import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  DollarSign,
  Receipt,
  RotateCcw,
  PiggyBank,
  Flag,
  Calendar,
  Filter,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  fetchReconciliation,
  fetchSellersForFilter,
  type ReconciliationResult,
  type ReconciliationRow,
  type ReconciliationFilters,
  type SellerOption,
} from '@/services/reconciliationService';
import { formatPrice } from '@/utils/format';

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

export function AdminReconciliationPage() {
  const { user } = useAuth();
  const [data, setData] = useState<ReconciliationResult | null>(null);
  const [sellers, setSellers] = useState<SellerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sellerId, setSellerId] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<string>('all');
  const [reconStatus, setReconStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filters: ReconciliationFilters = useMemo(() => ({
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    orderRef: search || null,
    sellerId: sellerId || null,
    paymentStatus: paymentStatus === 'all' ? null : paymentStatus,
    reconStatus: reconStatus === 'all' ? null : reconStatus,
  }), [dateFrom, dateTo, search, sellerId, paymentStatus, reconStatus]);

  const loadData = () => {
    setLoading(true);
    fetchReconciliation(filters)
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load reconciliation data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) {
      fetchSellersForFilter().then(setSellers).catch(() => {});
      loadData();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => { if (user) loadData(); }, 350);
    return () => clearTimeout(t);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const summary = data?.summary;
  const rows = data?.rows || [];

  const hasActiveFilters = search || dateFrom || dateTo || sellerId || paymentStatus !== 'all' || reconStatus !== 'all';

  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setSellerId('');
    setPaymentStatus('all');
    setReconStatus('all');
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'cancelled': return 'bg-rose-100 text-rose-700';
      case 'failed': return 'bg-rose-100 text-rose-700';
      case 'refunded': return 'bg-neutral-200 text-neutral-600';
      case 'partially_refunded': return 'bg-blue-100 text-blue-700';
      default: return 'bg-neutral-100 text-neutral-600';
    }
  };

  const getRowIssues = (row: ReconciliationRow): string[] => {
    const issues: string[] = [];
    if (row.issue_missing_earnings) issues.push('Missing earnings');
    if (row.issue_duplicate_earnings) issues.push('Duplicate earnings');
    if (row.issue_mismatched_totals) issues.push('Mismatched totals');
    if (row.issue_refund_exceeds_total) issues.push('Refund exceeds total');
    if (row.issue_incomplete_processing) issues.push('Incomplete processing');
    if (row.issue_status_inconsistency) issues.push('Status inconsistency');
    if (row.issue_missing_refund_adjustment) issues.push('Missing refund adjustment');
    return issues;
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Financial Reconciliation</h1>
        <p className="text-sm text-neutral-500">
          Read-only audit of orders, earnings, refunds, and processing integrity
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-neutral-400" />
        </div>
      ) : summary ? (
        <>
          {/* Financial Summary */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Financial Summary</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard
                label="Gross Sales (Paid)"
                value={formatPrice(Number(summary.gross_sales))}
                icon={<DollarSign size={18} />}
                color="bg-green-50 text-green-600"
              />
              <SummaryCard
                label="Platform Commission"
                value={formatPrice(Number(summary.platform_commission))}
                icon={<TrendingUp size={18} />}
                color="bg-blue-50 text-blue-600"
              />
              <SummaryCard
                label="Seller Net Earnings"
                value={formatPrice(Number(summary.seller_net_earnings))}
                icon={<PiggyBank size={18} />}
                color="bg-teal-50 text-teal-600"
              />
              <SummaryCard
                label="Earnings Reversals"
                value={formatPrice(Number(summary.earnings_reversals))}
                icon={<RotateCcw size={18} />}
                color="bg-rose-50 text-rose-600"
              />
              <SummaryCard
                label="Adjusted Net Earnings"
                value={formatPrice(Number(summary.adjusted_net_earnings))}
                icon={<PiggyBank size={18} />}
                color="bg-neutral-100 text-neutral-700"
              />
              <SummaryCard
                label="Processed Refunds"
                value={formatPrice(Number(summary.processed_refunds))}
                icon={<Receipt size={18} />}
                color="bg-amber-50 text-amber-600"
              />
              <SummaryCard
                label="Pending Refunds"
                value={formatPrice(Number(summary.pending_refunds))}
                icon={<Receipt size={18} />}
                color="bg-neutral-100 text-neutral-600"
              />
              <SummaryCard
                label="Paid Orders"
                value={String(summary.paid_orders)}
                icon={<CheckCircle2 size={18} />}
                color="bg-green-50 text-green-600"
              />
            </div>
          </div>

          {/* Reconciliation Issues */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Reconciliation Issues</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <IssueCard
                label="Missing Earnings"
                count={summary.issues_missing_earnings}
                description="Paid orders with no earnings records"
              />
              <IssueCard
                label="Duplicate Earnings"
                count={summary.issues_duplicate_earnings}
                description="Multiple earnings rows for the same order item"
              />
              <IssueCard
                label="Mismatched Totals"
                count={summary.issues_mismatched_totals}
                description="Earnings gross != order items line total"
              />
              <IssueCard
                label="Refund Exceeds Total"
                count={summary.issues_refund_exceeds}
                description="Processed refunds exceed order total"
              />
              <IssueCard
                label="Incomplete Processing"
                count={summary.issues_incomplete_processing}
                description="Stock or earnings not processed for paid orders"
              />
              <IssueCard
                label="Status Inconsistency"
                count={summary.issues_status_inconsistency}
                description="Has processed refunds but order status not updated"
              />
              <IssueCard
                label="Missing Refund Adjustment"
                count={summary.issues_missing_refund_adjustment}
                description="Processed refund exists but no earnings adjustment"
              />
            </div>
            {summary.total_issue_orders > 0 && (
              <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <Flag size={14} className="text-amber-600" />
                <p className="text-xs text-amber-700">
                  {summary.total_issue_orders} order{summary.total_issue_orders !== 1 ? 's' : ''} with reconciliation issues detected.
                  Review the table below for details.
                </p>
              </div>
            )}
            {summary.total_issue_orders === 0 && (
              <div className="mt-3 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                <CheckCircle2 size={14} className="text-green-600" />
                <p className="text-xs text-green-700">
                  No reconciliation issues detected. All financial records are consistent.
                </p>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 text-sm font-medium text-neutral-700 hover:text-neutral-900"
              >
                <Filter size={16} />
                Filters
                {hasActiveFilters && (
                  <span className="w-2 h-2 bg-neutral-900 rounded-full" />
                )}
              </button>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900"
                >
                  <X size={12} />
                  Clear all
                </button>
              )}
            </div>

            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                placeholder="Search by order number..."
              />
            </div>

            {showFilters && (
              <div className="space-y-3 pt-2 border-t border-neutral-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-neutral-500 flex items-center gap-1 mb-1">
                      <Calendar size={12} /> From Date
                    </label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 flex items-center gap-1 mb-1">
                      <Calendar size={12} /> To Date
                    </label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 mb-1 block">Seller / Store</label>
                    <select
                      value={sellerId}
                      onChange={(e) => setSellerId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    >
                      <option value="">All sellers</option>
                      {sellers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name || s.store_name || 'Unknown'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 mb-1 block">Payment Status</label>
                    <select
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    >
                      <option value="all">All statuses</option>
                      <option value="paid">Paid</option>
                      <option value="pending">Pending</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="failed">Failed</option>
                      <option value="refunded">Refunded</option>
                      <option value="partially_refunded">Partially Refunded</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-neutral-500 mb-1 block">Reconciliation Status</label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { value: 'all', label: 'All' },
                      { value: 'issues', label: 'With Issues' },
                      { value: 'clean', label: 'Clean' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setReconStatus(opt.value)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          reconStatus === opt.value
                            ? 'bg-neutral-900 text-white'
                            : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Results count */}
          <p className="text-xs text-neutral-500 mb-4">
            {rows.length} order{rows.length !== 1 ? 's' : ''} found
          </p>

          {/* Order Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-neutral-400" />
            </div>
          ) : rows.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
              <Search size={28} className="text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">No orders match your filters.</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden lg:block bg-white border border-neutral-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-200 text-left">
                        <th className="px-3 py-2.5 font-semibold text-neutral-600">Order</th>
                        <th className="px-3 py-2.5 font-semibold text-neutral-600">Status</th>
                        <th className="px-3 py-2.5 font-semibold text-neutral-600 text-right">Total</th>
                        <th className="px-3 py-2.5 font-semibold text-neutral-600 text-right">Refunds</th>
                        <th className="px-3 py-2.5 font-semibold text-neutral-600 text-right">Gross Earn.</th>
                        <th className="px-3 py-2.5 font-semibold text-neutral-600 text-right">Commission</th>
                        <th className="px-3 py-2.5 font-semibold text-neutral-600 text-right">Net Earn.</th>
                        <th className="px-3 py-2.5 font-semibold text-neutral-600 text-right">Adjust.</th>
                        <th className="px-3 py-2.5 font-semibold text-neutral-600 text-right">Adj. Net</th>
                        <th className="px-3 py-2.5 font-semibold text-neutral-600">Processing</th>
                        <th className="px-3 py-2.5 font-semibold text-neutral-600">Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const isExpanded = expandedId === row.order_id;
                        const issues = getRowIssues(row);
                        const hasIssues = issues.length > 0;
                        return (
                          <>
                            <tr
                              key={row.order_id}
                              onClick={() => setExpandedId(isExpanded ? null : row.order_id)}
                              className={`border-b border-neutral-100 cursor-pointer hover:bg-neutral-50 transition-colors ${
                                hasIssues ? 'bg-amber-50/30' : ''
                              }`}
                            >
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1.5">
                                  {isExpanded ? <ChevronDown size={12} className="text-neutral-400" /> : <ChevronRight size={12} className="text-neutral-400" />}
                                  <span className="font-semibold text-neutral-900">{row.order_number}</span>
                                </div>
                                <p className="text-neutral-400 mt-0.5">{new Date(row.created_at).toLocaleDateString('en-ZA')}</p>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusBadge(row.order_status)}`}>
                                  {formatStatus(row.order_status)}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right font-medium text-neutral-900">{formatPrice(Number(row.order_total))}</td>
                              <td className="px-3 py-2.5 text-right text-neutral-700">
                                {Number(row.processed_refund_total) > 0 ? formatPrice(Number(row.processed_refund_total)) : '—'}
                              </td>
                              <td className="px-3 py-2.5 text-right text-neutral-700">{formatPrice(Number(row.gross_earnings))}</td>
                              <td className="px-3 py-2.5 text-right text-neutral-700">{formatPrice(Number(row.commission))}</td>
                              <td className="px-3 py-2.5 text-right text-neutral-700">{formatPrice(Number(row.original_net_earnings))}</td>
                              <td className="px-3 py-2.5 text-right text-neutral-700">
                                {Number(row.net_adjustment) !== 0 ? formatPrice(Number(row.net_adjustment)) : '—'}
                              </td>
                              <td className="px-3 py-2.5 text-right font-medium text-neutral-900">{formatPrice(Number(row.adjusted_net_earnings))}</td>
                              <td className="px-3 py-2.5">
                                {row.stock_decremented !== null ? (
                                  <div className="flex items-center gap-1">
                                    {row.stock_decremented ? <CheckCircle2 size={12} className="text-green-600" /> : <XCircle size={12} className="text-rose-600" />}
                                    {row.earnings_created ? <CheckCircle2 size={12} className="text-green-600" /> : <XCircle size={12} className="text-rose-600" />}
                                  </div>
                                ) : (
                                  <span className="text-neutral-400">No log</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                {hasIssues ? (
                                  <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                                    <AlertTriangle size={12} />
                                    {issues.length}
                                  </span>
                                ) : (
                                  <CheckCircle2 size={14} className="text-green-500" />
                                )}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-neutral-50">
                                <td colSpan={11} className="px-4 py-3">
                                  <ExpandedRowDetail row={row} issues={issues} />
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="lg:hidden space-y-3">
                {rows.map((row) => {
                  const isExpanded = expandedId === row.order_id;
                  const issues = getRowIssues(row);
                  const hasIssues = issues.length > 0;
                  return (
                    <div key={row.order_id} className={`bg-white border rounded-xl overflow-hidden ${hasIssues ? 'border-amber-200' : 'border-neutral-200'}`}>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : row.order_id)}
                        className="w-full flex items-center justify-between p-3 text-left"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-neutral-900">{row.order_number}</p>
                          <p className="text-xs text-neutral-500">{formatStatus(row.order_status)} · {formatPrice(Number(row.order_total))}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {hasIssues && <AlertTriangle size={14} className="text-amber-600" />}
                          {isExpanded ? <ChevronDown size={14} className="text-neutral-400" /> : <ChevronRight size={14} className="text-neutral-400" />}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="border-t border-neutral-100 p-3">
                          <ExpandedRowDetail row={row} issues={issues} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-neutral-400 mt-6">
            All figures are calculated from authoritative database records. This page is read-only and does not modify any financial data.
          </p>
        </>
      ) : !loading ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
          <p className="text-sm text-neutral-500">No reconciliation data available.</p>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        {icon}
      </div>
      <p className="text-xl font-bold text-neutral-900 break-all">{value}</p>
      <p className="text-xs text-neutral-500 mt-1">{label}</p>
    </div>
  );
}

function IssueCard({ label, count, description }: { label: string; count: number; description: string }) {
  const hasIssue = count > 0;
  return (
    <div className={`rounded-xl border p-4 ${hasIssue ? 'bg-amber-50 border-amber-200' : 'bg-white border-neutral-200'}`}>
      <div className="flex items-center gap-2 mb-1">
        {hasIssue ? <AlertTriangle size={16} className="text-amber-600" /> : <CheckCircle2 size={16} className="text-green-500" />}
        <p className={`text-lg font-bold ${hasIssue ? 'text-amber-700' : 'text-neutral-900'}`}>{count}</p>
      </div>
      <p className="text-xs font-medium text-neutral-700">{label}</p>
      <p className="text-xs text-neutral-400 mt-0.5">{description}</p>
    </div>
  );
}

function ExpandedRowDetail({ row, issues }: { row: ReconciliationRow; issues: string[] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <DetailItem label="Payment Reference" value={row.payment_reference || 'None'} />
        <DetailItem label="Payment Status" value={row.payment_tx_status ? formatStatus(row.payment_tx_status) : 'None'} />
        <DetailItem label="Verified" value={row.verified_at ? new Date(row.verified_at).toLocaleDateString('en-ZA') : 'Not verified'} />
        <DetailItem label="Items / Sellers" value={`${row.item_count} items, ${row.seller_count} seller${row.seller_count !== 1 ? 's' : ''}`} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <DetailItem label="Subtotal" value={formatPrice(Number(row.subtotal))} />
        <DetailItem label="Delivery Fee" value={formatPrice(Number(row.delivery_fee))} />
        <DetailItem label="Order Total" value={formatPrice(Number(row.order_total))} />
        <DetailItem label="Items Line Total" value={formatPrice(Number(row.items_line_total))} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <DetailItem label="Gross Earnings" value={formatPrice(Number(row.gross_earnings))} />
        <DetailItem label="Commission" value={formatPrice(Number(row.commission))} />
        <DetailItem label="Original Net" value={formatPrice(Number(row.original_net_earnings))} />
        <DetailItem label="Adjusted Net" value={formatPrice(Number(row.adjusted_net_earnings))} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <DetailItem label="Earnings Count" value={String(row.earnings_count)} />
        <DetailItem label="Reversed Count" value={String(row.reversed_earnings_count)} />
        <DetailItem label="Adjustment Count" value={String(row.adjustment_count)} />
        <DetailItem label="Net Adjustment" value={Number(row.net_adjustment) !== 0 ? formatPrice(Number(row.net_adjustment)) : '—'} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <DetailItem label="Processed Refunds" value={Number(row.processed_refund_total) > 0 ? formatPrice(Number(row.processed_refund_total)) : '—'} />
        <DetailItem label="Pending Refunds" value={Number(row.pending_refund_total) > 0 ? formatPrice(Number(row.pending_refund_total)) : '—'} />
        <DetailItem label="Stock Decremented" value={row.stock_decremented === null ? 'No log' : row.stock_decremented ? 'Yes' : 'No'} />
        <DetailItem label="Earnings Created" value={row.earnings_created === null ? 'No log' : row.earnings_created ? 'Yes' : 'No'} />
      </div>

      {row.processing_error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-2">
          <p className="text-xs text-rose-700 font-medium">Processing Error</p>
          <p className="text-xs text-rose-600 mt-0.5">{row.processing_error}</p>
        </div>
      )}

      {issues.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-amber-700 mb-1.5">Reconciliation Issues</p>
          <ul className="space-y-1">
            {issues.map((issue, i) => (
              <li key={i} className="text-xs text-amber-700 flex items-center gap-1.5">
                <AlertTriangle size={10} className="shrink-0" />
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-neutral-400 mb-0.5">{label}</p>
      <p className="text-neutral-900 font-medium break-all">{value}</p>
    </div>
  );
}
