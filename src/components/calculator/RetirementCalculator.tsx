"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import {
  projectRetirementRoi,
  type ScenarioProjection,
} from "@/lib/domain/retirement-roi";
import { defaultCagrFor } from "@/lib/domain/price-estimates";
import type { LegoEra } from "@/lib/types/lego";
import {
  NumberInput,
  FieldLabel,
  FieldError,
  fmtUSD,
  fmtPct,
} from "./shared/form-bits";
import { cn } from "@/lib/utils";

const ERAS: LegoEra[] = ["Classic", "Modern", "Licensed", "Premium"];

const schema = z.object({
  retailPrice: z.coerce.number().positive("Must be > 0"),
  horizonYears: z.coerce.number().positive("Must be > 0").max(50, "Max 50 years"),
  pessimistPct: z.coerce.number().min(-50).max(100),
  moderatePct: z.coerce.number().min(-50).max(100),
  optimistPct: z.coerce.number().min(-50).max(100),
});

type FormValues = z.infer<typeof schema>;

export function RetirementCalculator() {
  const [era, setEra] = useState<LegoEra>("Modern");
  const seed = defaultCagrFor("Modern");

  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      retailPrice: 300,
      horizonYears: 5,
      pessimistPct: seed.pessimist * 100,
      moderatePct: seed.moderate * 100,
      optimistPct: seed.optimist * 100,
    },
  });

  useEffect(() => {
    const c = defaultCagrFor(era);
    setValue("pessimistPct", +(c.pessimist * 100).toFixed(2));
    setValue("moderatePct", +(c.moderate * 100).toFixed(2));
    setValue("optimistPct", +(c.optimist * 100).toFixed(2));
  }, [era, setValue]);

  const values = watch();

  const result = useMemo(() => {
    return projectRetirementRoi({
      retailPrice: Number(values.retailPrice) || 0,
      horizonYears: Number(values.horizonYears) || 0,
      pessimistCagr: (Number(values.pessimistPct) || 0) / 100,
      moderateCagr: (Number(values.moderatePct) || 0) / 100,
      optimistCagr: (Number(values.optimistPct) || 0) / 100,
    });
  }, [
    values.retailPrice,
    values.horizonYears,
    values.pessimistPct,
    values.moderatePct,
    values.optimistPct,
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="type-h2 mb-1">Retirement inputs</h2>
        <p className="type-body-sm text-slate-700 mb-4">
          Project a set&apos;s value at horizon under three CAGR scenarios.
        </p>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
          <div>
            <FieldLabel>Retail price (USD)</FieldLabel>
            <NumberInput {...register("retailPrice")} error={!!errors.retailPrice} />
            <FieldError message={errors.retailPrice?.message} />
          </div>
          <div>
            <FieldLabel>Horizon (years)</FieldLabel>
            <NumberInput {...register("horizonYears")} error={!!errors.horizonYears} />
            <FieldError message={errors.horizonYears?.message} />
          </div>

          <div className="md:col-span-2">
            <FieldLabel>Seed defaults from era</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {ERAS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEra(e)}
                  className={cn(
                    "px-3 py-1.5 rounded-card border-2 type-body-sm transition-colors",
                    era === e
                      ? "bg-bright-yellow text-jet-black border-jet-black font-semibold"
                      : "bg-pure-white text-jet-black border-jet-black hover:bg-slate-100"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>Pessimist CAGR (%)</FieldLabel>
            <NumberInput {...register("pessimistPct")} error={!!errors.pessimistPct} />
            <FieldError message={errors.pessimistPct?.message} />
          </div>
          <div>
            <FieldLabel>Moderate CAGR (%)</FieldLabel>
            <NumberInput {...register("moderatePct")} error={!!errors.moderatePct} />
            <FieldError message={errors.moderatePct?.message} />
          </div>
          <div>
            <FieldLabel>Optimist CAGR (%)</FieldLabel>
            <NumberInput {...register("optimistPct")} error={!!errors.optimistPct} />
            <FieldError message={errors.optimistPct?.message} />
          </div>
        </form>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {result.scenarios.map((s) => (
          <ScenarioCard
            key={s.scenario}
            projection={s}
            highlight={
              s.scenario === result.bestCase.scenario
                ? "best"
                : s.scenario === result.worstCase.scenario
                ? "worst"
                : null
            }
          />
        ))}
      </div>
    </div>
  );
}

function ScenarioCard({
  projection,
  highlight,
}: {
  projection: ScenarioProjection;
  highlight: "best" | "worst" | null;
}) {
  const title =
    projection.scenario === "pessimist"
      ? "Pessimist"
      : projection.scenario === "moderate"
      ? "Moderate"
      : "Optimist";

  return (
    <Card
      className={cn(
        highlight === "best" && "ring-2 ring-emerald-500",
        highlight === "worst" && "ring-2 ring-brick-red"
      )}
    >
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="type-h3 font-semibold">{title}</h3>
        {highlight === "best" && (
          <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
            Best case
          </span>
        )}
        {highlight === "worst" && (
          <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-brick-red">
            Worst case
          </span>
        )}
      </div>
      <div className="space-y-2">
        <div>
          <p className="type-body-sm text-slate-700">Projected value</p>
          <p className="text-2xl font-bold tabular-nums">{fmtUSD(projection.projectedValue)}</p>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-700">Total return</span>
          <span className="tabular-nums">{fmtPct(projection.totalReturnPercent)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-700">Annualized</span>
          <span className="tabular-nums">{fmtPct(projection.annualizedReturnPercent)}</span>
        </div>
      </div>
    </Card>
  );
}
