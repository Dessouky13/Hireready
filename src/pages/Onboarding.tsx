import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Logo from "@/components/Logo";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

const REFERRAL_OPTIONS = [
  { id: "instagram_tiktok", label: "Instagram / TikTok", emoji: "📱" },
  { id: "friend", label: "Friend or colleague", emoji: "👥" },
  { id: "google", label: "Google Search", emoji: "🔍" },
  { id: "linkedin", label: "LinkedIn", emoji: "💼" },
  { id: "university", label: "University / college", emoji: "🎓" },
  { id: "job_board", label: "Job board (Wuzzuf, LinkedIn Jobs…)", emoji: "📋" },
  { id: "other", label: "Other", emoji: "✨" },
];

const GOAL_OPTIONS = [
  { id: "get_job", label: "Land a job faster", emoji: "🚀" },
  { id: "improve_skills", label: "Improve interview skills", emoji: "📈" },
  { id: "specific_role", label: "Prep for a specific role", emoji: "🎯" },
  { id: "confidence", label: "Build confidence", emoji: "💪" },
  { id: "promotion", label: "Prepare for a promotion", emoji: "⭐" },
  { id: "arabic", label: "Practice in Arabic", emoji: "🇪🇬" },
  { id: "mentor", label: "Help students I mentor", emoji: "🧑‍🏫" },
];

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [referral, setReferral] = useState<string | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true);

  // If onboarding already done, skip to dashboard
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("referral_source")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.referral_source) navigate("/dashboard", { replace: true });
        else setChecking(false);
      });
  }, [user, navigate]);

  const toggleGoal = (id: string) => {
    setGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await supabase
        .from("profiles")
        .update({
          referral_source: referral ?? "skipped",
          goals: goals.length > 0 ? goals : ["skipped"],
        } as any)
        .eq("id", user.id);
    } catch {
      // Non-critical — don't block navigation
      toast.error("Could not save your preferences, but you're all set!");
    } finally {
      setSaving(false);
      navigate("/dashboard", { replace: true });
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="neo-card w-full max-w-lg bg-card p-8">
        {/* Logo */}
        <div className="mb-6 text-center">
          <Logo size="large" />
          <h1 className="mt-4 font-heading text-2xl font-extrabold">Welcome to HireReady!</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Two quick questions to personalise your experience.
          </p>
        </div>

        {/* Question 1 — Referral */}
        <div className="mb-8">
          <p className="mb-3 font-heading text-sm font-bold uppercase tracking-wide text-foreground">
            How did you find us?
          </p>
          <div className="flex flex-wrap gap-2">
            {REFERRAL_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setReferral(opt.id)}
                className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 font-heading text-xs font-bold transition-all ${
                  referral === opt.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-ink bg-background text-foreground hover:border-primary/40"
                }`}
              >
                <span>{opt.emoji}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Question 2 — Goals */}
        <div className="mb-8">
          <p className="mb-1 font-heading text-sm font-bold uppercase tracking-wide text-foreground">
            What's your main goal?
          </p>
          <p className="mb-3 text-xs text-muted-foreground">Select all that apply.</p>
          <div className="flex flex-wrap gap-2">
            {GOAL_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => toggleGoal(opt.id)}
                className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 font-heading text-xs font-bold transition-all ${
                  goals.includes(opt.id)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-ink bg-background text-foreground hover:border-primary/40"
                }`}
              >
                <span>{opt.emoji}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="neo-btn w-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
          ) : (
            <>Set Up My Account <ArrowRight className="h-4 w-4" /></>
          )}
        </button>

        <button
          onClick={() => navigate("/dashboard", { replace: true })}
          className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
};

export default Onboarding;
