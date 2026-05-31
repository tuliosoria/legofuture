import type { ProductType } from "@/lib/types/lego";

const KEYCHAIN_PATTERN = /\bkey[\s-]?(?:chain|ring)\b/i;
const WATCH_PATTERN = /\b(?:buildable\s+)?watch\b|\bdigital\s+watch\b|\bwatch\s+face\b/i;
const PLUSH_PATTERN = /\bplush(?:ie)?\b/i;
const BOOK_PATTERN =
  /\b(?:activity|sticker|colouring|coloring|story)\s+book\b|\bbook\s+with\b/i;
const PENCIL_CASE_PATTERN = /\bpencil\s+case\b/i;
const BACKPACK_PATTERN = /\b(?:school\s+)?bag\b|\bbackpack\b/i;
const RADIO_PATTERN = /\bradio\b/i;
const DIARY_PATTERN = /\bdiary\b/i;
const POLYBAG_NAME_PATTERN = /\bpolybag\b/i;
const MINIFIG_SERIES_PATTERN =
  /\b(?:cmf|collectible\s+minifig|series\s+\d+\s+minifig|minifig\w*\s+series)/i;

export function inferProductType(
  name: string,
  setNumber: string,
  pieceCount: number
): ProductType {
  if (KEYCHAIN_PATTERN.test(name)) return "Keychain";
  if (WATCH_PATTERN.test(name)) return "Watch";
  if (PLUSH_PATTERN.test(name)) return "Plush";
  if (BOOK_PATTERN.test(name)) return "Book";
  if (PENCIL_CASE_PATTERN.test(name) || BACKPACK_PATTERN.test(name)) return "Gear";
  if (RADIO_PATTERN.test(name) || DIARY_PATTERN.test(name)) return "Gear";
  if (MINIFIG_SERIES_PATTERN.test(name)) return "Minifigure Pack";

  // Polybag: 30xxx set-number prefix or name says polybag
  const digits = setNumber.replace(/\D/g, "");
  if (digits.startsWith("30") || POLYBAG_NAME_PATTERN.test(name)) return "Polybag";

  // Large piece count → almost certainly a boxed set
  if (pieceCount >= 50) return "Boxed Set";

  return "Unknown";
}
