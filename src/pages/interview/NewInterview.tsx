import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowRight, Check, Upload, AlertCircle, PenLine } from "lucide-react";
import { toast } from "sonner";
import { track, Events } from "@/lib/analytics";

const sectors = [
  { id: "Technology & Software", label: "Technology & Software", emoji: "💻" },
  { id: "Finance & Banking", label: "Finance & Banking", emoji: "💰" },
  { id: "Healthcare & Medicine", label: "Healthcare & Medicine", emoji: "🏥" },
  { id: "Marketing & Communications", label: "Marketing & Communications", emoji: "📣" },
  { id: "Human Resources", label: "Human Resources", emoji: "👥" },
  { id: "Engineering & Manufacturing", label: "Engineering & Manufacturing", emoji: "⚙️" },
  { id: "Education & Training", label: "Education & Training", emoji: "📚" },
  { id: "Retail & E-Commerce", label: "Retail & E-Commerce", emoji: "🛍️" },
  { id: "Consulting & Strategy", label: "Consulting & Strategy", emoji: "🏢" },
  { id: "Operations & Supply Chain", label: "Operations & Supply Chain", emoji: "🔄" },
];

const levels = [
  { id: "Internship/Student", label: "Internship / Student", desc: "First professional experience" },
  { id: "Junior", label: "Junior (0–2 yrs)", desc: "Early career professional" },
  { id: "Mid-level", label: "Mid-level (2–5 yrs)", desc: "Experienced professional" },
  { id: "Senior", label: "Senior (5+ yrs)", desc: "Leadership and expertise" },
];

const NewInterview = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [customRole, setCustomRole] = useState("");
  const [isOtherRole, setIsOtherRole] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [starting, setStarting] = useState(false);
  const [language, setLanguage] = useState<"en" | "ar">("en");

  const effectiveRole = isOtherRole ? customRole.trim() : selectedRole;
  // alias for clarity in JSX below
  const roles = sectors;

  useEffect(() => {
    if (!user) return;
    supabase.from("credits").select("balance").eq("user_id", user.id).single().then(({ data }) => {
      if (data) setCredits(data.balance);
    });
  }, [user]);

  const handleStartInterview = async () => {
    if (!user || !effectiveRole || !selectedLevel) return;
    if (credits <= 0) {
      toast.error("You're out of credits!");
      return;
    }
    setStarting(true);

    let cvUrl: string | null = null;

    // Upload CV if provided
    if (cvFile) {
      const filePath = `${user.id}/${Date.now()}-${cvFile.name}`;
      const { error: uploadError } = await supabase.storage.from("cvs").upload(filePath, cvFile);
      if (uploadError) {
        toast.error("Failed to upload CV: " + uploadError.message);
        setStarting(false);
        return;
      }
      cvUrl = filePath;
    }

    // Create interview record — credit deduction happens server-side in orchestrator on first call
    const { data: interview, error: interviewError } = await supabase
      .from("interviews")
      .insert({
        user_id: user.id,
        role: effectiveRole!,
        level: selectedLevel,
        status: "active",
        cv_url: cvUrl,
        language,
      })
      .select()
      .single();

    if (interviewError || !interview) {
      toast.error("Failed to create interview");
      setStarting(false);
      return;
    }

    track(Events.INTERVIEW_STARTED, { role: effectiveRole, level: selectedLevel, language });
    toast.success("Starting your interview...");
    navigate(`/interview/${interview.id}`);
  };

  const roleLabel = isOtherRole ? customRole.trim() : sectors.find((r) => r.id === selectedRole)?.label;
  const levelLabel = levels.find((l) => l.id === selectedLevel)?.label;

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b-2 border-ink bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/dashboard"><Logo /></Link>
          <div className="flex items-center gap-3">
            {/* Language Toggle */}
            <div className="flex items-center rounded-full border-2 border-ink overflow-hidden">
              <button
                onClick={() => setLanguage("en")}
                className={`px-3 py-1 text-xs font-bold font-heading transition-colors ${language === "en" ? "bg-primary text-primary-foreground" : "bg-background text-foreground"}`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage("ar")}
                className={`px-3 py-1 text-xs font-bold font-heading transition-colors ${language === "ar" ? "bg-primary text-primary-foreground" : "bg-background text-foreground"}`}
              >
                عربي
              </button>
            </div>
            <div className={`neo-badge ${credits === 0 ? "bg-coral text-coral-foreground" : "bg-primary text-primary-foreground"}`}>
              {credits} credits
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto max-w-3xl px-4 py-8">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="mb-2 flex justify-between text-sm font-semibold">
            <span className={step >= 1 ? "text-primary" : "text-muted-foreground"}>1. Sector</span>
            <span className={step >= 2 ? "text-primary" : "text-muted-foreground"}>2. Level</span>
            <span className={step >= 3 ? "text-primary" : "text-muted-foreground"}>3. CV</span>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-2 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="animate-fadeUp">
            <h1 className="mb-2 font-heading text-3xl font-extrabold">Pick your sector</h1>
            <p className="mb-8 text-muted-foreground">Which industry are you targeting?</p>
            <div className="mb-8 grid grid-cols-2 gap-4">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => { setSelectedRole(role.id); setIsOtherRole(false); }}
                  className={`neo-card flex items-center gap-3 p-4 text-left transition-all hover:-translate-y-1 ${
                    selectedRole === role.id && !isOtherRole ? "border-primary bg-primary/10 ring-2 ring-primary" : "bg-card hover:bg-muted"
                  }`}
                  style={{ boxShadow: selectedRole === role.id && !isOtherRole ? "5px 5px 0 hsl(var(--primary))" : "5px 5px 0 hsl(var(--ink))" }}
                >
                  <span className="text-2xl">{role.emoji}</span>
                  <span className={`font-heading font-bold ${selectedRole === role.id && !isOtherRole ? "text-primary" : ""}`}>{role.label}</span>
                </button>
              ))}
              <button
                onClick={() => { setIsOtherRole(true); setSelectedRole(null); }}
                className={`neo-card flex items-center gap-3 p-4 text-left transition-all hover:-translate-y-1 ${
                  isOtherRole ? "border-primary bg-primary/10 ring-2 ring-primary" : "bg-card hover:bg-muted"
                }`}
                style={{ boxShadow: isOtherRole ? "5px 5px 0 hsl(var(--primary))" : "5px 5px 0 hsl(var(--ink))" }}
              >
                <span className="text-2xl"><PenLine className="h-6 w-6" /></span>
                <span className={`font-heading font-bold ${isOtherRole ? "text-primary" : ""}`}>Other</span>
              </button>
            </div>
            {isOtherRole && (
              <div className="mb-8">
                <input
                  type="text"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="Type your role (e.g. Sales Manager)"
                  className="neo-card w-full border-2 border-ink bg-card p-4 font-heading font-bold placeholder:font-normal placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
            <button onClick={() => setStep(2)} disabled={!effectiveRole} className="neo-btn bg-primary text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fadeUp">
            <h1 className="mb-2 font-heading text-3xl font-extrabold">Pick your level</h1>
            <p className="mb-8 text-muted-foreground">How much experience do you have?</p>
            <div className="mb-8 space-y-3">
              {levels.map((level) => (
                <button
                  key={level.id}
                  onClick={() => setSelectedLevel(level.id)}
                  className={`neo-card flex w-full items-center justify-between p-5 text-left transition-all ${
                    selectedLevel === level.id ? "border-primary bg-primary/10 ring-2 ring-primary" : "bg-card hover:bg-muted"
                  }`}
                  style={{ boxShadow: selectedLevel === level.id ? "5px 5px 0 hsl(var(--primary))" : "5px 5px 0 hsl(var(--ink))" }}
                >
                  <div>
                    <div className={`font-heading font-bold ${selectedLevel === level.id ? "text-primary" : ""}`}>{level.label}</div>
                    <div className="text-sm text-muted-foreground">{level.desc}</div>
                  </div>
                  {selectedLevel === level.id && <Check className="h-6 w-6 text-primary" />}
                </button>
              ))}
            </div>
            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="neo-btn bg-background text-foreground"><ArrowLeft className="h-4 w-4" /> Back</button>
              <button onClick={() => setStep(3)} disabled={!selectedLevel} className="neo-btn bg-primary text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fadeUp">
            <h1 className="mb-2 font-heading text-3xl font-extrabold">Upload your CV</h1>
            <p className="mb-6 text-muted-foreground">Optional, but helps us tailor questions to your experience.</p>
            <div className="mb-6 flex flex-wrap gap-2">
              <span className="neo-badge bg-primary text-primary-foreground">{roleLabel}</span>
              <span className="neo-badge bg-muted text-muted-foreground">{levelLabel}</span>
              <span className={`neo-badge ${language === "ar" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                {language === "ar" ? "عربي 🇪🇬" : "English 🇬🇧"}
              </span>
            </div>

            <label
              className={`neo-card mb-6 flex w-full cursor-pointer flex-col items-center justify-center border-2 border-dashed p-12 transition-colors ${
                cvFile ? "border-success bg-success/10" : "border-ink bg-card hover:bg-muted"
              }`}
            >
              <input type="file" accept=".pdf" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0] || null;
                if (file && file.size > 5 * 1024 * 1024) {
                  toast.error("CV must be under 5 MB");
                  e.target.value = "";
                  return;
                }
                setCvFile(file);
              }} />
              {cvFile ? (
                <>
                  <Check className="mb-2 h-10 w-10 text-success" />
                  <span className="font-heading font-bold text-success">{cvFile.name}</span>
                  <span className="text-sm text-muted-foreground">Click to change</span>
                </>
              ) : (
                <>
                  <Upload className="mb-2 h-10 w-10 text-muted-foreground" />
                  <span className="font-heading font-bold">Click to upload your CV</span>
                  <span className="text-sm text-muted-foreground">PDF only (max 5 MB)</span>
                </>
              )}
            </label>

            {credits === 0 && (
              <div className="mb-6 flex items-center gap-3 rounded-xl bg-coral/10 p-4 text-coral">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm font-semibold">You're out of credits! Buy more to start an interview.</span>
              </div>
            )}

            <div className="flex gap-4">
              <button onClick={() => setStep(2)} className="neo-btn bg-background text-foreground"><ArrowLeft className="h-4 w-4" /> Back</button>
              <button
                onClick={handleStartInterview}
                disabled={credits === 0 || starting}
                className="neo-btn flex-1 bg-primary text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {starting ? "Starting..." : "Start Interview (1 credit)"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default NewInterview;
