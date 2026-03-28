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
    <div className="grid grid-cols-[theme(spacing.64)_1fr_theme(spacing.80)] min-h-screen">
      <aside className="hidden md:block border-r bg-slate-50 p-3">
        <div className="h-6 bg-slate-200 rounded w-1/2 mb-4"></div>
        <SceneListSkeleton />
      </aside>
      <main className="border-x bg-white p-4">
        <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-2">
          <ContentBlockSkeleton />
          <ContentBlockSkeleton />
          <ContentBlockSkeleton />
        </div>
      </main>
      <aside className="hidden md:block bg-slate-100/50 p-3">
        <div className="h-6 bg-slate-200 rounded w-1/2 mb-3"></div>
        <div className="space-y-2">
          <InspirationCardSkeleton />
          <InspirationCardSkeleton />
        </div>
      </aside>
    </div>
  );
}

