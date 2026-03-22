import { Mic, FileText, BarChart3, Share2, MessageSquare, Globe } from "lucide-react";

const features = [
  {
    icon: Mic,
    title: "Live Voice Interview",
    desc: "Hold to speak, release to send. Powered by OpenAI Whisper for accurate transcription even with accents.",
    color: "text-primary",
  },
  {
    icon: FileText,
    title: "CV-Aware Questions",
    desc: "Upload your resume and the AI will reference your real experience, projects, and companies throughout.",
    color: "text-lime",
  },
  {
    icon: MessageSquare,
    title: "5-Phase Structure",
    desc: "Opening → Technical → Behavioral → Situational → Closing. A complete real-world interview every time.",
    color: "text-coral",
  },
  {
    icon: BarChart3,
    title: "6-Dimension Scoring",
    desc: "Scored on Communication, Technical, Confidence, Structure, Clarity, and Impact after every answer.",
    color: "text-purple",
  },
  {
    icon: Share2,
    title: "Shareable Score Card",
    desc: "Download or share your performance card with recruiters, mentors, or your LinkedIn profile.",
    color: "text-success",
  },
  {
    icon: Globe,
    title: "Arabic & English",
    desc: "Practice in English or Arabic. The AI interviewer adapts language, tone, and questions accordingly.",
    color: "text-pink",
  },
];

const Features = () => {
  return (
    <section id="features" className="border-y-2 border-ink bg-ink py-20 text-primary-foreground">
      <div className="container mx-auto px-4">
        <h2 className="mb-4 text-center font-heading text-3xl font-extrabold md:text-5xl">
          Everything you need to ace it
        </h2>
        <p className="mx-auto mb-12 max-w-lg text-center text-primary-foreground/60">
          Built for real interview prep — not generic quiz apps.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-[20px] border-2 border-primary-foreground/20 bg-primary-foreground/5 p-6 transition-all hover:-translate-y-1 hover:border-primary-foreground/40"
              style={{ boxShadow: "5px 5px 0 rgba(255,255,255,0.05)" }}
            >
              <f.icon className={`mb-4 h-8 w-8 ${f.color}`} />
              <h3 className="mb-2 font-heading text-lg font-bold">{f.title}</h3>
              <p className="text-sm text-primary-foreground/60">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
