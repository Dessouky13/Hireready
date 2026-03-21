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
    const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
    if (!FAL_API_KEY) throw new Error("FAL_API_KEY is not configured");

    const { interviewId } = await req.json();
    if (!interviewId) throw new Error("interviewId is required");

    // Fetch interview and verify ownership (IDOR prevention)
    const { data: interview, error: intErr } = await supabaseAdmin
      .from("interviews")
      .select("role, level, user_id")
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

    // Call Google AI via FAL — use prompt-based JSON approach (FAL doesn't support tool calling)
    const prompt = `[SYSTEM]
You are an expert interview coach analyzing a mock interview transcript. The candidate interviewed for the role of ${interview.role} at ${interview.level} level. Evaluate their performance thoroughly and provide actionable feedback.

[TRANSCRIPT]
${transcriptText}

[INSTRUCTION]
Analyze this interview transcript and generate a detailed performance report.
Respond ONLY with a valid JSON object (no markdown, no code fences, no extra text). The JSON must have these exact fields:
- "overall_score" (integer 0-100): Overall performance score
- "comm_score" (integer 0-100): Communication skills score
- "tech_score" (integer 0-100): Technical knowledge score
- "conf_score" (integer 0-100): Confidence and composure score
- "struct_score" (integer 0-100): Answer structure and organization score
- "clarity_score" (integer 0-100): Clarity of expression score
- "impact_score" (integer 0-100): Impact and persuasiveness score
- "strengths" (array of 3-5 strings): Specific strengths observed
- "weaknesses" (array of 3-5 strings): Specific areas for improvement
- "feedback_text" (string): Detailed paragraph of overall feedback (3-5 sentences)
- "roadmap" (array of 3-5 objects): Each with "title" (string), "desc" (string), "resource" (string) — actionable learning roadmap items`;

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
          prompt: prompt,
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
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
    // Try stripping markdown code fences
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
