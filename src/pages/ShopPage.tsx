import { useProductFilters } from '@/hooks/useProductFilters';
import { ProductGrid } from '@/components/ProductGrid';

interface ShopPageProps {
  category?: string;
}

export function ShopPage({ category }: ShopPageProps) {
  const hook = useProductFilters(category);

  const categoryName = category && category !== 'all'
    ? category.charAt(0).toUpperCase() + category.slice(1)
    : 'Shop All Products';

  return (
    <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-neutral-900">{categoryName}</h1>
        <p className="text-neutral-500 mt-1">Browse the latest fashion from Small Street stores</p>
      </div>
      <ProductGrid hook={hook} emptyMessage="No products match your filters. Try adjusting them or check back later." />
    </div>
  );
}
