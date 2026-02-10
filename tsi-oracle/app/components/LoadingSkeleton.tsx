export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 rounded bg-[var(--card-bg)] animate-pulse"
          style={{ animationDelay: `${i * 50}ms` }}
        />
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="w-full h-[400px] rounded-lg bg-[var(--card-bg)] animate-pulse flex items-center justify-center">
      <span className="text-[var(--text-dim)] text-sm">Loading chart...</span>
    </div>
  );
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-24 rounded-lg bg-[var(--card-bg)] animate-pulse"
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}
