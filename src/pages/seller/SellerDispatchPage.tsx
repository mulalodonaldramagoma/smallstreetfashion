import { useState, useEffect } from 'react';
import {
  Truck,
  Package,
  CheckCircle2,
  Clock,
  MapPin,
  Loader2,
  ChevronRight,
  XCircle,
  AlertTriangle,
  Store as StoreIcon,
  Plus,
  ExternalLink,
  Hash,
} from 'lucide-react';
import { SellerLayout } from '@/components/SellerLayout';
import { useAuth } from '@/context/AuthContext';
import { fetchSellerDeliveries, updateDeliveryStatus } from '@/services/deliveryService';
import { fetchActiveCourierProviders, fetchShipmentsForDeliveries, cancelShipment } from '@/services/courierService';
import { ErrorState } from '@/components/ui/States';
import { formatPrice } from '@/utils/format';
import { supabase } from '@/lib/supabase';
import { navigateTo } from '@/hooks/useRouter';
import type { Delivery, DeliveryStatus, OrderItem, CourierProvider, Shipment } from '@/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const STATUS_FLOW: { status: DeliveryStatus; label: string; icon: typeof Clock }[] = [
  { status: 'awaiting_fulfilment', label: 'Awaiting Fulfilment', icon: Clock },
  { status: 'processing', label: 'Processing', icon: Package },
  { status: 'packed', label: 'Packed', icon: Package },
  { status: 'ready_for_collection', label: 'Ready for Collection', icon: StoreIcon },
  { status: 'dispatched', label: 'Dispatched', icon: Truck },
  { status: 'in_transit', label: 'In Transit', icon: Truck },
  { status: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

const TERMINAL_STATUSES: DeliveryStatus[] = ['delivered', 'delivery_failed', 'cancelled'];

function nextStatus(current: DeliveryStatus): DeliveryStatus | null {
  const idx = STATUS_FLOW.findIndex((s) => s.status === current);
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1].status;
}

function statusLabel(status: DeliveryStatus): string {
  const found = STATUS_FLOW.find((s) => s.status === status);
  if (found) return found.label;
  if (status === 'delivery_failed') return 'Delivery Failed';
  if (status === 'cancelled') return 'Cancelled';
  return status;
}

function statusColor(status: DeliveryStatus): string {
  switch (status) {
    case 'delivered':
      return 'bg-green-100 text-green-700';
    case 'dispatched':
    case 'in_transit':
      return 'bg-blue-100 text-blue-700';
    case 'ready_for_collection':
      return 'bg-teal-100 text-teal-700';
    case 'packed':
    case 'processing':
      return 'bg-amber-100 text-amber-700';
    case 'delivery_failed':
      return 'bg-rose-100 text-rose-700';
    case 'cancelled':
      return 'bg-neutral-200 text-neutral-600';
    default:
      return 'bg-neutral-100 text-neutral-600';
  }
}

export function SellerDispatchPage() {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [orderItemsMap, setOrderItemsMap] = useState<Record<string, OrderItem[]>>({});
  const [shipmentsMap, setShipmentsMap] = useState<Record<string, Shipment>>({});
  const [courierProviders, setCourierProviders] = useState<CourierProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [noteModal, setNoteModal] = useState<{ deliveryId: string; status: DeliveryStatus } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [shipmentModal, setShipmentModal] = useState<{ deliveryId: string } | null>(null);
  const [creatingShipment, setCreatingShipment] = useState(false);
  const [shipmentError, setShipmentError] = useState<string | null>(null);

  const loadDeliveries = () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    Promise.all([fetchSellerDeliveries(user.id), fetchActiveCourierProviders()])
      .then(([data, providers]) => {
        setDeliveries(data);
        setCourierProviders(providers);
        const orderIds = data.map((d) => d.order_id);
        const deliveryIds = data.map((d) => d.id);

        if (orderIds.length > 0) {
          supabase
            .from('order_items')
            .select('*')
            .in('order_id', orderIds)
            .then(({ data: items }) => {
              if (items) {
                const map: Record<string, OrderItem[]> = {};
                for (const item of items) {
                  if (!map[item.order_id]) map[item.order_id] = [];
                  map[item.order_id].push(item as OrderItem);
                }
                setOrderItemsMap(map);
              }
            });
        }

        if (deliveryIds.length > 0) {
          fetchShipmentsForDeliveries(deliveryIds).then((shipments) => {
            const smap: Record<string, Shipment> = {};
            for (const s of shipments) {
              smap[s.delivery_id] = s;
            }
            setShipmentsMap(smap);
          });
        }

        setLoading(false);
      })
      .catch((err) => {
        setDeliveries([]);
        setError('Failed to load deliveries. Please try again.');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadDeliveries();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdvance = async (deliveryId: string, newStatus: DeliveryStatus) => {
    setUpdatingId(deliveryId);
    try {
      await updateDeliveryStatus(deliveryId, newStatus, noteText || undefined, user?.id);
      setNoteModal(null);
      setNoteText('');
      loadDeliveries();
    } catch (err) {
      setError('Failed to update delivery status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleFail = async (deliveryId: string) => {
    setUpdatingId(deliveryId);
    try {
      await updateDeliveryStatus(deliveryId, 'delivery_failed', undefined, user?.id);
      loadDeliveries();
    } catch (err) {
      setError('Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCancel = async (deliveryId: string) => {
    setUpdatingId(deliveryId);
    try {
      await updateDeliveryStatus(deliveryId, 'cancelled', undefined, user?.id);
      loadDeliveries();
    } catch (err) {
      setError('Failed to cancel delivery');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCreateShipment = async (deliveryId: string, providerId: string) => {
    setCreatingShipment(true);
    setShipmentError(null);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/courier-create-shipment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          deliveryId,
          courierProviderId: providerId,
          createdBy: user?.id || null,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${response.status})`);
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setShipmentModal(null);
      loadDeliveries();
    } catch (err) {
      setShipmentError('Failed to create shipment');
    } finally {
      setCreatingShipment(false);
    }
  };

  const handleCancelShipment = async (shipmentId: string) => {
    if (!user) return;
    setUpdatingId(shipmentId);
    try {
      await cancelShipment(shipmentId, user.id);
      loadDeliveries();
    } catch (err) {
      setError('Failed to cancel shipment');
    } finally {
      setUpdatingId(null);
    }
  };

  const pendingCount = deliveries.filter(
    (d) => d.status === 'awaiting_fulfilment' || d.status === 'processing'
  ).length;
  const packedCount = deliveries.filter((d) => d.status === 'packed' || d.status === 'ready_for_collection').length;
  const dispatchedCount = deliveries.filter((d) => d.status === 'dispatched' || d.status === 'in_transit').length;
  const deliveredCount = deliveries.filter((d) => d.status === 'delivered').length;

  return (
    <SellerLayout activePage="dispatch">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Dispatch Management</h1>
        <p className="text-sm text-neutral-500">
          Prepare and track deliveries for your store's orders
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Needs Prep" value={pendingCount} color="bg-amber-50 text-amber-600" icon={<Clock size={18} />} />
        <StatCard label="Packed" value={packedCount} color="bg-teal-50 text-teal-600" icon={<Package size={18} />} />
        <StatCard label="Dispatched" value={dispatchedCount} color="bg-blue-50 text-blue-600" icon={<Truck size={18} />} />
        <StatCard label="Delivered" value={deliveredCount} color="bg-green-50 text-green-600" icon={<CheckCircle2 size={18} />} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-neutral-400" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadDeliveries} />
      ) : deliveries.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
          <div className="w-14 h-14 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package size={26} className="text-neutral-300" />
          </div>
          <h2 className="text-lg font-semibold text-neutral-900 mb-1">No deliveries to manage</h2>
          <p className="text-sm text-neutral-500">
            Deliveries for your store's orders will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {deliveries.map((delivery) => {
            const next = nextStatus(delivery.status);
            const order = delivery.order;
            const items = orderItemsMap[delivery.order_id] || [];
            const isTerminal = TERMINAL_STATUSES.includes(delivery.status);
            const isPickup = delivery.delivery_method?.type === 'pickup';
            const shipment = shipmentsMap[delivery.id];
            const canCreateShipment = !shipment && !isPickup && order?.status === 'paid' && !isTerminal;
            return (
              <div key={delivery.id} className="bg-white border border-neutral-200 rounded-xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-neutral-900">
                        {order?.order_number || 'Order'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(delivery.status)}`}>
                        {statusLabel(delivery.status)}
                      </span>
                      {isPickup && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600 flex items-center gap-1">
                          <StoreIcon size={10} />
                          Pickup
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500">
                      {new Date(delivery.created_at).toLocaleDateString('en-ZA', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {order && (
                      <span className="text-sm font-semibold text-neutral-900">
                        {formatPrice(Number(order.total))}
                      </span>
                    )}
                    {order && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        order.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {order.status === 'paid' ? 'Paid' : 'Pending Payment'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Order items */}
                {items.length > 0 && (
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 mb-4">
                    <p className="text-xs font-medium text-neutral-500 mb-2">Order Items</p>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 text-xs">
                          {item.product_image && (
                            <div className="w-10 h-10 rounded-md overflow-hidden bg-neutral-200 shrink-0">
                              <img src={item.product_image} alt={item.product_name} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-neutral-900 line-clamp-1">{item.product_name}</p>
                            <p className="text-neutral-500">
                              {item.size} · {item.colour} · Qty {item.quantity}
                            </p>
                          </div>
                          <span className="font-medium text-neutral-700 shrink-0">
                            {formatPrice(Number(item.line_total))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Customer info */}
                {order && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-xs">
                    <div>
                      <p className="text-neutral-400 mb-0.5">Customer</p>
                      <p className="font-medium text-neutral-900">{order.customer_name}</p>
                      <p className="text-neutral-500">{order.customer_phone}</p>
                      <p className="text-neutral-500">{order.customer_email}</p>
                    </div>
                    {!isPickup && (
                      <div>
                        <p className="text-neutral-400 mb-0.5">Delivery Address</p>
                        <p className="font-medium text-neutral-900">{order.delivery_address}</p>
                        <p className="text-neutral-500">
                          {order.suburb}, {order.city}
                        </p>
                        <p className="text-neutral-500">
                          {order.province} {order.postal_code}
                        </p>
                        {order.delivery_instructions && (
                          <p className="text-neutral-400 italic mt-1">
                            "{order.delivery_instructions}"
                          </p>
                        )}
                      </div>
                    )}
                    {isPickup && (
                      <div>
                        <p className="text-neutral-400 mb-0.5">Fulfilment</p>
                        <p className="font-medium text-neutral-900 flex items-center gap-1">
                          <StoreIcon size={12} /> Store Pickup
                        </p>
                        <p className="text-neutral-500">Customer will collect from store</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Delivery method */}
                {delivery.delivery_method && (
                  <div className="flex items-center gap-2 text-xs text-neutral-500 mb-4">
                    <Truck size={14} />
                    {delivery.delivery_method.name}
                    {delivery.delivery_method.estimated_days && (
                      <span className="text-neutral-400">
                        · {delivery.delivery_method.estimated_days}
                      </span>
                    )}
                  </div>
                )}

                {/* Shipment info */}
                {shipment && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Truck size={14} className="text-blue-600" />
                        <span className="text-xs font-semibold text-blue-900">
                          {shipment.courier_provider?.name || 'Courier'}
                        </span>
                        {shipment.courier_provider?.is_demo && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                            Demo
                          </span>
                        )}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white text-blue-700 font-medium capitalize">
                        {shipment.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-blue-700 mb-2">
                      <Hash size={12} />
                      <span className="font-mono">{shipment.tracking_number}</span>
                      {shipment.tracking_url && (
                        <a
                          href={shipment.tracking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 underline"
                        >
                          Track <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                    {!isTerminal && (
                      <button
                        onClick={() => handleCancelShipment(shipment.id)}
                        disabled={updatingId === shipment.id}
                        className="text-xs text-neutral-500 hover:text-rose-600 font-medium transition-colors"
                      >
                        Cancel shipment
                      </button>
                    )}
                  </div>
                )}

                {/* Tracking note */}
                {delivery.tracking_note && (
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 mb-4">
                    <p className="text-xs text-neutral-600">
                      <span className="font-medium text-neutral-900">Note: </span>
                      {delivery.tracking_note}
                    </p>
                  </div>
                )}

                {/* Action buttons */}
                {next && order?.status === 'paid' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        setNoteModal({ deliveryId: delivery.id, status: next });
                        setNoteText('');
                      }}
                      disabled={updatingId === delivery.id}
                      className="px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {updatingId === delivery.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                      Advance to "{statusLabel(next)}"
                    </button>
                    {canCreateShipment && courierProviders.length > 0 && (
                      <button
                        onClick={() => {
                          setShipmentModal({ deliveryId: delivery.id });
                          setShipmentError(null);
                        }}
                        className="px-4 py-2.5 border border-blue-200 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2"
                      >
                        <Plus size={14} />
                        Create Shipment
                      </button>
                    )}
                    {!isTerminal && delivery.status !== 'dispatched' && delivery.status !== 'in_transit' && (
                      <button
                        onClick={() => handleFail(delivery.id)}
                        disabled={updatingId === delivery.id}
                        className="px-4 py-2.5 border border-rose-200 text-rose-600 text-sm font-medium rounded-lg hover:bg-rose-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <AlertTriangle size={14} />
                        Mark Failed
                      </button>
                    )}
                    {!isTerminal && (
                      <button
                        onClick={() => handleCancel(delivery.id)}
                        disabled={updatingId === delivery.id}
                        className="px-4 py-2.5 border border-neutral-200 text-neutral-500 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <XCircle size={14} />
                        Cancel
                      </button>
                    )}
                  </div>
                ) : order?.status !== 'paid' ? (
                  <p className="text-xs text-neutral-400">
                    Awaiting payment confirmation before dispatch can begin.
                  </p>
                ) : delivery.status === 'delivered' ? (
                  <p className="text-xs text-green-600 font-medium">Delivery completed.</p>
                ) : delivery.status === 'delivery_failed' ? (
                  <p className="text-xs text-rose-600 font-medium">Delivery failed.</p>
                ) : delivery.status === 'cancelled' ? (
                  <p className="text-xs text-neutral-500 font-medium">Delivery cancelled.</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Note modal */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNoteModal(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="font-bold text-neutral-900 mb-2">
              Advance to "{statusLabel(noteModal.status)}"
            </h3>
            <p className="text-sm text-neutral-500 mb-4">
              Add an optional tracking note that the customer will see.
            </p>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none mb-4"
              placeholder="e.g. Order packed and ready for collection by courier"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setNoteModal(null)}
                className="px-5 py-2.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAdvance(noteModal.deliveryId, noteModal.status)}
                disabled={updatingId === noteModal.deliveryId}
                className="flex-1 px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {updatingId === noteModal.deliveryId ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>Confirm</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shipment creation modal */}
      {shipmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShipmentModal(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-2 mb-4">
              <Truck size={20} className="text-neutral-900" />
              <h3 className="font-bold text-neutral-900">Create Courier Shipment</h3>
            </div>
            <p className="text-sm text-neutral-500 mb-4">
              Select a courier provider to create a shipment for this delivery. A tracking number will be generated.
            </p>
            {shipmentError && (
              <div className="mb-4 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3">
                <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-700">{shipmentError}</p>
              </div>
            )}
            <div className="space-y-2 mb-4">
              {courierProviders.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => handleCreateShipment(shipmentModal.deliveryId, provider.id)}
                  disabled={creatingShipment}
                  className="w-full flex items-center justify-between p-4 border border-neutral-200 rounded-lg hover:border-neutral-900 hover:bg-neutral-50 transition-colors text-left disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      provider.is_demo ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      <Truck size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{provider.name}</p>
                      {provider.is_demo && (
                        <p className="text-xs text-amber-600">Demo mode — generates test tracking numbers</p>
                      )}
                    </div>
                  </div>
                  {creatingShipment ? (
                    <Loader2 size={16} className="animate-spin text-neutral-400" />
                  ) : (
                    <Plus size={18} className="text-neutral-400" />
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShipmentModal(null)}
              className="w-full px-5 py-2.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </SellerLayout>
  );
}

function StatCard({ label, value, color, icon }: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-neutral-900">{value}</p>
      <p className="text-xs text-neutral-500 mt-1">{label}</p>
    </div>
  );
}
