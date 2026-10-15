import { ArrowLeft, MapPin, Package, Store, Phone, MessageCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useStoreBySlug } from '@/hooks/useData';
import { fetchProductsByStore } from '@/services/storeService';
import { ProductCard } from '@/components/ProductCard';
import { navigateTo } from '@/hooks/useRouter';
import { DetailSkeleton, ErrorState, EmptyState, ProductGridSkeleton } from '@/components/ui/States';
import type { Product, Store as StoreType } from '@/types';

interface StoreDetailPageProps {
  storeSlug: string;
}

export function StoreDetailPage({ storeSlug }: StoreDetailPageProps) {
  const { data: store, loading, error } = useStoreBySlug(storeSlug);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const s = store as StoreType | null;

  useEffect(() => {
    if (s?.id) {
      setProductsLoading(true);
      fetchProductsByStore(s.id)
        .then(setProducts)
        .catch(() => setProducts([]))
        .finally(() => setProductsLoading(false));
    }
  }, [s?.id]);

  if (loading) {
    return <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"><DetailSkeleton /></div>;
  }

  if (error || !s) {
    return (
      <div className="pt-24 max-w-7xl mx-auto px-4 py-20">
        <ErrorState message="Unable to load this store. Please try again." />
        <div className="text-center mt-4">
          <button onClick={() => navigateTo('/stores')} className="px-6 py-3 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors">View All Stores</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigateTo('/stores')} className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 mb-6 transition-colors">
        <ArrowLeft size={16} />Back to Stores
      </button>

      {/* Store Header */}
      <div className="relative h-64 rounded-2xl overflow-hidden mb-8 bg-neutral-100">
        {s.banner_url ? (
          <img src={s.banner_url} alt={s.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neutral-700 to-neutral-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end gap-4">
          {s.logo_url && (
            <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-white shadow-lg shrink-0">
              <img src={s.logo_url} alt={s.name} className="w-full h-full object-cover" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
              <Store size={16} /><span>Small Street Store</span>
              {s.is_verified && <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">Verified</span>}
            </div>
            <h1 className="text-3xl font-bold text-white">{s.name}</h1>
            <div className="flex items-center gap-4 mt-2 text-white/80 text-sm">
              <span className="flex items-center gap-1"><MapPin size={14} />{s.location}</span>
              <span className="flex items-center gap-1"><Package size={14} />{products.length} products</span>
            </div>
          </div>
        </div>
      </div>

      {/* Store Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <p className="text-neutral-600 leading-relaxed">{s.description || 'A Small Street Fashion store'}</p>
        </div>
        <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-neutral-900">Contact Information</h3>
          {s.phone && <div className="flex items-center gap-2 text-sm text-neutral-600"><Phone size={14} />{s.phone}</div>}
          {s.whatsapp && <div className="flex items-center gap-2 text-sm text-neutral-600"><MessageCircle size={14} />{s.whatsapp}</div>}
          <div className="flex items-center gap-2 text-sm text-neutral-600"><MapPin size={14} />{s.location}</div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-neutral-900 mb-6">Products from {s.name}</h2>

      {productsLoading ? (
        <ProductGridSkeleton count={8} />
      ) : products.length === 0 ? (
        <EmptyState title="No products available" message="This store hasn't added any products yet." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      )}
    </div>
  );
}
