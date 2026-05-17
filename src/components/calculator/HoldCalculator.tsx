"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { projectHoldRoi } from "@/lib/domain/hold-roi";
import {
  NumberInput,
  FieldLabel,
  FieldError,
  ResultRow,
  fmtUSD,
  fmtPct,
} from "./shared/form-bits";

const schema = z.object({
  currentValue: z.coerce.number().positive("Must be > 0"),
  acquisitionCost: z.coerce.number().nonnegative("Must be ≥ 0"),
  holdMonths: z.coerce.number().positive("Must be > 0").max(600, "Max 50 years"),
  monthlyStorageCost: z.coerce.number().nonnegative("Must be ≥ 0"),
  expectedAnnualAppreciationPct: z.coerce.number().min(-50).max(100),
});

type FormValues = z.infer<typeof schema>;

export function HoldCalculator() {
  const {
    register,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      currentValue: 500,
      acquisitionCost: 400,
      holdMonths: 24,
      monthlyStorageCost: 2,
      expectedAnnualAppreciationPct: 10,
    },
  });

  const v = watch();

  const result = useMemo(() => {
    return projectHoldRoi({
      currentValue: Number(v.currentValue) || 0,
      acquisitionCost: Number(v.acquisitionCost) || 0,
      holdMonths: Number(v.holdMonths) || 0,
      monthlyStorageCost: Number(v.monthlyStorageCost) || 0,
      expectedAnnualAppreciation: (Number(v.expectedAnnualAppreciationPct) || 0) / 100,
    });
  }, [
    v.currentValue,
    v.acquisitionCost,
    v.holdMonths,
    v.monthlyStorageCost,
    v.expectedAnnualAppreciationPct,
  ]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <h2 className="type-h2 mb-1">Hold inputs</h2>
        <p className="type-body-sm text-slate-700 mb-4">
          Compound a set you already own forward, net of storage.
        </p>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <FieldLabel>Current value (USD)</FieldLabel>
            <NumberInput {...register("currentValue")} error={!!errors.currentValue} />
            <FieldError message={errors.currentValue?.message} />
          </div>
          <div>
            <FieldLabel>Acquisition cost (what you paid)</FieldLabel>
            <NumberInput {...register("acquisitionCost")} error={!!errors.acquisitionCost} />
            <FieldError message={errors.acquisitionCost?.message} />
          </div>
          <div>
            <FieldLabel>Hold period (months)</FieldLabel>
            <NumberInput {...register("holdMonths")} error={!!errors.holdMonths} />
            <FieldError message={errors.holdMonths?.message} />
          </div>
          <div>
            <FieldLabel>Monthly storage cost</FieldLabel>
            <NumberInput
              {...register("monthlyStorageCost")}
              error={!!errors.monthlyStorageCost}
            />
            <FieldError message={errors.monthlyStorageCost?.message} />
          </div>
          <div>
            <FieldLabel>Expected annual appreciation (%)</FieldLabel>
            <NumberInput
              {...register("expectedAnnualAppreciationPct")}
              error={!!errors.expectedAnnualAppreciationPct}
            />
            <FieldError message={errors.expectedAnnualAppreciationPct?.message} />
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="type-h2 mb-1">Result</h2>
        <p className="type-body-sm text-slate-700 mb-4">
          Value compounds monthly at the rate you specify; storage is subtracted from gain.
        </p>
        <div>
          <ResultRow
            label="Projected value at end"
            value={fmtUSD(result.projectedValueAtEnd)}
            emphasize
          />
          <ResultRow label="Total storage cost" value={fmtUSD(result.totalStorageCost)} />
          <ResultRow
            label="Net gain"
            value={fmtUSD(result.netGain)}
            emphasize
            positive={result.netGain >= 0}
          />
          <ResultRow
            label="Net gain %"
            value={fmtPct(result.netGainPercent)}
            positive={result.netGain >= 0}
          />
          <ResultRow
            label="Annualized return"
            value={fmtPct(result.annualizedReturnPercent)}
            positive={result.annualizedReturnPercent >= 0}
          />
        </div>
      </Card>
    </div>
  );
}
