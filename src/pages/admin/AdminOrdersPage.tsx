import { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchAdminOrders } from '@/services/adminService';
import { formatPrice } from '@/utils/format';
import type { Order, OrderItem, PaymentTransaction } from '@/types';

export function AdminOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<(Order & { order_items?: OrderItem[]; payment_transactions?: PaymentTransaction[] })[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const perPage = 15;

  const loadOrders = () => {
    setLoading(true);
    fetchAdminOrders({
      search: search || undefined,
      status: statusFilter === 'all' ? null : statusFilter,
      page,
      perPage,
    })
      .then(({ orders, total }) => {
        setOrders(orders);
        setTotal(total);
      })
      .catch((err) => setError('Failed to load orders'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) loadOrders();
  }, [user, page, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => { if (user) { setPage(1); loadOrders(); } }, 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const totalPages = Math.ceil(total / perPage);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'cancelled': return 'bg-rose-100 text-rose-700';
      case 'failed': return 'bg-rose-100 text-rose-700';
      case 'refunded': return 'bg-neutral-200 text-neutral-600';
      default: return 'bg-neutral-100 text-neutral-600';
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Orders</h1>
        <p className="text-sm text-neutral-500">View and filter all marketplace orders</p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700">{error}</p>
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-xl p-4 mb-6 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            placeholder="Search by order number, customer name, or email..."
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'paid', 'cancelled', 'failed', 'refunded'].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
                statusFilter === s ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-neutral-500 mb-4">{total} order{total !== 1 ? 's' : ''} found</p>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-neutral-400" />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
          <ShoppingBag size={28} className="text-neutral-300 mx-auto mb-3" />
          <p className="text-sm text-neutral-500">No orders match your filters.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {orders.map((order) => {
              const isExpanded = expandedId === order.id;
              const items = order.order_items || [];
              const payments = order.payment_transactions || [];
              const verifiedPayment = payments.find((p) => p.status === 'success');
              return (
                <div key={order.id} className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isExpanded ? <ChevronDown size={16} className="text-neutral-400 shrink-0" /> : <ChevronRight size={16} className="text-neutral-400 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-900">{order.order_number}</p>
                        <p className="text-xs text-neutral-500 truncate">{order.customer_name} · {order.customer_email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusBadge(order.status)}`}>
                        {order.status}
                      </span>
                      <span className="text-sm font-semibold text-neutral-900">{formatPrice(Number(order.total))}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-neutral-200 p-4 space-y-4">
                      {/* Order items */}
                      <div>
                        <p className="text-xs font-medium text-neutral-500 mb-2">Items</p>
                        <div className="space-y-2">
                          {items.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 text-xs">
                              {item.product_image && (
                                <div className="w-10 h-10 rounded-md overflow-hidden bg-neutral-200 shrink-0">
                                  <img src={item.product_image} alt={item.product_name} className="w-full h-full object-cover" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-neutral-900 truncate">{item.product_name}</p>
                                <p className="text-neutral-500">{item.size} · {item.colour} · Qty {item.quantity}</p>
                              </div>
                              <span className="font-medium text-neutral-700 shrink-0">{formatPrice(Number(item.line_total))}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Payment info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
                          <p className="text-xs font-medium text-neutral-500 mb-2">Payment</p>
                          {payments.length > 0 ? (
                            <div className="space-y-1.5">
                              {payments.map((p) => (
                                <div key={p.id} className="flex items-center gap-2 text-xs">
                                  {p.status === 'success' ? <CheckCircle2 size={12} className="text-green-600" /> : p.status === 'pending' ? <Clock size={12} className="text-amber-600" /> : <XCircle size={12} className="text-rose-600" />}
                                  <span className="text-neutral-700 capitalize">{p.status}</span>
                                  <span className="text-neutral-400">{p.provider}</span>
                                  {p.verified_at && <span className="text-neutral-400">· {new Date(p.verified_at).toLocaleDateString('en-ZA')}</span>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-neutral-400">No payment records</p>
                          )}
                          {!verifiedPayment && (
                            <p className="text-xs text-amber-600 mt-2">
                              Payment not verified by provider. Admin cannot mark as paid.
                            </p>
                          )}
                        </div>

                        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
                          <p className="text-xs font-medium text-neutral-500 mb-2">Delivery Address</p>
                          <p className="text-xs text-neutral-700">{order.delivery_address}</p>
                          <p className="text-xs text-neutral-500">{order.suburb}, {order.city}</p>
                          <p className="text-xs text-neutral-500">{order.province} {order.postal_code}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-neutral-500">
                        <span>Subtotal: {formatPrice(Number(order.subtotal))} · Delivery: {formatPrice(Number(order.delivery_fee))}</span>
                        <span>{new Date(order.created_at).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-neutral-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
