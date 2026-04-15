"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRepoHealth, type RepoHealth } from "@/lib/hooks/use-repo-health";
import { formatPercentage } from "@/lib/utils";

const engagementConfig = {
  responsive: {
    label: "Responsive",
    color: "text-emerald-400 border-emerald-500/25",
    dot: "bg-emerald-500",
  },
  slow: {
    label: "Slow",
    color: "text-amber-400 border-amber-500/25",
    dot: "bg-amber-500",
  },
  dead: {
    label: "Dead",
    color: "text-red-400 border-red-500/25",
    dot: "bg-red-500",
  },
};

const actionConfig = {
  target_actively: {
    label: "Target Actively",
    color: "text-emerald-400 border-emerald-500/25 bg-emerald-500/8",
    description: "Proven merge history, submit substantive PRs",
  },
  one_more_try: {
    label: "One More Try",
    color: "text-cyan-400 border-cyan-500/25 bg-cyan-500/8",
    description: "Got review but not merged, follow up",
  },
  build_trust_first: {
    label: "Build Trust",
    color: "text-amber-400 border-amber-500/25 bg-amber-500/8",
    description: "Good repo, start with small PR to build reputation",
  },
  avoid: {
    label: "Avoid",
    color: "text-red-400 border-red-500/25 bg-red-500/8",
    description: "Dead or hostile, don't waste tokens",
  },
};

function HealthScoreRing({ score }: { score: number }) {
  const color =
    score >= 60
      ? "text-emerald-400 border-emerald-500/40"
      : score >= 30
        ? "text-amber-400 border-amber-500/40"
        : "text-red-400 border-red-500/40";

  return (
    <div
      className={`inline-flex items-center justify-center w-12 h-12 rounded-full border-2 font-bold text-sm font-mono tabular-nums ${color}`}
    >
      {score}
    </div>
  );
}

function MiniMetric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="stat-label">{label}</div>
      <div className={`text-sm font-bold tabular-nums mt-0.5 font-mono ${color || ""}`}>
        {value}
      </div>
    </div>
  );
}

function RepoCard({ repo }: { repo: RepoHealth }) {
  const eng = engagementConfig[repo.engagement];
  const action = actionConfig[repo.recommendedAction];

  return (
    <Card className="card-lift">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <HealthScoreRing score={repo.healthScore} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-sm font-semibold truncate">{repo.repo}</h3>
              <Badge
                variant="outline"
                className={`text-[10px] h-4 px-1.5 font-mono shrink-0 ${eng.color}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${eng.dot} mr-1`} />
                {eng.label}
              </Badge>
              <Badge
                variant="outline"
                className={`text-[10px] h-4 px-1.5 font-mono shrink-0 ${action.color}`}
                title={action.description}
              >
                {action.label}
              </Badge>
            </div>

            {/* PR status row */}
            <div className="flex items-center gap-1 mb-3">
              <span className="text-[10px] font-mono text-muted-foreground/50">
                {repo.prs.total} PRs
              </span>
              <span className="text-muted-foreground/20 text-[10px]">|</span>
              <span className="text-[10px] font-mono text-emerald-400/70">
                {repo.prs.merged} merged
              </span>
              <span className="text-muted-foreground/20 text-[10px]">|</span>
              <span className="text-[10px] font-mono text-red-400/70">
                {repo.prs.closed} rejected
              </span>
              <span className="text-muted-foreground/20 text-[10px]">|</span>
              <span className="text-[10px] font-mono text-foreground/40">
                {repo.prs.open} open
              </span>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-6 gap-3 pt-2 border-t border-foreground/[0.04]">
              <MiniMetric
                label="Merge Rate"
                value={formatPercentage(repo.prs.mergeRate)}
                color={
                  repo.prs.mergeRate >= 20
                    ? "text-emerald-400"
                    : repo.prs.mergeRate > 0
                      ? "text-red-400"
                      : ""
                }
              />
              <MiniMetric
                label="Review Rate"
                value={formatPercentage(repo.prs.reviewRate)}
                color={
                  repo.prs.reviewRate >= 50
                    ? "text-emerald-400"
                    : repo.prs.reviewRate > 0
                      ? "text-amber-400"
                      : ""
                }
              />
              <MiniMetric
                label="Prediction"
                value={`${repo.mergePrediction}%`}
                color={
                  repo.mergePrediction >= 60
                    ? "text-emerald-400"
                    : repo.mergePrediction >= 30
                      ? "text-amber-400"
                      : "text-red-400"
                }
              />
              <MiniMetric
                label="Merge Velocity"
                value={
                  repo.velocity
                    ? `${repo.velocity.avgDays}d`
                    : "--"
                }
              />
              <MiniMetric
                label="1st Review"
                value={
                  repo.timeToFirstReview != null
                    ? `${repo.timeToFirstReview}d`
                    : "--"
                }
              />
              <MiniMetric
                label="Avg Diff"
                value={
                  repo.avgDiffSize > 0
                    ? `${repo.avgDiffSize}L`
                    : "--"
                }
                color={
                  repo.avgDiffSize > 0 && repo.avgDiffSize < 20
                    ? "text-emerald-400"
                    : repo.avgDiffSize >= 100
                      ? "text-red-400"
                      : ""
                }
              />
            </div>

            {/* Follow-up row */}
            {repo.followUps.total > 0 && (
              <div className="mt-2 pt-2 border-t border-foreground/[0.04] flex items-center gap-3 text-[10px] font-mono text-muted-foreground/50">
                <span>
                  follow-ups:{" "}
                  <span className="text-foreground/60">{repo.followUps.total}</span>
                </span>
                {repo.followUps.active > 0 && (
                  <span>
                    active:{" "}
                    <span className="text-amber-400">{repo.followUps.active}</span>
                  </span>
                )}
                {repo.followUps.successes > 0 && (
                  <span>
                    led to merge:{" "}
                    <span className="text-emerald-400">{repo.followUps.successes}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Merge rate bar */}
        <div className="mt-3 h-1 rounded-full bg-foreground/[0.04] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              repo.prs.mergeRate >= 20
                ? "bg-emerald-500/50"
                : repo.prs.mergeRate > 0
                  ? "bg-red-500/40"
                  : "bg-foreground/10"
            }`}
            style={{ width: `${Math.max(repo.prs.mergeRate, 1)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCards({ repos }: { repos: RepoHealth[] }) {
  const totalRepos = repos.length;
  const responsive = repos.filter((r) => r.engagement === "responsive").length;
  const slow = repos.filter((r) => r.engagement === "slow").length;
  const dead = repos.filter((r) => r.engagement === "dead").length;
  const avgHealth =
    totalRepos > 0
      ? Math.round(repos.reduce((sum, r) => sum + r.healthScore, 0) / totalRepos)
      : 0;
  const totalMerged = repos.reduce((sum, r) => sum + r.prs.merged, 0);
  const totalSubmitted = repos.reduce((sum, r) => sum + r.prs.total, 0);
  const overallMergeRate =
    totalSubmitted > 0 ? Math.round((totalMerged / totalSubmitted) * 1000) / 10 : 0;

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      <Card className="metric-card">
        <CardContent className="p-4 pb-3">
          <div className="stat-label">Repos</div>
          <div className="text-xl font-bold tabular-nums mt-1">{totalRepos}</div>
        </CardContent>
      </Card>
      <Card className="metric-card">
        <CardContent className="p-4 pb-3">
          <div className="stat-label">Avg Health</div>
          <div className={`text-xl font-bold tabular-nums mt-1 ${avgHealth >= 40 ? "text-emerald-400" : "text-red-400"}`}>
            {avgHealth}
          </div>
        </CardContent>
      </Card>
      <Card className="metric-card">
        <CardContent className="p-4 pb-3">
          <div className="stat-label">Merge Rate</div>
          <div className={`text-xl font-bold tabular-nums mt-1 ${overallMergeRate >= 10 ? "text-emerald-400" : "text-red-400"}`}>
            {overallMergeRate}%
          </div>
        </CardContent>
      </Card>
      <Card className="metric-card">
        <CardContent className="p-4 pb-3">
          <div className="stat-label">Responsive</div>
          <div className="text-xl font-bold tabular-nums mt-1 text-emerald-400">{responsive}</div>
        </CardContent>
      </Card>
      <Card className="metric-card">
        <CardContent className="p-4 pb-3">
          <div className="stat-label">Slow</div>
          <div className="text-xl font-bold tabular-nums mt-1 text-amber-400">{slow}</div>
        </CardContent>
      </Card>
      <Card className="metric-card">
        <CardContent className="p-4 pb-3">
          <div className="stat-label">Dead</div>
          <div className="text-xl font-bold tabular-nums mt-1 text-red-400">{dead}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ReposPage() {
  const { data: repos, isLoading } = useRepoHealth("90d");

  return (
    <div className="flex flex-col">
      <Header title="Repo Health" />
      <div className="flex-1 space-y-8 p-6 lg:p-8">
        {isLoading ? (
          <div className="space-y-4">
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <>
            <SummaryCards repos={repos || []} />

            {(!repos || repos.length === 0) ? (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">No repo data yet</p>
                  <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">
                    Sync PRs from GitHub to see repo health scores
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {repos.map((repo) => (
                  <RepoCard key={repo.repo} repo={repo} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
