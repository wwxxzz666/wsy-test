"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useVelocity, type VelocityDay } from "@/lib/hooks/use-velocity";

function DayBar({
  day,
  maxSubmitted,
  barWidth,
  x,
  chartHeight,
}: {
  day: VelocityDay;
  maxSubmitted: number;
  barWidth: number;
  x: number;
  chartHeight: number;
}) {
  if (day.submitted === 0 && day.merged === 0 && day.closed === 0) {
    return null;
  }

  const totalHeight = maxSubmitted > 0 ? (day.submitted / maxSubmitted) * (chartHeight - 16) : 0;
  const mergedHeight = day.submitted > 0 ? (day.merged / day.submitted) * totalHeight : 0;
  const closedHeight = day.submitted > 0 ? (day.closed / day.submitted) * totalHeight : 0;
  const openHeight = totalHeight - mergedHeight - closedHeight;

  const y = chartHeight - totalHeight;

  return (
    <g>
      <title>
        {day.date}: {day.submitted} submitted, {day.merged} merged, {day.closed} closed
      </title>
      {/* Open (pending) section - top */}
      {openHeight > 0 && (
        <rect
          x={x}
          y={y}
          width={barWidth}
          height={openHeight}
          rx={1}
          fill="rgba(56, 189, 248, 0.3)"
        />
      )}
      {/* Closed section - middle */}
      {closedHeight > 0 && (
        <rect
          x={x}
          y={y + openHeight}
          width={barWidth}
          height={closedHeight}
          rx={1}
          fill="rgba(248, 113, 113, 0.35)"
        />
      )}
      {/* Merged section - bottom */}
      {mergedHeight > 0 && (
        <rect
          x={x}
          y={y + openHeight + closedHeight}
          width={barWidth}
          height={mergedHeight}
          rx={1}
          fill="rgba(52, 211, 153, 0.6)"
        />
      )}
    </g>
  );
}

export function VelocityTimeline() {
  const { data, isLoading } = useVelocity();

  if (isLoading) {
    return (
      <Card className="metric-card card-lift">
        <CardHeader>
          <CardTitle className="text-sm font-medium">PR Velocity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 rounded bg-muted/30 animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.days.length === 0) {
    return (
      <Card className="metric-card card-lift">
        <CardHeader>
          <CardTitle className="text-sm font-medium">PR Velocity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No velocity data yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { days, rolling7d, summary } = data;
  const chartWidth = 600;
  const chartHeight = 100;
  const padding = 2;
  const barWidth = Math.max((chartWidth - padding * 2) / days.length - 2, 3);
  const gap = (chartWidth - padding * 2 - barWidth * days.length) / Math.max(days.length - 1, 1);
  const maxSubmitted = Math.max(...days.map((d) => d.submitted), 1);

  // Rolling average line
  const rollingPoints = rolling7d
    .map((r, i) => {
      const x = padding + i * (barWidth + gap) + barWidth / 2;
      const y =
        chartHeight -
        (r.avgSubmitted / maxSubmitted) * (chartHeight - 16);
      return `${x},${y}`;
    })
    .join(" ");

  // X-axis labels (show every 5th day)
  const labels = days
    .map((d, i) => ({
      x: padding + i * (barWidth + gap) + barWidth / 2,
      label: d.date.slice(5), // MM-DD
      show: i % 5 === 0 || i === days.length - 1,
    }))
    .filter((l) => l.show);

  return (
    <Card className="metric-card card-lift">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>PR Velocity</span>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1.5 font-mono text-muted-foreground/60 border-muted-foreground/20"
            >
              {summary.activeDays}d active
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1.5 font-mono text-cyan-400 border-cyan-500/25"
            >
              {summary.avgPerDay}/day avg
            </Badge>
            {summary.peakDay && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1.5 font-mono text-amber-400 border-amber-500/25"
              >
                peak: {summary.peakCount} on {summary.peakDay.slice(5)}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Legend */}
        <div className="flex items-center gap-4 text-[9px] font-mono text-muted-foreground/30">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
            merged
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500/35" />
            closed
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-500/30" />
            open/pending
          </span>
          <span className="flex items-center gap-1 ml-auto">
            <span className="w-3 h-[1px] bg-amber-400/50" />
            7d rolling avg
          </span>
        </div>

        {/* Chart */}
        <div className="w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight + 16}`}
            className="w-full"
            preserveAspectRatio="none"
          >
            {/* Grid lines */}
            {[0.25, 0.5, 0.75, 1].map((frac) => {
              const y = chartHeight - frac * (chartHeight - 16);
              return (
                <line
                  key={frac}
                  x1={0}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.03}
                  strokeWidth={0.5}
                />
              );
            })}

            {/* Bars */}
            {days.map((day, i) => (
              <DayBar
                key={day.date}
                day={day}
                maxSubmitted={maxSubmitted}
                barWidth={barWidth}
                x={padding + i * (barWidth + gap)}
                chartHeight={chartHeight}
              />
            ))}

            {/* Rolling average line */}
            {rollingPoints && (
              <polyline
                points={rollingPoints}
                fill="none"
                stroke="#fbbf24"
                strokeWidth="1.5"
                strokeOpacity="0.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* X-axis labels */}
            {labels.map((l) => (
              <text
                key={l.label}
                x={l.x}
                y={chartHeight + 12}
                textAnchor="middle"
                fill="currentColor"
                fillOpacity={0.15}
                fontSize={7}
                fontFamily="monospace"
              >
                {l.label}
              </text>
            ))}
          </svg>
        </div>

        {/* Summary footer */}
        <div className="pt-2 border-t border-foreground/[0.04]">
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/40 flex-wrap gap-1">
            <span>
              30d:{" "}
              <span className="text-foreground/50 tabular-nums">{summary.totalSubmitted}</span> submitted
              <span className="text-muted-foreground/20"> | </span>
              <span className="text-emerald-400/60 tabular-nums">{summary.totalMerged}</span> merged
              <span className="text-muted-foreground/20"> | </span>
              <span className="text-red-400/60 tabular-nums">{summary.totalClosed}</span> closed
            </span>
            <span>
              merge ratio:{" "}
              <span
                className={`tabular-nums ${
                  summary.mergeRatio > 32.7
                    ? "text-emerald-400/70"
                    : "text-red-400/70"
                }`}
              >
                {summary.mergeRatio}%
              </span>
              <span className="text-muted-foreground/20"> vs </span>
              <span className="text-muted-foreground/30 tabular-nums">32.7% AI avg</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
