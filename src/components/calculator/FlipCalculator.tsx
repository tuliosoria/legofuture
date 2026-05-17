"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { calculateBrickLinkFees } from "@/lib/domain/fees";
import {
  NumberInput,
  FieldLabel,
  FieldError,
  ResultRow,
  fmtUSD,
  fmtPct,
} from "./shared/form-bits";

const schema = z.object({
  buyPrice: z.coerce.number().nonnegative("Must be ≥ 0"),
  salePrice: z.coerce.number().nonnegative("Must be ≥ 0"),
  shippingCost: z.coerce.number().nonnegative("Must be ≥ 0"),
  shippingChargedToBuyer: z.coerce.number().nonnegative("Must be ≥ 0"),
});

type FormValues = z.infer<typeof schema>;

export function FlipCalculator() {
  const {
    register,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      buyPrice: 200,
      salePrice: 400,
      shippingCost: 20,
      shippingChargedToBuyer: 0,
    },
  });

  const values = watch();

  const result = useMemo(() => {
    const buy = Number(values.buyPrice) || 0;
    const sale = Number(values.salePrice) || 0;
    const shipCost = Number(values.shippingCost) || 0;
    const shipCharged = Number(values.shippingChargedToBuyer) || 0;
    const fees = calculateBrickLinkFees({
      salePrice: sale,
      shippingCost: shipCost,
      shippingChargedToBuyer: shipCharged,
    });
    const profit = fees.netToSeller - buy;
    const profitPercent = buy > 0 ? profit / buy : 0;
    return { fees, profit, profitPercent };
  }, [values.buyPrice, values.salePrice, values.shippingCost, values.shippingChargedToBuyer]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <h2 className="type-h2 mb-1">Flip inputs</h2>
        <p className="type-body-sm text-slate-700 mb-4">
          Estimate profit on a BrickLink resale right now.
        </p>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <FieldLabel>Buy price (what you paid)</FieldLabel>
            <NumberInput {...register("buyPrice")} error={!!errors.buyPrice} />
            <FieldError message={errors.buyPrice?.message} />
          </div>
          <div>
            <FieldLabel>Sale price</FieldLabel>
            <NumberInput {...register("salePrice")} error={!!errors.salePrice} />
            <FieldError message={errors.salePrice?.message} />
          </div>
          <div>
            <FieldLabel>Shipping cost (seller pays)</FieldLabel>
            <NumberInput {...register("shippingCost")} error={!!errors.shippingCost} />
            <FieldError message={errors.shippingCost?.message} />
          </div>
          <div>
            <FieldLabel>Shipping charged to buyer (optional)</FieldLabel>
            <NumberInput
              {...register("shippingChargedToBuyer")}
              error={!!errors.shippingChargedToBuyer}
            />
            <FieldError message={errors.shippingChargedToBuyer?.message} />
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="type-h2 mb-1">Result</h2>
        <p className="type-body-sm text-slate-700 mb-4">
          BrickLink 3% + payment processor 2.9% + $0.30.
        </p>
        <div>
          <ResultRow label="BrickLink fee (3%)" value={fmtUSD(result.fees.bricklinkFee)} />
          <ResultRow
            label="Payment fee (2.9% + $0.30)"
            value={fmtUSD(result.fees.paymentProcessorFee)}
          />
          <ResultRow label="Shipping cost" value={fmtUSD(result.fees.shippingCost)} />
          <ResultRow label="Total fees" value={fmtUSD(result.fees.totalFees)} />
          <ResultRow
            label="Net to seller"
            value={fmtUSD(result.fees.netToSeller)}
            emphasize
          />
          <ResultRow
            label="Profit"
            value={fmtUSD(result.profit)}
            emphasize
            positive={result.profit >= 0}
          />
          <ResultRow
            label="Profit %"
            value={fmtPct(result.profitPercent)}
            positive={result.profit >= 0}
          />
        </div>
      </Card>
    </div>
  );
}
