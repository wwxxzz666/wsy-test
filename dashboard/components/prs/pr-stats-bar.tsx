"use client";

import { Card, CardContent } from "@/components/ui/card";

interface PRStatsBarProps {
  total: number;
  open: number;
  merged: number;
  closed: number;
  avgReviewTime: number;
}

const statColors: Record<string, string> = {
  Total: "",
  Open: "text-foreground/70",
  Merged: "text-emerald-400",
  Closed: "text-red-400",
  "Avg Review": "text-muted-foreground",
};

export function PRStatsBar({
  total,
  open,
  merged,
  closed,
  avgReviewTime,
}: PRStatsBarProps) {
  const stats = [
    { label: "Total", value: total },
    { label: "Open", value: open },
    { label: "Merged", value: merged },
    { label: "Closed", value: closed },
    { label: "Avg Review", value: `${avgReviewTime}h` },
  ];

  return (
    <div className="grid grid-cols-5 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="card-lift">
          <CardContent className="pt-4 pb-3">
            <p className="stat-label">{stat.label}</p>
            <p className={`stat-value mt-1 ${statColors[stat.label] || ""}`}>{stat.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
