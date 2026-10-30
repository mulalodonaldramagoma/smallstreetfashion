import { useMemo } from 'react';
import { useFeaturedProducts } from '@/hooks/useData';
import { useProductRatingSummaries } from '@/hooks/useRatingSummaries';
import { ProductCard } from '@/components/ProductCard';
import { ProductGridSkeleton, EmptyState } from '@/components/ui/States';
import { navigateTo } from '@/hooks/useRouter';
import { ArrowRight } from 'lucide-react';
import type { Product } from '@/types';

export function TrendingPage() {
  const { data: products, loading } = useFeaturedProducts(24);
  const productList = (products as Product[] | null) ?? [];
  const productIds = useMemo(() => productList.map((p) => p.id), [productList]);
  const { summaries } = useProductRatingSummaries(productIds);

  return (
    <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-neutral-900 mb-2">Trending on Small Street</h1>
        <p className="text-neutral-500 text-lg">What everyone's wearing right now.</p>
      </div>

      {loading ? (
        <ProductGridSkeleton count={8} />
      ) : productList.length === 0 ? (
        <EmptyState
          title="No trending products yet"
          message="Check back soon for trending styles from Small Street Fashion stores."
          actionLabel="Browse All Products"
          onAction={() => navigateTo('/products')}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {productList.map((product) => (
            <ProductCard key={product.id} product={product} ratingSummary={summaries[product.id] ?? null} />
          ))}
        </div>
      )}

      <div className="mt-12 text-center">
        <button
          onClick={() => navigateTo('/products')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-700 hover:text-neutral-900 hover:gap-2.5 transition-all"
        >
          Browse All Products
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
