import type { Metadata } from "next";
import { CalculatorTabs } from "@/components/calculator/CalculatorTabs";

export const metadata: Metadata = {
  title: "Calculator | LegoFuture",
  description:
    "Estimate flip profit, retirement ROI, or hold ROI for any LEGO set.",
};

export default function CalculatorPage() {
  return (
    <main>
      <div className="bg-pure-white border-b-2 border-jet-black">
        <div className="mx-auto max-w-[1240px] px-4 md:px-8 py-10">
          <p className="type-eyebrow text-slate-500 mb-2">Calculator</p>
          <h1 className="type-display-2 text-jet-black mb-3">Calculator</h1>
          <p className="type-body-lg text-slate-700 max-w-xl">
            Estimate flip profit, retirement ROI, or hold ROI for any LEGO set.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[1240px] px-4 md:px-8 py-8">
        <CalculatorTabs />
      </div>
    </main>
  );
}
