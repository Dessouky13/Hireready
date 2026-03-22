import { Link } from "react-router-dom";

const Hero = () => {
  return (
    <section className="relative overflow-hidden py-16 md:py-24">
      {/* Blobs */}
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-[60px]" />
      <div className="absolute -right-32 top-20 h-80 w-80 rounded-full bg-lime/20 blur-[60px]" />
      <div className="absolute bottom-0 left-1/2 h-72 w-72 rounded-full bg-coral/10 blur-[60px]" />

      <div className="container relative mx-auto grid gap-12 px-4 md:grid-cols-2 md:items-center">
        {/* Left */}
        <div className="animate-fadeUp">
          <span className="neo-badge mb-6 bg-lime text-lime-foreground">
            AI Interview Coach — Now Live
          </span>
          <h1 className="mb-6 text-4xl font-extrabold leading-tight md:text-6xl">
            Stop{" "}
            <span className="relative">
              <span className="relative z-10">freezing</span>
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none">
                <path d="M2 8c40-6 80-6 120-2s60 4 76 2" stroke="hsl(var(--coral))" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </span>{" "}
            in interviews.
            <br />
            <span className="relative inline-block mt-2">
              <span className="absolute inset-0 -skew-x-3 bg-lime rounded-md" />
              <span className="relative z-10 px-3">Get hired.</span>
            </span>
          </h1>
          <p className="mb-8 max-w-lg text-lg text-muted-foreground">
            Practice with a tough AI interviewer that adapts to your sector, experience level, and CV.
            Get a detailed 6-dimension performance report after every session.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/auth/signup" className="neo-btn bg-primary text-primary-foreground text-base">
              Start Free — No Card Needed
            </Link>
            <a href="#how-it-works" className="neo-btn bg-background text-foreground text-base">
              See how it works
            </a>
          </div>
          <div className="mt-8 flex items-center gap-3">
            <div className="flex -space-x-3">
              {["bg-primary", "bg-lime", "bg-coral", "bg-purple"].map((c, i) => (
                <div key={i} className={`h-10 w-10 rounded-full border-2 border-ink ${c}`} />
              ))}
            </div>
            <span className="font-body text-sm font-semibold text-muted-foreground">
              Join thousands of job seekers practicing daily
            </span>
          </div>
        </div>

        {/* Right — Phone mockup */}
        <div className="relative flex justify-center" style={{ animationDelay: "0.2s" }}>
          <div className="neo-card relative w-72 bg-ink p-4 text-primary-foreground md:w-80" style={{ borderRadius: "32px" }}>
            {/* Header */}
            <div className="mb-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-success animate-blink" />
              <span className="font-heading text-xs uppercase text-success">Live Interview</span>
            </div>

            {/* Phase indicator */}
            <div className="mb-3 flex gap-1 text-[9px] font-heading font-bold uppercase opacity-40">
              {["Opening", "Technical", "Behavioral", "Situational", "Closing"].map((p, i) => (
                <span key={p} className={`${i === 1 ? "text-primary opacity-100" : ""}`}>{i > 0 ? "→ " : ""}{p}</span>
              ))}
            </div>

            {/* AI message */}
            <div className="mb-3 max-w-[85%] rounded-2xl rounded-tl-sm bg-foreground/10 p-3 text-sm">
              <p className="mb-1 font-heading text-[10px] uppercase text-primary">AI Interviewer</p>
              Your CV mentions a migration project at your last company — walk me through the biggest technical challenge you faced.
            </div>

            {/* User message */}
            <div className="mb-4 ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-primary p-3 text-sm">
              We had to migrate 3M records with zero downtime, so I designed a dual-write strategy...
            </div>

            {/* Score circles */}
            <div className="flex justify-around border-t border-foreground/20 pt-3">
              {[
                { label: "Comm", score: 82, color: "text-success" },
                { label: "Tech", score: 78, color: "text-primary" },
                { label: "Conf", score: 71, color: "text-primary" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className={`font-heading text-lg font-bold ${s.color}`}>{s.score}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Floating pills */}
          <div className="absolute -left-4 top-8 animate-float neo-badge bg-background text-foreground text-[11px]" style={{ animationDelay: "0s" }}>
            🎯 15-min session
          </div>
          <div className="absolute -right-4 top-1/3 animate-float neo-badge bg-background text-foreground text-[11px]" style={{ animationDelay: "1s" }}>
            📊 Full 6D report
          </div>
          <div className="absolute -left-2 bottom-12 animate-float neo-badge bg-background text-foreground text-[11px]" style={{ animationDelay: "2s" }}>
            📄 CV-aware questions
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
