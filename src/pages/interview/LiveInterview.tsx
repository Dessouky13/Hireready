import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Mic, MicOff, PhoneOff, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import VoiceVisualizer from "@/components/interview/VoiceVisualizer";
import InterviewTopBar from "@/components/interview/InterviewTopBar";
import { track, Events } from "@/lib/analytics";
import { Link } from "react-router-dom";

type TranscriptEntry = { role: "ai" | "user"; text: string };

const PHASE_LABELS: Record<string, string> = {
  opening: "Opening",
  technical: "Technical Deep-dive",
  behavioral: "Behavioral",
  situational: "Situational",
  closing: "Closing",
};

const LiveInterview = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [interviewData, setInterviewData] = useState<{ role: string; level: string } | null>(null);
  const [currentPhase, setCurrentPhase] = useState("opening");
  const [questionCount, setQuestionCount] = useState(0);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [textFallback, setTextFallback] = useState<string | null>(null);
  const [insufficientCredits, setInsufficientCredits] = useState(false);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const endingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const userSpeechBuffer = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("interviews")
      .select("role, level")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (data) setInterviewData(data);
      });
  }, [id]);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      userSpeechBuffer.current = data.text;
    },
    onCommittedTranscript: (data) => {
      if (!data.text.trim() || aiSpeaking || processing) return;
      const text = data.text.trim();
      userSpeechBuffer.current = "";

      setTranscript((prev) => [...prev, { role: "user", text }]);

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        handleUserTurn(text);
      }, 1200);
    },
  });

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    if (!interviewStarted) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleEndInterview();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [interviewStarted]);

  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ latencyHint: "interactive" });
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const unlockAudio = useCallback(async () => {
    await ensureAudioContext();
  }, [ensureAudioContext]);

  const playTTS = useCallback(async (text: string): Promise<void> => {
    setAiSpeaking(true);
    setTextFallback(null);
    try {
      const audioContext = await ensureAudioContext();
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts-stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ text }),
        }
      );

      if (!response.ok) {
        throw new Error(`TTS failed: ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      if (audioBuffer.byteLength === 0) {
        throw new Error("Empty audio response");
      }

      try {
        const decoded = await audioContext.decodeAudioData(audioBuffer.slice(0));
        await new Promise<void>((resolve) => {
          const source = audioContext.createBufferSource();
          source.buffer = decoded;
          source.connect(audioContext.destination);
          audioSourceRef.current = source;
          source.onended = () => {
            if (audioSourceRef.current === source) audioSourceRef.current = null;
            resolve();
          };
          source.start(0);
        });
      } catch (decodeError) {
        const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.volume = 1.0;
        audioRef.current = audio;

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => { URL.revokeObjectURL(audioUrl); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(audioUrl); reject(new Error("Audio playback failed")); };
          audio.play().catch((e) => { URL.revokeObjectURL(audioUrl); reject(e); });
        });
      }
    } catch (e) {
      console.error("TTS playback error:", e);
      // Text fallback — never drop the user mid-interview
      setTextFallback(text);
      toast.error("Audio unavailable — question shown as text below.");
    } finally {
      setAiSpeaking(false);
      audioRef.current = null;
    }
  }, [ensureAudioContext]);

  const callOrchestrator = useCallback(async (userMessage?: string) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("interview-orchestrator", {
        body: { interviewId: id, userMessage: userMessage || "" },
      });

      if (error) {
        // Handle insufficient credits — server deducts on first call
        if (error.message?.includes("insufficient_credits") || (error as any)?.context?.status === 402) {
          setInsufficientCredits(true);
          toast.error("Insufficient credits. Please buy more to continue.");
          return;
        }
        throw error;
      }
      if (!data?.next_question) throw new Error("No question returned");

      setCurrentPhase(data.phase || "opening");
      setQuestionCount(data.question_count || 0);
      setTranscript((prev) => [...prev, { role: "ai", text: data.next_question }]);
      await playTTS(data.next_question);
    } catch (e) {
      console.error("Orchestrator error:", e);
      toast.error("Failed to get next question. Please try again.");
    } finally {
      setProcessing(false);
    }
  }, [id, playTTS]);

  const handleUserTurn = useCallback(async (text: string) => {
    await callOrchestrator(text);
  }, [callOrchestrator]);

  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    try {
      await unlockAudio();
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
      if (error || !data?.token) {
        if (error?.message?.includes("insufficient_credits")) {
          setInsufficientCredits(true);
          toast.error("Insufficient credits. Please buy more credits to start.");
          return;
        }
        throw new Error("No scribe token received");
      }

      await scribe.connect({
        token: data.token,
        microphone: { echoCancellation: true, noiseSuppression: true },
      });

      setInterviewStarted(true);
      toast.success("Connected! Starting interview...");
      await callOrchestrator();
    } catch (error) {
      console.error("Failed to start conversation:", error);
      toast.error("Failed to connect. Please check microphone permissions.");
    } finally {
      setIsConnecting(false);
    }
  }, [scribe, callOrchestrator, unlockAudio]);

  const handleEndInterview = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;

    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch { /* already ended */ }
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

    scribe.disconnect();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    track(Events.INTERVIEW_COMPLETED, { phase: currentPhase, questionCount });
    toast.success("Great work! Processing results...");

    if (id) {
      try {
        await supabase
          .from("interviews")
          .update({ status: "completed", ended_at: new Date().toISOString() })
          .eq("id", id);

        // Generate AI report — userId extracted from JWT server-side
        supabase.functions
          .invoke("generate-report", { body: { interviewId: id } })
          .then(({ error: reportErr }) => {
            if (reportErr) console.error("Report generation failed:", reportErr);
          });
      } catch (e) {
        console.error("End interview error:", e);
      }
    }

    navigate(`/report/${id || "demo"}`);
  }, [scribe, navigate, id, currentPhase, questionCount]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    toast.info(isMuted ? "Microphone unmuted" : "Microphone muted");
  }, [isMuted]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Insufficient credits screen
  if (insufficientCredits) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8 text-center">
        <div className="neo-card max-w-md bg-coral/10 p-8">
          <h2 className="mb-2 font-heading text-2xl font-bold text-coral">Out of Credits</h2>
          <p className="mb-6 text-muted-foreground">
            You need at least 1 credit to start an interview. Buy more credits to continue practicing.
          </p>
          <div className="flex flex-col gap-3">
            <Link to="/pricing" className="neo-btn bg-primary text-primary-foreground w-full text-center">
              Buy Credits
            </Link>
            <Link to="/dashboard" className="neo-btn bg-background text-foreground w-full text-center">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-ink text-foreground">
      <InterviewTopBar
        timeLeft={timeLeft}
        formatTime={formatTime}
        interviewStarted={interviewStarted}
        onEnd={handleEndInterview}
      />

      <div className="flex flex-1 flex-col items-center justify-center gap-8 overflow-hidden px-4">
        {!interviewStarted ? (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-primary/20">
              <Mic className="h-16 w-16 text-primary" />
            </div>
            <h1 className="font-heading text-3xl font-bold text-primary-foreground">
              Ready for your interview?
            </h1>
            {interviewData && (
              <p className="text-sm font-medium text-primary">
                {interviewData.role} · {interviewData.level}
              </p>
            )}
            <p className="max-w-md text-sm text-primary-foreground/60">
              This is a voice-only interview powered by advanced AI. The interviewer will adapt
              questions based on your answers, just like a real interview.
              {interviewData && " Your CV has been shared with the interviewer."}
            </p>
            <button
              onClick={startConversation}
              disabled={isConnecting}
              className="neo-btn bg-primary px-8 py-4 text-lg font-bold text-primary-foreground disabled:opacity-50"
            >
              {isConnecting ? "Connecting..." : "Join Interview"}
            </button>
          </div>
        ) : (
          <div className="flex w-full max-w-4xl flex-1 flex-col items-center gap-6">
            {/* Phase indicator */}
            <div className="flex items-center gap-3">
              <span className="rounded-md border border-foreground/20 bg-foreground/10 px-3 py-1 text-xs font-semibold text-primary-foreground/70">
                {PHASE_LABELS[currentPhase] || currentPhase} · Q{questionCount}
              </span>
              {processing && (
                <span className="text-xs text-primary-foreground/50 animate-pulse">Thinking...</span>
              )}
            </div>

            {/* Participant cards */}
            <div className="flex flex-1 items-center justify-center gap-8">
              <div className="flex flex-col items-center gap-4">
                <div
                  className={`relative flex h-40 w-40 items-center justify-center rounded-full transition-all duration-300 ${
                    aiSpeaking ? "bg-primary/30 ring-4 ring-primary ring-offset-4 ring-offset-ink" : "bg-foreground/10"
                  }`}
                >
                  <span className="text-5xl">🤖</span>
                  {aiSpeaking && <VoiceVisualizer isActive={true} color="primary" />}
                </div>
                <div className="text-center">
                  <p className="font-heading text-sm font-bold text-primary-foreground">AI Interviewer</p>
                  <p className="text-xs text-primary-foreground/50">
                    {aiSpeaking ? "Speaking..." : processing ? "Thinking..." : "Listening"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-4">
                <div
                  className={`relative flex h-40 w-40 items-center justify-center rounded-full transition-all duration-300 ${
                    !aiSpeaking && !isMuted && !processing
                      ? "bg-accent/30 ring-4 ring-accent ring-offset-4 ring-offset-ink"
                      : "bg-foreground/10"
                  }`}
                >
                  <span className="text-5xl">👤</span>
                  {!aiSpeaking && !isMuted && !processing && (
                    <VoiceVisualizer isActive={true} color="accent" />
                  )}
                </div>
                <div className="text-center">
                  <p className="font-heading text-sm font-bold text-primary-foreground">You</p>
                  <p className="text-xs text-primary-foreground/50">
                    {isMuted ? "Muted" : aiSpeaking ? "Waiting..." : processing ? "Waiting..." : "Your turn"}
                  </p>
                </div>
              </div>
            </div>

            {/* TTS text fallback */}
            {textFallback && (
              <div className="w-full max-w-2xl rounded-xl border-2 border-primary/30 bg-primary/10 p-4">
                <div className="mb-1 flex items-center gap-2">
                  <VolumeX className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-primary">Audio unavailable — read the question below:</span>
                </div>
                <p className="text-sm text-primary-foreground">{textFallback}</p>
              </div>
            )}

            {/* Live transcript */}
            <div className="w-full max-w-2xl rounded-xl bg-foreground/5 p-4">
              <div className="max-h-32 overflow-y-auto">
                {transcript.length === 0 ? (
                  <p className="text-center text-xs text-primary-foreground/40">
                    Live captions will appear here...
                  </p>
                ) : (
                  transcript.slice(-4).map((t, i) => (
                    <p key={i} className="mb-1 text-xs text-primary-foreground/70">
                      <span className="font-bold text-primary-foreground/90">
                        {t.role === "ai" ? "🤖 " : "You: "}
                      </span>
                      {t.text}
                    </p>
                  ))
                )}
                <div ref={transcriptEndRef} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      {interviewStarted && (
        <div className="flex items-center justify-center gap-4 border-t border-foreground/10 py-5">
          <button
            onClick={toggleMute}
            className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
              isMuted
                ? "bg-destructive text-destructive-foreground"
                : "bg-foreground/10 text-primary-foreground hover:bg-foreground/20"
            }`}
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </button>
          <button
            onClick={handleEndInterview}
            className="flex h-14 w-20 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <PhoneOff className="h-6 w-6" />
          </button>
        </div>
      )}
    </div>
  );
};

export default LiveInterview;
