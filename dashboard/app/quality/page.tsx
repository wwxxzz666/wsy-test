"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { QualityOverviewCards } from "@/components/quality/quality-overview-cards";
import { QualityTrendChart } from "@/components/quality/quality-trend-chart";
import { QualityByRepoChart } from "@/components/quality/quality-by-repo-chart";
import { ReviewFeedbackList } from "@/components/quality/review-feedback-list";
import { RejectionReasonsChart } from "@/components/quality/rejection-reasons-chart";
import { QualityDistribution } from "@/components/quality/quality-distribution";
import { useQualityMetrics } from "@/lib/hooks/use-metrics";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
export default function QualityPage() {
  const [range, setRange] = useState("30d");
  const { data, isLoading } = useQualityMetrics(range);

  if (isLoading) {
    return (
      <div className="flex flex-col">
        <Header title="Quality Metrics" />
        <div className="flex-1 space-y-4 p-6">
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Header title="Quality Metrics" />
      <div className="flex-1 space-y-8 p-6 lg:p-8">
        <div className="flex justify-end">
          <Select value={range} onValueChange={(v) => v && setRange(v)}>
            <SelectTrigger className="w-[120px] mono-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="60d">60 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {data?.overview && (
          <QualityOverviewCards
            avgScore={data.overview.avgScore}
            avgScoreChange={data.overview.avgScoreChange}
            firstPassRate={data.overview.firstPassRate}
            firstPassChange={data.overview.firstPassChange}
            reviewScore={data.overview.reviewScore}
            rejectionRate={data.overview.rejectionRate}
            rejectionChange={data.overview.rejectionChange}
          />
        )}

        <QualityTrendChart data={data?.trend || []} />

        <div className="grid gap-6 md:grid-cols-2">
          <QualityByRepoChart data={data?.byRepo || []} />
          <RejectionReasonsChart data={data?.rejectionReasons || []} />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <QualityDistribution data={data?.distribution || []} />
          <ReviewFeedbackList items={data?.feedback || []} />
        </div>
      </div>
    </div>
  );
}
