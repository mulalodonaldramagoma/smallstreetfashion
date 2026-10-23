import { supabase } from '@/lib/supabase';
import type { AdminAuditLog, AdminStoreWithSeller, Order, OrderItem, Product, Profile, Store, Category, PaymentTransaction } from '@/types';

// --- Admin Overview Stats ---

export interface AdminStats {
  totalOrders: number;
  paidOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalCustomers: number;
  totalSellers: number;
  totalStores: number;
  activeStores: number;
  unverifiedStores: number;
  demoStores: number;
  deliveriesDispatched: number;
  deliveriesDelivered: number;
  deliveriesPending: number;
  shipmentsCreated: number;
  verifiedPayments: number;
  verifiedRevenue: number;
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const [
    ordersRes,
    productsRes,
    profilesRes,
    storesRes,
    deliveriesRes,
    shipmentsRes,
    paymentsRes,
  ] = await Promise.all([
    supabase.from('orders').select('status'),
    supabase.from('products').select('stock, is_active, is_demo'),
    supabase.from('profiles').select('role'),
    supabase.from('stores').select('is_active, is_verified, is_demo'),
    supabase.from('deliveries').select('status'),
    supabase.from('shipments').select('status').is('cancelled_at', null),
    supabase.from('payment_transactions').select('amount, status, verified_at'),
  ]);

  const responses = [ordersRes, productsRes, profilesRes, storesRes, deliveriesRes, shipmentsRes, paymentsRes];
  const failedResponse = responses.find((response) => response.error);
  if (failedResponse?.error) throw failedResponse.error;

  const orders = ordersRes.data || [];
  const products = productsRes.data || [];
  const profiles = profilesRes.data || [];
  const stores = storesRes.data || [];
  const deliveries = deliveriesRes.data || [];
  const shipments = shipmentsRes.data || [];
  const verifiedPayments = (paymentsRes.data || []).filter(
    (payment: { status: string; verified_at: string | null }) => payment.status === 'success' && payment.verified_at !== null
  );

  return {
    totalOrders: orders.length,
    paidOrders: orders.filter((o: { status: string }) => o.status === 'paid').length,
    pendingOrders: orders.filter((o: { status: string }) => o.status === 'pending').length,
    cancelledOrders: orders.filter((o: { status: string }) => o.status === 'cancelled').length,
    totalProducts: products.length,
    activeProducts: products.filter((p: { is_active: boolean }) => p.is_active).length,
    lowStockProducts: products.filter((p: { stock: number; is_active: boolean }) => p.stock > 0 && p.stock <= 5 && p.is_active).length,
    outOfStockProducts: products.filter((p: { stock: number; is_active: boolean }) => p.stock === 0 && p.is_active).length,
    totalCustomers: profiles.filter((p: { role: string }) => p.role === 'customer').length,
    totalSellers: profiles.filter((p: { role: string }) => p.role === 'seller' || p.role === 'admin').length,
    totalStores: stores.length,
    activeStores: stores.filter((s: { is_active: boolean }) => s.is_active).length,
    unverifiedStores: stores.filter((s: { is_verified: boolean }) => !s.is_verified).length,
    demoStores: stores.filter((s: { is_demo: boolean }) => s.is_demo).length,
    deliveriesDispatched: deliveries.filter((d: { status: string }) => d.status === 'dispatched' || d.status === 'in_transit').length,
    deliveriesDelivered: deliveries.filter((d: { status: string }) => d.status === 'delivered').length,
    deliveriesPending: deliveries.filter((d: { status: string }) => d.status === 'awaiting_fulfilment' || d.status === 'processing' || d.status === 'packed').length,
    shipmentsCreated: shipments.length,
    verifiedPayments: verifiedPayments.length,
    verifiedRevenue: verifiedPayments.reduce(
      (total: number, payment: { amount: number }) => total + Number(payment.amount),
      0
    ),
  };
}

// --- Store/Seller Management ---

export async function fetchAdminStores(): Promise<AdminStoreWithSeller[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('*, seller_profile:profiles!stores_seller_id_fkey(id, full_name)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as AdminStoreWithSeller[];
}

export async function updateStoreStatus(
  storeId: string,
  updates: { is_active?: boolean; is_verified?: boolean },
  adminId: string,
  action: string,
  reason?: string
): Promise<void> {
  const { error } = await supabase
    .from('stores')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', storeId);

  if (error) throw error;

  // Fetch store name + seller_id for audit + notification
  const { data: store } = await supabase
    .from('stores')
    .select('name, seller_id')
    .eq('id', storeId)
    .maybeSingle();

  await logAdminAction({
    actor_id: adminId,
    action,
    target_type: 'store',
    target_id: storeId,
    target_name: store?.name || null,
    reason: reason || null,
  });

  // Create in-app notification for the seller
  if (store?.seller_id) {
    let title = '';
    let body = '';
    if (action === 'store_approved') {
      title = 'Store Approved';
      body = `Your store "${store.name}" has been approved and is now live.`;
    } else if (action === 'store_suspended') {
      title = 'Store Suspended';
      body = `Your store "${store.name}" has been suspended${reason ? `: ${reason}` : ''}.`;
    } else if (action === 'store_reactivated') {
      title = 'Store Reactivated';
      body = `Your store "${store.name}" has been reactivated and is now live.`;
    } else {
      title = 'Store Status Updated';
      body = `Your store "${store.name}" status has been updated.`;
    }

    await supabase.rpc('create_notification', {
      p_user_id: store.seller_id,
      p_category: 'store',
      p_type: action,
      p_title: title,
      p_body: body,
      p_entity_type: 'store',
      p_entity_id: storeId,
      p_action_url: '/seller/store',
    }).then(({ error: notifError }) => {
      if (notifError) console.warn('Failed to create store notification:', notifError.message);
    });
  }
}

// --- Product Moderation ---

export async function fetchAdminProducts(params: {
  search?: string;
  storeId?: string | null;
  categoryId?: string | null;
  isActive?: boolean | null;
  stockFilter?: 'all' | 'low' | 'out' | 'in';
  page?: number;
  perPage?: number;
}): Promise<{ products: Product[]; total: number }> {
  const page = params.page || 1;
  const perPage = params.perPage || 20;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from('products')
    .select('*, store:stores!inner(id, name, slug, location), category:categories(id, name, slug)', { count: 'exact' });

  if (params.search) {
    query = query.or(`name.ilike.%${params.search}%,description.ilike.%${params.search}%`);
  }
  if (params.storeId) {
    query = query.eq('store_id', params.storeId);
  }
  if (params.categoryId) {
    query = query.eq('category_id', params.categoryId);
  }
  if (params.isActive !== null && params.isActive !== undefined) {
    query = query.eq('is_active', params.isActive);
  }

  query = query.order('created_at', { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  let products = data as unknown as Product[];

  if (params.stockFilter && params.stockFilter !== 'all') {
    products = products.filter((p) => {
      if (params.stockFilter === 'out') return p.stock === 0;
      if (params.stockFilter === 'low') return p.stock > 0 && p.stock <= 5;
      if (params.stockFilter === 'in') return p.stock > 5;
      return true;
    });
  }

  return { products, total: count || 0 };
}

export async function adminToggleProductActive(
  productId: string,
  isActive: boolean,
  adminId: string,
  reason?: string
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', productId);

  if (error) throw error;

  const { data: product } = await supabase
    .from('products')
    .select('name, store:stores!inner(seller_id, name)')
    .eq('id', productId)
    .maybeSingle();

  await logAdminAction({
    actor_id: adminId,
    action: isActive ? 'product_restore' : 'product_hide',
    target_type: 'product',
    target_id: productId,
    target_name: product?.name || null,
    reason: reason || null,
  });

  // Create in-app notification for the seller
  const sellerId = (product as any)?.store?.seller_id;
  const storeName = (product as any)?.store?.name;
  if (sellerId) {
    const title = isActive ? 'Product Restored' : 'Product Hidden';
    const body = `Your product "${product?.name || 'Unknown'}" in "${storeName || 'your store'}" has been ${isActive ? 'restored' : 'hidden'}${reason ? `: ${reason}` : ''}.`;

    await supabase.rpc('create_notification', {
      p_user_id: sellerId,
      p_category: 'product',
      p_type: isActive ? 'product_restore' : 'product_hide',
      p_title: title,
      p_body: body,
      p_entity_type: 'product',
      p_entity_id: productId,
      p_action_url: '/seller/products',
    }).then(({ error: notifError }) => {
      if (notifError) console.warn('Failed to create product notification:', notifError.message);
    });
  }
}

// --- Orders ---

export async function fetchAdminOrders(params: {
  search?: string;
  status?: string | null;
  page?: number;
  perPage?: number;
}): Promise<{ orders: (Order & { order_items?: OrderItem[]; payment_transactions?: PaymentTransaction[] })[]; total: number }> {
  const page = params.page || 1;
  const perPage = params.perPage || 15;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from('orders')
    .select('*, order_items(*), payment_transactions(*)', { count: 'exact' });

  if (params.search) {
    query = query.or(`order_number.ilike.%${params.search}%,customer_name.ilike.%${params.search}%,customer_email.ilike.%${params.search}%`);
  }
  if (params.status) {
    query = query.eq('status', params.status);
  }

  query = query.order('created_at', { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    orders: data as unknown as (Order & { order_items?: OrderItem[]; payment_transactions?: PaymentTransaction[] })[],
    total: count || 0,
  };
}

export async function fetchAdminOrderItems(orderId: string): Promise<OrderItem[]> {
  const { data, error } = await supabase
    .from('order_items')
    .select('*, product:products(name), store:stores(name)')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as unknown as OrderItem[];
}

// --- Profiles ---

export async function fetchAdminProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Profile[];
}

// --- Categories ---

export async function createCategory(params: {
  name: string;
  slug: string;
  description?: string;
  image_url?: string | null;
}): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      name: params.name,
      slug: params.slug,
      description: params.description || null,
      image_url: params.image_url || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Category;
}

export async function updateCategory(
  id: string,
  updates: Partial<Pick<Category, 'name' | 'slug' | 'description' | 'image_url'>>
): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Category;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// --- Audit Log ---

export async function logAdminAction(params: {
  actor_id: string;
  action: string;
  target_type: string;
  target_id?: string | null;
  target_name?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  await supabase.from('admin_audit_log').insert({
    actor_id: params.actor_id,
    action: params.action,
    target_type: params.target_type,
    target_id: params.target_id || null,
    target_name: params.target_name || null,
    reason: params.reason || null,
    metadata: params.metadata || null,
  });
}

export async function fetchAuditLog(page: number = 1, perPage: number = 20): Promise<{ logs: AdminAuditLog[]; total: number }> {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data, error, count } = await supabase
    .from('admin_audit_log')
    .select('*, actor_profile:profiles!admin_audit_log_actor_id_fkey(id, full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    logs: data as unknown as AdminAuditLog[],
    total: count || 0,
  };
}
