import { Plus, Edit, Trash2, Power, AlertCircle, Search, X } from 'lucide-react';
import { SellerLayout } from '@/components/SellerLayout';
import { useAuth } from '@/context/AuthContext';
import { useSellerStore, useSellerProducts } from '@/hooks/useData';
import { updateProduct, deleteProduct } from '@/services/productService';
import { ErrorState, EmptyState } from '@/components/ui/States';
import { navigateTo } from '@/hooks/useRouter';
import { useState, useMemo, useEffect } from 'react';
import { formatPrice } from '@/utils/format';
import { fetchCategoryTree } from '@/services/categoryService';
import type { CategoryWithChildren, SortOption } from '@/types';

type StockFilter = 'all' | 'in-stock' | 'low-stock' | 'out-of-stock' | 'inactive';

function getStockStatus(stock: number, isActive: boolean): { label: string; color: string } {
  if (!isActive) return { label: 'Inactive', color: 'bg-neutral-200 text-neutral-600' };
  if (stock === 0) return { label: 'Out of Stock', color: 'bg-rose-100 text-rose-700' };
  if (stock <= 5) return { label: 'Low Stock', color: 'bg-amber-100 text-amber-700' };
  return { label: 'In Stock', color: 'bg-green-100 text-green-700' };
}

export function SellerProductsPage() {
  const { user } = useAuth();
  const { data: store } = useSellerStore(user?.id ?? null);
  const { data: products, loading, error, refetch } = useSellerProducts(store?.id ?? null);
  const [categoryTree, setCategoryTree] = useState<CategoryWithChildren[]>([]);

  useEffect(() => {
    fetchCategoryTree().then(setCategoryTree).catch(() => {});
  }, []);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let result = [...products];

    // Search by name
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }

    // Filter by category (includes subcategories when a department is selected)
    if (categoryFilter !== 'all') {
      const dept = categoryTree.find((d) => d.id === categoryFilter);
      if (dept) {
        const matchIds = new Set([dept.id, ...dept.children.map((c) => c.id)]);
        result = result.filter((p) => p.category_id && matchIds.has(p.category_id));
      } else {
        result = result.filter((p) => p.category_id === categoryFilter);
      }
    }

    // Filter by stock status
    if (stockFilter !== 'all') {
      result = result.filter((p) => {
        const status = getStockStatus(p.stock, p.is_active);
        if (stockFilter === 'in-stock') return status.label === 'In Stock';
        if (stockFilter === 'low-stock') return status.label === 'Low Stock';
        if (stockFilter === 'out-of-stock') return status.label === 'Out of Stock';
        if (stockFilter === 'inactive') return status.label === 'Inactive';
        return true;
      });
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'price-low':
        result.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case 'price-high':
        result.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case 'featured':
        result.sort((a, b) => {
          if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        break;
    }

    return result;
  }, [products, searchQuery, categoryFilter, stockFilter, sortBy, categoryTree]);

  const hasFilters = searchQuery.trim() || categoryFilter !== 'all' || stockFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setStockFilter('all');
    setSortBy('newest');
  };

  const handleToggleActive = async (productId: string, current: boolean) => {
    setActionError(null);
    try {
      await updateProduct(productId, { is_active: !current });
      refetch();
    } catch {
      setActionError('Unable to update product status. Please try again.');
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product? This cannot be undone.')) return;
    setActionError(null);
    try {
      await deleteProduct(productId);
      refetch();
    } catch {
      setActionError('Unable to delete product. Please try again.');
    }
  };

  if (!store && !loading) {
    return (
      <SellerLayout activePage="products">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <AlertCircle size={26} className="text-amber-500 mx-auto mb-3" />
          <h2 className="font-semibold text-neutral-900 mb-2">Please create your store first</h2>
          <p className="text-sm text-neutral-500 mb-4">You need a store before you can add products.</p>
          <button
            onClick={() => navigateTo('/seller/store')}
            className="px-5 py-2 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Create Store
          </button>
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout activePage="products">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-1">Products</h1>
          <p className="text-sm text-neutral-500">Manage your store's products</p>
        </div>
        <button
          onClick={() => navigateTo('/seller/products/new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Product</span>
        </button>
      </div>

      {actionError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700 mb-4">
          {actionError}
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 mb-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by name..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 min-w-[140px]"
          >
            <option value="all">All Departments</option>
            {categoryTree.map((dept) => (
              <optgroup key={dept.id} label={dept.name}>
                <option value={dept.id}>All {dept.name}</option>
                {dept.children.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </optgroup>
            ))}
          </select>

          {/* Stock Filter */}
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as StockFilter)}
            className="px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 min-w-[130px]"
          >
            <option value="all">All Status</option>
            <option value="in-stock">In Stock</option>
            <option value="low-stock">Low Stock</option>
            <option value="out-of-stock">Out of Stock</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 min-w-[130px]"
          >
            <option value="newest">Newest</option>
            <option value="featured">Featured</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>

        {hasFilters && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-500">
              Showing {filteredProducts.length} of {products?.length ?? 0} products
            </p>
            <button
              onClick={clearFilters}
              className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1"
            >
              <X size={12} /> Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Product List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-neutral-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message="Unable to load your products. Please try again." />
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No matching products' : 'No products yet'}
          message={hasFilters ? 'Try adjusting your search or filters.' : 'Create your first product to start selling on Small Street Fashion.'}
          actionLabel={hasFilters ? undefined : 'Add Your First Product'}
          onAction={hasFilters ? undefined : () => navigateTo('/seller/products/new')}
        />
      ) : (
        <div className="space-y-3">
          {filteredProducts.map((p) => {
            const status = getStockStatus(p.stock, p.is_active);
            return (
              <div
                key={p.id}
                className="flex items-center gap-4 bg-white border border-neutral-200 rounded-xl p-4"
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
                  {p.main_image_url ? (
                    <img src={p.main_image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Plus size={20} className="text-neutral-300" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-neutral-900 truncate">{p.name}</h3>
                  <p className="text-xs text-neutral-500">
                    {p.category?.name || 'Uncategorized'} &middot; {formatPrice(Number(p.price))}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                    {p.is_featured && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        Featured
                      </span>
                    )}
                    {p.is_demo && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        Demo
                      </span>
                    )}
                    <span className="text-xs text-neutral-400">Stock: {p.stock}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => navigateTo(`/seller/products/${p.id}/edit`)}
                    className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
                    aria-label="Edit"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleToggleActive(p.id, p.is_active)}
                    className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
                    aria-label="Toggle active"
                  >
                    <Power size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-2 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SellerLayout>
  );
}
