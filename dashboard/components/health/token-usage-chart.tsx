"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts";
import type { TokenUsageData } from "@/lib/types";

interface TokenUsageChartProps {
  data: TokenUsageData[];
}

const chartConfig = {
  inputTokens: { label: "Input Tokens", color: "var(--chart-1)" },
  outputTokens: { label: "Output Tokens", color: "var(--chart-2)" },
};

export function TokenUsageChart({ data }: TokenUsageChartProps) {
  return (
    <Card className="card-inset">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Token Usage</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No token data available
          </p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={12} tickLine={false} />
              <YAxis fontSize={12} tickLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="inputTokens"
                stackId="1"
                stroke="var(--chart-1)"
                fill="var(--chart-1)"
                fillOpacity={0.4}
              />
              <Area
                type="monotone"
                dataKey="outputTokens"
                stackId="1"
                stroke="var(--chart-2)"
                fill="var(--chart-2)"
                fillOpacity={0.4}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
