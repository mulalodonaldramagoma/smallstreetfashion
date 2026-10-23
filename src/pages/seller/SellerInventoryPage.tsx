import { useState, useEffect } from 'react';
import { Save, AlertCircle, Minus, Plus, Package, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { SellerLayout } from '@/components/SellerLayout';
import { useAuth } from '@/context/AuthContext';
import { useSellerStore } from '@/hooks/useData';
import { fetchSellerProducts, updateProduct } from '@/services/productService';
import { ErrorState, EmptyState } from '@/components/ui/States';
import { navigateTo } from '@/hooks/useRouter';
import { formatPrice } from '@/utils/format';
import type { Product } from '@/types';

function getStockStatus(stock: number, isActive: boolean): { label: string; color: string } {
  if (!isActive) return { label: 'Inactive', color: 'bg-neutral-200 text-neutral-600' };
  if (stock === 0) return { label: 'Out of Stock', color: 'bg-rose-100 text-rose-700' };
  if (stock <= 5) return { label: 'Low Stock', color: 'bg-amber-100 text-amber-700' };
  return { label: 'In Stock', color: 'bg-green-100 text-green-700' };
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-neutral-900">{value}</p>
      <p className="text-xs text-neutral-500 mt-1">{label}</p>
    </div>
  );
}

export function SellerInventoryPage() {
  const { user } = useAuth();
  const { data: store } = useSellerStore(user?.id ?? null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    if (!store?.id) return;
    setLoading(true);
    fetchSellerProducts(store.id)
      .then(setProducts)
      .catch(() => setError('Unable to load your inventory. Please try again.'))
      .finally(() => setLoading(false));
  }, [store?.id]);

  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.is_active).length;
  const outOfStock = products.filter((p) => p.is_active && p.stock === 0).length;
  const lowStock = products.filter((p) => p.is_active && p.stock > 0 && p.stock <= 5).length;

  const handleStockChange = async (productId: string, newStock: number) => {
    if (newStock < 0 || !Number.isInteger(newStock)) return;
    setUpdatingId(productId);
    setUpdateError(null);
    try {
      await updateProduct(productId, { stock: newStock });
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stock: newStock } : p))
      );
    } catch {
      setUpdateError('Unable to update stock. The change was not saved.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (!store && !loading) {
    return (
      <SellerLayout activePage="inventory">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <AlertCircle size={26} className="text-amber-500 mx-auto mb-3" />
          <h2 className="font-semibold text-neutral-900 mb-2">Please create your store first</h2>
          <button onClick={() => navigateTo('/seller/store')} className="px-5 py-2 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors">Create Store</button>
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout activePage="inventory">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Inventory</h1>
        <p className="text-sm text-neutral-500">Track and update your stock levels</p>
      </div>

      {updateError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700 mb-4">{updateError}</div>
      )}

      {/* Summary Stats */}
      {!loading && !error && products.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={<Package size={20} />}
            label="Total Products"
            value={totalProducts}
            color="bg-blue-50 text-blue-600"
          />
          <StatCard
            icon={<CheckCircle size={20} />}
            label="Active Products"
            value={activeProducts}
            color="bg-green-50 text-green-600"
          />
          <StatCard
            icon={<AlertTriangle size={20} />}
            label="Low Stock (1-5)"
            value={lowStock}
            color="bg-amber-50 text-amber-600"
          />
          <StatCard
            icon={<XCircle size={20} />}
            label="Out of Stock"
            value={outOfStock}
            color="bg-rose-50 text-rose-600"
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-neutral-100 rounded-xl animate-pulse" />)}</div>
      ) : error ? (
        <ErrorState message={error} />
      ) : products.length === 0 ? (
        <EmptyState title="No products in inventory" message="Add products to start tracking your stock." actionLabel="Add Product" onAction={() => navigateTo('/seller/products/new')} />
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="text-left font-semibold text-neutral-700 px-4 py-3">Product</th>
                  <th className="text-left font-semibold text-neutral-700 px-4 py-3 hidden sm:table-cell">SKU</th>
                  <th className="text-left font-semibold text-neutral-700 px-4 py-3">Price</th>
                  <th className="text-left font-semibold text-neutral-700 px-4 py-3">Stock</th>
                  <th className="text-left font-semibold text-neutral-700 px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {products.map((p) => {
                  const status = getStockStatus(p.stock, p.is_active);
                  return (
                    <tr key={p.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
                            {p.main_image_url && <img src={p.main_image_url} alt={p.name} className="w-full h-full object-cover" />}
                          </div>
                          <span className="font-medium text-neutral-900 truncate max-w-[180px]">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-500 hidden sm:table-cell">{p.sku || '—'}</td>
                      <td className="px-4 py-3 text-neutral-700">{formatPrice(Number(p.price))}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleStockChange(p.id, Math.max(0, p.stock - 1))} disabled={updatingId === p.id} className="p-1 text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded transition-colors disabled:opacity-50" aria-label="Decrease stock"><Minus size={12} /></button>
                          <span className="text-sm font-semibold text-neutral-900 min-w-[30px] text-center">{p.stock}</span>
                          <button onClick={() => handleStockChange(p.id, p.stock + 1)} disabled={updatingId === p.id} className="p-1 text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded transition-colors disabled:opacity-50" aria-label="Increase stock"><Plus size={12} /></button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${status.color}`}>{status.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SellerLayout>
  );
}
