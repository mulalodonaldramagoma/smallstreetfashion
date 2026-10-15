import { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Package,
  Users,
  Store as StoreIcon,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchAdminStats, type AdminStats } from '@/services/adminService';
import { formatPrice } from '@/utils/format';

export function AdminOverviewPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchAdminStats()
      .then(setStats)
      .catch((err) => setError('Failed to load stats'))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Dashboard Overview</h1>
        <p className="text-sm text-neutral-500">Marketplace summary from real database records</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-neutral-400" />
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      ) : stats ? (
        <div className="space-y-6">
          {/* Orders Section */}
          <div>
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Orders</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Orders" value={stats.totalOrders} icon={<ShoppingBag size={18} />} color="bg-neutral-100 text-neutral-700" />
              <StatCard label="Paid Orders" value={stats.paidOrders} icon={<CheckCircle2 size={18} />} color="bg-green-50 text-green-600" />
              <StatCard label="Pending Payment" value={stats.pendingOrders} icon={<Clock size={18} />} color="bg-amber-50 text-amber-600" />
              <StatCard label="Cancelled" value={stats.cancelledOrders} icon={<XCircle size={18} />} color="bg-rose-50 text-rose-600" />
              <StatCard label="Verified Payments" value={stats.verifiedPayments} icon={<CheckCircle2 size={18} />} color="bg-teal-50 text-teal-600" />
              <StatCard label="Verified Revenue" value={formatPrice(stats.verifiedRevenue)} icon={<CheckCircle2 size={18} />} color="bg-green-50 text-green-600" />
            </div>
            <p className="text-xs text-neutral-400 mt-2">
              Unpaid orders are not counted as revenue. Only Paystack-verified payments are treated as paid.
            </p>
          </div>

          {/* Products Section */}
          <div>
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Products</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Products" value={stats.totalProducts} icon={<Package size={18} />} color="bg-neutral-100 text-neutral-700" />
              <StatCard label="Active Listings" value={stats.activeProducts} icon={<CheckCircle2 size={18} />} color="bg-green-50 text-green-600" />
              <StatCard label="Low Stock" value={stats.lowStockProducts} icon={<AlertTriangle size={18} />} color="bg-amber-50 text-amber-600" />
              <StatCard label="Out of Stock" value={stats.outOfStockProducts} icon={<XCircle size={18} />} color="bg-rose-50 text-rose-600" />
            </div>
          </div>

          {/* Users Section */}
          <div>
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Users</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Customers" value={stats.totalCustomers} icon={<Users size={18} />} color="bg-blue-50 text-blue-600" />
              <StatCard label="Sellers & Admins" value={stats.totalSellers} icon={<Users size={18} />} color="bg-teal-50 text-teal-600" />
              <StatCard label="Active Stores" value={stats.activeStores} icon={<StoreIcon size={18} />} color="bg-green-50 text-green-600" />
              <StatCard label="Unverified Stores" value={stats.unverifiedStores} icon={<AlertTriangle size={18} />} color="bg-amber-50 text-amber-600" />
            </div>
            {stats.demoStores > 0 && (
              <p className="text-xs text-amber-600 mt-2">
                {stats.demoStores} demo store{stats.demoStores !== 1 ? 's' : ''} in the marketplace — clearly labelled in store and product listings.
              </p>
            )}
          </div>

          {/* Delivery & Shipments */}
          <div>
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Delivery & Shipments</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Awaiting Fulfilment" value={stats.deliveriesPending} icon={<Clock size={18} />} color="bg-amber-50 text-amber-600" />
              <StatCard label="Dispatched / In Transit" value={stats.deliveriesDispatched} icon={<Truck size={18} />} color="bg-blue-50 text-blue-600" />
              <StatCard label="Delivered" value={stats.deliveriesDelivered} icon={<CheckCircle2 size={18} />} color="bg-green-50 text-green-600" />
              <StatCard label="Active Shipments" value={stats.shipmentsCreated} icon={<Package size={18} />} color="bg-neutral-100 text-neutral-700" />
            </div>
            <p className="text-xs text-neutral-400 mt-2">
              Courier integration is in demo mode. No live courier API is connected.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: string }) {
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
