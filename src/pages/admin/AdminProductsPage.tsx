import { useState, useEffect } from 'react';
import {
  Package,
  Search,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchAdminProducts, adminToggleProductActive } from '@/services/adminService';
import { fetchAdminStores } from '@/services/adminService';
import { fetchCategories } from '@/services/categoryService';
import { formatPrice } from '@/utils/format';
import type { Product, Category, AdminStoreWithSeller } from '@/types';

export function AdminProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [storeId, setStoreId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out' | 'in'>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [stores, setStores] = useState<AdminStoreWithSeller[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);

  const perPage = 20;

  useEffect(() => {
    if (user) {
      fetchAdminStores().then(setStores).catch(() => {});
      fetchCategories().then(setCategories).catch(() => {});
    }
  }, [user]);

  const loadProducts = () => {
    setLoading(true);
    fetchAdminProducts({
      search: search || undefined,
      storeId: storeId || null,
      categoryId: categoryId || null,
      isActive: activeFilter === 'all' ? null : activeFilter === 'active',
      stockFilter,
      page,
      perPage,
    })
      .then(({ products, total }) => {
        setProducts(products);
        setTotal(total);
      })
      .catch((err) => setError('Failed to load products'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) loadProducts();
  }, [user, page, storeId, categoryId, activeFilter, stockFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { if (user) { setPage(1); loadProducts(); } }, 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const handleToggle = async (product: Product) => {
    if (!user) return;
    setActingId(product.id);
    try {
      await adminToggleProductActive(product.id, !product.is_active, user.id);
      loadProducts();
    } catch (err) {
      setError('Action failed');
    } finally {
      setActingId(null);
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Product Moderation</h1>
        <p className="text-sm text-neutral-500">Search, filter, hide, and restore product listings</p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 mb-6 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            placeholder="Search products by name or description..."
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            value={storeId}
            onChange={(e) => { setStoreId(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
          >
            <option value="">All Stores</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
          >
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={activeFilter}
            onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Hidden Only</option>
          </select>
          <select
            value={stockFilter}
            onChange={(e) => { setStockFilter(e.target.value as 'all' | 'low' | 'out' | 'in'); setPage(1); }}
            className="px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
          >
            <option value="all">All Stock Levels</option>
            <option value="in">In Stock (&gt;5)</option>
            <option value="low">Low Stock (1-5)</option>
            <option value="out">Out of Stock (0)</option>
          </select>
        </div>
      </div>

      <p className="text-xs text-neutral-500 mb-4">{total} product{total !== 1 ? 's' : ''} found</p>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-neutral-400" />
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
          <Package size={28} className="text-neutral-300 mx-auto mb-3" />
          <p className="text-sm text-neutral-500">No products match your filters.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {products.map((product) => (
              <div key={product.id} className="bg-white border border-neutral-200 rounded-xl p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
                  {product.main_image_url ? (
                    <img src={product.main_image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package size={18} className="text-neutral-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-neutral-900 truncate">{product.name}</p>
                    {!product.is_active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 font-medium">Hidden</span>
                    )}
                    {product.is_demo && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">Demo</span>
                    )}
                    {product.stock === 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-medium">Out of stock</span>
                    )}
                    {product.stock > 0 && product.stock <= 5 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">Low: {product.stock}</span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {product.store?.name || 'Unknown store'} · {formatPrice(Number(product.price))}
                  </p>
                </div>
                <button
                  onClick={() => handleToggle(product)}
                  disabled={actingId === product.id}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50 ${
                    product.is_active
                      ? 'border border-rose-200 text-rose-600 hover:bg-rose-50'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {actingId === product.id ? <Loader2 size={12} className="animate-spin" /> : product.is_active ? <><EyeOff size={12} /> Hide</> : <><Eye size={12} /> Restore</>}
                </button>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-neutral-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
