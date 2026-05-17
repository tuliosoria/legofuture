"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

interface ForecastChartProps {
  series: Array<{
    year: number;
    pessimist: number;
    moderate: number;
    optimist: number;
  }>;
}

export function ForecastChart({ series }: ForecastChartProps) {
  if (series.length === 0) return null;
  const data = series.map((p) => ({
    label: p.year === 0 ? "Now" : `Y${p.year}`,
    ...p,
  }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
        <YAxis
          tickFormatter={(v) =>
            v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`
          }
          tick={{ fontSize: 11, fill: "#64748b" }}
          width={60}
        />
        <Tooltip
          formatter={(v) => `$${Number(v).toLocaleString()}`}
          contentStyle={{
            backgroundColor: "#ffffff",
            border: "2px solid #0b0b0b",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="optimist"
          stroke="#10b981"
          strokeWidth={2}
          strokeDasharray="5 3"
          dot={false}
          name="Optimist"
        />
        <Line
          type="monotone"
          dataKey="moderate"
          stroke="#0066ff"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          name="Moderate"
        />
        <Line
          type="monotone"
          dataKey="pessimist"
          stroke="#ef4444"
          strokeWidth={2}
          strokeDasharray="5 3"
          dot={false}
          name="Pessimist"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
