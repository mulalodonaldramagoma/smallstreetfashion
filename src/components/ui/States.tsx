export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-neutral-200 animate-pulse">
      <div className="aspect-square bg-neutral-200" />
      <div className="p-4 space-y-2">
        <div className="h-3 w-1/3 bg-neutral-200 rounded" />
        <div className="h-4 w-3/4 bg-neutral-200 rounded" />
        <div className="h-3 w-1/2 bg-neutral-200 rounded" />
        <div className="h-5 w-1/3 bg-neutral-200 rounded" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function StoreCardSkeleton() {
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-neutral-200 animate-pulse">
      <div className="h-48 bg-neutral-200" />
      <div className="p-5 space-y-2">
        <div className="h-5 w-1/2 bg-neutral-200 rounded" />
        <div className="h-3 w-2/3 bg-neutral-200 rounded" />
        <div className="h-3 w-full bg-neutral-200 rounded" />
        <div className="h-3 w-3/4 bg-neutral-200 rounded" />
      </div>
    </div>
  );
}

export function CategoryGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[3/4] rounded-xl bg-neutral-200 animate-pulse"
        />
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 animate-pulse">
      <div className="aspect-square rounded-2xl bg-neutral-200" />
      <div className="space-y-4">
        <div className="h-4 w-1/4 bg-neutral-200 rounded" />
        <div className="h-8 w-3/4 bg-neutral-200 rounded" />
        <div className="h-6 w-1/3 bg-neutral-200 rounded" />
        <div className="h-24 w-full bg-neutral-200 rounded" />
        <div className="h-10 w-full bg-neutral-200 rounded" />
        <div className="h-10 w-full bg-neutral-200 rounded" />
      </div>
    </div>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = 'Unable to load data. Please try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-rose-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <p className="text-neutral-600 font-medium mb-1">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-5 py-2 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-neutral-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-neutral-900 mb-1">{title}</h3>
      {message && <p className="text-sm text-neutral-500 max-w-md">{message}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-6 px-6 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
