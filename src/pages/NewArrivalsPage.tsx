import { useNewArrivals } from '@/hooks/useData';
import { ProductCard } from '@/components/ProductCard';
import { ProductGridSkeleton, EmptyState } from '@/components/ui/States';
import type { Product } from '@/types';

export function NewArrivalsPage() {
  const { data: products, loading } = useNewArrivals(20);

  return (
    <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-neutral-900 mb-2">New Arrivals</h1>
        <p className="text-neutral-500 text-lg">Fresh styles from Johannesburg CBD.</p>
      </div>

      {loading ? (
        <ProductGridSkeleton count={8} />
      ) : (products as Product[] | null)?.length === 0 ? (
        <EmptyState title="No new arrivals yet" message="Check back soon for fresh styles from Small Street Fashion stores." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {(products as Product[] | null)?.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
