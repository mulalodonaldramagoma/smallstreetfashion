import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { Product } from '@/types';
import { ProductCard } from './ProductCard';
import { FilterSidebar } from './FilterSidebar';
import { ProductGridSkeleton, ErrorState, EmptyState } from './ui/States';
import type { useProductFilters } from '@/hooks/useProductFilters';

type FilterHook = ReturnType<typeof useProductFilters>;

interface ProductGridProps {
  hook: FilterHook;
  emptyMessage?: string;
  emptyActionLabel?: string;
  emptyAction?: () => void;
  title?: string;
}

export function ProductGrid({
  hook,
  emptyMessage = 'No products found.',
  emptyActionLabel,
  emptyAction,
  title,
}: ProductGridProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const { filtered, loading, error } = hook;

  return (
    <div className="flex gap-8">
      <FilterSidebar
        filters={hook.filters}
        sort={hook.sort}
        setSort={hook.setSort}
        setCategory={hook.setCategory}
        setPriceRange={hook.setPriceRange}
        toggleSize={hook.toggleSize}
        toggleColour={hook.toggleColour}
        setStore={hook.setStore}
        resetFilters={hook.resetFilters}
        allColours={hook.allColours}
        allSizes={hook.allSizes}
        storeList={hook.storeList}
        isMobileOpen={mobileFiltersOpen}
        onCloseMobile={() => setMobileFiltersOpen(false)}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-neutral-600">
            {loading
              ? 'Loading products...'
              : `${filtered.length} ${filtered.length === 1 ? 'product' : 'products'}`}
            {title && !loading && (
              <span className="text-neutral-400"> &middot; {title}</span>
            )}
          </p>
          <button
            onClick={() => setMobileFiltersOpen(true)}
            className="flex items-center gap-2 lg:hidden px-3 py-2 border border-neutral-200 rounded-lg text-sm text-neutral-700 hover:bg-neutral-50"
          >
            <SlidersHorizontal size={16} />
            Filters
          </button>
        </div>

        {loading ? (
          <ProductGridSkeleton count={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={hook.resetFilters} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No products found"
            message={emptyMessage}
            actionLabel={emptyActionLabel}
            onAction={emptyAction}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {filtered.map((product: Product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
