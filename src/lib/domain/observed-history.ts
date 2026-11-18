import type { HistoryPoint } from '@/lib/types/lego';

/** Keep actual dates, selecting the latest real sample for each observed month.
 * Daily collection must not make six days look like six months of history. */
export function mergeObservedHistory(legacy: HistoryPoint[], observed: Record<string, unknown>[]): HistoryPoint[] {
  const byMonth = new Map<string, HistoryPoint>();
  const valid = (p: HistoryPoint) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(Date.parse(p.date)) && Number.isFinite(p.price) && p.price > 0;
  for (const point of [...legacy].filter(valid).sort((a,b)=>a.date.localeCompare(b.date))) byMonth.set(point.date.slice(0,7), point);
  const real = observed.filter(row => row.source === 'ebay' && typeof row.capturedAt === 'string' && Number.isFinite(Date.parse(row.capturedAt)))
    .map(row => ({date: (row.capturedAt as string).slice(0,10),price: Number(row.price)}))
    .filter(valid).sort((a,b)=>a.date.localeCompare(b.date));
  for (const point of real) byMonth.set(point.date.slice(0,7),point);
  return [...byMonth.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
