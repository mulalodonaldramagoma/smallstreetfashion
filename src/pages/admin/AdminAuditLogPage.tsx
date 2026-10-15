import { useState, useEffect } from 'react';
import {
  ScrollText,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchAuditLog } from '@/services/adminService';
import type { AdminAuditLog } from '@/types';

export function AdminAuditLogPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 20;

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchAuditLog(page, perPage)
      .then(({ logs, total }) => {
        setLogs(logs);
        setTotal(total);
      })
      .catch((err) => setError('Failed to load audit log'))
      .finally(() => setLoading(false));
  }, [user, page]);

  if (!user) return null;

  const totalPages = Math.ceil(total / perPage);

  const actionLabel = (action: string): string => {
    const labels: Record<string, string> = {
      store_approve: 'Approved Store',
      store_suspend: 'Suspended Store',
      store_reactivate: 'Reactivated Store',
      store_verify: 'Verified Store',
      product_hide: 'Hidden Product',
      product_restore: 'Restored Product',
      category_create: 'Created Category',
      category_update: 'Updated Category',
      category_delete: 'Deleted Category',
    };
    return labels[action] || action;
  };

  const actionColor = (action: string): string => {
    if (action.includes('suspend') || action.includes('hide') || action.includes('delete')) return 'bg-rose-50 text-rose-700';
    if (action.includes('approve') || action.includes('restore') || action.includes('reactivate') || action.includes('verify') || action.includes('create')) return 'bg-green-50 text-green-700';
    return 'bg-neutral-100 text-neutral-700';
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Audit Log</h1>
        <p className="text-sm text-neutral-500">Immutable record of all admin actions</p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-neutral-400" />
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
          <ScrollText size={28} className="text-neutral-300 mx-auto mb-3" />
          <p className="text-sm text-neutral-500">No admin actions recorded yet.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="bg-white border border-neutral-200 rounded-lg p-4 flex items-start gap-3">
                <div className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${actionColor(log.action)}`}>
                  {actionLabel(log.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-neutral-900">{log.target_name || log.target_type}</p>
                    <span className="text-xs text-neutral-400 capitalize">{log.target_type}</span>
                  </div>
                  {log.reason && (
                    <p className="text-xs text-neutral-500 mt-0.5">Reason: {log.reason}</p>
                  )}
                  <p className="text-xs text-neutral-400 mt-1">
                    By {log.actor_profile?.full_name || 'Unknown'} · {new Date(log.created_at).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 disabled:opacity-50 flex items-center gap-1"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="text-sm text-neutral-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 disabled:opacity-50 flex items-center gap-1"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
