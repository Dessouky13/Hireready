import { Clock, Radio, X } from "lucide-react";

interface InterviewTopBarProps {
  timeLeft: number;
  formatTime: (seconds: number) => string;
  interviewStarted: boolean;
  onEnd: () => void;
  phase?: string;
  questionCount?: number;
}

const PHASE_LABELS: Record<string, string> = {
  opening: "Opening",
  technical: "Technical",
  behavioral: "Behavioral",
  situational: "Situational",
  closing: "Closing",
};

const InterviewTopBar = ({
  timeLeft,
  formatTime,
  interviewStarted,
  onEnd,
  phase,
  questionCount,
}: InterviewTopBarProps) => {
  const pct = timeLeft / 900;
  const timerColor = pct > 0.4 ? "text-accent" : pct > 0.15 ? "text-coral" : "text-destructive";

  return (
    <div className="relative z-10 flex items-center justify-between border-b border-white/[0.06] bg-ink/80 px-6 py-3 backdrop-blur-xl">
      {/* Left: brand + live indicator */}
      <div className="flex items-center gap-3">
        <span className="font-heading text-base font-bold tracking-tight text-white">
          Hire<span className="text-primary">Ready</span>
        </span>
        {interviewStarted && (
          <div className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5">
            <Radio className="h-3 w-3 text-accent animate-pulse" />
            <span className="font-heading text-[10px] font-bold uppercase tracking-wider text-accent">
              Live
            </span>
          </div>
        )}
      </div>

      {/* Center: phase + question */}
      {interviewStarted && phase && (
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2">
          <span className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-1 font-heading text-[11px] font-semibold uppercase tracking-wider text-white/60">
            {PHASE_LABELS[phase] || phase}
          </span>
          {questionCount !== undefined && questionCount > 0 && (
            <span className="font-body text-[11px] text-white/40">
              Q{questionCount}
            </span>
          )}
        </div>
      )}

      {/* Right: timer + end button */}
      <div className="flex items-center gap-3">
        {interviewStarted && (
          <>
            <div className="flex items-center gap-1.5">
              <Clock className={`h-3.5 w-3.5 ${timerColor}`} />
              <span className={`font-heading text-lg font-bold tabular-nums ${timerColor}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
            <button
              onClick={onEnd}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/20 text-destructive transition-colors hover:bg-destructive/30"
              title="End Interview"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default InterviewTopBar;
