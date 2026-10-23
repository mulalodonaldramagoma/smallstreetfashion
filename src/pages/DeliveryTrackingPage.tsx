import { useState, useEffect } from 'react';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Store as StoreIcon,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Hash,
  Bell,
  MessageCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchCustomerDeliveries, fetchDeliveryStatusHistory } from '@/services/deliveryService';
import { fetchShipmentsForDeliveries, fetchTrackingEvents } from '@/services/courierService';
import { fetchCustomerNotifications } from '@/services/notificationService';
import { formatPrice } from '@/utils/format';
import { navigateTo } from '@/hooks/useRouter';
import type { Delivery, DeliveryStatus, DeliveryStatusHistory, Shipment, ShipmentTrackingEvent, NotificationEvent } from '@/types';
import { NOTIFICATION_EVENT_LABELS } from '@/types';

const STATUS_STEPS: { status: DeliveryStatus; label: string; icon: typeof Clock }[] = [
  { status: 'awaiting_fulfilment', label: 'Order Placed', icon: Clock },
  { status: 'processing', label: 'Processing', icon: Package },
  { status: 'packed', label: 'Packed', icon: Package },
  { status: 'ready_for_collection', label: 'Ready for Collection', icon: StoreIcon },
  { status: 'dispatched', label: 'Dispatched', icon: Truck },
  { status: 'in_transit', label: 'In Transit', icon: Truck },
  { status: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

function statusIndex(status: DeliveryStatus): number {
  const idx = STATUS_STEPS.findIndex((s) => s.status === status);
  if (idx >= 0) return idx;
  return 0;
}

function statusLabel(status: DeliveryStatus): string {
  const found = STATUS_STEPS.find((s) => s.status === status);
  if (found) return found.label;
  if (status === 'delivery_failed') return 'Delivery Failed';
  if (status === 'cancelled') return 'Cancelled';
  return status;
}

function DeliveryCard({ delivery, shipment }: { delivery: Delivery; shipment?: Shipment }) {
  const [history, setHistory] = useState<DeliveryStatusHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [trackingEvents, setTrackingEvents] = useState<ShipmentTrackingEvent[]>([]);
  const [showTracking, setShowTracking] = useState(false);
  const currentStep = statusIndex(delivery.status);
  const orderInfo = delivery.order as
    | { id: string; order_number: string; status: string; total: number }
    | undefined;
  const isPickup = delivery.delivery_method?.type === 'pickup';
  const isFailed = delivery.status === 'delivery_failed';
  const isCancelled = delivery.status === 'cancelled';

  useEffect(() => {
    if (showHistory && history.length === 0) {
      fetchDeliveryStatusHistory(delivery.id).then(setHistory).catch(() => {});
    }
  }, [showHistory, delivery.id, history.length]);

  useEffect(() => {
    if (showTracking && shipment && trackingEvents.length === 0) {
      fetchTrackingEvents(shipment.id).then(setTrackingEvents).catch(() => {});
    }
  }, [showTracking, shipment, trackingEvents.length]);

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-neutral-900">
              {orderInfo?.order_number || 'Order'}
            </p>
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
        <div className="text-right">
          <span
            className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${
              delivery.status === 'delivered'
                ? 'bg-green-100 text-green-700'
                : delivery.status === 'dispatched' || delivery.status === 'in_transit'
                ? 'bg-blue-100 text-blue-700'
                : isFailed
                ? 'bg-rose-100 text-rose-700'
                : isCancelled
                ? 'bg-neutral-200 text-neutral-600'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {statusLabel(delivery.status)}
          </span>
          {orderInfo && (
            <p className="text-xs text-neutral-500 mt-1">
              {formatPrice(Number(orderInfo.total))}
            </p>
          )}
        </div>
      </div>

      {delivery.delivery_method && (
        <div className="flex items-center gap-2 text-xs text-neutral-500 mb-4">
          {isPickup ? <StoreIcon size={14} /> : <Truck size={14} />}
          {delivery.delivery_method.name}
          {delivery.delivery_method.estimated_days && (
            <span className="text-neutral-400">
              · {delivery.delivery_method.estimated_days}
            </span>
          )}
        </div>
      )}

      {/* Courier shipment info */}
      {shipment && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">
                {shipment.courier_provider?.name || 'Courier'}
              </span>
              {shipment.courier_provider?.is_demo && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                  Demo Mode
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
                Track shipment <ExternalLink size={10} />
              </a>
            )}
          </div>
          <button
            onClick={() => setShowTracking((s) => !s)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            {showTracking ? 'Hide' : 'Show'} courier tracking history
          </button>
          {showTracking && trackingEvents.length > 0 && (
            <div className="mt-3 border-l-2 border-blue-200 pl-4 space-y-3">
              {trackingEvents.map((ev) => (
                <div key={ev.id} className="relative">
                  <div className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-blue-400" />
                  <p className="text-xs font-medium text-blue-900 capitalize">
                    {ev.status.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-blue-600">
                    {new Date(ev.event_timestamp).toLocaleString('en-ZA', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  {ev.description && (
                    <p className="text-xs text-blue-500 mt-0.5">{ev.description}</p>
                  )}
                  {ev.location && (
                    <p className="text-xs text-blue-400 mt-0.5">{ev.location}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {showTracking && trackingEvents.length === 0 && (
            <p className="mt-3 text-xs text-blue-400">No courier tracking events yet.</p>
          )}
        </div>
      )}

      {/* Progress tracker */}
      {!isFailed && !isCancelled && (
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-2">
          {STATUS_STEPS.map((step, i) => {
            const Icon = step.icon;
            const isComplete = i <= currentStep;
            const isCurrent = i === currentStep;
            return (
              <div key={step.status} className="flex items-center flex-1 last:flex-none min-w-0">
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      isComplete
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-100 text-neutral-400'
                    } ${isCurrent ? 'ring-2 ring-neutral-900 ring-offset-2' : ''}`}
                  >
                    <Icon size={15} />
                  </div>
                  <span
                    className={`text-[10px] text-center hidden sm:block ${
                      isComplete ? 'text-neutral-900 font-medium' : 'text-neutral-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div
                    className={`h-px flex-1 mx-1 ${
                      i < currentStep ? 'bg-neutral-900' : 'bg-neutral-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Failed/cancelled banner */}
      {isFailed && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3 mb-4">
          <AlertTriangle size={16} className="text-rose-600" />
          <p className="text-xs text-rose-700 font-medium">Delivery could not be completed. The store will contact you.</p>
        </div>
      )}
      {isCancelled && (
        <div className="flex items-center gap-2 bg-neutral-100 border border-neutral-200 rounded-lg p-3 mb-4">
          <XCircle size={16} className="text-neutral-500" />
          <p className="text-xs text-neutral-600 font-medium">This delivery has been cancelled.</p>
        </div>
      )}

      {/* Tracking note */}
      {delivery.tracking_note && (
        <div className="mt-4 bg-neutral-50 border border-neutral-200 rounded-lg p-3">
          <p className="text-xs text-neutral-600">
            <span className="font-medium text-neutral-900">Note: </span>
            {delivery.tracking_note}
          </p>
        </div>
      )}

      {/* Timestamps */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
        {delivery.dispatched_at && (
          <span>Dispatched: {new Date(delivery.dispatched_at).toLocaleDateString('en-ZA')}</span>
        )}
        {delivery.delivered_at && (
          <span>Delivered: {new Date(delivery.delivered_at).toLocaleDateString('en-ZA')}</span>
        )}
        {delivery.cancelled_at && (
          <span>Cancelled: {new Date(delivery.cancelled_at).toLocaleDateString('en-ZA')}</span>
        )}
        {delivery.failed_at && (
          <span>Failed: {new Date(delivery.failed_at).toLocaleDateString('en-ZA')}</span>
        )}
      </div>

      {/* Timeline toggle */}
      <button
        onClick={() => setShowHistory((s) => !s)}
        className="mt-3 text-xs text-neutral-500 hover:text-neutral-900 font-medium transition-colors"
      >
        {showHistory ? 'Hide' : 'Show'} status history
      </button>
      {showHistory && history.length > 0 && (
        <div className="mt-3 border-l-2 border-neutral-200 pl-4 space-y-3">
          {history.map((h) => (
            <div key={h.id} className="relative">
              <div className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-neutral-400" />
              <p className="text-xs font-medium text-neutral-900">{statusLabel(h.status)}</p>
              <p className="text-xs text-neutral-500">
                {new Date(h.created_at).toLocaleString('en-ZA', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              {h.note && <p className="text-xs text-neutral-400 mt-0.5">{h.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DeliveryTrackingPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [shipmentsMap, setShipmentsMap] = useState<Record<string, Shipment>>({});
  const [notifications, setNotifications] = useState<(NotificationEvent & { order_number?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    setLoading(true);
    Promise.all([
      fetchCustomerDeliveries(user.id),
      fetchCustomerNotifications(user.id).catch(() => [] as (NotificationEvent & { order_number?: string })[]),
    ])
      .then(([data, notifs]) => {
        if (mounted) {
          setDeliveries(data);
          setNotifications(notifs);
          if (data.length > 0) {
            fetchShipmentsForDeliveries(data.map((d) => d.id)).then((shipments) => {
              if (mounted) {
                const map: Record<string, Shipment> = {};
                for (const s of shipments) {
                  map[s.delivery_id] = s;
                }
                setShipmentsMap(map);
              }
            });
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setError('Failed to load deliveries');
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, [user]);

  if (authLoading) {
    return (
      <div className="pt-20 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    navigateTo('/login');
    return null;
  }

  return (
    <div className="pt-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigateTo('/')}
        className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Home
      </button>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-neutral-900 rounded-lg flex items-center justify-center">
          <Truck size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">My Deliveries</h1>
          <p className="text-sm text-neutral-500">Track the status of your orders</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-neutral-400" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center mb-4">
            <AlertCircle size={26} className="text-rose-500" />
          </div>
          <p className="text-sm text-neutral-600">{error}</p>
        </div>
      ) : deliveries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
            <Package size={28} className="text-neutral-300" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-1">No deliveries yet</h3>
          <p className="text-sm text-neutral-500 max-w-md mb-6">
            Your delivery tracking will appear here once you place an order.
          </p>
          <button
            onClick={() => navigateTo('/products')}
            className="px-6 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Start Shopping
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {deliveries.map((delivery) => (
            <DeliveryCard
              key={delivery.id}
              delivery={delivery}
              shipment={shipmentsMap[delivery.id]}
            />
          ))}
        </div>
      )}

      {/* WhatsApp Notifications Timeline */}
      {!loading && notifications.length > 0 && (
        <div className="mt-8 bg-white border border-neutral-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
              <MessageCircle size={16} className="text-green-600" />
            </div>
            <div>
              <h2 className="font-bold text-neutral-900 text-sm">Order Updates</h2>
              <p className="text-xs text-neutral-500">WhatsApp notifications sent for your orders</p>
            </div>
          </div>
          <div className="space-y-3">
            {notifications.slice(0, 12).map((n) => (
              <div key={n.id} className="flex items-start gap-3 pb-3 border-b border-neutral-100 last:border-0 last:pb-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  n.status === 'sent'
                    ? 'bg-green-50 text-green-600'
                    : n.status === 'simulated'
                    ? 'bg-amber-50 text-amber-600'
                    : n.status === 'failed'
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-neutral-100 text-neutral-400'
                }`}>
                  <Bell size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-neutral-900">
                      {NOTIFICATION_EVENT_LABELS[n.event_type] || n.event_type}
                    </p>
                    {n.order_number && (
                      <span className="text-xs text-neutral-400">{n.order_number}</span>
                    )}
                    {n.is_simulated && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                        Simulated
                      </span>
                    )}
                    {n.status === 'sent' && !n.is_simulated && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                        Sent
                      </span>
                    )}
                    {n.status === 'failed' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium">
                        Failed
                      </span>
                    )}
                    {n.status === 'skipped' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500 font-medium">
                        Skipped
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {new Date(n.created_at).toLocaleString('en-ZA', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {notifications.some((n) => n.is_simulated) && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-700">
                Some notifications are simulated because WhatsApp Business credentials are not yet configured.
                No actual WhatsApp messages were sent for those events.
              </p>
            </div>
          )}
        </div>
      )}

      {profile && (
        <div className="mt-8 bg-white border border-neutral-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={16} className="text-neutral-900" />
            <h2 className="font-bold text-neutral-900 text-sm">Delivery Support</h2>
          </div>
          <p className="text-xs text-neutral-500">
            For delivery enquiries, contact the store directly or reach out through our contact page.
            Delivery statuses are updated by the store after your order is confirmed.
          </p>
        </div>
      )}
    </div>
  );
}
