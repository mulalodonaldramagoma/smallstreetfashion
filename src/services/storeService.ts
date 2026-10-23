import { supabase } from '@/lib/supabase';
import type { Store, Product, OpeningHours } from '@/types';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export async function fetchActiveStores(): Promise<Store[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Store[];
}

export async function fetchStoreBySlug(slug: string): Promise<Store | null> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  return data as Store | null;
}

export async function fetchStoreById(id: string): Promise<Store | null> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as Store | null;
}

export async function fetchStoreBySeller(
  sellerId: string
): Promise<Store | null> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) throw error;
  return (data && data[0]) ? (data[0] as Store) : null;
}

export async function createStore(params: {
  sellerId: string;
  name: string;
  description: string;
  location: string;
  phone: string;
  whatsapp: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  address_line?: string | null;
  building_name?: string | null;
  shop_number?: string | null;
  area?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  google_maps_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  instagram_url?: string | null;
  tiktok_url?: string | null;
  facebook_url?: string | null;
  website_url?: string | null;
  opening_hours?: OpeningHours | null;
}): Promise<Store> {
  const slug = slugify(params.name);
  const { data, error } = await supabase
    .from('stores')
    .insert({
      seller_id: params.sellerId,
      name: params.name,
      slug,
      description: params.description,
      location: params.location,
      phone: params.phone,
      whatsapp: params.whatsapp,
      logo_url: params.logoUrl,
      banner_url: params.bannerUrl,
      address_line: params.address_line ?? null,
      building_name: params.building_name ?? null,
      shop_number: params.shop_number ?? null,
      area: params.area ?? null,
      city: params.city ?? null,
      province: params.province ?? null,
      postal_code: params.postal_code ?? null,
      google_maps_url: params.google_maps_url ?? null,
      latitude: params.latitude ?? null,
      longitude: params.longitude ?? null,
      instagram_url: params.instagram_url ?? null,
      tiktok_url: params.tiktok_url ?? null,
      facebook_url: params.facebook_url ?? null,
      website_url: params.website_url ?? null,
      opening_hours: (params.opening_hours as never) ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Store;
}

export async function updateStore(
  storeId: string,
  updates: Partial<Pick<Store,
    | 'name' | 'description' | 'location' | 'phone' | 'whatsapp'
    | 'logo_url' | 'banner_url'
    | 'address_line' | 'building_name' | 'shop_number' | 'area' | 'city'
    | 'province' | 'postal_code' | 'google_maps_url' | 'latitude' | 'longitude'
    | 'instagram_url' | 'tiktok_url' | 'facebook_url' | 'website_url'
    | 'opening_hours'
  >>
): Promise<Store> {
  const insertData: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  if (updates.name) {
    insertData.slug = slugify(updates.name);
  }

  const { data, error } = await supabase
    .from('stores')
    .update(insertData)
    .eq('id', storeId)
    .select()
    .single();

  if (error) throw error;
  return data as Store;
}

export async function fetchStoreProductCount(storeId: string): Promise<number> {
  const { count, error } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .eq('is_active', true);

  if (error) throw error;
  return count ?? 0;
}

export async function fetchProductsByStore(
  storeId: string
): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      *,
      store:stores(id, name, slug, location),
      category:categories(id, name, slug),
      product_images(id, image_url, position)
    `
    )
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as Product[];
}
