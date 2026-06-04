"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LegoSet } from "@/lib/domain/lego-set";
import { SP500_ANNUAL } from "@/lib/domain/forecast";

interface Props {
  set: LegoSet;
}

interface Point {
  t: number;
  history?: number;
  forecast?: number;
  sp500?: number;
  bandLow?: number;
  bandHigh?: number;
}

function parseMomentumAnnual(momentum: string): number {
  // "+18% 12mo" → 0.18
  const m = momentum.match(/(-?\d+(?:\.\d+)?)\s*%/);
  if (!m) return 0.05;
  return Number(m[1]) / 100;
}

function buildSeries(set: LegoSet): Point[] {
  const annualBack = parseMomentumAnnual(set.momentum);
  const out: Point[] = [];
  // History: −3yr → 0, monthly (37 points). Backcast: price_t = currentPrice / (1+r)^|t|
  for (let m = -36; m <= 0; m++) {
    const yrs = m / 12;
    const noise = 1 + 0.015 * Math.sin(m * 0.9);
    const price = (set.currentPrice / Math.pow(1 + annualBack, -yrs)) * noise;
    out.push({ t: yrs, history: Math.round(price) });
  }
  // Anchor: forecast starts at currentPrice at t=0
  const baseRatio = set.proj5y / set.currentPrice;
  const bearRatio = set.bear / set.currentPrice;
  const bullRatio = set.bull / set.currentPrice;
  for (let m = 0; m <= 60; m++) {
    const yrs = m / 12;
    const forecast = set.currentPrice * Math.pow(baseRatio, yrs / 5);
    const bandLow = set.currentPrice * Math.pow(bearRatio, yrs / 5);
    const bandHigh = set.currentPrice * Math.pow(bullRatio, yrs / 5);
    const sp500 = set.currentPrice * Math.pow(1 + SP500_ANNUAL, yrs);
    const point: Point = {
      t: yrs,
      forecast: Math.round(forecast),
      sp500: Math.round(sp500),
      bandLow: Math.round(bandLow),
      bandHigh: Math.round(bandHigh),
    };
    if (m === 0) point.history = set.currentPrice;
    out.push(point);
  }
  return out;
}

const fmtUSD = (n: number) => `$${n.toLocaleString()}`;
const fmtYear = (t: number) => (t === 0 ? "Today" : t > 0 ? `+${t.toFixed(0)}y` : `${t.toFixed(0)}y`);

export function MvpForecastChart({ set }: Props) {
  const data = buildSeries(set);
  return (
    <div className="bg-pure-white border-2 border-jet-black rounded-card shadow-click p-4">
      <h2
        className="type-h3 mb-1 px-2"
        style={{ fontFamily: "var(--nf-jakarta, system-ui)", fontWeight: 800 }}
      >
        Price trajectory
      </h2>
      <p className="type-body-sm text-slate-500 mb-3 px-2">
        3yr estimated history · today&rsquo;s price · 5yr forecast vs. S&amp;P 500.
      </p>
      <div className="h-80 w-full">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E4E0" />
            <XAxis
              dataKey="t"
              type="number"
              domain={[-3, 5]}
              tickFormatter={fmtYear}
              ticks={[-3, -2, -1, 0, 1, 2, 3, 4, 5]}
              stroke="#6E6D68"
              tick={{ fontSize: 12 }}
            />
            <YAxis tickFormatter={fmtUSD} stroke="#6E6D68" tick={{ fontSize: 12 }} width={70} />
            <Tooltip
              formatter={(v) => fmtUSD(Number(v))}
              labelFormatter={(t) => `Year ${fmtYear(Number(t))}`}
              contentStyle={{ border: "2px solid #1B1B1B", borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="bandHigh"
              stroke="none"
              fill="#00852B"
              fillOpacity={0.08}
              name="Bull case"
              activeDot={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="bandLow"
              stroke="none"
              fill="#FAF7F0"
              fillOpacity={1}
              activeDot={false}
              isAnimationActive={false}
              legendType="none"
            />
            <Line
              type="monotone"
              dataKey="history"
              stroke="#006DB7"
              strokeWidth={2.5}
              dot={false}
              name="Estimated history"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="#00852B"
              strokeWidth={2.5}
              dot={false}
              name="Base forecast"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="sp500"
              stroke="#6E6D68"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              name="S&P 500 (10.5%/yr)"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
