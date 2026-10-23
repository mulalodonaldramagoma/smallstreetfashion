import { useState, useEffect } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { useProductFilters } from '@/hooks/useProductFilters';
import { ProductGrid } from '@/components/ProductGrid';

interface SearchPageProps {
  query: string;
}

export function SearchPage({ query }: SearchPageProps) {
  const hook = useProductFilters();
  const [searchInput, setSearchInput] = useState(query);

  useEffect(() => {
    setSearchInput(query);
    hook.setSearch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    hook.setSearch(searchInput);
  };

  const emptyMessage = query
    ? `No products found for '${query}'.`
    : 'Start typing to search for products.';

  return (
    <div className="pt-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 mb-4">Search</h1>
        <form onSubmit={handleSearch} className="relative max-w-2xl">
          <SearchIcon
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by product name, category, store, or description..."
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-neutral-200 rounded-xl text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
        </form>
        {query && (
          <p className="text-sm text-neutral-500 mt-3">
            Showing results for: <span className="font-medium text-neutral-900">"{query}"</span>
          </p>
        )}
      </div>

      <ProductGrid hook={hook} emptyMessage={emptyMessage} />
    </div>
  );
}
