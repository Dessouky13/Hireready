import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // JWT Authentication — userId always from token, never from request body
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
  if (authErr || !user) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }
  const userId = user.id; // Always from JWT

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const { interviewId } = await req.json();
    if (!interviewId) throw new Error("interviewId is required");

    // Fetch interview and verify ownership (IDOR prevention)
    const { data: interview, error: intErr } = await supabaseAdmin
      .from("interviews")
      .select("role, level, user_id, cv_url")
      .eq("id", interviewId)
      .single();

    if (intErr || !interview) {
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    }
    if (interview.user_id !== userId) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    // Fetch transcript messages
    const { data: messages, error: msgErr } = await supabaseAdmin
      .from("messages")
      .select("role, content")
      .eq("interview_id", interviewId)
      .order("created_at", { ascending: true });

    if (msgErr) throw new Error(`Failed to fetch messages: ${msgErr.message}`);
    if (!messages || messages.length === 0) throw new Error("No transcript found");

    const transcriptText = messages
      .map((m) => `${m.role === "assistant" ? "Interviewer" : "Candidate"}: ${m.content}`)
      .join("\n");

    // Fetch interview state for CV summary and running scores (if available)
    const { data: interviewState } = await supabaseAdmin
      .from("interview_state")
      .select("cv_summary, running_scores")
      .eq("interview_id", interviewId)
      .single();

    const cvContext = interviewState?.cv_summary
      ? `\n\nCANDIDATE CV/RESUME:\n${interviewState.cv_summary}\n\nUse this CV to evaluate whether the candidate's answers align with their stated experience. Note any gaps between what the CV claims and how the candidate performed.`
      : "";

    // Call OpenAI GPT-4o-mini with JSON mode for reliable structured output
    const systemPrompt = `You are a world-class interview coach and career advisor providing a comprehensive performance report. Your job is to deliver MAXIMUM VALUE — be specific, cite exact quotes from the transcript, and give actionable advice they can use TODAY.`;

    const userPrompt = `The candidate just completed a mock interview for a ${interview.level} ${interview.role} position.
${cvContext}

[TRANSCRIPT]
${transcriptText}

[INSTRUCTION]
Analyze every single answer in this transcript. For each scoring dimension, reference specific moments from the interview. Be brutally honest but constructive.

Respond ONLY with a valid JSON object. The JSON must have these exact fields:

- "overall_score" (integer 0-100): Weighted overall score. Be calibrated: 90+ is exceptional (top 5%), 70-89 is good, 50-69 needs work, below 50 is poor.

- "comm_score" (integer 0-100): Communication — Did they speak clearly? Were answers concise or rambling? Did they use filler words excessively?

- "tech_score" (integer 0-100): Technical/Domain Knowledge — Were their answers technically accurate? Did they demonstrate real depth or just surface knowledge?

- "conf_score" (integer 0-100): Confidence & Composure — Did they sound confident? How did they handle difficult questions? Did they panic or stay composed?

- "struct_score" (integer 0-100): Answer Structure — Did they use frameworks like STAR? Were answers logically organized or scattered?

- "clarity_score" (integer 0-100): Clarity of Thought — Could you follow their reasoning? Did they answer the actual question asked?

- "impact_score" (integer 0-100): Impact & Persuasiveness — Did they give concrete examples? Did they quantify results? Would you be convinced to hire them?

- "strengths" (array of 3-5 objects, each with "title" and "detail"):
  - "title": Short strength label (e.g., "Strong Technical Foundation")
  - "detail": 2-3 sentences explaining this strength with a SPECIFIC example or quote from the interview.

- "weaknesses" (array of 3-5 objects, each with "title" and "detail" and "how_to_fix"):
  - "title": Short weakness label (e.g., "Vague on Metrics")
  - "detail": 2-3 sentences explaining the weakness with a specific example from the interview
  - "how_to_fix": One concrete, actionable tip to fix this.

- "feedback_text" (string): A thorough 5-8 sentence overall assessment. Start with what they did well. Then address the biggest improvement area. End with encouragement and a specific next step. Write as if you're a senior mentor giving candid but supportive feedback.

- "roadmap" (array of 4-6 objects): A personalized learning plan based on their ACTUAL weaknesses. Each with:
  - "title": Action item title (e.g., "Master the STAR Method")
  - "desc": 2-3 sentences explaining WHY this matters for them specifically and HOW to practice it.
  - "resource": A specific, real resource — e.g., "Book: 'Cracking the Coding Interview' by Gayle McDowell" or "YouTube: 'Interview tips by Jeff Su'" or "Practice: Do 5 mock behavioral questions using STAR format this week".

QUALITY RULES:
- Every strength and weakness MUST reference something specific the candidate actually said or did
- Scores must be calibrated to real interview standards — don't inflate
- Roadmap items must be personalized to THIS candidate's gaps, not generic advice
- If a CV was provided, note whether the candidate's performance matched their CV claims`;

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("OpenAI error:", aiResponse.status, errText);
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const rawOutput = aiResult.choices?.[0]?.message?.content || "";
    console.log("Raw AI output length:", rawOutput.length, "first 200 chars:", rawOutput.substring(0, 200));

    let reportData;
    try {
      reportData = JSON.parse(rawOutput);
    } catch (parseErr) {
      console.error("Failed to parse AI output as JSON:", rawOutput.substring(0, 500));
      throw new Error("AI did not return valid JSON");
    }

    if (!reportData.overall_score || !reportData.feedback_text) {
      console.error("AI output missing required fields:", reportData);
      throw new Error("AI output missing required fields");
    }

    // Save report — await this to ensure it's written before returning
    const { data: savedReport, error: saveErr } = await supabaseAdmin
      .from("reports")
      .insert({
        interview_id: interviewId,
        user_id: userId, // From JWT, not request body
        overall_score: reportData.overall_score,
        comm_score: reportData.comm_score,
        tech_score: reportData.tech_score,
        conf_score: reportData.conf_score,
        struct_score: reportData.struct_score,
        clarity_score: reportData.clarity_score,
        impact_score: reportData.impact_score,
        strengths: reportData.strengths,
        weaknesses: reportData.weaknesses,
        feedback_text: reportData.feedback_text,
        roadmap: reportData.roadmap,
      })
      .select("id")
      .single();

    if (saveErr) throw new Error(`Failed to save report: ${saveErr.message}`);

    return new Response(JSON.stringify({ success: true, reportId: savedReport.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Report generation error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
