"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRepoHealth, type RepoHealth } from "@/lib/hooks/use-repo-health";

const engagementColors: Record<string, string> = {
  responsive: "text-emerald-400 border-emerald-500/25",
  slow: "text-amber-400 border-amber-500/25",
  dead: "text-red-400 border-red-500/25",
};

const actionConfig: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  target_actively: { label: "TARGET", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  one_more_try: { label: "RETRY", color: "text-cyan-400", bg: "bg-cyan-500/10" },
  build_trust_first: { label: "WATCH", color: "text-amber-400", bg: "bg-amber-500/10" },
  avoid: { label: "AVOID", color: "text-red-400", bg: "bg-red-500/10" },
};

function HealthBar({ score }: { score: number }) {
  const color =
    score >= 60
      ? "bg-emerald-500/60"
      : score >= 35
        ? "bg-amber-500/60"
        : "bg-red-500/60";
  return (
    <div className="h-1 w-full rounded-full bg-foreground/[0.04] overflow-hidden">
      <div
        className={`h-full rounded-full ${color} transition-all duration-500`}
        style={{ width: `${Math.max(score, 2)}%` }}
      />
    </div>
  );
}

function formatReviewDays(days: number | null): string {
  if (days == null) return "--";
  if (days < 1) return `${Math.round(days * 24)}h`;
  return `${days.toFixed(1)}d`;
}

function RepoRow({ repo }: { repo: RepoHealth }) {
  const action = actionConfig[repo.recommendedAction] || actionConfig.avoid;
  const shortName = repo.repo.includes("/")
    ? repo.repo.split("/")[1]
    : repo.repo;
  const owner = repo.repo.includes("/")
    ? repo.repo.split("/")[0]
    : "";

  return (
    <div className="py-2 px-2 -mx-2 rounded-md hover:bg-muted/40 transition-colors group">
      <div className="flex items-center gap-3">
        {/* Health score */}
        <div className="w-8 text-center shrink-0">
          <span
            className={`text-sm font-bold tabular-nums ${
              repo.healthScore >= 60
                ? "text-emerald-400"
                : repo.healthScore >= 35
                  ? "text-amber-400"
                  : "text-red-400"
            }`}
          >
            {repo.healthScore}
          </span>
        </div>

        {/* Repo name + badges */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <a
              href={`https://github.com/${repo.repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium truncate hover:underline"
              title={repo.repo}
            >
              {owner && (
                <span className="text-muted-foreground/50">{owner}/</span>
              )}
              {shortName}
            </a>
            {repo.nicheFit && (
              <span className="text-[8px] font-mono px-1 py-0.5 rounded-sm bg-violet-500/10 text-violet-400 shrink-0">
                AI
              </span>
            )}
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm ${action.bg} ${action.color} shrink-0`}>
              {action.label}
            </span>
          </div>
          <HealthBar score={repo.healthScore} />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 shrink-0 text-[10px] font-mono tabular-nums">
          <span className="text-muted-foreground/50">
            <span className="text-emerald-400/70">{repo.prs.merged}</span>
            /{repo.prs.total} merged
          </span>
          <Badge
            variant="outline"
            className={`text-[9px] h-4 px-1 font-mono ${engagementColors[repo.engagement] || ""}`}
          >
            {repo.engagement}
          </Badge>
          <span
            className={`w-8 text-center text-[9px] font-mono px-1 py-0.5 rounded-sm ${
              repo.mergePrediction >= 60
                ? "bg-emerald-500/10 text-emerald-400"
                : repo.mergePrediction >= 30
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-red-500/10 text-red-400"
            }`}
            title={`Merge prediction: ${repo.mergePrediction}%`}
          >
            {repo.mergePrediction}%
          </span>
          <span className="text-muted-foreground/40 w-12 text-right">
            {formatReviewDays(repo.timeToFirstReview)} rev
          </span>
        </div>
      </div>
    </div>
  );
}

export function RepoHealthPanel() {
  const { data: repos, isLoading } = useRepoHealth("90d");

  const targetCount = repos?.filter((r) => r.recommendedAction === "target_actively").length ?? 0;
  const nicheCount = repos?.filter((r) => r.nicheFit).length ?? 0;
  const avoidCount = repos?.filter((r) => r.recommendedAction === "avoid").length ?? 0;

  return (
    <Card className="metric-card card-lift">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Repo Health</span>
          <div className="flex items-center gap-2">
            {nicheCount > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-mono text-violet-400 border-violet-500/25"
              >
                {nicheCount} AI niche
              </Badge>
            )}
            {targetCount > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-mono text-emerald-400 border-emerald-500/25"
              >
                {targetCount} target
              </Badge>
            )}
            {avoidCount > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-mono text-red-400 border-red-500/25"
              >
                {avoidCount} avoid
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-8 rounded bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : !repos || repos.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No repo data yet</p>
            <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">
              Repo health scores appear after PRs are submitted
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {/* Header row */}
            <div className="flex items-center gap-3 px-2 -mx-2 text-[9px] font-mono text-muted-foreground/30 uppercase tracking-wider pb-1">
              <span className="w-8 text-center">score</span>
              <span className="flex-1">repository</span>
              <span>merge / engagement / prediction / review</span>
            </div>
            {repos.map((repo) => (
              <RepoRow key={repo.repo} repo={repo} />
            ))}
            {/* Summary bar */}
            {repos.length > 0 && (
              <div className="mt-3 pt-2 border-t border-foreground/[0.04]">
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/40">
                  <span>
                    avg health:{" "}
                    <span className="text-foreground/60 tabular-nums">
                      {Math.round(
                        repos.reduce((sum, r) => sum + r.healthScore, 0) /
                          repos.length
                      )}
                    </span>
                  </span>
                  {nicheCount > 0 && (
                    <span>
                      niche merge rate:{" "}
                      <span className="text-violet-400/70 tabular-nums">
                        {(() => {
                          const nicheRepos = repos.filter((r) => r.nicheFit);
                          const total = nicheRepos.reduce((s, r) => s + r.prs.total, 0);
                          const merged = nicheRepos.reduce((s, r) => s + r.prs.merged, 0);
                          return total > 0 ? ((merged / total) * 100).toFixed(1) : "0";
                        })()}%
                      </span>
                    </span>
                  )}
                  <span>
                    overall merge rate:{" "}
                    <span className="text-foreground/60 tabular-nums">
                      {repos.reduce((s, r) => s + r.prs.total, 0) > 0
                        ? (
                            (repos.reduce((s, r) => s + r.prs.merged, 0) /
                              repos.reduce((s, r) => s + r.prs.total, 0)) *
                            100
                          ).toFixed(1)
                        : "0"}
                      %
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
