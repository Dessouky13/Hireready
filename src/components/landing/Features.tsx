import { Mic, FileText, Flame, BarChart3, Map, Share2 } from "lucide-react";

const features = [
  { icon: Mic, title: "Live Voice Interview", desc: "Talk naturally with speech-to-text. No typing needed.", color: "text-primary" },
  { icon: FileText, title: "CV-Aware Questions", desc: "AI reads your resume and tailors every question to your background.", color: "text-lime" },
  { icon: Flame, title: "Pressure Mode", desc: "Get challenged with tough follow-ups when your answers are vague.", color: "text-coral" },
  { icon: BarChart3, title: "6-Dimension Score", desc: "Communication, Technical, Confidence, Structure, Clarity, Impact.", color: "text-purple" },
  { icon: Map, title: "Learning Roadmap", desc: "Personalized next steps with resources to close your skill gaps.", color: "text-success" },
  { icon: Share2, title: "Shareable Score Card", desc: "Show off your interview score to recruiters and mentors.", color: "text-pink" },
];

const Features = () => {
  return (
    <section id="features" className="border-y-2 border-ink bg-ink py-20 text-primary-foreground">
      <div className="container mx-auto px-4">
        <h2 className="mb-4 text-center font-heading text-3xl font-extrabold md:text-5xl">
          Everything you need to ace it
        </h2>
        <p className="mx-auto mb-12 max-w-lg text-center text-primary-foreground/60">
          Built for real interview prep, not generic quiz apps.
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
