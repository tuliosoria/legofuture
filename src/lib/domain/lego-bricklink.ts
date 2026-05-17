/**
 * Returns the canonical BrickLink catalog page URL for a sealed LEGO set.
 *
 * BrickLink uses a suffix of `-1` for the default variant of every set.
 * Example: set 10497 → https://www.bricklink.com/v2/catalog/catalogitem.page?S=10497-1
 */
export function bricklinkUrlForSetNumber(setNum: string): string {
  return `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${setNum}-1`;
}

/**
 * Guard against pointing users at the wrong BrickLink catalog item type.
 * Only `?S=` (set) URLs are valid marketplace destinations for a sealed
 * set forecast. Parts (`?P=`), minifigs (`?M=`), instructions (`?I=`),
 * gear (`?G=`), books (`?B=`), and original packaging (`?O=`) all live
 * at the same `catalogitem.page` path but should never be linked from
 * a set-level CTA.
 */
export function isValidSetMarketplaceUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("bricklink.com")) return false;
    if (!parsed.pathname.includes("catalogitem.page")) return false;
    const params = parsed.searchParams;
    const invalidKeys = ["P", "M", "I", "G", "B", "O"];
    if (invalidKeys.some((k) => params.has(k))) return false;
    return params.has("S");
  } catch {
    return false;
  }
}

/**
 * Resolve a guaranteed-set BrickLink URL for a given set number.
 * Returns null if the candidate URL fails the marketplace-type guard
 * (i.e. caller passed a bad set number that round-trips to a non-set
 * BrickLink page).
 */
export function resolveBricklinkSetUrl(setNumber: string | undefined): string | null {
  if (!setNumber) return null;
  const url = bricklinkUrlForSetNumber(setNumber);
  return isValidSetMarketplaceUrl(url) ? url : null;
}
