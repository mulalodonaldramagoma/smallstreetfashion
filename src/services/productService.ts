import { supabase } from '@/lib/supabase';
import type { Product, ProductFilters, SortOption } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProductQuery = any;

function applySorting(query: ProductQuery, sort: SortOption) {
  switch (sort) {
    case 'newest':
      return query.order('created_at', { ascending: false });
    case 'price-low':
      return query.order('price', { ascending: true });
    case 'price-high':
      return query.order('price', { ascending: false });
    case 'featured':
    default:
      return query
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });
  }
}

export async function fetchProducts(
  filters?: Partial<ProductFilters>,
  sort: SortOption = 'featured'
): Promise<Product[]> {
  const hasCategoryFilter =
    !!filters?.category && filters.category !== 'all';

  let query = supabase
    .from('products')
    .select(
      `
      *,
      store:stores!inner(id, name, slug, location),
      category:categories${hasCategoryFilter ? '!inner' : ''}(id, name, slug),
      product_images(id, image_url, position)
    `
    )
    .eq('is_active', true);

  if (hasCategoryFilter) {
    query = query.eq('category.slug', filters!.category);
  }

  if (filters?.priceMin !== undefined && filters.priceMin > 0) {
    query = query.gte('price', filters.priceMin);
  }

  if (filters?.priceMax !== undefined && filters.priceMax > 0) {
    query = query.lte('price', filters.priceMax);
  }

  if (filters?.storeId) {
    query = query.eq('store_id', filters.storeId);
  }

  if (filters?.sizes && filters.sizes.length > 0) {
    query = query.overlaps('sizes', filters.sizes);
  }

  if (filters?.colours && filters.colours.length > 0) {
    query = query.overlaps('colours', filters.colours);
  }

  if (filters?.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    );
  }

  query = applySorting(query, sort);

  const { data, error } = await query;

  if (error) throw error;

  // For store name search, we need to filter client-side since Supabase
  // doesn't support filtering on joined columns with ilike easily
  let products = data as unknown as Product[];

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false) ||
        (p.store?.name.toLowerCase().includes(q) ?? false) ||
        (p.category?.name.toLowerCase().includes(q) ?? false)
    );
  }

  return products;
}

export async function fetchProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      *,
      store:stores!inner(id, name, slug, location),
      category:categories(id, name, slug),
      product_images(id, image_url, position)
    `
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as Product | null;
}

export async function fetchFeaturedProducts(limit = 12): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      *,
      store:stores!inner(id, name, slug, location),
      category:categories(id, name, slug),
      product_images(id, image_url, position)
    `
    )
    .eq('is_active', true)
    .eq('is_featured', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as unknown as Product[];
}

export async function fetchNewArrivals(limit = 8): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      *,
      store:stores!inner(id, name, slug, location),
      category:categories(id, name, slug),
      product_images(id, image_url, position)
    `
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as unknown as Product[];
}

// ===== Seller product management =====

export async function fetchSellerProducts(storeId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      *,
      category:categories(id, name, slug),
      product_images(id, image_url, position)
    `
    )
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as Product[];
}

export async function fetchSellerProductById(
  productId: string,
  storeId: string
): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      *,
      category:categories(id, name, slug),
      product_images(id, image_url, position)
    `
    )
    .eq('id', productId)
    .eq('store_id', storeId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as Product | null;
}

export async function createProduct(params: {
  store_id: string;
  category_id: string | null;
  name: string;
  description: string;
  sku: string;
  price: number;
  compare_at_price: number | null;
  stock: number;
  sizes: string[];
  colours: string[];
  main_image_url: string | null;
  is_active: boolean;
}): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      store_id: params.store_id,
      category_id: params.category_id,
      name: params.name,
      description: params.description,
      sku: params.sku,
      price: params.price,
      compare_at_price: params.compare_at_price,
      stock: params.stock,
      sizes: params.sizes,
      colours: params.colours,
      main_image_url: params.main_image_url,
      is_active: params.is_active,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Product;
}

export async function updateProduct(
  productId: string,
  updates: Record<string, unknown>
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .select()
    .single();

  if (error) throw error;
  return data as Product;
}

export async function deleteProduct(productId: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId);

  if (error) throw error;
}

export async function addProductImage(
  productId: string,
  imageUrl: string,
  position: number
): Promise<void> {
  const { error } = await supabase
    .from('product_images')
    .insert({
      product_id: productId,
      image_url: imageUrl,
      position,
    });

  if (error) throw error;
}

export async function deleteProductImages(productId: string): Promise<void> {
  const { error } = await supabase
    .from('product_images')
    .delete()
    .eq('product_id', productId);

  if (error) throw error;
}

// ===== Image upload to Supabase Storage =====

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Image must be a JPEG, PNG, WebP, or GIF file.';
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return 'Image must be 5 MB or smaller.';
  }
  return null;
}

export async function uploadProductImage(
  file: File,
  sellerId: string
): Promise<string> {
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);

  const fileExt = file.name.split('.').pop();
  const fileName = `${sellerId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('product-images')
    .getPublicUrl(fileName);

  return data.publicUrl;
}

// ===== Aggregated helpers =====

export async function fetchAllColours(): Promise<string[]> {
  const { data, error } = await supabase
    .from('products')
    .select('colours')
    .eq('is_active', true);

  if (error) throw error;

  const colours = new Set<string>();
  (data as { colours: string[] }[]).forEach((row) => {
    row.colours?.forEach((c) => colours.add(c));
  });
  return Array.from(colours).sort();
}

export async function fetchAllSizes(): Promise<string[]> {
  const { data, error } = await supabase
    .from('products')
    .select('sizes')
    .eq('is_active', true);

  if (error) throw error;

  const sizes = new Set<string>();
  (data as { sizes: string[] }[]).forEach((row) => {
    row.sizes?.forEach((s) => sizes.add(s));
  });
  return Array.from(sizes).sort();
}
