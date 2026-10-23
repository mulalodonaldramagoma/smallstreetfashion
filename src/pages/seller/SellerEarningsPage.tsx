import { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  TrendingUp,
  Percent,
  CircleDollarSign,
  Clock,
  AlertTriangle,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Package,
  RotateCcw,
} from 'lucide-react';
import { SellerLayout } from '@/components/SellerLayout';
import { useAuth } from '@/context/AuthContext';
import { useSellerStore } from '@/hooks/useData';
import { ErrorState } from '@/components/ui/States';
import { fetchEarningsSummary, fetchEarningsHistory } from '@/services/earningsService';
import { formatPrice } from '@/utils/format';
import type { EarningsSummary, SellerEarning, EarningStatus } from '@/types';
import { EARNING_STATUS_LABELS, EARNING_STATUS_COLORS } from '@/types';

type StatusFilter = EarningStatus | 'all';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'available', label: 'Available' },
  { key: 'paid', label: 'Paid' },
  { key: 'reversed', label: 'Reversed' },
];

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function SellerEarningsPage() {
  const { user } = useAuth();
  const { data: store } = useSellerStore(user?.id ?? null);

  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [earnings, setEarnings] = useState<SellerEarning[]>([]);
  const [earningsTotal, setEarningsTotal] = useState(0);
  const [earningsLoading, setEarningsLoading] = useState(true);
  const [earningsError, setEarningsError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await fetchEarningsSummary();
      setSummary(data);
    } catch {
      setSummaryError('Failed to load earnings summary');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadEarnings = useCallback(async () => {
    setEarningsLoading(true);
    setEarningsError(null);
    try {
      const { earnings, total } = await fetchEarningsHistory({
        status: statusFilter,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        page,
        perPage,
      });
      setEarnings(earnings);
      setEarningsTotal(total);
    } catch {
      setEarningsError('Failed to load earnings history');
    } finally {
      setEarningsLoading(false);
    }
  }, [statusFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadEarnings();
  }, [loadEarnings]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(earningsTotal / perPage);

  return (
    <SellerLayout activePage="earnings">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Earnings</h1>
        <p className="text-sm text-neutral-500">
          Track your sales, commission and net earnings
        </p>
      </div>

      {summaryError ? (
        <ErrorState message="Unable to load your earnings summary." />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <SummaryCard
              icon={<TrendingUp size={20} />}
              label="Gross Sales"
              value={summary ? formatPrice(summary.totalGross) : null}
              loading={summaryLoading}
              color="bg-blue-50 text-blue-600"
            />
            <SummaryCard
              icon={<Percent size={20} />}
              label="Commission Deducted"
              value={summary ? formatPrice(summary.totalCommission) : null}
              loading={summaryLoading}
              color="bg-amber-50 text-amber-600"
              subtitle="10% platform fee"
            />
            <SummaryCard
              icon={<CircleDollarSign size={20} />}
              label="Net Earnings"
              value={summary ? formatPrice(summary.totalNet) : null}
              loading={summaryLoading}
              color="bg-green-50 text-green-600"
              subtitle="Before refund adjustments"
            />
            <SummaryCard
              icon={<Clock size={20} />}
              label="Pending Earnings"
              value={summary ? formatPrice(summary.pendingNet) : null}
              loading={summaryLoading}
              color="bg-neutral-100 text-neutral-600"
              subtitle="Not yet available for payout"
            />
          </div>

          {/* Adjusted net and refund row */}
          {!summaryLoading && summary && (summary.totalRefunded > 0 || summary.adjustedNet !== summary.totalNet) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="bg-white border border-neutral-200 rounded-xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                  <Wallet size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-neutral-900">{formatPrice(summary.adjustedNet)}</p>
                  <p className="text-xs text-neutral-500">Adjusted Net (after refunds)</p>
                </div>
              </div>
              <div className="bg-white border border-neutral-200 rounded-xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                  <RotateCcw size={20} className="text-rose-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-neutral-900">{formatPrice(summary.totalRefunded)}</p>
                  <p className="text-xs text-neutral-500">Total Refunded Gross</p>
                </div>
              </div>
            </div>
          )}

          {/* Secondary stats */}
          {!summaryLoading && summary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white border border-neutral-200 rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                  <Package size={18} className="text-neutral-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-neutral-900">{summary.orderCount}</p>
                  <p className="text-xs text-neutral-500">Orders with earnings</p>
                </div>
              </div>
              <div className="bg-white border border-neutral-200 rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                  <RotateCcw size={18} className="text-rose-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-neutral-900">
                    {summary.reversedNet > 0 ? formatPrice(summary.reversedNet) : 'R0.00'}
                  </p>
                  <p className="text-xs text-neutral-500">Reversed / refunded</p>
                </div>
              </div>
              <div className="bg-white border border-neutral-200 rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                  <Wallet size={18} className="text-neutral-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    Payouts not yet available
                  </p>
                  <p className="text-xs text-neutral-500">Coming in a future update</p>
                </div>
              </div>
            </div>
          )}

          {/* Payout disclaimer */}
          {!summaryLoading && summary && summary.pendingNet > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Pending earnings reflect sales where payment has been verified but
                earnings are not yet available for withdrawal. A payout mechanism
                will be added in a future update.
              </p>
            </div>
          )}
        </>
      )}

      {/* Earnings History */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-neutral-200">
          <h2 className="font-bold text-neutral-900 mb-4">Earnings History</h2>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-neutral-500 mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>
            </div>
          </div>

          {/* Status filters */}
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  statusFilter === f.key
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {earningsLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-neutral-400" />
          </div>
        )}

        {/* Error */}
        {!earningsLoading && earningsError && (
          <div className="p-6">
            <ErrorState message={earningsError} />
          </div>
        )}

        {/* Empty */}
        {!earningsLoading && !earningsError && earnings.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-14 h-14 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet size={24} className="text-neutral-300" />
            </div>
            <p className="text-sm font-medium text-neutral-900 mb-1">No earnings yet</p>
            <p className="text-xs text-neutral-500">
              Earnings will appear here once customers place and pay for orders
              from your store.
            </p>
          </div>
        )}

        {/* Table (desktop) */}
        {!earningsLoading && !earningsError && earnings.length > 0 && (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50">
                    <th className="text-left px-5 py-3 font-semibold text-neutral-700">Order</th>
                    <th className="text-left px-5 py-3 font-semibold text-neutral-700">Product</th>
                    <th className="text-right px-5 py-3 font-semibold text-neutral-700">Gross</th>
                    <th className="text-right px-5 py-3 font-semibold text-neutral-700">Commission</th>
                    <th className="text-right px-5 py-3 font-semibold text-neutral-700">Net</th>
                    <th className="text-center px-5 py-3 font-semibold text-neutral-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.map((e) => (
                    <tr key={e.id} className="border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-neutral-900">{e.order?.order_number || '—'}</p>
                        <p className="text-xs text-neutral-400">{e.order ? timeAgo(e.order.created_at) : ''}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
                            {e.order_item?.product_image && (
                              <img
                                src={e.order_item.product_image}
                                alt={e.order_item.product_name}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-neutral-900 truncate max-w-[200px]">
                              {e.order_item?.product_name || 'Unknown product'}
                            </p>
                            <p className="text-xs text-neutral-400">Qty: {e.order_item?.quantity ?? '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-neutral-900">
                        {formatPrice(Number(e.gross_amount))}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <p className="text-neutral-700">{formatPrice(Number(e.commission_amount))}</p>
                        <p className="text-xs text-neutral-400">{(Number(e.commission_rate) * 100).toFixed(1)}%</p>
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-neutral-900">
                        {formatPrice(Number(e.net_earnings))}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${EARNING_STATUS_COLORS[e.status]}`}>
                          {EARNING_STATUS_LABELS[e.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards (mobile) */}
            <div className="lg:hidden divide-y divide-neutral-100">
              {earnings.map((e) => (
                <div key={e.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
                        {e.order_item?.product_image && (
                          <img
                            src={e.order_item.product_image}
                            alt={e.order_item.product_name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-900 truncate">
                          {e.order_item?.product_name || 'Unknown product'}
                        </p>
                        <p className="text-xs text-neutral-400">
                          {e.order?.order_number} · Qty {e.order_item?.quantity ?? '—'}
                        </p>
                      </div>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 text-xs font-medium rounded-full ${EARNING_STATUS_COLORS[e.status]}`}>
                      {EARNING_STATUS_LABELS[e.status]}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-neutral-400">Gross</p>
                      <p className="text-sm font-medium text-neutral-900">{formatPrice(Number(e.gross_amount))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-400">Commission</p>
                      <p className="text-sm font-medium text-neutral-700">{formatPrice(Number(e.commission_amount))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-400">Net</p>
                      <p className="text-sm font-semibold text-neutral-900">{formatPrice(Number(e.net_earnings))}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-4 border-t border-neutral-200">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 border border-neutral-200 rounded-lg text-neutral-600 hover:bg-neutral-50 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-neutral-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 border border-neutral-200 rounded-lg text-neutral-600 hover:bg-neutral-50 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </SellerLayout>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  loading,
  color,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  loading?: boolean;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        {icon}
      </div>
      {loading ? (
        <div className="h-7 w-24 bg-neutral-100 rounded animate-pulse" />
      ) : (
        <p className="text-xl font-bold text-neutral-900">{value}</p>
      )}
      <p className="text-xs text-neutral-500 mt-1">{label}</p>
      {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}
