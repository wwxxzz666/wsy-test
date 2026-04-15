"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStalePRs, type StalePR } from "@/lib/hooks/use-stale-prs";

const recConfig = {
  rework: {
    label: "REWORK",
    color: "text-orange-400 border-orange-500/25 bg-orange-500/8",
    description: "No engagement — rework with a different approach",
  },
  followup: {
    label: "FOLLOW UP",
    color: "text-cyan-400 border-cyan-500/25 bg-cyan-500/8",
    description: "Reviewer asked for changes, respond to convert",
  },
  wait: {
    label: "WAIT",
    color: "text-amber-400 border-amber-500/25 bg-amber-500/8",
    description: "Has human interest, may still convert",
  },
};

function StalePRRow({ pr }: { pr: StalePR }) {
  const rec = recConfig[pr.recommendation];
  const shortName = pr.repo.includes("/")
    ? pr.repo.split("/")[1]
    : pr.repo;
  const owner = pr.repo.includes("/")
    ? pr.repo.split("/")[0]
    : "";

  return (
    <div className="py-2 px-2 -mx-2 rounded-md hover:bg-muted/40 transition-colors group">
      <div className="flex items-center gap-3">
        {/* Days open */}
        <div className="w-10 text-center shrink-0">
          <span
            className={`text-sm font-bold tabular-nums ${
              pr.daysOpen >= 14
                ? "text-red-400"
                : pr.daysOpen >= 7
                  ? "text-amber-400"
                  : "text-muted-foreground"
            }`}
          >
            {pr.daysOpen}d
          </span>
        </div>

        {/* PR info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <a
              href={pr.htmlUrl || `https://github.com/${pr.repo}/pull/${pr.number}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm truncate hover:underline"
              title={pr.title}
            >
              <span className="text-muted-foreground/50 text-[11px]">
                {owner}/{shortName}#{pr.number}
              </span>
            </a>
            <Badge
              variant="outline"
              className={`text-[9px] h-4 px-1.5 font-mono shrink-0 ${rec.color}`}
              title={rec.description}
            >
              {rec.label}
            </Badge>
            {pr.hasHumanReview && (
              <span className="text-[8px] font-mono px-1 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-400 shrink-0">
                REVIEWED
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground/50 truncate mt-0.5">
            {pr.title}
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono tabular-nums text-muted-foreground/40">
          <span>
            +{pr.diffSize}
          </span>
          <span>
            {pr.filesChanged}f
          </span>
          {pr.reviewCount > 0 && (
            <span className={pr.hasHumanReview ? "text-emerald-400/60" : "text-muted-foreground/30"}>
              {pr.reviewCount} rev
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function StalePRPanel() {
  const { stalePRs, summary, isLoading } = useStalePRs(7);

  return (
    <Card className="metric-card card-lift">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Stale PR Rework</span>
          <div className="flex items-center gap-2">
            {summary && summary.rework > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-mono text-orange-400 border-orange-500/25"
              >
                {summary.rework} to rework
              </Badge>
            )}
            {summary && summary.followup > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-mono text-cyan-400 border-cyan-500/25"
              >
                {summary.followup} follow up
              </Badge>
            )}
            {summary && summary.wait > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-mono text-amber-400 border-amber-500/25"
              >
                {summary.wait} wait
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
        ) : !stalePRs || stalePRs.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No stale PRs</p>
            <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">
              All open PRs are within the 7-day window
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {/* Header row */}
            <div className="flex items-center gap-3 px-2 -mx-2 text-[9px] font-mono text-muted-foreground/30 uppercase tracking-wider pb-1">
              <span className="w-10 text-center">age</span>
              <span className="flex-1">pull request</span>
              <span>size / reviews</span>
            </div>
            {stalePRs.slice(0, 10).map((pr) => (
              <StalePRRow key={pr.id} pr={pr} />
            ))}
            {stalePRs.length > 10 && (
              <div className="text-center pt-2 text-[10px] font-mono text-muted-foreground/30">
                +{stalePRs.length - 10} more stale PRs
              </div>
            )}
            {/* Summary bar */}
            {summary && (
              <div className="mt-3 pt-2 border-t border-foreground/[0.04]">
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/40">
                  <span>
                    {summary.total} stale PRs
                    <span className="text-muted-foreground/20"> | </span>
                    avg{" "}
                    <span className="text-foreground/60 tabular-nums">
                      {summary.avgDaysOpen}d
                    </span>{" "}
                    open
                  </span>
                  {summary.worstRepos.length > 0 && (
                    <span>
                      worst:{" "}
                      <span className="text-red-400/60">
                        {summary.worstRepos[0].repo.split("/")[1] || summary.worstRepos[0].repo}
                      </span>
                      <span className="text-muted-foreground/20"> ({summary.worstRepos[0].count})</span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
