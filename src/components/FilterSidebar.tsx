import { SlidersHorizontal, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { ProductFilters, SortOption, Category } from '@/types';
import { fetchCategories } from '@/services/categoryService';

interface FilterSidebarProps {
  filters: ProductFilters;
  sort: SortOption;
  setSort: (s: SortOption) => void;
  setCategory: (c: ProductFilters['category']) => void;
  setPriceRange: (min: number, max: number) => void;
  toggleSize: (s: string) => void;
  toggleColour: (c: string) => void;
  setStore: (id: string | null) => void;
  resetFilters: () => void;
  allColours: string[];
  allSizes: string[];
  storeList: { id: string; name: string }[];
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
];

export function FilterSidebar({
  filters,
  sort,
  setSort,
  setCategory,
  setPriceRange,
  toggleSize,
  toggleColour,
  setStore,
  resetFilters,
  allColours,
  allSizes,
  storeList,
  isMobileOpen,
  onCloseMobile,
}: FilterSidebarProps) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  const content = (
    <div className="space-y-6">
      {isMobileOpen && (
        <div className="flex items-center justify-between lg:hidden">
          <h3 className="font-bold text-neutral-900">Filters</h3>
          <button
            onClick={onCloseMobile}
            className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-md"
          >
            <X size={20} />
          </button>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">Sort By</h3>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">Category</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="category" checked={filters.category === 'all'} onChange={() => setCategory('all')} className="accent-neutral-900" />
            <span className="text-sm text-neutral-700">All Categories</span>
          </label>
          {categories.map((cat) => (
            <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="category" checked={filters.category === cat.slug} onChange={() => setCategory(cat.slug)} className="accent-neutral-900" />
              <span className="text-sm text-neutral-700">{cat.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">Price Range</h3>
        <div className="flex items-center gap-2">
          <input type="number" value={filters.priceMin || ''} onChange={(e) => setPriceRange(Number(e.target.value) || 0, filters.priceMax)} className="w-20 px-2 py-1.5 border border-neutral-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900" placeholder="Min" />
          <span className="text-neutral-400">&mdash;</span>
          <input type="number" value={filters.priceMax || ''} onChange={(e) => setPriceRange(filters.priceMin, Number(e.target.value) || 0)} className="w-20 px-2 py-1.5 border border-neutral-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900" placeholder="Max" />
        </div>
        <div className="mt-2 flex gap-2 flex-wrap">
          {[
            { label: 'Under R300', min: 0, max: 300 },
            { label: 'R300-R500', min: 300, max: 500 },
            { label: 'R500-R800', min: 500, max: 800 },
            { label: 'R800+', min: 800, max: 5000 },
          ].map((range) => (
            <button key={range.label} onClick={() => setPriceRange(range.min, range.max)} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filters.priceMin === range.min && filters.priceMax === range.max ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}>{range.label}</button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">Size</h3>
        <div className="flex flex-wrap gap-2">
          {allSizes.length === 0 && <span className="text-xs text-neutral-400">No sizes available</span>}
          {allSizes.map((size) => (
            <button key={size} onClick={() => toggleSize(size)} className={`min-w-[36px] h-9 px-2 text-xs font-medium rounded-lg border transition-colors ${filters.sizes.includes(size) ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'}`}>{size}</button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">Colour</h3>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {allColours.length === 0 && <span className="text-xs text-neutral-400">No colours available</span>}
          {allColours.map((colour) => (
            <label key={colour} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={filters.colours.includes(colour)} onChange={() => toggleColour(colour)} className="accent-neutral-900" />
              <span className="text-sm text-neutral-700">{colour}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">Store</h3>
        <select value={filters.storeId || ''} onChange={(e) => setStore(e.target.value || null)} className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900">
          <option value="">All Stores</option>
          {storeList.map((store) => (
            <option key={store.id} value={store.id}>{store.name}</option>
          ))}
        </select>
      </div>

      <button onClick={resetFilters} className="w-full py-2.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors">Reset Filters</button>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-24 bg-white border border-neutral-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <SlidersHorizontal size={18} className="text-neutral-900" />
            <h2 className="font-bold text-neutral-900">Filters</h2>
          </div>
          {content}
        </div>
      </aside>
      {isMobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onCloseMobile} />
          <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[80vw] bg-white overflow-y-auto p-5">{content}</div>
        </div>
      )}
    </>
  );
}
