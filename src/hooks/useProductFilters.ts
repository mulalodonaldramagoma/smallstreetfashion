import { useMemo, useState, useEffect, useCallback } from 'react';
import type { ProductFilters, SortOption, Product } from '@/types';
import { fetchProducts, fetchAllColours, fetchAllSizes } from '@/services/productService';
import { fetchActiveStores } from '@/services/storeService';

const defaultFilters: ProductFilters = {
  category: 'all',
  priceMin: 0,
  priceMax: 0,
  sizes: [],
  colours: [],
  storeId: null,
  search: '',
};

export function useProductFilters(initialCategory?: string) {
  const [filters, setFilters] = useState<ProductFilters>({
    ...defaultFilters,
    category: initialCategory || 'all',
  });
  const [sort, setSort] = useState<SortOption>('featured');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allColours, setAllColours] = useState<string[]>([]);
  const [allSizes, setAllSizes] = useState<string[]>([]);
  const [storeList, setStoreList] = useState<{ id: string; name: string }[]>([]);

  // Update category when initialCategory changes
  useEffect(() => {
    if (initialCategory) {
      setFilters((prev) => ({ ...prev, category: initialCategory }));
    }
  }, [initialCategory]);

  // Fetch colours, sizes, and stores on mount
  useEffect(() => {
    Promise.all([fetchAllColours(), fetchAllSizes(), fetchActiveStores()])
      .then(([colours, sizes, stores]) => {
        setAllColours(colours);
        setAllSizes(sizes);
        setStoreList(stores.map((s) => ({ id: s.id, name: s.name })));
      })
      .catch(() => {
        // Fail silently — fallbacks are in place
      });
  }, []);

  // Fetch products when filters or sort change
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    fetchProducts(filters, sort)
      .then((data) => {
        if (mounted) {
          setProducts(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError('Unable to load products. Please try again.');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [filters, sort]);

  const setCategory = useCallback((category: ProductFilters['category']) => {
    setFilters((prev) => ({ ...prev, category }));
  }, []);

  const setPriceRange = useCallback(
    (min: number, max: number) =>
      setFilters((prev) => ({ ...prev, priceMin: min, priceMax: max })),
    []
  );

  const toggleSize = useCallback((size: string) => {
    setFilters((prev) => ({
      ...prev,
      sizes: prev.sizes.includes(size)
        ? prev.sizes.filter((s) => s !== size)
        : [...prev.sizes, size],
    }));
  }, []);

  const toggleColour = useCallback((colour: string) => {
    setFilters((prev) => ({
      ...prev,
      colours: prev.colours.includes(colour)
        ? prev.colours.filter((c) => c !== colour)
        : [...prev.colours, colour],
    }));
  }, []);

  const setStore = useCallback(
    (storeId: string | null) => setFilters((prev) => ({ ...prev, storeId })),
    []
  );

  const setSearch = useCallback(
    (search: string) => setFilters((prev) => ({ ...prev, search })),
    []
  );

  const resetFilters = useCallback(() => {
    setFilters({
      ...defaultFilters,
      category: (initialCategory as ProductFilters['category']) || 'all',
    });
    setSort('featured');
  }, [initialCategory]);

  const filtered = useMemo(() => products, [products]);

  return {
    filters,
    sort,
    setSort,
    setCategory,
    setPriceRange,
    toggleSize,
    toggleColour,
    setStore,
    setSearch,
    resetFilters,
    filtered,
    loading,
    error,
    allColours,
    allSizes,
    storeList,
  };
}
