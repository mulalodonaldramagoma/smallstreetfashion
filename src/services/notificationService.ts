import { supabase } from '@/lib/supabase';
import type { NotificationEvent } from '@/types';

export async function fetchOrderNotifications(
  orderId: string
): Promise<NotificationEvent[]> {
  const { data, error } = await supabase
    .from('notification_events')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as NotificationEvent[];
}

export async function fetchCustomerNotifications(
  userId: string
): Promise<(NotificationEvent & { order_number?: string })[]> {
  const { data: orderIds, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number')
    .eq('user_id', userId);

  if (orderError) throw orderError;
  if (!orderIds || orderIds.length === 0) return [];

  const orderMap = new Map(orderIds.map((o) => [o.id, o.order_number]));

  const { data, error } = await supabase
    .from('notification_events')
    .select('*')
    .in('order_id', orderIds.map((o) => o.id))
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data as NotificationEvent[]).map((n) => ({
    ...n,
    order_number: n.order_id ? orderMap.get(n.order_id) : undefined,
  }));
}
