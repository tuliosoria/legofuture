/**
 * Returns the canonical BrickLink catalog page URL for a sealed LEGO set.
 *
 * BrickLink uses a suffix of `-1` for the default variant of every set.
 * Example: set 10497 → https://www.bricklink.com/v2/catalog/catalogitem.page?S=10497-1
 */
export function bricklinkUrlForSetNumber(setNum: string): string {
  return `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${setNum}-1`;
}
