import { Link } from "react-router-dom";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Trial",
    price: "$3",
    period: "one-time",
    credits: "1 interview",
    features: ["AI interviewer", "Voice input", "Basic report", "1 role"],
    cta: "Get Started",
    highlight: false,
    bg: "bg-card",
  },
  {
    name: "Starter",
    price: "$9",
    period: "one-time",
    credits: "+5 interviews",
    features: ["Everything in Trial", "All roles", "Full 6D report", "CV upload"],
    cta: "Buy Starter",
    highlight: false,
    bg: "bg-card",
  },
  {
    name: "Pro",
    price: "$19",
    period: "one-time",
    credits: "+15 interviews",
    features: ["Everything in Starter", "Pressure mode", "Learning roadmap", "Priority support"],
    cta: "Buy Pro",
    highlight: true,
    bg: "bg-primary text-primary-foreground",
  },
  {
    name: "Scale",
    price: "$29",
    period: "/month",
    credits: "30 interviews / month",
    features: ["Everything in Pro", "30 interviews every month", "Score history", "Shareable cards"],
    cta: "Choose Scale",
    highlight: false,
    bg: "bg-card",
  },
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-20">
      <div className="container mx-auto px-4">
        <h2 className="mb-4 text-center font-heading text-3xl font-extrabold md:text-5xl">
          Simple pricing
        </h2>
        <p className="mx-auto mb-12 max-w-lg text-center text-muted-foreground">
          Start with a single interview for just $3. Scale as you grow.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`neo-card relative flex flex-col p-6 ${p.bg} ${p.highlight ? "ring-4 ring-lime" : ""}`}
            >
              {p.highlight && (
                <span className="neo-badge absolute -top-3 left-1/2 -translate-x-1/2 bg-lime text-lime-foreground">
                  Most Popular
                </span>
              )}
              <h3 className="font-heading text-lg font-bold">{p.name}</h3>
              <div className="mt-3 mb-1">
                <span className="font-heading text-4xl font-extrabold">{p.price}</span>
                {p.period && <span className="ml-1 text-sm opacity-60">{p.period}</span>}
              </div>
              <p className="mb-4 text-sm font-semibold opacity-70">{p.credits}</p>
              <ul className="mb-6 flex-1 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className={`h-4 w-4 ${p.highlight ? "text-lime" : "text-primary"}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth/signup"
                className={`neo-btn text-center ${
                  p.highlight
                    ? "bg-lime text-lime-foreground"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
