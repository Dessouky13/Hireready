import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Mic, PhoneOff, VolumeX, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AIOrb from "@/components/interview/AIOrb";
import InterviewTopBar from "@/components/interview/InterviewTopBar";
import { track, Events } from "@/lib/analytics";
import { Link } from "react-router-dom";

type TranscriptEntry = { role: "ai" | "user"; text: string };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const LiveInterview = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [isConnecting, setIsConnecting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [interviewData, setInterviewData] = useState<{ role: string; level: string } | null>(null);
  const [currentPhase, setCurrentPhase] = useState("opening");
  const [questionCount, setQuestionCount] = useState(0);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [textFallback, setTextFallback] = useState<string | null>(null);
  const [insufficientCredits, setInsufficientCredits] = useState(false);
  const [isPTTActive, setIsPTTActive] = useState(false);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const endingRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const busyRef = useRef(false);
  const isPTTActiveRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const firstCallDoneRef = useRef(false);
  const handleUserTurnRef = useRef<(text: string) => Promise<void>>();

  // ── Load interview metadata ──
  useEffect(() => {
    if (!id) return;
    supabase
      .from("interviews")
      .select("role, level")
      .eq("id", id)
      .single()
      .then(({ data }) => { if (data) setInterviewData(data); });
  }, [id]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // ── Interview timer ──
  useEffect(() => {
    if (!interviewStarted) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(timer); handleEndInterview(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [interviewStarted]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Spacebar PTT ──
  useEffect(() => {
    if (!interviewStarted) return;
    const down = (e: KeyboardEvent) => { if (e.code === "Space" && !e.repeat) { e.preventDefault(); startPTT(); } };
    const up   = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); stopPTT(); } };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup",   up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [interviewStarted]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AudioContext helper ──
  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ latencyHint: "interactive" });
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // ── Browser TTS fallback ──
  const playBrowserTTS = useCallback((text: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (!window.speechSynthesis) { resolve(); return; }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      // Pick best English voice available
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Microsoft") || v.name.includes("Samantha") || v.name.includes("Daniel"))) ||
        voices.find((v) => v.lang.startsWith("en"));
      if (preferred) utterance.voice = preferred;
      utterance.onend = () => resolve();
      utterance.onerror = (e) => {
        if (e.error === "interrupted" || e.error === "canceled") resolve();
        else { console.warn("Browser TTS error:", e.error); resolve(); }
      };
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  // ── Primary TTS: OpenAI → fallback to browser ──
  const playTTS = useCallback(async (text: string): Promise<void> => {
    setTextFallback(null);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("No auth token");

      // Abort if TTS takes > 10s (prevents stuck "speaking" state)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      let res: Response;
      try {
        res = await fetch(`${SUPABASE_URL}/functions/v1/openai-tts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!res.ok) throw new Error(`TTS ${res.status}`);

      const arrayBuffer = await res.arrayBuffer();
      const audioCtx = await ensureAudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      audioSourceRef.current = source;

      // Only mark as "speaking" once audio is actually about to play
      setAiSpeaking(true);
      await new Promise<void>((resolve) => {
        source.onended = () => { audioSourceRef.current = null; resolve(); };
        source.start(0);
      });
    } catch (e) {
      // OpenAI TTS failed — fall back to browser speech synthesis
      console.warn("OpenAI TTS failed, using browser TTS:", (e as Error).message);
      setAiSpeaking(true); // still animate the orb
      try {
        await playBrowserTTS(text);
      } catch {
        setTextFallback(text);
      }
    } finally {
      setAiSpeaking(false);
    }
  }, [ensureAudioContext, playBrowserTTS]);

  // ── Orchestrator call ──
  const callOrchestrator = useCallback(async (userMessage?: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setProcessing(true);

    try {
      // 30s timeout — prevents infinite "interview in progress" if the AI hangs
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      let data: { next_question: string; phase: string; question_count: number; follow_up: boolean; topic: string } | null = null;
      let invokeError: unknown = null;

      try {
        const result = await supabase.functions.invoke("interview-orchestrator", {
          body: { interviewId: id, userMessage: userMessage || "" },
        });
        data = result.data;
        invokeError = result.error;
      } finally {
        clearTimeout(timeout);
      }

      if (invokeError) {
        const err = invokeError as { message?: string; context?: { status?: number } };
        if (err.message?.includes("insufficient_credits") || err.context?.status === 402) {
          setInsufficientCredits(true);
          toast.error("Insufficient credits. Please buy more to continue.");
          return;
        }
        throw new Error(err.message || "Orchestrator error");
      }
      if (!data?.next_question) throw new Error("No question returned from AI");

      firstCallDoneRef.current = true;
      setCurrentPhase(data.phase || "opening");
      setQuestionCount(data.question_count || 0);
      setTranscript((prev) => [...prev, { role: "ai", text: data!.next_question }]);

      // Play TTS — this sets aiSpeaking true only when audio is ready
      await playTTS(data.next_question);
    } catch (e) {
      console.error("Orchestrator error:", e);
      const msg = (e as Error).message;
      if (msg?.includes("aborted") || msg?.includes("abort")) {
        toast.error("Interview took too long to respond. Please try again.");
      } else {
        toast.error("Failed to get next question. Please try again.");
      }
    } finally {
      setProcessing(false);
      busyRef.current = false;
    }
  }, [id, playTTS]);

  const handleUserTurn = useCallback(async (text: string) => {
    await callOrchestrator(text);
  }, [callOrchestrator]);

  useEffect(() => { handleUserTurnRef.current = handleUserTurn; }, [handleUserTurn]);

  // ── PTT: start recording ──
  const startPTT = useCallback(() => {
    if (busyRef.current || isTranscribing || isPTTActiveRef.current) return;

    // Interrupt AI speech
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch { /* already ended */ }
      audioSourceRef.current = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setAiSpeaking(false);

    const stream = mediaStreamRef.current;
    if (!stream) { toast.error("Microphone not available"); return; }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "audio/ogg";

    audioChunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
    recorder.start(100);
    mediaRecorderRef.current = recorder;

    isPTTActiveRef.current = true;
    setIsPTTActive(true);
  }, [isTranscribing]);

  // ── PTT: stop recording → Whisper ──
  const stopPTT = useCallback(() => {
    if (!isPTTActiveRef.current) return;
    isPTTActiveRef.current = false;
    setIsPTTActive(false);

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    mediaRecorderRef.current = null;

    recorder.onstop = async () => {
      if (audioChunksRef.current.length === 0) return;
      const mimeType = recorder.mimeType || "audio/webm";
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      audioChunksRef.current = [];

      if (blob.size < 3000) return; // too short — ignore

      setIsTranscribing(true);
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token) throw new Error("No auth token");

        const ext = mimeType.includes("ogg") ? "ogg" : "webm";
        const formData = new FormData();
        formData.append("audio", blob, `recording.${ext}`);

        const res = await fetch(`${SUPABASE_URL}/functions/v1/whisper-transcribe`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
          body: formData,
        });

        if (!res.ok) throw new Error(`Transcription failed: ${res.status}`);

        const { text } = await res.json();
        if (text?.trim()) {
          setTranscript((prev) => [...prev, { role: "user", text: text.trim() }]);
          if (!busyRef.current && handleUserTurnRef.current) {
            handleUserTurnRef.current(text.trim());
          }
        } else {
          toast.info("Couldn't hear you clearly — please try again.");
        }
      } catch (e) {
        console.error("Whisper error:", e);
        toast.error("Could not transcribe your speech. Please try again.");
      } finally {
        setIsTranscribing(false);
      }
    };

    recorder.stop();
  }, []);

  // ── Start interview ──
  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    try {
      // Mic + AudioContext in parallel
      const [stream] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ audio: true }),
        ensureAudioContext(),
      ]);
      mediaStreamRef.current = stream;

      // Pre-warm speech synthesis voices while connecting
      if (window.speechSynthesis) window.speechSynthesis.getVoices();

      setInterviewStarted(true);
      // Kick off the first AI call — no extra credit-check roundtrip needed
      // (orchestrator handles credit deduction on first call and returns 402 if insufficient)
      await callOrchestrator();
    } catch (error) {
      const msg = (error as Error).message;
      if (msg?.includes("Permission") || msg?.includes("NotAllowed") || msg?.includes("NotFound")) {
        toast.error("Microphone access denied. Please allow microphone and try again.");
      } else {
        toast.error("Failed to start. Please check your microphone and try again.");
      }
      console.error("startConversation error:", error);
    } finally {
      setIsConnecting(false);
    }
  }, [callOrchestrator, ensureAudioContext]);

  // ── End interview ──
  const handleEndInterview = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;

    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch { /* ok */ }
      try { audioSourceRef.current.disconnect(); } catch { /* ok */ }
      audioSourceRef.current = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (mediaRecorderRef.current) {
      try { mediaRecorderRef.current.stop(); } catch { /* ok */ }
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    track(Events.INTERVIEW_COMPLETED, { phase: currentPhase, questionCount });
    toast.success("Great work! Generating your report...");

    if (id) {
      try {
        await supabase
          .from("interviews")
          .update({ status: "completed", ended_at: new Date().toISOString() })
          .eq("id", id);

        supabase.functions
          .invoke("generate-report", { body: { interviewId: id } })
          .then(({ error: e }) => { if (e) console.error("Report generation failed:", e); });
      } catch (e) {
        console.error("End interview error:", e);
      }
    }

    navigate(`/report/${id || "demo"}`);
  }, [navigate, id, currentPhase, questionCount]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // ── Status label ──
  const statusLabel = processing && !firstCallDoneRef.current
    ? "Your interview is starting, please wait..."
    : isTranscribing
    ? "Transcribing your answer..."
    : processing
    ? "AI is thinking..."
    : aiSpeaking
    ? "Interviewer is speaking..."
    : isPTTActive
    ? "Listening — release to send"
    : "Hold SPACE or the mic button to speak";

  const orbState: "idle" | "listening" | "thinking" | "speaking" =
    aiSpeaking ? "speaking"
    : processing || isTranscribing ? "thinking"
    : isPTTActive ? "listening"
    : "idle";

  // ── Insufficient credits screen ──
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
              You need at least 1 credit to start an interview.
            </p>
            <div className="flex flex-col gap-3">
              <Link to="/pricing" className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-heading text-sm font-bold uppercase tracking-wide text-white transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25">
                Buy Credits <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/dashboard" className="flex items-center justify-center rounded-full border border-white/10 px-6 py-3 font-heading text-sm font-bold uppercase tracking-wide text-white/70 transition-all hover:bg-white/5">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink">
      {/* Ambient background */}
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
              {/* Interview structure preview */}
              <div className="mb-4 flex items-center justify-center gap-1 text-white/25 text-[11px] font-heading font-semibold uppercase tracking-wider">
                {["Opening", "Technical", "Behavioral", "Situational", "Closing"].map((s, i, arr) => (
                  <span key={s} className="flex items-center gap-1">
                    <span>{s}</span>
                    {i < arr.length - 1 && <span className="text-white/15">→</span>}
                  </span>
                ))}
              </div>
              <p className="mx-auto max-w-sm font-body text-sm leading-relaxed text-white/40">
                A real-time AI voice interview. Hold the mic button or spacebar to speak, release to send.
              </p>
            </div>

            <button
              onClick={startConversation}
              disabled={isConnecting}
              className="group flex items-center gap-3 rounded-full bg-primary px-10 py-4 font-heading text-base font-bold uppercase tracking-wide text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-50 disabled:shadow-none"
            >
              {isConnecting ? (
                <><span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Connecting...</>
              ) : (
                <><Sparkles className="h-5 w-5 transition-transform group-hover:scale-110" /> Start Interview</>
              )}
            </button>

            <p className="font-body text-[11px] text-white/25">Make sure your microphone is enabled</p>
          </div>
        ) : (
          /* ─── LIVE INTERVIEW ─── */
          <div className="flex w-full max-w-3xl flex-1 flex-col items-center justify-between gap-4 py-4">
            {/* Orb */}
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <AIOrb state={orbState} size={200} />
              <p className="font-body text-xs text-white/30">{statusLabel}</p>
            </div>

            {/* TTS text fallback */}
            {textFallback && (
              <div className="w-full max-w-xl animate-fadeUp rounded-2xl border border-primary/20 bg-primary/[0.06] p-5 backdrop-blur-sm">
                <div className="mb-2 flex items-center gap-2">
                  <VolumeX className="h-4 w-4 text-primary/70" />
                  <span className="font-heading text-[10px] font-bold uppercase tracking-wider text-primary/70">Audio unavailable — read below</span>
                </div>
                <p className="font-body text-sm leading-relaxed text-white/80">{textFallback}</p>
              </div>
            )}

            {/* Transcript */}
            <div className="w-full max-w-xl">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm">
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-accent" />
                  <span className="font-heading text-[10px] font-bold uppercase tracking-widest text-white/30">Transcript</span>
                </div>
                <div className="max-h-40 space-y-2 overflow-y-auto">
                  {transcript.length === 0 ? (
                    <p className="py-4 text-center font-body text-xs text-white/20">Conversation will appear here...</p>
                  ) : (
                    transcript.slice(-6).map((t, i) => (
                      <div key={i} className={`flex gap-2 ${i === transcript.slice(-6).length - 1 ? "animate-fadeUp" : ""}`}>
                        <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] ${t.role === "ai" ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent"}`}>
                          {t.role === "ai" ? "AI" : "Y"}
                        </span>
                        <p className={`font-body text-sm leading-relaxed ${t.role === "ai" ? "text-white/70" : "text-white/50"}`}>
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
          {/* PTT button */}
          <button
            onMouseDown={startPTT}
            onMouseUp={stopPTT}
            onTouchStart={(e) => { e.preventDefault(); startPTT(); }}
            onTouchEnd={(e) => { e.preventDefault(); stopPTT(); }}
            disabled={processing || isTranscribing}
            className={`relative flex h-16 w-16 items-center justify-center rounded-full transition-all select-none ${
              isPTTActive
                ? "bg-accent ring-4 ring-accent/40 scale-110 shadow-xl shadow-accent/30"
                : isTranscribing
                ? "bg-white/[0.06] text-white/40 cursor-wait"
                : processing
                ? "bg-white/[0.04] text-white/20 cursor-not-allowed"
                : "bg-white/[0.08] text-white/70 hover:bg-white/[0.14] hover:text-white hover:shadow-lg"
            }`}
            title="Hold to speak (or hold Space)"
          >
            {isTranscribing
              ? <Loader2 className="h-6 w-6 animate-spin text-white/50" />
              : <Mic className={`h-6 w-6 ${isPTTActive ? "text-white" : ""}`} />
            }
            {isPTTActive && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-accent animate-pulse" />}
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
