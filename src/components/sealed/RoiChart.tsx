"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import type { Forecast } from "@/lib/types/sealed";

interface RoiChartProps {
  forecast: Forecast;
}

export function RoiChart({ forecast }: RoiChartProps) {
  const data = [
    {
      name: "Pessimist",
      roi: parseFloat(forecast.scenarios.pessimist.roiPercent.toFixed(1)),
    },
    {
      name: "Moderate",
      roi: parseFloat(forecast.scenarios.moderate.roiPercent.toFixed(1)),
    },
    {
      name: "Optimist",
      roi: parseFloat(forecast.scenarios.optimist.roiPercent.toFixed(1)),
    },
    { name: "S&P 500", roi: parseFloat(((Math.pow(1.105, 5) - 1) * 100).toFixed(1)) },
  ];

  const colors = ["#f87171", "hsl(46 100% 50%)", "#10b981", "#94a3b8"];

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(215 20% 60%)" }} />
        <YAxis
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: "hsl(215 20% 60%)" }}
          width={45}
        />
        <Tooltip
          formatter={(value) => [`${Number(value).toFixed(1)}%`, "5y ROI"]}
          contentStyle={{
            backgroundColor: "hsl(220 14% 11%)",
            border: "1px solid hsl(218 16% 20%)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <ReferenceLine y={0} stroke="hsl(215 20% 30%)" />
        <Bar dataKey="roi" radius={[4, 4, 0, 0]}>
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
