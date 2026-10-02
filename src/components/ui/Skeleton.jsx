/**
 * src/components/ui/Skeleton.jsx
 * Skeleton loader components for loading states.
 */

export function SkeletonLine({ width = 'w-full', height = 'h-4', className = '' }) {
  return <div className={`skeleton ${width} ${height} ${className}`} />
}

export function SkeletonCard() {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="skeleton w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="w-3/4" />
          <SkeletonLine width="w-1/2" height="h-3" />
        </div>
        <SkeletonLine width="w-16" height="h-5" />
      </div>
    </div>
  )
}

export function SkeletonList({ count = 4 }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonSummary() {
  return (
    <div className="grid grid-cols-3 gap-3 p-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card p-3 space-y-2">
          <SkeletonLine width="w-full" height="h-3" />
          <SkeletonLine width="w-4/5" height="h-6" />
        </div>
      ))}
    </div>
  )
}
