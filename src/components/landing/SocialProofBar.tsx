import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  total_users: number;
  total_interviews: number;
}

const formatCount = (n: number) => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k+`;
  return `${n}+`;
};

const SocialProofBar = () => {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    supabase.functions
      .invoke("get-stats")
      .then(({ data }) => {
        if (data && typeof data.total_users === "number") {
          setStats(data);
        }
      })
      .catch(() => {
        // Silently fail — banner just won't show
      });
  }, []);

  if (!stats || (stats.total_users === 0 && stats.total_interviews === 0)) return null;

  return (
    <div className="w-full border-b border-border bg-lime/10 py-3">
      <div className="container mx-auto flex flex-wrap items-center justify-center gap-6 px-4 text-center text-sm font-semibold">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔥</span>
          <span>
            <span className="font-heading text-base font-extrabold text-foreground">
              {formatCount(stats.total_users)}
            </span>{" "}
            <span className="text-muted-foreground">job seekers signed up</span>
          </span>
        </div>
        <div className="h-4 w-px bg-border hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <span>
            <span className="font-heading text-base font-extrabold text-foreground">
              {formatCount(stats.total_interviews)}
            </span>{" "}
            <span className="text-muted-foreground">mock interviews completed</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default SocialProofBar;
