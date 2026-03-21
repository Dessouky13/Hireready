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

    // Call Google AI directly
    const aiResponse = await fetch(
      "https://fal.run/fal-ai/any-llm",
      {
        method: "POST",
        headers: {
          Authorization: `Key ${FAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-flash-2.0",
          messages: [
            {
              role: "system",
              content: `You are an expert interview coach analyzing a mock interview transcript. The candidate interviewed for the role of ${interview.role} at ${interview.level} level. Evaluate their performance thoroughly and provide actionable feedback.`,
            },
            {
              role: "user",
              content: `Analyze this interview transcript and generate a detailed performance report:\n\n${transcriptText}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "generate_report",
                description: "Generate a structured interview performance report.",
                parameters: {
                  type: "object",
                  properties: {
                    overall_score: { type: "integer", description: "Overall performance score 0-100" },
                    comm_score: { type: "integer", description: "Communication skills score 0-100" },
                    tech_score: { type: "integer", description: "Technical knowledge score 0-100" },
                    conf_score: { type: "integer", description: "Confidence and composure score 0-100" },
                    struct_score: { type: "integer", description: "Answer structure and organization score 0-100" },
                    clarity_score: { type: "integer", description: "Clarity of expression score 0-100" },
                    impact_score: { type: "integer", description: "Impact and persuasiveness score 0-100" },
                    strengths: {
                      type: "array",
                      items: { type: "string" },
                      description: "3-5 specific strengths observed",
                    },
                    weaknesses: {
                      type: "array",
                      items: { type: "string" },
                      description: "3-5 specific areas for improvement",
                    },
                    feedback_text: {
                      type: "string",
                      description: "A detailed paragraph of overall feedback (3-5 sentences)",
                    },
                    roadmap: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          desc: { type: "string" },
                          resource: { type: "string" },
                        },
                        required: ["title", "desc", "resource"],
                        additionalProperties: false,
                      },
                      description: "3-5 actionable learning roadmap items",
                    },
                  },
                  required: [
                    "overall_score", "comm_score", "tech_score", "conf_score",
                    "struct_score", "clarity_score", "impact_score",
                    "strengths", "weaknesses", "feedback_text", "roadmap",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "generate_report" } },
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
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured output");
    }

    const reportData = JSON.parse(toolCall.function.arguments);

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
