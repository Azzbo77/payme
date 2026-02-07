/**
 * Skeleton loader component for showing loading state
 * Displays animated placeholder boxes while data loads
 */
export function Skeleton({
  className = "",
  width = "w-full",
  height = "h-4",
  count = 1,
  circle = false,
}: {
  className?: string;
  width?: string;
  height?: string;
  count?: number;
  circle?: boolean;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`
            ${width} ${height}
            ${circle ? "rounded-full" : "rounded"}
            bg-sand-200 dark:bg-charcoal-700
            animate-pulse
            ${i < count - 1 ? "mb-2" : ""}
            ${className}
          `}
        />
      ))}
    </>
  );
}

/**
 * Skeleton for a full card with title, value, and description
 */
export function CardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton width="w-24" height="h-3" />
        <Skeleton width="w-4" height="h-4" circle className="rounded-full" />
      </div>
      <Skeleton width="w-32" height="h-6" />
      <Skeleton width="w-48" height="h-2" />
    </div>
  );
}

/**
 * Skeleton for a section with multiple items
 */
export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton width="w-40" height="h-3" />
          <Skeleton width="w-full" height="h-4" count={2} />
        </div>
      ))}
    </div>
  );
}
