"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";

interface QualityByRepoChartProps {
  data: { repo: string; avgScore: number; prCount: number }[];
}

const chartConfig = {
  avgScore: { label: "Avg Score", color: "var(--chart-2)" },
};

export function QualityByRepoChart({ data }: QualityByRepoChartProps) {
  return (
    <Card className="card-inset">
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Quality by Repository
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No repository data available
          </p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="repo" fontSize={10} tickLine={false} />
              <YAxis domain={[0, 100]} fontSize={12} tickLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="avgScore" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
