"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Timestamp } from "@/components/ui/timestamp";
import { CopyButton } from "@/components/ui/copy-button";
import type { PullRequestSummary } from "@/lib/types";

interface RecentPRsListProps {
  prs: PullRequestSummary[];
  limit?: number;
}

const statusColors: Record<string, string> = {
  open: "text-foreground/70 border-foreground/15",
  merged: "text-emerald-400 border-emerald-500/25",
  closed: "text-red-400 border-red-500/25",
};

function QualityDot({ score }: { score: number }) {
  const cls = score >= 80 ? "q-high" : score >= 60 ? "q-mid" : "q-low";
  return (
    <span className={`quality-ring ${cls}`} title={`Quality: ${score.toFixed(1)}`}>
      {score.toFixed(0)}
    </span>
  );
}

function PMergeBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? "text-emerald-400 border-emerald-500/25"
      : score >= 40
        ? "text-amber-400 border-amber-500/25"
        : "text-red-400 border-red-500/25";
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1 py-0 rounded border text-[9px] font-mono tabular-nums ${color}`}
      title={`P(merge): ${score}`}
    >
      P{score}
    </span>
  );
}

export function RecentPRsList({ prs, limit = 5 }: RecentPRsListProps) {
  const displayed = prs.slice(0, limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Recent PRs</span>
          {prs.length > 0 && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono">
              {prs.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {displayed.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No PRs yet</p>
            <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">Waiting for first PR...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map((pr) => (
              <div
                key={pr.id}
                className="flex items-center gap-3 py-1.5 px-2 -mx-2 rounded-md hover:bg-muted/40 transition-colors group"
              >
                {/* Quality ring */}
                {pr.qualityScore != null ? (
                  <QualityDot score={pr.qualityScore} />
                ) : (
                  <span className="quality-ring text-muted-foreground/30 border-muted-foreground/20">--</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">
                    <CopyButton value={`${pr.repo}#${pr.number}`} className="inline">
                      <span className="text-muted-foreground">#{pr.number}</span>
                    </CopyButton>{" "}
                    {pr.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <CopyButton value={pr.repo}>
                      <span className="text-[10px] text-muted-foreground/60 font-mono">
                        {pr.repo}
                      </span>
                    </CopyButton>
                    <Timestamp
                      date={pr.createdAt}
                      className="text-[10px] text-muted-foreground/40 font-mono"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {pr.mergeProbability != null && (
                    <PMergeBadge score={pr.mergeProbability} />
                  )}
                  <Badge variant="outline" className={`text-[10px] font-mono ${statusColors[pr.status] || ""}`}>
                    {pr.status}
                  </Badge>
                  <a
                    href={`https://github.com/${pr.repo}/pull/${pr.number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gh-link"
                    title={`Open ${pr.repo}#${pr.number} on GitHub`}
                  >
                    <span className="gh-link-icon text-[9px] font-mono">GH</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
