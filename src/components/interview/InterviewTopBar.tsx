interface InterviewTopBarProps {
  timeLeft: number;
  formatTime: (seconds: number) => string;
  interviewStarted: boolean;
  onEnd: () => void;
}

const InterviewTopBar = ({ timeLeft, formatTime, interviewStarted, onEnd }: InterviewTopBarProps) => {
  const pct = timeLeft / 900;
  const timerColor = pct > 0.4 ? "text-success" : pct > 0.15 ? "text-coral" : "text-destructive";

  return (
    <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-3">
      <div className="flex items-center gap-3">
        {interviewStarted && <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-success" />}
        <span className="font-heading text-sm font-bold text-primary-foreground">HireReady AI</span>
        <span className="rounded-md border border-foreground/20 bg-foreground/10 px-2 py-0.5 text-xs text-primary-foreground/70">
          Voice Interview
        </span>
      </div>
      {interviewStarted && (
        <div className="flex items-center gap-4">
          <span className={`font-heading text-xl font-bold ${timerColor}`}>{formatTime(timeLeft)}</span>
        </div>
      )}
    </div>
  );
};

export default InterviewTopBar;
