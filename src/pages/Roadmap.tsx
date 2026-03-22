import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import Logo from "@/components/Logo";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  BookOpen,
  CheckSquare,
  Square,
  TrendingUp,
  Loader2,
  Mic,
  ArrowRight,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RoadmapItem {
  title: string;
  desc: string;
  resource: string;
}

interface ReportRow {
  overall_score: number;
  comm_score: number;
  tech_score: number;
  conf_score: number;
  struct_score: number;
  clarity_score: number;
  impact_score: number;
  roadmap: RoadmapItem[];
  created_at: string;
  interviews: { role: string; level: string } | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DONE_KEY = "hireready_roadmap_done_v1";

const DIMENSIONS = [
  { key: "comm_score",    label: "Communication", short: "Comm",    emoji: "🗣️" },
  { key: "tech_score",    label: "Technical",     short: "Tech",    emoji: "⚙️" },
  { key: "conf_score",    label: "Confidence",    short: "Conf",    emoji: "💪" },
  { key: "struct_score",  label: "Structure",     short: "Struct",  emoji: "📐" },
  { key: "clarity_score", label: "Clarity",       short: "Clarity", emoji: "💡" },
  { key: "impact_score",  label: "Impact",        short: "Impact",  emoji: "🎯" },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const scoreColor = (s: number) =>
  s >= 80 ? "text-success" : s >= 65 ? "text-primary" : "text-coral";

const scoreBg = (s: number) =>
  s >= 80 ? "bg-success/15 border-success/30" : s >= 65 ? "bg-primary/10 border-primary/30" : "bg-coral/10 border-coral/30";

const dedup = (items: RoadmapItem[]): RoadmapItem[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title.toLowerCase().replace(/\s+/g, "").slice(0, 18);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const ProgressTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border-2 border-ink bg-card px-3 py-2 shadow-lg">
      <p className="font-heading text-xs font-bold uppercase text-muted-foreground">{label}</p>
      <p className="font-heading text-lg font-extrabold text-primary">{payload[0].value}%</p>
      {payload[0].payload.role && (
        <p className="text-xs text-muted-foreground">{payload[0].payload.role}</p>
      )}
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

const Roadmap = () => {
  const { user } = useAuth();

  const [doneItems, setDoneItems] = useState<Set<string>>(() => {
    try {
      const s = localStorage.getItem(DONE_KEY);
      return s ? new Set(JSON.parse(s)) : new Set();
    } catch {
      return new Set();
    }
  });

  const { data: reports = [], isLoading } = useQuery<ReportRow[]>({
    queryKey: ["roadmap-reports", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select(
          "overall_score, comm_score, tech_score, conf_score, struct_score, clarity_score, impact_score, roadmap, created_at, interviews:interview_id(role, level)"
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        interviews: Array.isArray(r.interviews) ? r.interviews[0] : r.interviews,
        roadmap: (r.roadmap as unknown as RoadmapItem[]) ?? [],
      })) as ReportRow[];
    },
    enabled: !!user,
  });

  const toggleDone = (title: string) => {
    setDoneItems((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      localStorage.setItem(DONE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const avgDim = (key: string) => {
    const vals = reports
      .map((r) => r[key as keyof ReportRow] as number)
      .filter((v) => typeof v === "number" && v > 0);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  };

  const avgOverall =
    reports.length > 0
      ? Math.round(reports.reduce((s, r) => s + r.overall_score, 0) / reports.length)
      : 0;

  const radarData = DIMENSIONS.map((d) => ({
    dimension: d.short,
    score: avgDim(d.key),
    fullMark: 100,
  }));

  const progressData = reports.map((r, i) => ({
    label: `S${i + 1}`,
    score: r.overall_score,
    role: r.interviews?.role ?? "Interview",
  }));

  const dimWithAvg = DIMENSIONS.map((d) => ({ ...d, avg: avgDim(d.key) }));
  const weakDimensions = dimWithAvg.filter((d) => d.avg < 70).sort((a, b) => a.avg - b.avg);
  const strongDimensions = dimWithAvg.filter((d) => d.avg >= 80);

  const mostImproved = (() => {
    if (reports.length < 2) return null;
    const first = reports[0];
    const last = reports[reports.length - 1];
    let best = { label: "", gain: -Infinity };
    DIMENSIONS.forEach((d) => {
      const gain = (last[d.key as keyof ReportRow] as number) - (first[d.key as keyof ReportRow] as number);
      if (gain > best.gain) best = { label: d.label, gain };
    });
    return best.gain > 0 ? best : null;
  })();

  const allItems = dedup(reports.flatMap((r) => r.roadmap ?? []));
  const pendingItems = allItems.filter((i) => !doneItems.has(i.title));
  const completedItems = allItems.filter((i) => doneItems.has(i.title));

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  if (reports.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="sticky top-0 z-50 border-b-2 border-ink bg-background/95 backdrop-blur">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <Link to="/dashboard"><Logo /></Link>
            <Link to="/dashboard" className="neo-btn bg-background text-foreground text-sm">
              Dashboard
            </Link>
          </div>
        </nav>
        <div className="flex flex-col items-center justify-center py-32 text-center px-4">
          <div className="neo-card max-w-md bg-card p-10">
            <Mic className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 font-heading text-2xl font-extrabold">No sessions yet</h2>
            <p className="mb-6 text-muted-foreground text-sm">
              Complete your first interview and your personalised learning roadmap will be built automatically.
            </p>
            <Link to="/interview/new" className="neo-btn bg-primary text-primary-foreground">
              Start Your First Interview <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b-2 border-ink bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Link to="/dashboard"><Logo /></Link>
            <div className="hidden items-center gap-6 md:flex">
              <Link to="/dashboard" className="font-body text-sm font-semibold text-muted-foreground hover:text-foreground">
                Dashboard
              </Link>
              <Link to="/roadmap" className="font-body text-sm font-semibold text-foreground">
                My Roadmap
              </Link>
            </div>
          </div>
          <Link to="/interview/new" className="neo-btn bg-primary text-primary-foreground text-sm">
            New Interview
          </Link>
        </div>
      </nav>

      <main className="container mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-1 font-heading text-3xl font-extrabold">
            Your Learning Roadmap
          </h1>
          <p className="text-muted-foreground text-sm">
            Built from{" "}
            <span className="font-bold text-foreground">{reports.length}</span>{" "}
            interview {reports.length === 1 ? "session" : "sessions"} · updated after every interview
          </p>
        </div>

        {/* Stats row */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="neo-card flex items-center gap-4 bg-primary p-5 text-primary-foreground">
            <TrendingUp className="h-8 w-8 flex-shrink-0" />
            <div>
              <div className="font-heading text-2xl font-bold">{avgOverall}%</div>
              <div className="text-sm opacity-80">Average Score</div>
            </div>
          </div>
          <div className="neo-card flex items-center gap-4 bg-card p-5">
            <BookOpen className="h-8 w-8 flex-shrink-0 text-primary" />
            <div>
              <div className="font-heading text-2xl font-bold">{pendingItems.length}</div>
              <div className="text-sm text-muted-foreground">Actions to do</div>
            </div>
          </div>
          <div
            className={`neo-card flex items-center gap-4 p-5 ${
              weakDimensions.length > 0 ? "bg-coral/10" : "bg-success/10"
            }`}
          >
            <AlertTriangle
              className={`h-8 w-8 flex-shrink-0 ${weakDimensions.length > 0 ? "text-coral" : "text-success"}`}
            />
            <div>
              <div className="font-heading text-lg font-bold truncate">
                {weakDimensions.length > 0
                  ? weakDimensions[0].label
                  : strongDimensions[0]?.label ?? "On track"}
              </div>
              <div className="text-sm text-muted-foreground">
                {weakDimensions.length > 0 ? "Weakest area" : "Strongest area"}
              </div>
            </div>
          </div>
        </div>

        {/* Score over time */}
        <div className="neo-card mb-8 bg-card p-6">
          <h2 className="mb-1 font-heading text-lg font-bold">Score Over Time</h2>
          <p className="mb-5 text-xs text-muted-foreground">
            {reports.length < 2
              ? "Complete more interviews to see your progress trend."
              : `${mostImproved ? `Most improved: ${mostImproved.label} (+${mostImproved.gain} pts)` : "Keep practicing to see gains."}`}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={progressData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ProgressTooltip />} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={{ r: 5, fill: "hsl(var(--primary))", strokeWidth: 2, stroke: "hsl(var(--background))" }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Radar + Weak dimensions */}
        <div className="mb-8 grid gap-6 md:grid-cols-2">
          {/* Radar chart */}
          <div className="neo-card bg-card p-6">
            <h2 className="mb-1 font-heading text-lg font-bold">Skill Profile</h2>
            <p className="mb-4 text-xs text-muted-foreground">Average across all sessions</p>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis
                  dataKey="dimension"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  tickCount={4}
                />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* All dimensions breakdown */}
          <div className="neo-card bg-card p-6">
            <h2 className="mb-1 font-heading text-lg font-bold">Dimension Breakdown</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Below 70 = focus area · 70–79 = developing · 80+ = strong
            </p>
            <div className="space-y-3">
              {dimWithAvg
                .sort((a, b) => a.avg - b.avg)
                .map((d) => (
                  <div key={d.key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span>{d.emoji}</span>
                        <span className="font-semibold">{d.label}</span>
                        {d.avg < 70 && (
                          <span className="rounded-full bg-coral/15 px-1.5 py-0.5 font-heading text-[9px] font-bold uppercase tracking-wide text-coral">
                            Focus
                          </span>
                        )}
                      </span>
                      <span className={`font-heading font-bold ${scoreColor(d.avg)}`}>{d.avg}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${
                          d.avg >= 80 ? "bg-success" : d.avg >= 65 ? "bg-primary" : "bg-coral"
                        }`}
                        style={{ width: `${d.avg}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Action Items checklist */}
        <div className="neo-card bg-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg font-bold">Your Action Plan</h2>
              <p className="text-xs text-muted-foreground">
                {completedItems.length} of {allItems.length} completed · pulled from all your sessions
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{
                    width: allItems.length > 0 ? `${(completedItems.length / allItems.length) * 100}%` : "0%",
                  }}
                />
              </div>
              <span className="font-heading text-sm font-bold text-success">
                {allItems.length > 0
                  ? Math.round((completedItems.length / allItems.length) * 100)
                  : 0}%
              </span>
            </div>
          </div>

          {/* Pending items */}
          {pendingItems.length === 0 && completedItems.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No action items yet — complete an interview to get your personalised plan.
            </p>
          )}

          {pendingItems.length > 0 && (
            <div className="mb-6 space-y-3">
              {pendingItems.map((item, i) => (
                <div
                  key={i}
                  className="flex gap-4 rounded-xl border-2 border-ink bg-background p-4 transition-all hover:border-primary/30"
                >
                  <button
                    onClick={() => toggleDone(item.title)}
                    className="mt-0.5 flex-shrink-0 text-muted-foreground transition-colors hover:text-primary"
                    title="Mark as done"
                  >
                    <Square className="h-5 w-5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <h4 className="mb-1 font-heading font-bold">{item.title}</h4>
                    <p className="mb-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 font-heading text-xs font-semibold text-primary">
                      <ExternalLink className="h-3 w-3" />
                      {item.resource}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Completed items */}
          {completedItems.length > 0 && (
            <div>
              <p className="mb-3 font-heading text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Completed ({completedItems.length})
              </p>
              <div className="space-y-2">
                {completedItems.map((item, i) => (
                  <div
                    key={i}
                    className="flex gap-4 rounded-xl border-2 border-success/20 bg-success/5 p-3 opacity-70"
                  >
                    <button
                      onClick={() => toggleDone(item.title)}
                      className="mt-0.5 flex-shrink-0 text-success"
                      title="Mark as incomplete"
                    >
                      <CheckSquare className="h-5 w-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-heading text-sm font-bold line-through">{item.title}</h4>
                      <p className="text-xs text-muted-foreground line-through">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="neo-card mt-8 bg-primary p-8 text-center text-primary-foreground">
          <h3 className="mb-2 font-heading text-xl font-bold">Keep improving your score</h3>
          <p className="mb-5 text-sm text-primary-foreground/70">
            Every session updates your roadmap with fresh, personalised action items.
          </p>
          <Link to="/interview/new" className="neo-btn bg-lime text-lime-foreground">
            Start Next Interview <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Roadmap;
