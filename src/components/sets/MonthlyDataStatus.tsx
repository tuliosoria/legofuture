import { getMonthlyReadiness } from '@/lib/domain/monthly-readiness';

/** Render from a dynamic server page so the edition never freezes at build time. */
export function MonthlyDataStatus({ now = new Date() }: { now?: Date }) {
  const state = getMonthlyReadiness(now);
  const month = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(now);
  return <section aria-label="Monthly data status" className="mx-auto max-w-[1240px] px-4 md:px-8 pt-8">
    <h2 className="type-h4">Monthly update · {month}</h2>
    <p className="mt-2">No verified price update or best-buy ranking is available for this month.</p>
    <p className="mt-2">Monthly automation is not enabled. Source access and publication rights must be verified first.</p>
    <p className="mt-2 type-caption">Requested edition: <time dateTime={state.requestedMonth}>{state.requestedMonth}</time>. Data month: unavailable. Last successful data update: unavailable.</p>
  </section>;
}
