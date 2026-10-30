import { supabase } from '@/lib/supabase';
import type {
  DeliveryMethod,
  DeliveryZone,
  Delivery,
  DeliveryStatus,
  DeliveryStatusHistory,
} from '@/types';

// --- Delivery Methods ---

export async function fetchActiveDeliveryMethods(): Promise<DeliveryMethod[]> {
  const { data, error } = await supabase
    .from('delivery_methods')
    .select('*, delivery_zone:delivery_zones(*)')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data as unknown as DeliveryMethod[]) ?? [];
}

export async function fetchAllDeliveryMethods(): Promise<DeliveryMethod[]> {
  const { data, error } = await supabase
    .from('delivery_methods')
    .select('*, delivery_zone:delivery_zones(*)')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data as unknown as DeliveryMethod[];
}

export async function fetchDeliveryMethodById(
  id: string
): Promise<DeliveryMethod | null> {
  const { data, error } = await supabase
    .from('delivery_methods')
    .select('*, delivery_zone:delivery_zones(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as DeliveryMethod | null;
}

export async function createDeliveryMethod(params: {
  name: string;
  description?: string;
  fee: number;
  estimated_days?: string;
  is_active: boolean;
  sort_order: number;
  type: 'delivery' | 'pickup';
  zone_id?: string | null;
}): Promise<DeliveryMethod> {
  const { data, error } = await supabase
    .from('delivery_methods')
    .insert({
      name: params.name,
      description: params.description || null,
      fee: params.fee,
      estimated_days: params.estimated_days || null,
      is_active: params.is_active,
      sort_order: params.sort_order,
      type: params.type,
      zone_id: params.zone_id || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as DeliveryMethod;
}

export async function updateDeliveryMethod(
  id: string,
  updates: Partial<{
    name: string;
    description: string | null;
    fee: number;
    estimated_days: string | null;
    is_active: boolean;
    sort_order: number;
    type: 'delivery' | 'pickup';
    zone_id: string | null;
  }>
): Promise<DeliveryMethod> {
  const { data, error } = await supabase
    .from('delivery_methods')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as DeliveryMethod;
}

export async function deleteDeliveryMethod(id: string): Promise<void> {
  const { error } = await supabase
    .from('delivery_methods')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// --- Delivery Zones ---

export async function fetchActiveDeliveryZones(): Promise<DeliveryZone[]> {
  const { data, error } = await supabase
    .from('delivery_zones')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data as DeliveryZone[];
}

export async function fetchAllDeliveryZones(): Promise<DeliveryZone[]> {
  const { data, error } = await supabase
    .from('delivery_zones')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data as DeliveryZone[];
}

export async function createDeliveryZone(params: {
  name: string;
  description?: string;
  base_fee: number;
  is_active: boolean;
  sort_order: number;
}): Promise<DeliveryZone> {
  const { data, error } = await supabase
    .from('delivery_zones')
    .insert({
      name: params.name,
      description: params.description || null,
      base_fee: params.base_fee,
      is_active: params.is_active,
      sort_order: params.sort_order,
    })
    .select()
    .single();

  if (error) throw error;
  return data as DeliveryZone;
}

export async function updateDeliveryZone(
  id: string,
  updates: Partial<{
    name: string;
    description: string | null;
    base_fee: number;
    is_active: boolean;
    sort_order: number;
  }>
): Promise<DeliveryZone> {
  const { data, error } = await supabase
    .from('delivery_zones')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as DeliveryZone;
}

export async function deleteDeliveryZone(id: string): Promise<void> {
  const { error } = await supabase
    .from('delivery_zones')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// --- Deliveries ---

export async function fetchDeliveryByOrderId(
  orderId: string
): Promise<Delivery | null> {
  const { data, error } = await supabase
    .from('deliveries')
    .select(
      `*,
      delivery_method:delivery_methods(id, name, estimated_days, type),
      delivery_zone:delivery_zones(id, name)`
    )
    .eq('order_id', orderId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as Delivery | null;
}

export async function fetchCustomerDeliveries(
  userId: string
): Promise<Delivery[]> {
  const { data: orderIds, error: orderError } = await supabase
    .from('orders')
    .select('id')
    .eq('user_id', userId);

  if (orderError) throw orderError;
  if (!orderIds || orderIds.length === 0) return [];

  const { data, error } = await supabase
    .from('deliveries')
    .select(
      `*,
      delivery_method:delivery_methods(id, name, estimated_days, type),
      delivery_zone:delivery_zones(id, name),
      order:orders(id, order_number, status, total)`
    )
    .in('order_id', orderIds.map((o) => o.id))
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as Delivery[];
}

export async function fetchSellerDeliveries(
  sellerId: string
): Promise<Delivery[]> {
  const { data: stores, error: storeError } = await supabase
    .from('stores')
    .select('id')
    .eq('seller_id', sellerId);

  if (storeError) throw storeError;
  if (!stores || stores.length === 0) return [];

  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('order_id')
    .in('store_id', stores.map((s) => s.id));

  if (itemsError) throw itemsError;
  if (!orderItems || orderItems.length === 0) return [];

  const orderIds = [...new Set(orderItems.map((oi) => oi.order_id))];

  const { data, error } = await supabase
    .from('deliveries')
    .select(
      `*,
      delivery_method:delivery_methods(id, name, estimated_days, type),
      delivery_zone:delivery_zones(id, name),
      order:orders(id, order_number, status, total, customer_name, customer_email, customer_phone, delivery_address, suburb, city, province, postal_code, delivery_instructions)`
    )
    .in('order_id', orderIds)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as Delivery[];
}

export async function fetchDeliveryStatusHistory(
  deliveryId: string
): Promise<DeliveryStatusHistory[]> {
  const { data, error } = await supabase
    .from('delivery_status_history')
    .select('*')
    .eq('delivery_id', deliveryId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as DeliveryStatusHistory[];
}

export async function updateDeliveryStatus(
  deliveryId: string,
  status: DeliveryStatus,
  trackingNote?: string,
  changedBy?: string
): Promise<Delivery> {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (trackingNote !== undefined) {
    updates.tracking_note = trackingNote;
  }

  if (status === 'dispatched') {
    updates.dispatched_at = new Date().toISOString();
  }
  if (status === 'delivered') {
    updates.delivered_at = new Date().toISOString();
  }
  if (status === 'cancelled') {
    updates.cancelled_at = new Date().toISOString();
  }
  if (status === 'delivery_failed') {
    updates.failed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('deliveries')
    .update(updates)
    .eq('id', deliveryId)
    .select(
      `*,
      delivery_method:delivery_methods(id, name, estimated_days, type),
      delivery_zone:delivery_zones(id, name)`
    )
    .single();

  if (error) throw error;

  // Insert status history record
  await supabase.from('delivery_status_history').insert({
    delivery_id: deliveryId,
    status,
    note: trackingNote || null,
    changed_by: changedBy || null,
  });

  // Trigger notification for delivery status change
  const deliveryNotificationMap: Record<DeliveryStatus, string | null> = {
    awaiting_fulfilment: null,
    processing: 'order_processing',
    packed: null,
    ready_for_collection: null,
    dispatched: 'order_dispatched',
    in_transit: 'delivery_in_transit',
    delivered: 'delivery_delivered',
    delivery_failed: 'delivery_failed',
    cancelled: 'order_cancelled',
  };

  const eventType = deliveryNotificationMap[status];
  if (eventType) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({
            eventType,
            deliveryId,
          }),
        }
      );
    } catch {
      // Notification failure should not block delivery status update
    }
  }

  return data as unknown as Delivery;
}
