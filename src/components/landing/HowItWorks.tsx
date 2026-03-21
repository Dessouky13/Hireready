const steps = [
  { num: "01", title: "Upload your CV", desc: "Drop your resume and we'll tailor questions to your experience.", bg: "bg-lime" },
  { num: "02", title: "Pick your role", desc: "Choose from 10+ roles — software engineer, PM, data scientist, and more.", bg: "bg-primary text-primary-foreground" },
  { num: "03", title: "15-min AI interview", desc: "A tough but fair AI interviewer pushes you with follow-ups and pressure.", bg: "bg-coral text-coral-foreground" },
  { num: "04", title: "Get your report", desc: "Scores across 6 dimensions, strengths, weaknesses, and a learning roadmap.", bg: "bg-purple text-purple-foreground" },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20">
      <div className="container mx-auto px-4">
        <h2 className="mb-4 text-center font-heading text-3xl font-extrabold md:text-5xl">
          How it works
        </h2>
        <p className="mx-auto mb-12 max-w-lg text-center text-muted-foreground">
          From CV upload to detailed report in 4 simple steps.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.num} className={`neo-card relative overflow-hidden p-6 ${s.bg}`}>
              <span className="absolute -right-4 -top-4 font-heading text-8xl font-extrabold opacity-10">
                {s.num}
              </span>
              <div className="relative z-10">
                <span className="mb-4 block font-heading text-sm font-bold uppercase opacity-60">{s.num}</span>
                <h3 className="mb-2 font-heading text-xl font-bold">{s.title}</h3>
                <p className="text-sm opacity-80">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
