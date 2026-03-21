import { Link, useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, CheckCircle, Trophy, Mic, ArrowRight, Lightbulb } from "lucide-react";
import DownloadShareCard from "@/components/dashboard/DownloadShareCard";
import { toast } from "sonner";
import { track, Events } from "@/lib/analytics";

interface Interview {
  id: string;
  role: string;
  level: string;
  created_at: string;
  status: string;
}

interface ReportSummary {
  interview_id: string;
  overall_score: number;
  conf_score: number;
  clarity_score: number;
  struct_score: number;
  comm_score: number;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: credits = 0 } = useQuery({
    queryKey: ["credits", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("credits")
        .select("balance")
        .eq("user_id", user!.id)
        .single();
      return data?.balance ?? 0;
    },
    enabled: !!user,
  });

  const { data: interviews = [], isLoading } = useQuery({
    queryKey: ["interviews", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("interviews")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as Interview[];
    },
    enabled: !!user,
  });

  const { data: reportList = [] } = useQuery({
    queryKey: ["reports", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("reports")
        .select("interview_id, overall_score, conf_score, clarity_score, struct_score, comm_score")
        .eq("user_id", user!.id);
      return (data ?? []) as ReportSummary[];
    },
    enabled: !!user,
  });

  const reports: Record<string, ReportSummary> = {};
  reportList.forEach((r) => {
    if (r.overall_score !== null) reports[r.interview_id] = r;
  });

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/");
  };

  const completedInterviews = interviews.filter((i) => i.status === "completed");
  const bestScore = reportList.length > 0
    ? Math.max(...reportList.map((r) => r.overall_score ?? 0))
    : 0;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-primary";
    return "text-coral";
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b-2 border-ink bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Link to="/dashboard"><Logo /></Link>
            <div className="hidden items-center gap-6 md:flex">
              <Link to="/dashboard" className="font-body text-sm font-semibold text-foreground">Dashboard</Link>
              <Link to="/interview/new" className="font-body text-sm font-semibold text-muted-foreground hover:text-foreground">New Interview</Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`neo-badge ${credits === 0 ? "bg-coral text-coral-foreground" : "bg-primary text-primary-foreground"}`}>
              {credits} credits
            </div>
            <button onClick={handleSignOut} className="neo-btn bg-background text-foreground text-sm">Sign out</button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 font-heading text-3xl font-extrabold">Hey there 👋</h1>
          <p className="text-muted-foreground">
            You have <span className="font-bold text-primary">{credits} interviews</span> remaining.
          </p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="neo-card flex items-center gap-4 bg-primary p-5 text-primary-foreground">
            <CreditCard className="h-8 w-8" />
            <div>
              <div className="font-heading text-2xl font-bold">{credits}</div>
              <div className="text-sm opacity-80">Credits Left</div>
            </div>
          </div>
          <div className="neo-card flex items-center gap-4 bg-success p-5 text-success-foreground">
            <CheckCircle className="h-8 w-8" />
            <div>
              <div className="font-heading text-2xl font-bold">{completedInterviews.length}</div>
              <div className="text-sm opacity-80">Done</div>
            </div>
          </div>
          <div className="neo-card flex items-center gap-4 bg-coral p-5 text-coral-foreground">
            <Trophy className="h-8 w-8" />
            <div>
              <div className="font-heading text-2xl font-bold">{bestScore}%</div>
              <div className="text-sm opacity-80">Best Score</div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="neo-card bg-card p-6">
              <h2 className="mb-4 font-heading text-xl font-bold">Past Interviews</h2>
              {completedInterviews.length === 0 ? (
                <div className="py-12 text-center">
                  <Mic className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="mb-4 text-muted-foreground">No interviews yet. Start your first one!</p>
                  <Link to="/interview/new" className="neo-btn bg-primary text-primary-foreground">Start Interview</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {completedInterviews.map((interview) => (
                    <div key={interview.id} className="flex items-center justify-between rounded-xl border-2 border-ink bg-background p-4">
                      <div>
                        <div className="font-heading font-bold">{interview.role}</div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{interview.level}</span>
                          <span>•</span>
                          <span>{new Date(interview.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="neo-badge bg-success/20 text-success">Done</span>
                        {reports[interview.id] && (
                          <>
                            <span className={`font-heading text-lg font-bold ${getScoreColor(reports[interview.id].overall_score)}`}>
                              {reports[interview.id].overall_score}%
                            </span>
                            <DownloadShareCard
                              overallScore={reports[interview.id].overall_score}
                              confScore={reports[interview.id].conf_score}
                              clarityScore={reports[interview.id].clarity_score}
                              structScore={reports[interview.id].struct_score}
                              commScore={reports[interview.id].comm_score}
                              role={interview.role}
                            />
                          </>
                        )}
                        <Link
                          to={`/report/${interview.id}`}
                          onClick={() => track(Events.REPORT_VIEWED, { role: interview.role })}
                          className="flex items-center gap-1 font-semibold text-primary hover:underline"
                        >
                          View <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className={`neo-card p-6 ${credits === 0 ? "bg-coral text-coral-foreground" : "bg-card"}`}>
              <h3 className="mb-2 font-heading text-lg font-bold">Credits</h3>
              <div className="mb-2 font-heading text-4xl font-extrabold">{credits}</div>
              <p className="mb-4 text-sm opacity-80">{credits === 0 ? "You're out of credits!" : "interviews remaining"}</p>
              <Link
                to="/pricing"
                onClick={() => track(Events.CREDITS_PAGE_VIEWED)}
                className={`neo-btn w-full text-center ${credits === 0 ? "bg-background text-foreground" : "bg-primary text-primary-foreground"}`}
              >
                {credits === 0 ? "Get More Credits" : "Buy Credits"}
              </Link>
            </div>
            <div className="neo-card bg-success/10 p-6">
              <div className="mb-2 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-success" />
                <h3 className="font-heading text-lg font-bold text-success">Pro Tip</h3>
              </div>
              <p className="text-sm text-foreground">
                Use the STAR method (Situation, Task, Action, Result) when answering behavioral questions.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
