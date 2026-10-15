import { useState, useEffect } from 'react';
import {
  Store as StoreIcon,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  Loader2,
  AlertCircle,
  BadgeCheck,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchAdminStores, updateStoreStatus } from '@/services/adminService';
import { formatPrice } from '@/utils/format';
import type { AdminStoreWithSeller } from '@/types';

export function AdminStoresPage() {
  const { user } = useAuth();
  const [stores, setStores] = useState<AdminStoreWithSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionModal, setActionModal] = useState<{ store: AdminStoreWithSeller; action: 'approve' | 'suspend' | 'reactivate' | 'verify' } | null>(null);
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);

  const loadStores = () => {
    setLoading(true);
    fetchAdminStores()
      .then(setStores)
      .catch((err) => setError('Failed to load stores'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) loadStores();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const filtered = stores.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.location.toLowerCase().includes(q) || (s.seller_profile?.full_name?.toLowerCase().includes(q) ?? false);
  });

  const handleConfirm = async () => {
    if (!actionModal || !user) return;
    setActing(true);
    try {
      const { store, action } = actionModal;
      if (action === 'approve') {
        await updateStoreStatus(store.id, { is_active: true, is_verified: true }, user.id, 'store_approve', reason);
      } else if (action === 'suspend') {
        await updateStoreStatus(store.id, { is_active: false }, user.id, 'store_suspend', reason);
      } else if (action === 'reactivate') {
        await updateStoreStatus(store.id, { is_active: true }, user.id, 'store_reactivate', reason);
      } else if (action === 'verify') {
        await updateStoreStatus(store.id, { is_verified: true }, user.id, 'store_verify', reason);
      }
      setActionModal(null);
      setReason('');
      loadStores();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setError(msg);
    } finally {
      setActing(false);
    }
  };

  const actionLabel = actionModal?.action === 'approve' ? 'Approve & Activate' : actionModal?.action === 'suspend' ? 'Suspend Store' : actionModal?.action === 'reactivate' ? 'Reactivate Store' : 'Verify Store';
  const actionDesc = actionModal?.action === 'suspend'
    ? 'Suspending a store hides it from the marketplace. The seller account and all orders remain intact.'
    : actionModal?.action === 'approve'
    ? 'Approving a store marks it as verified and activates it so it appears in the marketplace.'
    : actionModal?.action === 'reactivate'
    ? 'Reactivating a store makes it visible again in the marketplace.'
    : 'Verifying a store confirms it as a legitimate seller. The store remains visible.';

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Stores & Sellers</h1>
        <p className="text-sm text-neutral-500">Review, approve, suspend, and reactivate stores</p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700">{error}</p>
        </div>
      )}

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
          placeholder="Search by store name, location, or seller..."
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-neutral-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
          <p className="text-sm text-neutral-500">No stores found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((store) => (
            <div key={store.id} className="bg-white border border-neutral-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                    {store.logo_url ? (
                      <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <StoreIcon size={20} className="text-neutral-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-neutral-900 truncate">{store.name}</p>
                      {store.is_verified ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium flex items-center gap-1">
                          <BadgeCheck size={10} /> Verified
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                          Unverified
                        </span>
                      )}
                      {!store.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium">
                          Suspended
                        </span>
                      )}
                      {store.is_demo && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 font-medium">
                          Demo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">{store.location}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Seller: {store.seller_profile?.full_name || 'Unlinked'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!store.is_active ? (
                    <button
                      onClick={() => { setActionModal({ store, action: 'reactivate' }); setReason(''); }}
                      className="px-3 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                    >
                      <Play size={12} /> Reactivate
                    </button>
                  ) : (
                    <button
                      onClick={() => { setActionModal({ store, action: 'suspend' }); setReason(''); }}
                      className="px-3 py-2 border border-rose-200 text-rose-600 text-xs font-medium rounded-lg hover:bg-rose-50 transition-colors flex items-center gap-1"
                    >
                      <Pause size={12} /> Suspend
                    </button>
                  )}
                  {!store.is_verified && store.is_active && (
                    <button
                      onClick={() => { setActionModal({ store, action: 'verify' }); setReason(''); }}
                      className="px-3 py-2 border border-neutral-200 text-neutral-700 text-xs font-medium rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-1"
                    >
                      <BadgeCheck size={12} /> Verify
                    </button>
                  )}
                  {!store.is_active && !store.is_verified && (
                    <button
                      onClick={() => { setActionModal({ store, action: 'approve' }); setReason(''); }}
                      className="px-3 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors flex items-center gap-1"
                    >
                      <CheckCircle2 size={12} /> Approve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setActionModal(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert size={20} className="text-neutral-900" />
              <h3 className="font-bold text-neutral-900">{actionLabel}</h3>
            </div>
            <p className="text-sm text-neutral-500 mb-2">{actionDesc}</p>
            <p className="text-sm font-medium text-neutral-900 mb-4">{actionModal.store.name}</p>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Reason (recommended)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none mb-4"
              placeholder="e.g. Store verification documents confirmed"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setActionModal(null)}
                className="px-5 py-2.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={acting}
                className="flex-1 px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {acting ? <Loader2 size={16} className="animate-spin" /> : null}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
