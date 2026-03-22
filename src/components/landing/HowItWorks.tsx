const steps = [
  {
    num: "01",
    title: "Upload your CV",
    desc: "Drop your resume (PDF or Word) and the AI reads it to personalise every question to your real background.",
    bg: "bg-lime",
  },
  {
    num: "02",
    title: "Choose your sector",
    desc: "Pick from 10+ industries — Tech, Finance, Healthcare, Marketing, HR, and more. Or type a custom role.",
    bg: "bg-primary text-primary-foreground",
  },
  {
    num: "03",
    title: "15-min AI interview",
    desc: "A structured 5-phase interview: Opening, Technical, Behavioral, Situational, Closing — just like the real thing.",
    bg: "bg-coral text-coral-foreground",
  },
  {
    num: "04",
    title: "Get your report",
    desc: "Scores across 6 dimensions with specific feedback on what you said well and where to improve.",
    bg: "bg-purple text-purple-foreground",
  },
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
