"use client";

import { useState } from "react";
import { BuyOptionsDrawer } from "./BuyOptionsDrawer";
import type { BuyOptionsContext } from "./types";

interface SeeOnEbayButtonProps {
  context: BuyOptionsContext;
  label?: string;
  className?: string;
}

const DEFAULT_CLASS =
  "inline-flex items-center justify-center rounded-chip border-2 border-jet-black bg-pure-white px-4 py-2 type-body-sm font-semibold hover:bg-sunshine-yellow transition-colors";

export function SeeOnEbayButton({
  context,
  label = "Check eBay listings →",
  className,
}: SeeOnEbayButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? DEFAULT_CLASS}
      >
        {label}
      </button>
      <BuyOptionsDrawer
        open={open}
        onOpenChange={setOpen}
        context={open ? context : null}
      />
    </>
  );
}
