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
  opening: { min: 1, max: 2 },
  technical: { min: 4, max: 6 },
  behavioral: { min: 2, max: 3 },
  situational: { min: 1, max: 2 },
  closing: { min: 1, max: 1 },
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
  const scoresStr = Object.keys(runningScores).length > 0
    ? `Current running scores: ${JSON.stringify(runningScores)}`
    : "No scores yet (first question).";

  const topicsStr = topicsCovered.length > 0
    ? `Topics already covered (do NOT repeat): ${topicsCovered.join(", ")}`
    : "No topics covered yet.";

  const cvSection = cvSummary
    ? `\n\nCANDIDATE CV/RESUME:\n${cvSummary}\n\nCV-BASED INTERVIEWING (CRITICAL):
You have the candidate's actual CV above. You MUST use it extensively throughout the interview:
- In the OPENING phase, reference their most recent role or a notable achievement from the CV: "I see you worked at [Company] as a [Role] — tell me about that experience."
- In the TECHNICAL phase, ask about specific technologies, projects, or tools listed on their CV: "Your CV mentions [specific project/tech] — can you walk me through how you implemented that?"
- In the BEHAVIORAL phase, reference team sizes, leadership roles, or achievements from the CV: "You led a team of X people at [Company] — tell me about a time that was challenging."
- If the candidate's answers contradict or don't align with their CV, gently probe: "Interesting — your CV mentions [X], could you elaborate on your role in that?"
- Do NOT just read the CV back to them — use it to ask deeper, personalized questions that test whether they truly have the experience they claim.`
    : "\nNo CV provided. Ask general questions appropriate for the role and level.";

  const langInstruction = language === "ar"
    ? `\n\nLANGUAGE: Conduct this interview ENTIRELY in Modern Standard Arabic (فصحى). Ask all questions in Arabic. Do NOT mix languages. Keep responses concise and conversational.`
    : `\n\nLANGUAGE: Conduct this interview in clear, professional English.`;

  const arabicKeywords = [
    "arabic", "عربي", "middle east", "mena", "gcc", "saudi", "uae", "dubai", "qatar", "kuwait", "bahrain", "oman",
    "jordan", "egypt", "lebanon", "morocco", "customer service", "support", "sales", "marketing", "content",
    "copywriter", "translator", "teacher", "recruiter", "hr", "public relations", "communications",
  ];
  const roleLower = role.toLowerCase();
  const cvLower = (cvSummary || "").toLowerCase();
  const mightInvolveArabic = language !== "ar" && arabicKeywords.some(kw => roleLower.includes(kw) || cvLower.includes(kw));

  const arabicSection = mightInvolveArabic
    ? `\n\nARABIC LANGUAGE TESTING:\nThis role may involve Arabic language skills. During the interview (especially in Technical or Behavioral phases), occasionally ask 1-2 questions where you request the candidate to answer in Arabic. Frame it naturally. Do this 1-2 times during the interview, not every question.`
    : "";

  return `You are a professional, experienced interviewer conducting a mock interview for a ${level} ${role} position.

CURRENT STATE:
- Interview Phase: ${phase.toUpperCase()}
- Questions asked so far: ${questionCount}
- ${scoresStr}
- ${topicsStr}
${cvSection}
${langInstruction}
${arabicSection}

INTERVIEW METHODOLOGY:

PHASE DESCRIPTIONS:
1. OPENING (1-2 questions): Start with a WARM, PERSONALIZED welcome. If a CV is provided, reference something specific from it in your greeting (their recent company, a notable project, a key skill). Make the candidate feel like you've actually read their background. Then ask "Tell me about yourself", motivation for this role, or career goals. Be genuinely warm, friendly, and encouraging — like a real interviewer who's excited to meet them.
2. TECHNICAL (4-6 questions): Role-specific technical/domain questions. Calibrate difficulty to ${level} level. If previous answer scored below 50, ask a simpler follow-up. If above 80, escalate difficulty.
3. BEHAVIORAL (2-3 questions): Use the STAR method framework. Ask about leadership, conflict resolution, teamwork, failure handling.
4. SITUATIONAL (1-2 questions): Present hypothetical scenarios relevant to the ${role} role at ${level} level.
5. CLOSING (1 question): Wrap up warmly. Ask if the candidate has questions, provide brief encouragement.

ACTIVE LISTENING & CONTEXTUAL FOLLOW-UPS (CRITICAL):
You MUST actively listen to and reference the candidate's previous answers when forming your next question. This is what separates a great interviewer from a robotic one. Specifically:
- Pick up on specific technologies, projects, companies, or experiences the candidate mentioned and ask deeper questions about them. Example: if they say "I led a migration to microservices", follow up with "Tell me more about that migration — what was the biggest challenge you faced?"
- If the candidate mentions a metric or result, probe deeper: "You mentioned a 40% performance improvement — walk me through what you measured and how you achieved that."
- If the candidate mentions a team, ask about their specific role: "You said your team handled this — what was your individual contribution?"
- If the candidate gives a vague answer, don't just move on — ask them to be more specific: "Can you give me a concrete example of that?" or "What did that actually look like in practice?"
- Reference their earlier answers in later questions to show continuity: "Earlier you mentioned X — how does that relate to your approach here?"
- When transitioning between phases, bridge naturally using something from their last answer: "That's a great point about [thing they said]. Let me shift gears and ask you about..."
- NEVER ask a completely disconnected question when there's a natural thread to follow from their answer.

ADAPTIVE DIFFICULTY:
- If a candidate's answer is vague or weak (you'd score it below 50), ask a probing follow-up on the SAME topic before moving on.
- If an answer is strong (above 80), acknowledge what was good about it specifically, then escalate to a harder related topic.
- Never repeat a topic already covered.

SCORING RUBRIC (score each answer 0-100):
- comm: Communication clarity, articulation, conciseness
- tech: Technical accuracy and depth
- conf: Confidence, composure, professionalism
- struct: Answer structure (STAR method usage, logical flow)
- clarity: Clarity of thought and expression
- impact: Persuasiveness, concrete examples, measurable results

IMPORTANT: You are having a voice conversation. Keep your questions natural, conversational, and concise (2-3 sentences max). Do NOT use bullet points, markdown, or lists in your spoken question. Sound like a real human interviewer — react to what the candidate says, not like you're reading from a script.`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // JWT Authentication — extract userId from token, never from request body
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth client (user-scoped, for JWT verification only)
  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
  if (authErr || !user) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }
  const userId = user.id; // Always from JWT — never trust request body

  // Admin client for DB operations
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
    if (!FAL_API_KEY) throw new Error("FAL_API_KEY is not configured");

    const { interviewId, userMessage } = await req.json();
    if (!interviewId) throw new Error("interviewId is required");

    // 0. Rate limiting — 20 requests per user per minute
    const windowStart = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
    const { data: withinLimit } = await supabaseAdmin.rpc("increment_rate_limit", {
      p_key: `orchestrator:${userId}`,
      p_window_start: windowStart,
      p_limit: 20,
    });
    if (!withinLimit) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Load interview and verify IDOR (ownership check)
    const { data: interview, error: intErr } = await supabaseAdmin
      .from("interviews")
      .select("role, level, cv_url, user_id, language")
      .eq("id", interviewId)
      .single();

    if (intErr || !interview) {
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    }
    // IDOR prevention: ensure this interview belongs to the authenticated user
    if (interview.user_id !== userId) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    // 2. Load or create interview state
    let { data: state } = await supabaseAdmin
      .from("interview_state")
      .select("*")
      .eq("interview_id", interviewId)
      .single();

    if (!state) {
      // First call — deduct credit atomically BEFORE starting interview
      const { data: credited, error: creditErr } = await supabaseAdmin.rpc("deduct_credit", {
        p_user_id: userId,
      });
      if (creditErr || !credited) {
        return new Response(
          JSON.stringify({ error: "insufficient_credits" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Parse CV if provided
      let cvSummary: string | null = null;
      if (interview.cv_url) {
        try {
          const { data: fileData } = await supabaseAdmin.storage
            .from("cvs")
            .download(interview.cv_url);
          if (fileData) {
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

    // 3. Save user message if provided
    if (userMessage && userMessage.trim()) {
      await supabaseAdmin.from("messages").insert({
        interview_id: interviewId,
        role: "user",
        content: userMessage.trim(),
      });
    }

    // 4. Load conversation history
    const { data: messages } = await supabaseAdmin
      .from("messages")
      .select("role, content")
      .eq("interview_id", interviewId)
      .order("created_at", { ascending: true });

    const conversationHistory = (messages || []).map((m) => ({
      role: m.role === "assistant" ? "assistant" as const : "user" as const,
      content: m.content,
    }));

    // 5. Build system prompt
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

    // 6. Call Google AI directly (not through Lovable gateway)
    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
    ];

    if (!userMessage || !userMessage.trim()) {
      const cvHint = state.cv_summary
        ? `The candidate's CV has been provided in the system prompt. In your greeting, reference 1-2 specific things from their CV (e.g., their most recent company/role, a notable skill, or a standout project) to show you've reviewed their background. Example: "Hi [implied name]! Thanks for joining me today. I've had a chance to look over your background — I see you've been working as a [Role] at [Company], and your experience with [specific tech/project] really caught my eye. I'm excited to learn more about your journey. Let's start with — tell me a bit about yourself and what drew you to this field."`
        : "No CV was provided, so just give a friendly, warm greeting and ask a general opening question like 'Tell me about yourself'.";
      aiMessages.push({
        role: "user",
        content: `The interview is starting now. Please greet the candidate warmly and ask your first opening question.\n\nIMPORTANT: ${cvHint}`,
      });
    }

    // Build a single prompt string from system + conversation messages
    const promptParts = aiMessages.map((m) =>
      m.role === "system" ? `[SYSTEM]\n${m.content}` :
      m.role === "assistant" ? `[INTERVIEWER]\n${m.content}` :
      `[CANDIDATE]\n${m.content}`
    );
    promptParts.push(`\n[INSTRUCTION]\nRespond ONLY with a valid JSON object (no markdown, no code fences, no extra text). The JSON must have these fields:
- "next_question" (string): Your next spoken question/response. Keep it natural and conversational (2-3 sentences max).
- "phase" (string): One of ${JSON.stringify(PHASE_ORDER)}. The current or next interview phase.
- "scores" (object): Scores for the candidate's last answer with keys: comm, tech, conf, struct, clarity, impact (each 0-100 integer). Use empty object {} if this is the first question.
- "follow_up" (boolean): Whether this is a follow-up probe on the same topic.
- "topic" (string): The topic/subject of this question.`);

    const aiResponse = await fetch(
      "https://fal.run/fal-ai/any-llm",
      {
        method: "POST",
        headers: {
          Authorization: `Key ${FAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          prompt: promptParts.join("\n\n"),
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("FAL AI error:", aiResponse.status, errText);
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    let rawOutput = (aiResult.output || "").trim();
    console.log("Raw AI output length:", rawOutput.length, "first 200 chars:", rawOutput.substring(0, 200));
    
    // Robust JSON extraction — handle code fences, surrounding text, etc.
    const fenceMatch = rawOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenceMatch) {
      rawOutput = fenceMatch[1].trim();
    }
    // If still not starting with {, try to find the JSON object
    if (!rawOutput.startsWith("{")) {
      const jsonStart = rawOutput.indexOf("{");
      const jsonEnd = rawOutput.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        rawOutput = rawOutput.substring(jsonStart, jsonEnd + 1);
      }
    }

    let turnData;
    try {
      turnData = JSON.parse(rawOutput);
    } catch (parseErr) {
      console.error("Failed to parse AI output as JSON:", rawOutput.substring(0, 500));
      throw new Error("AI did not return valid JSON");
    }

    if (!turnData.next_question || !turnData.phase) {
      console.error("AI output missing required fields:", turnData);
      throw new Error("AI output missing required fields");
    }

    // 7. Save AI question to messages
    await supabaseAdmin.from("messages").insert({
      interview_id: interviewId,
      role: "assistant",
      content: turnData.next_question,
    });

    // 8. Update interview state
    const currentScores = (state.running_scores || {}) as Record<string, number[]>;
    const newScores = { ...currentScores };
    if (turnData.scores && Object.keys(turnData.scores).length > 0) {
      for (const [key, val] of Object.entries(turnData.scores)) {
        if (!newScores[key]) newScores[key] = [];
        (newScores[key] as number[]).push(val as number);
      }
    }

    const currentTopics = (state.topics_covered || []) as string[];
    const newTopics = turnData.topic && !turnData.follow_up && !currentTopics.includes(turnData.topic)
      ? [...currentTopics, turnData.topic]
      : currentTopics;

    let nextPhase = turnData.phase;
    const phaseConfig = PHASE_QUESTIONS[state.current_phase];
    const questionsInPhase = state.question_count - (
      PHASE_ORDER.slice(0, PHASE_ORDER.indexOf(state.current_phase))
        .reduce((sum, p) => sum + PHASE_QUESTIONS[p].max, 0)
    );

    if (questionsInPhase >= phaseConfig.max) {
      const currentIndex = PHASE_ORDER.indexOf(state.current_phase);
      if (currentIndex < PHASE_ORDER.length - 1) {
        nextPhase = PHASE_ORDER[currentIndex + 1];
      }
    }

    await supabaseAdmin
      .from("interview_state")
      .update({
        current_phase: nextPhase,
        question_count: state.question_count + 1,
        running_scores: newScores,
        topics_covered: newTopics,
        updated_at: new Date().toISOString(),
      })
      .eq("interview_id", interviewId);

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
