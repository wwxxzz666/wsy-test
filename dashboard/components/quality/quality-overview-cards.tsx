"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercentage } from "@/lib/utils";

interface QualityOverviewCardsProps {
  avgScore: number;
  avgScoreChange: number;
  firstPassRate: number;
  firstPassChange: number;
  reviewScore: number;
  rejectionRate: number;
  rejectionChange: number;
}

export function QualityOverviewCards({
  avgScore,
  avgScoreChange,
  firstPassRate,
  firstPassChange,
  reviewScore,
  rejectionRate,
  rejectionChange,
}: QualityOverviewCardsProps) {
  const cards = [
    {
      title: "Avg Score",
      value: avgScore.toFixed(1),
      change: avgScoreChange,
      suffix: "",
    },
    {
      title: "1st Pass Rate",
      value: formatPercentage(firstPassRate),
      change: firstPassChange,
      suffix: "",
    },
    {
      title: "Review Score",
      value: `${reviewScore.toFixed(1)}/5.0`,
      change: null,
      suffix: "",
    },
    {
      title: "Rejection Rate",
      value: formatPercentage(rejectionRate),
      change: rejectionChange,
      suffix: "",
      invertColor: true,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {cards.map((card, i) => (
        <Card key={card.title} className="card-lift">
          <CardHeader className="pb-2">
            <CardTitle className="stat-label">{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="stat-value">{card.value}</div>
            {card.change != null && (
              <p
                className={`text-[11px] font-mono mt-0.5 ${
                  card.invertColor
                    ? card.change < 0
                      ? "text-emerald-400"
                      : card.change > 0
                        ? "text-red-400"
                        : "text-muted-foreground/50"
                    : card.change > 0
                      ? "text-emerald-400"
                      : card.change < 0
                        ? "text-red-400"
                        : "text-muted-foreground/50"
                }`}
              >
                {card.change > 0 ? "+" : ""}
                {card.change.toFixed(1)} MTD
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
