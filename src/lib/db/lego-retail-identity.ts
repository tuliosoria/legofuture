const NON_RETAIL_NAME_PATTERNS = [
  /\bGWP\b/i,
  /\bgift with purchase\b/i,
  /\bpromo\b/i,
  /\bemployee\b/i,
  /\bsdcc\b/i,
  /\bcomic con\b/i,
  /\bpolybag\b/i,
  /\bpolybag exclusive\b/i,
  // Gear / merchandise — not investable sealed-box sets
  /\bkey\s?chain\b/i,
  /\bkey\s?ring\b/i,
  /\bplush(ie)?\b/i,
  /\bpencil\s+case\b/i,
  /\backpack\b/i,
  /\blanyard\b/i,
  /\bflip[\s-]?flop/i,
  /\balarm\s+clock\b/i,
  /\bsticker\s+book\b/i,
  /\bactivity\s+book\b/i,
  /\b(?:colouring|coloring)\s+book\b/i,
  /\bbandmates\b/i,
  /\bbuildable\s+watch\b/i,
  /\bdigital\s+watch\b/i,
  /\bwatch\s+face\b/i,
];

export function isNonRetailSetId(set: {
  id?: string;
  setNumber?: string;
  name?: string;
}): boolean {
  if (set.name && NON_RETAIL_NAME_PATTERNS.some((rx) => rx.test(set.name!))) {
    return true;
  }
  // Note: prefix-based heuristic intentionally NOT applied by default because
  // theme 30/40 prefixes are widely used legitimately. Only the explicit
  // denylist + name patterns gate.
  return false;
}

