/**
 * Loading placeholder that mirrors the visual rhythm of ProductForecastCard:
 * image · title · meta · 2x2 stat grid · CTA. Used during filter transitions
 * and SSR hand-off.
 */
export function SkeletonForecastCard() {
  return (
    <div
      role="status"
      aria-label="Loading set"
      className="flex flex-col overflow-hidden rounded-card border-2 border-jet-black bg-pure-white p-4 animate-pulse"
    >
      <div className="-mx-4 -mt-4 mb-4 aspect-[4/3] border-b-2 border-jet-black bg-slate-200" />
      <div className="mb-2 h-4 w-3/4 rounded bg-slate-200" />
      <div className="mb-4 h-3 w-1/2 rounded bg-slate-200" />
      <div className="grid grid-cols-2 gap-2 mb-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 rounded bg-slate-200" />
        ))}
      </div>
      <div className="h-8 rounded bg-slate-200" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
