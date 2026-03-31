/**
 * Reusable loading skeleton components
 * Provide visual feedback during async operations
 */

export function SceneListSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-12 bg-slate-200 rounded"></div>
      ))}
    </div>
  );
}

export function InspirationCardSkeleton() {
  return (
    <div className="p-3 bg-slate-100 rounded animate-pulse">
      <div className="h-4 bg-slate-300 rounded w-3/4 mb-2"></div>
      <div className="h-3 bg-slate-300 rounded w-full mb-1"></div>
      <div className="h-3 bg-slate-300 rounded w-5/6"></div>
    </div>
  );
}

export function ContentBlockSkeleton() {
  return (
    <div className="p-3 bg-slate-100 rounded animate-pulse">
      <div className="h-3 bg-slate-300 rounded w-1/4 mb-2"></div>
      <div className="h-4 bg-slate-300 rounded w-full mb-1"></div>
      <div className="h-4 bg-slate-300 rounded w-4/5"></div>
    </div>
  );
}

export function PageLoadingSkeleton() {
  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-stone-50 via-white to-stone-50/50 animate-pulse">
      {/* Header area */}
      <div className="h-12 bg-gradient-to-r from-stone-100/40 to-stone-200/40 border-b border-stone-200/50"></div>

      {/* Main content - staggered skeleton blocks */}
      <div className="max-w-4xl mx-auto px-8 py-12 space-y-6">
        {/* Title skeleton */}
        <div className="mb-8">
          <div className="h-10 bg-stone-200 rounded-lg w-1/3 mb-4"></div>
          <div className="h-4 bg-stone-100 rounded-lg w-2/3"></div>
        </div>

        {/* Content blocks */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-3 p-4 bg-white/40 rounded-lg border border-stone-200/20">
            <div className="h-6 bg-stone-200 rounded-lg w-1/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-stone-100 rounded-lg w-full"></div>
              <div className="h-4 bg-stone-100 rounded-lg w-5/6"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

