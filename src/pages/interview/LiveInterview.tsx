import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Mic, MicOff, PhoneOff, VolumeX, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import AIOrb from "@/components/interview/AIOrb";
import InterviewTopBar from "@/components/interview/InterviewTopBar";
import { track, Events } from "@/lib/analytics";
import { Link } from "react-router-dom";

type TranscriptEntry = { role: "ai" | "user"; text: string };

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
  const busyRef = useRef(false); // concurrency guard — prevents overlapping AI turns

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
      if (!data.text.trim() || busyRef.current) return;
      const text = data.text.trim();

      // Accumulate speech segments — don't send each one individually
      userSpeechBuffer.current = userSpeechBuffer.current
        ? `${userSpeechBuffer.current} ${text}`
        : text;

      setTranscript((prev) => [...prev, { role: "user", text }]);

      // Reset the silence timer — send accumulated speech after 1.5s of silence
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        const accumulated = userSpeechBuffer.current.trim();
        userSpeechBuffer.current = "";
        if (accumulated) handleUserTurn(accumulated);
      }, 1500);
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
    // Preload browser speech voices for fallback TTS
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }, [ensureAudioContext]);

  const playBrowserTTS = useCallback((text: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (!window.speechSynthesis) {
        resolve(); // gracefully degrade — text fallback will handle it
        return;
      }
      // Cancel any pending speech first
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Pick best English voice available
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Google") || v.name.includes("Microsoft") || v.name.includes("Samantha") || v.name.includes("Daniel"))
      ) || voices.find((v) => v.lang.startsWith("en"));
      if (preferred) utterance.voice = preferred;

      utterance.onend = () => resolve();
      // "interrupted" is expected when we cancel — never reject on it
      utterance.onerror = (e) => {
        if (e.error === "interrupted" || e.error === "canceled") {
          resolve();
        } else {
          console.warn("Browser TTS error:", e.error);
          resolve(); // still resolve — text fallback handles display
        }
      };
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const playTTS = useCallback(async (text: string): Promise<void> => {
    setAiSpeaking(true);
    setTextFallback(null);

    // Go straight to browser speech synthesis (ElevenLabs TTS is blocked on free tier from cloud).
    // This avoids the wasted 2-3s HTTP call that always returns 500.
    try {
      await playBrowserTTS(text);
    } catch {
      // Browser TTS failed — show text on screen as last resort
      setTextFallback(text);
    } finally {
      setAiSpeaking(false);
    }
  }, [playBrowserTTS]);

  const callOrchestrator = useCallback(async (userMessage?: string) => {
    // Concurrency guard — only one AI turn can run at a time
    if (busyRef.current) return;
    busyRef.current = true;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("interview-orchestrator", {
        body: { interviewId: id, userMessage: userMessage || "" },
      });

      if (error) {
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
      busyRef.current = false;
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
    if (window.speechSynthesis) window.speechSynthesis.cancel();

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink p-8 text-center">
        <div className="relative max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-10 backdrop-blur-xl">
          <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-coral/20 blur-[60px]" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-coral/20">
              <span className="text-3xl">💳</span>
            </div>
            <h2 className="mb-2 font-heading text-2xl font-bold text-white">Out of Credits</h2>
            <p className="mb-8 font-body text-sm text-white/50">
              You need at least 1 credit to start an interview. Buy more credits to continue practicing.
            </p>
            <div className="flex flex-col gap-3">
              <Link
                to="/pricing"
                className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-heading text-sm font-bold uppercase tracking-wide text-white transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25"
              >
                Buy Credits
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/dashboard"
                className="flex items-center justify-center rounded-full border border-white/10 px-6 py-3 font-heading text-sm font-bold uppercase tracking-wide text-white/70 transition-all hover:bg-white/5"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Derive orb state
  const orbState: "idle" | "listening" | "thinking" | "speaking" = aiSpeaking
    ? "speaking"
    : processing
    ? "thinking"
    : interviewStarted
    ? "listening"
    : "idle";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink">
      {/* Ambient background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-80 w-80 rounded-full bg-primary/[0.07] blur-[100px]" />
        <div className="absolute -right-40 top-1/3 h-72 w-72 rounded-full bg-purple/[0.06] blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-accent/[0.04] blur-[100px]" />
      </div>

      <InterviewTopBar
        timeLeft={timeLeft}
        formatTime={formatTime}
        interviewStarted={interviewStarted}
        onEnd={handleEndInterview}
        phase={currentPhase}
        questionCount={questionCount}
      />

      <div className="relative flex flex-1 flex-col items-center justify-center px-4">
        {!interviewStarted ? (
          /* ─── PRE-INTERVIEW LOBBY ─── */
          <div className="flex flex-col items-center gap-8 text-center animate-fadeUp">
            <AIOrb state="idle" size={160} />

            <div className="max-w-lg">
              <h1 className="mb-2 font-heading text-3xl font-bold tracking-tight text-white md:text-4xl">
                Ready when you are
              </h1>
              {interviewData && (
                <div className="mb-3 flex items-center justify-center gap-2">
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-heading text-xs font-semibold uppercase tracking-wider text-primary">
                    {interviewData.role}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-heading text-xs font-semibold uppercase tracking-wider text-white/50">
                    {interviewData.level}
                  </span>
                </div>
              )}
              <p className="mx-auto max-w-sm font-body text-sm leading-relaxed text-white/40">
                This is a real-time voice interview powered by AI. The interviewer adapts to your
                answers — just like the real thing.
              </p>
            </div>

            <button
              onClick={startConversation}
              disabled={isConnecting}
              className="group flex items-center gap-3 rounded-full bg-primary px-10 py-4 font-heading text-base font-bold uppercase tracking-wide text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-50 disabled:shadow-none"
            >
              {isConnecting ? (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Connecting...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 transition-transform group-hover:scale-110" />
                  Start Interview
                </>
              )}
            </button>

            <p className="font-body text-[11px] text-white/25">
              Make sure your microphone is enabled
            </p>
          </div>
        ) : (
          /* ─── LIVE INTERVIEW ─── */
          <div className="flex w-full max-w-3xl flex-1 flex-col items-center justify-between gap-4 py-4">
            {/* AI Orb — central focus */}
            <div className="flex flex-1 flex-col items-center justify-center">
              <AIOrb state={orbState} size={200} />
            </div>

            {/* TTS text fallback */}
            {textFallback && (
              <div className="w-full max-w-xl animate-fadeUp rounded-2xl border border-primary/20 bg-primary/[0.06] p-5 backdrop-blur-sm">
                <div className="mb-2 flex items-center gap-2">
                  <VolumeX className="h-4 w-4 text-primary/70" />
                  <span className="font-heading text-[10px] font-bold uppercase tracking-wider text-primary/70">
                    Audio unavailable — read below
                  </span>
                </div>
                <p className="font-body text-sm leading-relaxed text-white/80">{textFallback}</p>
              </div>
            )}

            {/* Live transcript panel */}
            <div className="w-full max-w-xl">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm">
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-accent" />
                  <span className="font-heading text-[10px] font-bold uppercase tracking-widest text-white/30">
                    Transcript
                  </span>
                </div>
                <div className="max-h-36 space-y-2 overflow-y-auto scrollbar-thin">
                  {transcript.length === 0 ? (
                    <p className="py-4 text-center font-body text-xs text-white/20">
                      Conversation will appear here...
                    </p>
                  ) : (
                    transcript.slice(-5).map((t, i) => (
                      <div
                        key={i}
                        className={`flex gap-2 ${
                          i === transcript.slice(-5).length - 1 ? "animate-fadeUp" : ""
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] ${
                            t.role === "ai"
                              ? "bg-primary/20 text-primary"
                              : "bg-accent/20 text-accent"
                          }`}
                        >
                          {t.role === "ai" ? "AI" : "Y"}
                        </span>
                        <p
                          className={`font-body text-sm leading-relaxed ${
                            t.role === "ai" ? "text-white/70" : "text-white/50"
                          }`}
                        >
                          {t.text}
                        </p>
                      </div>
                    ))
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      {interviewStarted && (
        <div className="relative z-10 flex items-center justify-center gap-5 border-t border-white/[0.06] bg-ink/80 py-5 backdrop-blur-xl">
          <button
            onClick={toggleMute}
            className={`flex h-14 w-14 items-center justify-center rounded-full transition-all ${
              isMuted
                ? "bg-destructive/20 text-destructive ring-2 ring-destructive/30"
                : "bg-white/[0.06] text-white/70 hover:bg-white/10 hover:text-white"
            }`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button
            onClick={handleEndInterview}
            className="flex h-14 w-24 items-center justify-center gap-2 rounded-full bg-destructive text-white font-heading text-xs font-bold uppercase tracking-wider transition-all hover:bg-destructive/90 hover:shadow-lg hover:shadow-destructive/25"
          >
            <PhoneOff className="h-4 w-4" />
            End
          </button>
        </div>
      )}
    </div>
  );
};

export default LiveInterview;
