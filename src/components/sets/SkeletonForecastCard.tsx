export function SkeletonForecastCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="aspect-[4/3] skeleton-shimmer" />
      <div className="flex flex-col gap-3 p-4">
        <div className="h-4 w-3/4 rounded skeleton-shimmer" />
        <div className="h-3 w-1/2 rounded skeleton-shimmer" />
        <div className="grid grid-cols-2 gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 rounded skeleton-shimmer" />
          ))}
        </div>
        <div className="h-8 rounded skeleton-shimmer mt-1" />
      </div>
    </div>
  );
}
