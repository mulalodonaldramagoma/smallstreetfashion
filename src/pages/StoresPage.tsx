import { ArrowRight, MapPin, Package } from 'lucide-react';
import { useActiveStores } from '@/hooks/useData';
import { navigateTo } from '@/hooks/useRouter';
import { StoreCardSkeleton, EmptyState } from '@/components/ui/States';
import type { Store } from '@/types';

export function StoresPage() {
  const { data: stores, loading } = useActiveStores();

  return (
    <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-neutral-900 mb-2">Discover Small Street Stores</h1>
        <p className="text-neutral-500 text-lg max-w-2xl mx-auto">
          Independent fashion retailers from the heart of Johannesburg CBD.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <StoreCardSkeleton key={i} />)}
        </div>
      ) : (stores as Store[] | null)?.length === 0 ? (
        <EmptyState title="No stores yet" message="Be the first to open a store on Small Street Fashion!" actionLabel="Become a Seller" onAction={() => navigateTo('/register')} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(stores as Store[] | null)?.map((store) => (
            <div key={store.id} className="group bg-white rounded-xl overflow-hidden border border-neutral-200 hover:shadow-lg transition-shadow">
              <div className="relative h-56 overflow-hidden bg-neutral-100">
                {store.banner_url ? (
                  <img src={store.banner_url} alt={store.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-neutral-200 to-neutral-300" />
                )}
                {store.logo_url && (
                  <div className="absolute -bottom-6 left-5 w-14 h-14 rounded-lg overflow-hidden border-2 border-white shadow-md bg-white">
                    <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-1 mt-2">
                  <h3 className="font-bold text-neutral-900 text-lg">{store.name}</h3>
                  {store.is_verified && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Verified</span>}
                </div>
                <div className="flex items-center gap-1 text-xs text-neutral-500 mb-3"><MapPin size={12} />{store.location}</div>
                <p className="text-sm text-neutral-600 line-clamp-3 mb-4">{store.description || 'A Small Street Fashion store'}</p>
                <button onClick={() => navigateTo(`/store/${store.slug}`)} className="flex items-center gap-1 text-sm font-medium text-neutral-900 hover:gap-2 transition-all">View Store<ArrowRight size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
