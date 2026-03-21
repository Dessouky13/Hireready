import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import { Check, Lock } from "lucide-react";

const plans = [
  {
    name: "Trial",
    price: "$3",
    period: "one-time",
    credits: "1 interview",
    features: ["AI interviewer", "Voice input", "Basic report", "1 role"],
    highlight: false,
  },
  {
    name: "Starter",
    price: "$9",
    period: "one-time",
    credits: "+5 interviews",
    features: ["All roles", "Full 6D report", "CV upload", "Email support"],
    highlight: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "one-time",
    credits: "+15 interviews",
    features: ["Everything in Starter", "Pressure mode", "Learning roadmap", "Priority support"],
    highlight: true,
  },
  {
    name: "Scale",
    price: "$29",
    period: "/month",
    credits: "30 interviews / month",
    features: ["Everything in Pro", "30 interviews every month", "Score history", "Shareable cards"],
    highlight: false,
  },
];

const Pricing = () => {
  const handleBuy = (plan: string) => {
    // TODO: Integrate with Stripe
    console.log(`Buying ${plan}`);
  };

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

      <main className="container mx-auto max-w-5xl px-4 py-12">
        <div className="mb-12 text-center">
          <h1 className="mb-4 font-heading text-4xl font-extrabold">Buy More Credits</h1>
          <p className="text-muted-foreground">Choose a plan that works for you. All purchases are one-time unless stated.</p>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`neo-card relative flex flex-col p-6 ${
                plan.highlight ? "bg-primary text-primary-foreground ring-4 ring-lime" : "bg-card"
              }`}
            >
              {plan.highlight && (
                <span className="neo-badge absolute -top-3 left-1/2 -translate-x-1/2 bg-lime text-lime-foreground">
                  Most Popular
                </span>
              )}
              <h3 className="font-heading text-xl font-bold">{plan.name}</h3>
              <div className="mt-4">
                <span className="font-heading text-5xl font-extrabold">{plan.price}</span>
                <span className="ml-1 text-sm opacity-60">{plan.period}</span>
              </div>
              <p className="mt-2 text-lg font-semibold opacity-80">{plan.credits}</p>
              <ul className="my-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className={`h-5 w-5 ${plan.highlight ? "text-lime" : "text-primary"}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleBuy(plan.name)}
                className={`neo-btn w-full text-center ${
                  plan.highlight ? "bg-lime text-lime-foreground" : "bg-primary text-primary-foreground"
                }`}
              >
                Buy Now →
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
