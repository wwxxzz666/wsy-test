"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useResponseTimes,
  type ResponseBucket,
  type RepoResponseStat,
} from "@/lib/hooks/use-response-times";

function DistributionBar({
  bucket,
  maxCount,
}: {
  bucket: ResponseBucket;
  maxCount: number;
}) {
  const width = maxCount > 0 ? Math.max((bucket.count / maxCount) * 100, 3) : 3;
  const isGood = bucket.max <= 24;
  const isBad = bucket.min >= 72;

  return (
    <div className="flex items-center gap-2 text-[10px] font-mono">
      <span className="w-10 text-right text-muted-foreground/50 shrink-0">
        {bucket.label}
      </span>
      <div className="flex-1 h-[6px] bg-foreground/5 rounded-[2px] overflow-hidden">
        <div
          className={`h-full rounded-[2px] transition-all ${
            isGood
              ? "bg-emerald-500/40"
              : isBad
                ? "bg-red-500/30"
                : "bg-amber-500/30"
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span
        className={`w-6 text-right tabular-nums shrink-0 ${
          isGood
            ? "text-emerald-400/70"
            : isBad
              ? "text-red-400/70"
              : "text-amber-400/70"
        }`}
      >
        {bucket.count}
      </span>
    </div>
  );
}

function RepoResponseRow({ stat }: { stat: RepoResponseStat }) {
  const shortRepo = stat.repo.includes("/") ? stat.repo.split("/")[1] : stat.repo;
  const owner = stat.repo.includes("/") ? stat.repo.split("/")[0] : "";

  function formatHours(h: number | null): string {
    if (h == null) return "--";
    if (h < 1) return `${Math.round(h * 60)}m`;
    if (h < 24) return `${Math.round(h)}h`;
    return `${(h / 24).toFixed(1)}d`;
  }

  return (
    <div className="flex items-center gap-2 text-[10px] font-mono py-1 px-2 -mx-2 rounded-md hover:bg-muted/40">
      <span
        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
          stat.reviewRate >= 50
            ? "bg-emerald-500"
            : stat.reviewRate > 0
              ? "bg-amber-500"
              : "bg-red-500"
        }`}
      />
      <a
        href={`https://github.com/${stat.repo}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground/70 hover:underline truncate flex-1 min-w-0"
      >
        {owner && <span className="text-muted-foreground/40">{owner}/</span>}
        {shortRepo}
      </a>
      <span className="text-muted-foreground/40 tabular-nums shrink-0">
        {stat.reviewed}/{stat.total}
      </span>
      <span
        className={`w-12 text-right tabular-nums shrink-0 ${
          stat.medianHours != null && stat.medianHours <= 12
            ? "text-emerald-400/70"
            : stat.medianHours != null && stat.medianHours <= 48
              ? "text-amber-400/70"
              : "text-red-400/70"
        }`}
      >
        {formatHours(stat.medianHours)}
      </span>
    </div>
  );
}

export function ResponseTimePanel() {
  const { data, isLoading } = useResponseTimes();

  if (isLoading) {
    return (
      <Card className="metric-card card-lift">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Response Times</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-4 rounded bg-muted/30 animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.summary.totalPRs === 0) {
    return (
      <Card className="metric-card card-lift">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Response Times</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No response data yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { distribution, repoRanking, summary } = data;
  const maxBucket = Math.max(...distribution.map((b) => b.count), 1);

  function formatHours(h: number | null): string {
    if (h == null) return "--";
    if (h < 1) return `${Math.round(h * 60)}m`;
    if (h < 24) return `${Math.round(h)}h`;
    return `${(h / 24).toFixed(1)}d`;
  }

  return (
    <Card className="metric-card card-lift">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Response Times</span>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-[10px] h-4 px-1.5 font-mono ${
                summary.reviewRate >= 50
                  ? "text-emerald-400 border-emerald-500/25"
                  : summary.reviewRate >= 20
                    ? "text-amber-400 border-amber-500/25"
                    : "text-red-400 border-red-500/25"
              }`}
            >
              {summary.reviewRate}% reviewed
            </Badge>
            {summary.medianHours != null && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-mono text-muted-foreground/60 border-muted-foreground/20"
              >
                median: {formatHours(summary.medianHours)}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Distribution */}
        <div>
          <div className="text-[9px] font-mono text-muted-foreground/30 uppercase tracking-wider mb-2">
            Time to First Review
          </div>
          <div className="space-y-1">
            {distribution.map((bucket) => (
              <DistributionBar
                key={bucket.label}
                bucket={bucket}
                maxCount={maxBucket}
              />
            ))}
          </div>
        </div>

        {/* Unreviewed callout */}
        {summary.unreviewed > 0 && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-red-500/5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
            <span className="text-[10px] font-mono text-red-400/70">
              {summary.unreviewed} PR{summary.unreviewed !== 1 ? "s" : ""} with zero reviews
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/30 ml-auto">
              {Math.round((summary.unreviewed / summary.totalPRs) * 100)}% of total
            </span>
          </div>
        )}

        {/* Repo ranking */}
        {repoRanking.length > 0 && (
          <div>
            <div className="text-[9px] font-mono text-muted-foreground/30 uppercase tracking-wider mb-2">
              Repo Response Ranking
            </div>
            <div className="flex items-center gap-2 px-2 -mx-2 text-[8px] font-mono text-muted-foreground/20 uppercase tracking-wider pb-1">
              <span className="w-2" />
              <span className="flex-1">repo</span>
              <span>reviewed</span>
              <span className="w-12 text-right">median</span>
            </div>
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {repoRanking.slice(0, 15).map((stat) => (
                <RepoResponseRow key={stat.repo} stat={stat} />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-foreground/[0.04]">
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/40 flex-wrap gap-1">
            <span>
              median:{" "}
              <span className="text-foreground/50 tabular-nums">{formatHours(summary.medianHours)}</span>
              <span className="text-muted-foreground/20"> | </span>
              avg:{" "}
              <span className="text-foreground/50 tabular-nums">{formatHours(summary.avgHours)}</span>
            </span>
            <span>
              benchmark:{" "}
              <span className="text-muted-foreground/30 tabular-nums">
                AI PRs wait 4.6x longer
              </span>
              {summary.benchmarkHumanMedian != null && (
                <>
                  <span className="text-muted-foreground/20"> = </span>
                  <span className="text-foreground/50 tabular-nums">
                    ~{formatHours(summary.benchmarkHumanMedian)} human equiv
                  </span>
                </>
              )}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
