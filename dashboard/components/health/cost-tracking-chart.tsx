"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid } from "recharts";
import type { CostData } from "@/lib/types";

interface CostTrackingChartProps {
  data: CostData[];
}

const chartConfig = {
  dailyCost: { label: "Daily Cost", color: "var(--chart-3)" },
  cumulativeCost: { label: "Cumulative", color: "var(--chart-4)" },
};

export function CostTrackingChart({ data }: CostTrackingChartProps) {
  return (
    <Card className="card-inset">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Cost Tracking</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No cost data available
          </p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={12} tickLine={false} />
              <YAxis fontSize={12} tickLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="dailyCost" fill="var(--chart-3)" />
              <Line
                type="monotone"
                dataKey="cumulativeCost"
                stroke="var(--chart-4)"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
