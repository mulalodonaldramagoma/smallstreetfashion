import { supabase } from '@/lib/supabase';
import type {
  CourierProvider,
  Shipment,
  ShipmentTrackingEvent,
  ShipmentStatus,
} from '@/types';

// --- Courier Providers ---

export async function fetchActiveCourierProviders(): Promise<CourierProvider[]> {
  const { data, error } = await supabase
    .from('courier_providers')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return data as CourierProvider[];
}

export async function fetchAllCourierProviders(): Promise<CourierProvider[]> {
  const { data, error } = await supabase
    .from('courier_providers')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data as CourierProvider[];
}

export async function createCourierProvider(params: {
  code: string;
  name: string;
  is_active: boolean;
  is_demo: boolean;
  tracking_url_template?: string | null;
}): Promise<CourierProvider> {
  const { data, error } = await supabase
    .from('courier_providers')
    .insert({
      code: params.code,
      name: params.name,
      is_active: params.is_active,
      is_demo: params.is_demo,
      tracking_url_template: params.tracking_url_template || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CourierProvider;
}

export async function updateCourierProvider(
  id: string,
  updates: Partial<{
    name: string;
    is_active: boolean;
    is_demo: boolean;
    tracking_url_template: string | null;
  }>
): Promise<CourierProvider> {
  const { data, error } = await supabase
    .from('courier_providers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as CourierProvider;
}

export async function deleteCourierProvider(id: string): Promise<void> {
  const { error } = await supabase
    .from('courier_providers')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// --- Shipments ---

export async function fetchShipmentByDeliveryId(
  deliveryId: string
): Promise<Shipment | null> {
  const { data, error } = await supabase
    .from('shipments')
    .select('*, courier_provider:courier_providers(id, code, name, is_demo, tracking_url_template)')
    .eq('delivery_id', deliveryId)
    .is('cancelled_at', null)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as Shipment | null;
}

export async function fetchShipmentsForDeliveries(
  deliveryIds: string[]
): Promise<Shipment[]> {
  if (deliveryIds.length === 0) return [];
  const { data, error } = await supabase
    .from('shipments')
    .select('*, courier_provider:courier_providers(id, code, name, is_demo, tracking_url_template)')
    .in('delivery_id', deliveryIds)
    .is('cancelled_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as Shipment[];
}

export async function cancelShipment(
  shipmentId: string,
  cancelledBy: string
): Promise<void> {
  const { error } = await supabase
    .from('shipments')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: cancelledBy,
    })
    .eq('id', shipmentId);

  if (error) throw error;
}

export async function updateShipmentStatus(
  shipmentId: string,
  status: ShipmentStatus,
  trackingNumber?: string | null
): Promise<Shipment> {
  const updates: Record<string, unknown> = { status };
  if (trackingNumber !== undefined) {
    updates.tracking_number = trackingNumber;
  }

  const { data, error } = await supabase
    .from('shipments')
    .update(updates)
    .eq('id', shipmentId)
    .select('*, courier_provider:courier_providers(id, code, name, is_demo, tracking_url_template)')
    .single();

  if (error) throw error;
  return data as unknown as Shipment;
}

// --- Tracking Events ---

export async function fetchTrackingEvents(
  shipmentId: string
): Promise<ShipmentTrackingEvent[]> {
  const { data, error } = await supabase
    .from('shipment_tracking_events')
    .select('*')
    .eq('shipment_id', shipmentId)
    .order('event_timestamp', { ascending: true });

  if (error) throw error;
  return data as ShipmentTrackingEvent[];
}

// --- Shipment Status Labels ---

export function shipmentStatusLabel(status: ShipmentStatus): string {
  const labels: Record<ShipmentStatus, string> = {
    created: 'Shipment Created',
    pending_pickup: 'Pending Pickup',
    picked_up: 'Picked Up',
    in_transit: 'In Transit',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    failed: 'Delivery Failed',
    cancelled: 'Cancelled',
  };
  return labels[status] || status;
}

export function shipmentStatusColor(status: ShipmentStatus): string {
  switch (status) {
    case 'delivered':
      return 'bg-green-100 text-green-700';
    case 'in_transit':
    case 'out_for_delivery':
      return 'bg-blue-100 text-blue-700';
    case 'picked_up':
      return 'bg-teal-100 text-teal-700';
    case 'pending_pickup':
    case 'created':
      return 'bg-amber-100 text-amber-700';
    case 'failed':
      return 'bg-rose-100 text-rose-700';
    case 'cancelled':
      return 'bg-neutral-200 text-neutral-600';
    default:
      return 'bg-neutral-100 text-neutral-600';
  }
}
