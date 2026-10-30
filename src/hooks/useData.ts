import { useState, useEffect, useCallback } from 'react';
import type { Category, Store, Product, SortOption, ProductFilters } from '@/types';
import { fetchCategories } from '@/services/categoryService';
import { fetchActiveStores, fetchStoreBySlug, fetchStoreBySeller } from '@/services/storeService';
import {
  fetchProducts,
  fetchFeaturedProducts,
  fetchNewArrivals,
  fetchProductById,
  fetchSellerProducts,
  fetchAllColours,
  fetchAllSizes,
} from '@/services/productService';

function useAsync<T>(
  asyncFn: () => Promise<T>,
  deps: unknown[] = []
): { data: T | null; loading: boolean; error: string | null; refetch: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  const refetch = useCallback(() => setRefetchCount((c) => c + 1), []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    asyncFn()
      .then((result) => {
        if (mounted) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError('Something went wrong.');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refetchCount]);

  return { data, loading, error, refetch };
}

export function useCategories() {
  return useAsync(() => fetchCategories(), []);
}

export function useActiveStores() {
  return useAsync(() => fetchActiveStores(), []);
}

export function useStoreBySlug(slug: string | null) {
  return useAsync(
    () => (slug ? fetchStoreBySlug(slug) : Promise.resolve(null)),
    [slug]
  );
}

export function useSellerStore(sellerId: string | null) {
  return useAsync(
    () => (sellerId ? fetchStoreBySeller(sellerId) : Promise.resolve(null)),
    [sellerId]
  );
}

export function useProductById(id: string | null) {
  return useAsync(
    () => (id ? fetchProductById(id) : Promise.resolve(null)),
    [id]
  );
}

export function useFeaturedProducts(limit = 12) {
  return useAsync(() => fetchFeaturedProducts(limit), []);
}

export function useNewArrivals(limit = 8) {
  return useAsync(() => fetchNewArrivals(limit), []);
}

export function useSellerProducts(storeId: string | null) {
  return useAsync(
    () => (storeId ? fetchSellerProducts(storeId) : Promise.resolve([])),
    [storeId]
  );
}

export function useAllColours() {
  return useAsync(() => fetchAllColours(), []);
}

export function useAllSizes() {
  return useAsync(() => fetchAllSizes(), []);
}

export function useFilteredProducts(
  filters: Partial<ProductFilters>,
  sort: SortOption
) {
  const filterKey = JSON.stringify({ filters, sort });
  return useAsync(() => fetchProducts(filters, sort), [filterKey]);
}
