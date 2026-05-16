"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { Forecast } from "@/lib/types/sealed";

interface ForecastChartProps {
  forecast: Forecast;
}

const SP500_MONTHLY_RATE = Math.pow(1.105, 1 / 12) - 1;

function buildChartData(forecast: Forecast) {
  const months = 60;
  const monthlyRate = Math.pow(1 + forecast.annualRate, 1 / 12) - 1;
  const pessMonthly = Math.pow(1 + forecast.scenarios.pessimist.annualRate, 1 / 12) - 1;
  const optMonthly = Math.pow(1 + forecast.scenarios.optimist.annualRate, 1 / 12) - 1;

  const base = forecast.currentPrice;
  const data = [];

  for (let m = 0; m <= months; m += 6) {
    const yr = m / 12;
    const label = m === 0 ? "Now" : Number.isInteger(yr) ? `Y${yr}` : `Y${Math.floor(yr)}½`;
    data.push({
      label,
      moderate: Math.round(base * Math.pow(1 + monthlyRate, m)),
      pessimist: Math.round(base * Math.pow(1 + pessMonthly, m)),
      optimist: Math.round(base * Math.pow(1 + optMonthly, m)),
      sp500: Math.round(base * Math.pow(1 + SP500_MONTHLY_RATE, m)),
    });
  }
  return data;
}

export function ForecastChart({ forecast }: ForecastChartProps) {
  const data = buildChartData(forecast);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(218 16% 20%)" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(215 20% 60%)" }} />
        <YAxis
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 11, fill: "hsl(215 20% 60%)" }}
          width={55}
        />
        <Tooltip
          formatter={(value) => [`$${Number(value).toLocaleString()}`, ""]}
          contentStyle={{
            backgroundColor: "hsl(220 14% 11%)",
            border: "1px solid hsl(218 16% 20%)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="optimist"
          stroke="#10b981"
          fill="#10b98120"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          name="Optimist"
        />
        <Area
          type="monotone"
          dataKey="moderate"
          stroke="hsl(46 100% 50%)"
          fill="hsl(46 100% 50% / 0.15)"
          strokeWidth={2.5}
          name="Moderate"
        />
        <Area
          type="monotone"
          dataKey="pessimist"
          stroke="#f87171"
          fill="#f8717120"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          name="Pessimist"
        />
        <Area
          type="monotone"
          dataKey="sp500"
          stroke="#94a3b8"
          fill="none"
          strokeWidth={1.5}
          strokeDasharray="6 3"
          name="S&P 500"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
