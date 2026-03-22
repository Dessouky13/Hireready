import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import { Check, Lock, Gift } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "$9",
    period: "one-time",
    credits: "5 interviews",
    costPerInterview: "$1.80 per interview",
    features: [
      "AI voice interviewer",
      "CV-aware questions",
      "5-phase structured interview",
      "Full 6D performance report",
      "Whisper speech recognition",
    ],
    highlight: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "one-time",
    credits: "15 interviews",
    costPerInterview: "$1.27 per interview",
    features: [
      "Everything in Starter",
      "Priority email support",
      "Shareable score card",
      "Score history & progress tracking",
      "Arabic language support",
    ],
    highlight: true,
  },
  {
    name: "Monthly",
    price: "$29",
    period: "/month",
    credits: "25 interviews / month",
    costPerInterview: "$1.16 per interview",
    features: [
      "Everything in Pro",
      "25 fresh interviews every month",
      "Never run out mid job-search",
      "Cancel anytime",
    ],
    highlight: false,
  },
];

const Pricing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b-2 border-ink bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/dashboard">
            <Logo />
          </Link>
          <Link to="/dashboard" className="neo-btn bg-background text-foreground text-sm">
            Back to Dashboard
          </Link>
        </div>
      </nav>

      <main className="container mx-auto max-w-4xl px-4 py-12">
        <div className="mb-10 text-center">
          <h1 className="mb-3 font-heading text-4xl font-extrabold">Buy More Credits</h1>
          <p className="text-muted-foreground">
            Choose a pack. Use them at your own pace — credits never expire.
          </p>
        </div>

        {/* Free interview callout */}
        <div className="mb-10 flex items-center justify-center gap-3 rounded-2xl border-2 border-lime bg-lime/10 px-6 py-4">
          <Gift className="h-5 w-5 text-foreground flex-shrink-0" />
          <p className="text-sm font-semibold">
            New accounts get <span className="font-extrabold">1 free interview</span> on signup — no payment required.
          </p>
        </div>

        {/* Cost breakdown note */}
        <div className="mb-8 rounded-xl bg-muted/50 px-5 py-4 text-sm text-muted-foreground">
          <span className="font-bold text-foreground">How does this compare?</span> A single session with a human career coach costs $80–$200.
          HireReady gives you structured, AI-powered practice with instant scoring — starting at{" "}
          <span className="font-bold text-foreground">$1.16 per full interview</span>.
        </div>

        <div className="mb-10 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`neo-card relative flex flex-col p-6 ${
                plan.highlight ? "bg-primary text-primary-foreground ring-4 ring-lime" : "bg-card"
              }`}
            >
              {plan.highlight && (
                <span className="neo-badge absolute -top-3 left-1/2 -translate-x-1/2 bg-lime text-lime-foreground">
                  Best Value
                </span>
              )}
              <h3 className="font-heading text-xl font-bold">{plan.name}</h3>
              <div className="mt-4">
                <span className="font-heading text-5xl font-extrabold">{plan.price}</span>
                <span className="ml-1 text-sm opacity-60">{plan.period}</span>
              </div>
              <p className="mt-1 text-lg font-semibold opacity-85">{plan.credits}</p>
              <p className={`mb-5 mt-1 text-xs font-semibold ${plan.highlight ? "opacity-60" : "text-muted-foreground"}`}>
                {plan.costPerInterview}
              </p>
              <ul className="flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className={`h-5 w-5 flex-shrink-0 ${plan.highlight ? "text-lime" : "text-primary"}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => alert("Payment integration coming soon!")}
                className={`neo-btn mt-6 w-full text-center ${
                  plan.highlight ? "bg-lime text-lime-foreground" : "bg-primary text-primary-foreground"
                }`}
              >
                Buy {plan.name} →
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" />
          Payments processed securely by Stripe
        </div>
      </main>
    </div>
  );
};

export default Pricing;
