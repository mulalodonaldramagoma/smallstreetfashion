import { supabase } from '@/lib/supabase';
import type { EarningsSummary, SellerEarning, EarningStatus } from '@/types';

export async function fetchEarningsSummary(): Promise<EarningsSummary> {
  const { data: earnings, error } = await supabase
    .from('seller_earnings')
    .select('gross_amount, commission_amount, net_earnings, status, order_id, seller_id');

  if (error) throw error;

  const rows = earnings ?? [];
  const orderIds = new Set<string>();
  const sellerIds = new Set<string>();

  let totalGross = 0;
  let totalCommission = 0;
  let totalNet = 0;
  let pendingNet = 0;
  let reversedNet = 0;

  for (const row of rows) {
    const gross = Number(row.gross_amount);
    const commission = Number(row.commission_amount);
    const net = Number(row.net_earnings);

    totalGross += gross;
    totalCommission += commission;
    totalNet += net;
    orderIds.add(row.order_id);
    sellerIds.add(row.seller_id);

    if (row.status === 'pending') {
      pendingNet += net;
    } else if (row.status === 'reversed') {
      reversedNet += net;
    }
  }

  // Fetch adjustments to compute adjusted net and total refunded
  let totalAdjustmentNet = 0;
  let totalRefunded = 0;

  if (sellerIds.size > 0) {
    const { data: adjustments, error: adjError } = await supabase
      .from('seller_earnings_adjustments')
      .select('net_adjustment, gross_adjustment, seller_id')
      .in('seller_id', Array.from(sellerIds));

    if (!adjError && adjustments) {
      for (const adj of adjustments) {
        totalAdjustmentNet += Number(adj.net_adjustment);
        totalRefunded += Math.abs(Number(adj.gross_adjustment));
      }
    }
  }

  const adjustedNet = totalNet + totalAdjustmentNet;

  return {
    totalGross,
    totalCommission,
    totalNet,
    pendingNet,
    reversedNet,
    adjustedNet,
    totalRefunded,
    orderCount: orderIds.size,
  };
}

export async function fetchEarningsHistory(params: {
  status?: EarningStatus | 'all';
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
  perPage?: number;
}): Promise<{ earnings: SellerEarning[]; total: number }> {
  const page = params.page || 1;
  const perPage = params.perPage || 15;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from('seller_earnings')
    .select(
      '*, order:orders(id, order_number, status, created_at), order_item:order_items!seller_earnings_order_item_id_fkey(id, product_name, quantity, product_image), store:stores!seller_earnings_store_id_fkey(id, name)',
      { count: 'exact' }
    );

  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status);
  }
  if (params.dateFrom) {
    query = query.gte('created_at', params.dateFrom);
  }
  if (params.dateTo) {
    query = query.lte('created_at', params.dateTo + 'T23:59:59');
  }

  query = query.order('created_at', { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    earnings: (data as unknown as SellerEarning[]) ?? [],
    total: count || 0,
  };
}
