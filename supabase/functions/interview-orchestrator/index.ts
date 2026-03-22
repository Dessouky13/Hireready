import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractText } from "npm:unpdf@0.12.1";

const ALLOWED_ORIGINS = [
  "https://hireready.coach",
  "https://www.hireready.coach",
  "https://hireready-one.vercel.app",
  "http://localhost:5173",
  "http://localhost:8080",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : "",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

const PHASE_ORDER = ["opening", "technical", "behavioral", "situational", "closing"];
const PHASE_QUESTIONS: Record<string, { min: number; max: number }> = {
  opening:     { min: 1, max: 2 },
  technical:   { min: 4, max: 6 },
  behavioral:  { min: 2, max: 3 },
  situational: { min: 1, max: 2 },
  closing:     { min: 1, max: 1 },
};

function buildSystemPrompt(
  role: string,
  level: string,
  phase: string,
  questionCount: number,
  runningScores: Record<string, number>,
  topicsCovered: string[],
  cvSummary: string | null,
  language: string
): string {
  const topicsStr = topicsCovered.length > 0
    ? `Topics already covered — do NOT repeat: ${topicsCovered.join(", ")}`
    : "No topics covered yet.";

  const cvSection = cvSummary
    ? `\n\nCANDIDATE CV:\n${cvSummary}\n\nCV RULES: Use the CV throughout. In Opening, reference their most recent company or a notable project. In Technical, ask about specific tools or projects on the CV. In Behavioral, reference team sizes or achievements. Do NOT recite the CV — use it to ask probing questions that verify the experience claimed.`
    : "\nNo CV uploaded. Ask general questions appropriate for the role and level.";

  const langInstruction = language === "ar"
    ? `\n\nLANGUAGE: Conduct this interview ENTIRELY in Modern Standard Arabic (فصحى). No English. Keep responses natural and conversational.`
    : `\n\nLANGUAGE: English only. Speak naturally and professionally.`;

  return `You are an experienced interviewer conducting a live voice mock interview for a ${level} candidate in the ${role} sector.

CURRENT STATE:
- Phase: ${phase.toUpperCase()} | Questions asked: ${questionCount}
- ${topicsStr}
${cvSection}
${langInstruction}

INTERVIEW PHASES:
1. OPENING (1-2 Qs): Warm greeting + briefly state the 5-section structure (Opening → Technical → Behavioral → Situational → Closing) in ONE sentence. Then ask "Tell me about yourself." Keep it under 60 words total. If CV provided, mention one specific thing from it.
2. TECHNICAL (4-6 Qs): Role-specific domain questions at ${level} difficulty. Reference CV details. Escalate if answers are strong (>80), simplify if weak (<50).
3. BEHAVIORAL (2-3 Qs): STAR-method questions — leadership, conflict, teamwork, failure.
4. SITUATIONAL (1-2 Qs): Hypothetical scenarios relevant to the ${role} sector.
5. CLOSING (1 Q): Warm wrap-up. Ask if they have questions. Offer brief encouragement.

ACTIVE LISTENING (critical): Always reference what the candidate just said. Pick up on specific details, probe vague answers, acknowledge strong points before moving on. Never ask a disconnected follow-up when there is a natural thread.

SCORING (per answer, 0-100): comm, tech, conf, struct, clarity, impact

OUTPUT RULES: You are speaking aloud. No bullet points, no markdown, no lists. Keep answers to 2-3 sentences maximum EXCEPT the opening greeting. Sound like a warm, professional human interviewer.`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Verify JWT
  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
  if (authErr || !user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const userId = user.id;

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const { interviewId, userMessage } = await req.json();
    if (!interviewId) throw new Error("interviewId is required");

    // ── Step 1: Load interview + state IN PARALLEL (saves ~200ms) ──
    const [interviewRes, stateRes] = await Promise.all([
      supabaseAdmin
        .from("interviews")
        .select("role, level, cv_url, user_id, language")
        .eq("id", interviewId)
        .single(),
      supabaseAdmin
        .from("interview_state")
        .select("*")
        .eq("interview_id", interviewId)
        .maybeSingle(),
    ]);

    const interview = interviewRes.data;
    if (interviewRes.error || !interview) {
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    }
    if (interview.user_id !== userId) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    let state = stateRes.data;

    // ── Step 2: First-call setup (credit deduction + CV parse) ──
    if (!state) {
      const { data: credited, error: creditErr } = await supabaseAdmin.rpc("deduct_credit", {
        p_user_id: userId,
      });
      if (creditErr || !credited) {
        return new Response(
          JSON.stringify({ error: "insufficient_credits" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let cvSummary: string | null = null;
      if (interview.cv_url) {
        try {
          const { data: fileData, error: dlErr } = await supabaseAdmin.storage
            .from("cvs")
            .download(interview.cv_url);
          if (!dlErr && fileData) {
            const buffer = await fileData.arrayBuffer();
            const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
            cvSummary = text || null;
            if (cvSummary && cvSummary.length > 4000) {
              cvSummary = cvSummary.substring(0, 4000) + "\n...[truncated]";
            }
          }
        } catch (e) {
          console.error("CV parse failed:", e);
        }
      }

      const { data: newState, error: createErr } = await supabaseAdmin
        .from("interview_state")
        .insert({
          interview_id: interviewId,
          current_phase: "opening",
          question_count: 0,
          running_scores: {},
          topics_covered: [],
          cv_summary: cvSummary,
        })
        .select()
        .single();

      if (createErr) throw new Error(`Failed to create state: ${createErr.message}`);
      state = newState;
    }

    // ── Step 3: Save user message + load history IN PARALLEL ──
    // We load history concurrently with saving the user message.
    // The current user message is appended manually below so order is correct.
    const [, { data: messages }] = await Promise.all([
      userMessage?.trim()
        ? supabaseAdmin.from("messages").insert({
            interview_id: interviewId,
            role: "user",
            content: userMessage.trim(),
          })
        : Promise.resolve({ data: null, error: null }),
      supabaseAdmin
        .from("messages")
        .select("role, content")
        .eq("interview_id", interviewId)
        .order("created_at", { ascending: true }),
    ]);

    // Build conversation history — exclude current user message (will append manually)
    const prevMessages = (messages || []).filter(
      (m) => !(m.role === "user" && m.content === userMessage?.trim())
    );
    const conversationHistory: { role: "user" | "assistant"; content: string }[] = prevMessages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    // ── Step 4: Build AI messages ──
    const systemPrompt = buildSystemPrompt(
      interview.role,
      interview.level,
      state.current_phase,
      state.question_count,
      state.running_scores as Record<string, number>,
      state.topics_covered as string[],
      state.cv_summary,
      interview.language || "en"
    );

    const aiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
    ];

    if (userMessage?.trim()) {
      // Append current user message so it's included even if DB save was concurrent
      if (!aiMessages.some((m) => m.role === "user" && m.content === userMessage.trim())) {
        aiMessages.push({ role: "user", content: userMessage.trim() });
      }
    } else {
      // First turn — inject a trigger message
      const cvHint = state.cv_summary
        ? `The candidate's CV is in the system prompt. Reference 1 specific detail (company, project, or skill) in your greeting.`
        : `No CV provided — give a warm general welcome.`;
      aiMessages.push({
        role: "user",
        content: `Start the interview now. Follow the OPENING phase instructions exactly: brief welcome + one-sentence structure overview + first question. Keep it under 70 words total. ${cvHint}`,
      });
    }

    // ── Step 5: Call OpenAI GPT-4o-mini with JSON mode ──
    // Much faster than FAL/Gemini routing: ~1-2s vs 5-8s
    const controller = new AbortController();
    const aiTimeout = setTimeout(() => controller.abort(), 30_000); // 30s hard timeout

    let aiResponse: Response;
    try {
      aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" }, // guaranteed JSON — no extraction hacks needed
          messages: aiMessages,
          temperature: 0.8,
          max_tokens: 600,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(aiTimeout);
    }

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("OpenAI error:", aiResponse.status, errText);
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "{}";

    let turnData: {
      next_question: string;
      phase: string;
      scores: Record<string, number>;
      follow_up: boolean;
      topic: string;
    };

    try {
      turnData = JSON.parse(rawContent);
    } catch {
      console.error("JSON parse failed:", rawContent.substring(0, 300));
      throw new Error("AI did not return valid JSON");
    }

    if (!turnData.next_question || !turnData.phase) {
      console.error("Missing fields in AI output:", turnData);
      throw new Error("AI output missing required fields");
    }

    // ── Step 6: Persist AI message + update state IN PARALLEL (saves ~200ms) ──
    const currentScores = (state.running_scores || {}) as Record<string, number[]>;
    const newScores = { ...currentScores };
    if (turnData.scores && Object.keys(turnData.scores).length > 0) {
      for (const [key, val] of Object.entries(turnData.scores)) {
        if (!newScores[key]) newScores[key] = [];
        (newScores[key] as number[]).push(val as number);
      }
    }

    const currentTopics = (state.topics_covered || []) as string[];
    const newTopics =
      turnData.topic && !turnData.follow_up && !currentTopics.includes(turnData.topic)
        ? [...currentTopics, turnData.topic]
        : currentTopics;

    // Advance phase if max questions reached
    let nextPhase = turnData.phase;
    const phaseConfig = PHASE_QUESTIONS[state.current_phase];
    const questionsInPhase =
      state.question_count -
      PHASE_ORDER.slice(0, PHASE_ORDER.indexOf(state.current_phase)).reduce(
        (sum, p) => sum + PHASE_QUESTIONS[p].max,
        0
      );
    if (questionsInPhase >= phaseConfig.max) {
      const currentIndex = PHASE_ORDER.indexOf(state.current_phase);
      if (currentIndex < PHASE_ORDER.length - 1) {
        nextPhase = PHASE_ORDER[currentIndex + 1];
      }
    }

    // Parallel write — don't block the response
    await Promise.all([
      supabaseAdmin.from("messages").insert({
        interview_id: interviewId,
        role: "assistant",
        content: turnData.next_question,
      }),
      supabaseAdmin
        .from("interview_state")
        .update({
          current_phase: nextPhase,
          question_count: state.question_count + 1,
          running_scores: newScores,
          topics_covered: newTopics,
          updated_at: new Date().toISOString(),
        })
        .eq("interview_id", interviewId),
    ]);

    return new Response(
      JSON.stringify({
        next_question: turnData.next_question,
        phase: nextPhase,
        question_count: state.question_count + 1,
        follow_up: turnData.follow_up,
        topic: turnData.topic,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Orchestrator error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
