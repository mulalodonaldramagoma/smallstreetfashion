import { ArrowRight, Truck, Store, Sparkles } from 'lucide-react';
import { navigateTo } from '@/hooks/useRouter';
import { useCategories, useFeaturedProducts, useNewArrivals, useActiveStores } from '@/hooks/useData';
import { ProductCard } from '@/components/ProductCard';
import { ProductGridSkeleton, CategoryGridSkeleton, StoreCardSkeleton } from '@/components/ui/States';
import type { Product, Category, Store as StoreType } from '@/types';

export function HomePage() {
  const { data: categories, loading: catLoading } = useCategories();
  const { data: featured, loading: featLoading } = useFeaturedProducts(12);
  const { data: newArrivals, loading: newArrLoading } = useNewArrivals(4);
  const { data: stores, loading: storeLoading } = useActiveStores();

  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="relative h-[70vh] min-h-[500px] max-h-[700px] overflow-hidden">
        <div className="absolute inset-0">
          <img src="https://images.pexels.com/photos/914667/pexels-photo-914667.jpeg?auto=compress&cs=tinysrgb&h=1200&w=2000" alt="Fashion model on city steps" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        </div>
        <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center">
          <div className="max-w-xl">
            <p className="text-amber-300 text-sm font-medium tracking-wider uppercase mb-3">Small Street &middot; Johannesburg CBD</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] mb-5">Johannesburg Fashion.<br />Delivered to You.</h1>
            <p className="text-lg text-white/80 mb-8 leading-relaxed max-w-lg">Discover the latest styles from Small Street and Johannesburg CBD fashion stores &mdash; all in one place.</p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => navigateTo('/products')} className="px-7 py-3.5 bg-white text-neutral-900 text-sm font-semibold rounded-lg hover:bg-neutral-100 transition-colors flex items-center gap-2">Shop Now<ArrowRight size={18} /></button>
              <button onClick={() => navigateTo('/new-arrivals')} className="px-7 py-3.5 bg-white/10 backdrop-blur border border-white/30 text-white text-sm font-semibold rounded-lg hover:bg-white/20 transition-colors">Explore New Arrivals</button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-neutral-900 mb-2">Shop by Category</h2>
          <p className="text-neutral-500">Find exactly what you're looking for</p>
        </div>
        {catLoading ? (
          <CategoryGridSkeleton />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {(categories as Category[] | null)?.map((cat) => (
              <button key={cat.id} onClick={() => navigateTo(`/products/${cat.slug}`)} className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-neutral-100">
                <img src={cat.image_url || 'https://images.pexels.com/photos/996329/pexels-photo-996329.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'} alt={cat.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
                  <h3 className="text-sm font-bold text-white mb-0.5">{cat.name}</h3>
                  <p className="text-xs text-white/70 line-clamp-1">{cat.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Trending */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-neutral-900 mb-1">Trending on Small Street</h2>
            <p className="text-neutral-500">What everyone's wearing right now</p>
          </div>
          <button onClick={() => navigateTo('/products')} className="hidden sm:flex items-center gap-1 text-sm font-medium text-neutral-900 hover:gap-2 transition-all">View All<ArrowRight size={16} /></button>
        </div>
        {featLoading ? (
          <ProductGridSkeleton count={8} />
        ) : (featured as Product[] | null)?.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-neutral-500">No trending products yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {(featured as Product[] | null)?.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Promo Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="relative rounded-2xl overflow-hidden bg-neutral-900">
          <img src="https://images.pexels.com/photos/2464890/pexels-photo-2464890.jpeg?auto=compress&cs=tinysrgb&h=650&w=2000" alt="Johannesburg street scene" className="w-full h-[300px] sm:h-[350px] object-cover opacity-50" />
          <div className="absolute inset-0 flex items-center">
            <div className="max-w-lg px-6 sm:px-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight">Shop Small Street.<br />Support Local Fashion.</h2>
              <p className="text-white/80 mb-6 leading-relaxed">Discover independent fashion retailers from Johannesburg CBD and shop their latest styles online.</p>
              <button onClick={() => navigateTo('/products')} className="px-6 py-3 bg-white text-neutral-900 text-sm font-semibold rounded-lg hover:bg-neutral-100 transition-colors">Start Shopping</button>
            </div>
          </div>
        </div>
      </section>

      {/* New Arrivals Preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-neutral-900 mb-1">New Arrivals</h2>
            <p className="text-neutral-500">Fresh styles from Johannesburg CBD</p>
          </div>
          <button onClick={() => navigateTo('/new-arrivals')} className="hidden sm:flex items-center gap-1 text-sm font-medium text-neutral-900 hover:gap-2 transition-all">View All<ArrowRight size={16} /></button>
        </div>
        {newArrLoading ? (
          <ProductGridSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {(newArrivals as Product[] | null)?.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Stores */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-amber-600 text-sm font-medium mb-2"><Store size={16} /><span>Local Businesses</span></div>
          <h2 className="text-3xl font-bold text-neutral-900 mb-2">Discover Small Street Stores</h2>
          <p className="text-neutral-500">Independent fashion retailers from the heart of Johannesburg</p>
        </div>
        {storeLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => <StoreCardSkeleton key={i} />)}
          </div>
        ) : (stores as StoreType[] | null)?.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-neutral-500">No stores yet. Be the first to sell on Small Street Fashion!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(stores as StoreType[] | null)?.slice(0, 3).map((store) => (
              <div key={store.id} className="group bg-white rounded-xl overflow-hidden border border-neutral-200 hover:shadow-lg transition-shadow">
                <div className="relative h-48 overflow-hidden bg-neutral-100">
                  {store.banner_url ? (
                    <img src={store.banner_url} alt={store.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-neutral-200 to-neutral-300" />
                  )}
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-neutral-900 mb-1">{store.name}</h3>
                  <p className="text-xs text-neutral-500 mb-2">{store.location}</p>
                  <p className="text-sm text-neutral-600 line-clamp-2 mb-3">{store.description || 'A Small Street Fashion store'}</p>
                  <button onClick={() => navigateTo(`/store/${store.slug}`)} className="text-sm font-medium text-neutral-900 hover:gap-2 flex items-center gap-1 transition-all">View Store<ArrowRight size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Delivery */}
      <section className="bg-neutral-50 border-y border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="w-16 h-16 bg-neutral-900 rounded-2xl flex items-center justify-center shrink-0"><Truck size={32} className="text-white" /></div>
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 text-amber-600 text-xs font-medium mb-2"><Sparkles size={14} /><span>Coming Soon</span></div>
              <h2 className="text-2xl font-bold text-neutral-900 mb-2">Delivery Across South Africa</h2>
              <p className="text-neutral-600 leading-relaxed max-w-2xl">Order from Small Street and have your fashion delivered to your door. Courier integration will be introduced in a future version.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
