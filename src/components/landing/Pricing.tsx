import { Link } from "react-router-dom";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "$9",
    period: "one-time",
    credits: "5 interviews",
    costPerInterview: "$1.80 / interview",
    features: [
      "AI voice interviewer",
      "CV-aware questions",
      "5-phase structured interview",
      "Full 6D performance report",
      "Whisper speech recognition",
    ],
    cta: "Buy Starter",
    highlight: false,
    bg: "bg-card",
  },
  {
    name: "Pro",
    price: "$19",
    period: "one-time",
    credits: "15 interviews",
    costPerInterview: "$1.27 / interview",
    features: [
      "Everything in Starter",
      "Priority email support",
      "Shareable score card",
      "Score history & progress",
      "Arabic language support",
    ],
    cta: "Buy Pro",
    highlight: true,
    bg: "bg-primary text-primary-foreground",
  },
  {
    name: "Monthly",
    price: "$29",
    period: "/month",
    credits: "25 interviews / month",
    costPerInterview: "$1.16 / interview",
    features: [
      "Everything in Pro",
      "25 fresh interviews every month",
      "Never run out mid job-search",
      "Cancel anytime",
    ],
    cta: "Go Monthly",
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
        <p className="mx-auto mb-3 max-w-lg text-center text-muted-foreground">
          Pay once, practice as many times as your credits allow.
        </p>

        {/* Free first interview callout */}
        <p className="mb-12 text-center">
          <span className="inline-block rounded-full border-2 border-lime bg-lime/20 px-4 py-1.5 font-heading text-sm font-bold text-foreground">
            First interview is free when you sign up — no credit card needed
          </span>
        </p>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
              <p className="mb-1 text-sm font-bold opacity-80">{p.credits}</p>
              <p className={`mb-4 text-xs font-semibold ${p.highlight ? "opacity-60" : "text-muted-foreground"}`}>
                {p.costPerInterview}
              </p>
              <ul className="mb-6 flex-1 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className={`h-4 w-4 flex-shrink-0 ${p.highlight ? "text-lime" : "text-primary"}`} />
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
