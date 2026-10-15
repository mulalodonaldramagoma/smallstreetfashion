import { Package, Store, TrendingUp, AlertCircle } from 'lucide-react';
import { SellerLayout } from '@/components/SellerLayout';
import { useAuth } from '@/context/AuthContext';
import { useSellerStore, useSellerProducts } from '@/hooks/useData';
import { ErrorState } from '@/components/ui/States';
import { navigateTo } from '@/hooks/useRouter';

export function SellerOverviewPage() {
  const { user } = useAuth();
  const { data: store, loading: storeLoading, error: storeError } = useSellerStore(user?.id ?? null);
  const { data: products, loading: productsLoading, error: productsError } = useSellerProducts(store?.id ?? null);

  const productCount = products?.length ?? 0;
  const activeProducts = products?.filter((p) => p.is_active).length ?? 0;
  const lowStock = products?.filter((p) => p.stock > 0 && p.stock <= 5).length ?? 0;
  const outOfStock = products?.filter((p) => p.stock === 0).length ?? 0;

  return (
    <SellerLayout activePage="overview">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Overview</h1>
        <p className="text-sm text-neutral-500">Your store at a glance</p>
      </div>

      {storeError ? (
        <ErrorState message="Unable to load your store information." />
      ) : storeLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-neutral-200 p-5 animate-pulse">
              <div className="h-8 w-8 bg-neutral-200 rounded-lg mb-3" />
              <div className="h-6 w-16 bg-neutral-200 rounded mb-2" />
              <div className="h-3 w-24 bg-neutral-200 rounded" />
            </div>
          ))}
        </div>
      ) : !store ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={26} className="text-amber-500" />
          </div>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">
            You haven't created your store yet
          </h2>
          <p className="text-sm text-neutral-500 mb-5 max-w-md mx-auto">
            Create your store to start adding products and selling on Small Street Fashion.
          </p>
          <button
            onClick={() => navigateTo('/seller/store')}
            className="px-6 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Create Your Store
          </button>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={<Store size={20} />}
              label="Store Status"
              value={store.is_active ? 'Active' : 'Inactive'}
              color="bg-green-50 text-green-600"
            />
            <StatCard
              icon={<Package size={20} />}
              label="Total Products"
              value={String(productCount)}
              loading={productsLoading}
              color="bg-blue-50 text-blue-600"
            />
            <StatCard
              icon={<TrendingUp size={20} />}
              label="Active Products"
              value={String(activeProducts)}
              loading={productsLoading}
              color="bg-neutral-100 text-neutral-600"
            />
            <StatCard
              icon={<AlertCircle size={20} />}
              label="Low / Out of Stock"
              value={`${lowStock} / ${outOfStock}`}
              loading={productsLoading}
              color="bg-amber-50 text-amber-600"
            />
          </div>

          {/* Store Info */}
          <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6">
            <h2 className="font-bold text-neutral-900 mb-4">Store Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow label="Store Name" value={store.name} />
              <InfoRow label="Location" value={store.location} />
              <InfoRow label="Phone" value={store.phone || 'Not set'} />
              <InfoRow label="WhatsApp" value={store.whatsapp || 'Not set'} />
              <InfoRow
                label="Verified"
                value={store.is_verified ? 'Yes' : 'Pending'}
              />
              <InfoRow
                label="Active"
                value={store.is_active ? 'Yes' : 'No'}
              />
            </div>
            <button
              onClick={() => navigateTo('/seller/store')}
              className="mt-4 px-4 py-2 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              Edit Store
            </button>
          </div>

          {/* Recent Products */}
          {productsError ? (
            <ErrorState message="Unable to load your products." />
          ) : (
            <div className="bg-white border border-neutral-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-neutral-900">Recent Products</h2>
                <button
                  onClick={() => navigateTo('/seller/products')}
                  className="text-sm font-medium text-neutral-900 hover:underline"
                >
                  View All
                </button>
              </div>
              {productsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-neutral-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : productCount === 0 ? (
                <p className="text-sm text-neutral-500 py-4">
                  No products yet.{' '}
                  <button
                    onClick={() => navigateTo('/seller/products/new')}
                    className="font-medium text-neutral-900 hover:underline"
                  >
                    Add your first product
                  </button>
                </p>
              ) : (
                <div className="space-y-2">
                  {(products ?? []).slice(0, 5).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-200 shrink-0">
                        {p.main_image_url && (
                          <img src={p.main_image_url} alt={p.name} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 truncate">{p.name}</p>
                        <p className="text-xs text-neutral-500">R{Number(p.price)} &middot; Stock: {p.stock}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        p.is_active ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-500'
                      }`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </SellerLayout>
  );
}

function StatCard({ icon, label, value, loading, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  loading?: boolean;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        {icon}
      </div>
      {loading ? (
        <div className="h-6 w-16 bg-neutral-100 rounded animate-pulse" />
      ) : (
        <p className="text-2xl font-bold text-neutral-900">{value}</p>
      )}
      <p className="text-xs text-neutral-500 mt-1">{label}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-neutral-900">{value}</p>
    </div>
  );
}
