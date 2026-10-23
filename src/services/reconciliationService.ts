import { supabase } from '@/lib/supabase';

export interface ReconciliationSummary {
  total_orders: number;
  paid_orders: number;
  gross_sales: number;
  platform_commission: number;
  seller_net_earnings: number;
  earnings_reversals: number;
  adjusted_net_earnings: number;
  processed_refunds: number;
  pending_refunds: number;
  issues_missing_earnings: number;
  issues_duplicate_earnings: number;
  issues_mismatched_totals: number;
  issues_refund_exceeds: number;
  issues_incomplete_processing: number;
  issues_status_inconsistency: number;
  issues_missing_refund_adjustment: number;
  total_issue_orders: number;
}

export interface ReconciliationRow {
  order_id: string;
  order_number: string;
  order_status: string;
  order_total: number;
  subtotal: number;
  delivery_fee: number;
  created_at: string;
  payment_reference: string | null;
  payment_tx_status: string | null;
  has_verified_payment: boolean;
  verified_at: string | null;
  earnings_count: number;
  gross_earnings: number;
  commission: number;
  original_net_earnings: number;
  reversed_earnings_count: number;
  net_adjustment: number;
  adjustment_count: number;
  adjusted_net_earnings: number;
  processed_refund_total: number;
  pending_refund_total: number;
  refund_count: number;
  items_line_total: number;
  item_count: number;
  seller_count: number;
  stock_decremented: boolean | null;
  earnings_created: boolean | null;
  processing_error: string | null;
  processed_at: string | null;
  issue_missing_earnings: boolean;
  issue_duplicate_earnings: boolean;
  issue_mismatched_totals: boolean;
  issue_refund_exceeds_total: boolean;
  issue_incomplete_processing: boolean;
  issue_status_inconsistency: boolean;
  issue_missing_refund_adjustment: boolean;
}

export interface ReconciliationResult {
  summary: ReconciliationSummary;
  rows: ReconciliationRow[];
}

export interface ReconciliationFilters {
  dateFrom?: string | null;
  dateTo?: string | null;
  orderRef?: string | null;
  sellerId?: string | null;
  paymentStatus?: string | null;
  reconStatus?: string | null;
}

export async function fetchReconciliation(
  filters: ReconciliationFilters
): Promise<ReconciliationResult> {
  const { data, error } = await supabase.rpc('get_reconciliation_summary', {
    p_date_from: filters.dateFrom ? new Date(filters.dateFrom).toISOString() : null,
    p_date_to: filters.dateTo ? new Date(filters.dateTo + 'T23:59:59').toISOString() : null,
    p_order_ref: filters.orderRef || null,
    p_seller_id: filters.sellerId || null,
    p_payment_status: filters.paymentStatus || null,
    p_recon_status: filters.reconStatus || null,
  });

  if (error) throw error;
  if (!data) throw new Error('No data returned from reconciliation function');

  return data as ReconciliationResult;
}

export interface SellerOption {
  id: string;
  full_name: string | null;
  store_name: string | null;
}

export async function fetchSellersForFilter(): Promise<SellerOption[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('seller_id, name, seller_profile:profiles!stores_seller_id_fkey(id, full_name)')
    .order('name');

  if (error) throw error;

  const seen = new Set<string>();
  const sellers: SellerOption[] = [];
  for (const store of (data as Record<string, unknown>[] | null) || []) {
    const sellerId = store.seller_id as string;
    const sellerProfile = store.seller_profile as { id: string; full_name: string | null } | null;
    if (sellerId && !seen.has(sellerId)) {
      seen.add(sellerId);
      sellers.push({
        id: sellerId,
        full_name: sellerProfile?.full_name || null,
        store_name: (store.name as string) || null,
      });
    }
  }
  return sellers;
}
