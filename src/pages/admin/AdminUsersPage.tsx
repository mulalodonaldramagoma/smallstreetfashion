import { useState, useEffect, useCallback } from 'react';
import {
  Users as UsersIcon,
  Search,
  Loader2,
  AlertCircle,
  Shield,
  ShieldCheck,
  MessageSquare,
  Send,
  X,
  ChevronLeft,
  ChevronRight,
  Store as StoreIcon,
  ShoppingBag,
  Ban,
  CheckCircle2,
  ArrowUpDown,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  fetchAdminUsers,
  adminSetRole,
  adminToggleBan,
  adminMessageUser,
  adminMessageGroup,
  type AdminUserWithDetails,
  type SortOption,
  type StatusFilter,
} from '@/services/adminUserService';

type RoleFilter = 'all' | 'customer' | 'seller' | 'admin';

export function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUserWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortOption>('created_desc');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 15;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailUser, setDetailUser] = useState<AdminUserWithDetails | null>(null);
  const [roleModal, setRoleModal] = useState<{ user: AdminUserWithDetails; role: 'customer' | 'seller' | 'admin' } | null>(null);
  const [banModal, setBanModal] = useState<{ user: AdminUserWithDetails; ban: boolean } | null>(null);
  const [messageModal, setMessageModal] = useState<{ group: boolean } | null>(null);
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchAdminUsers({ search: search.trim() || undefined, role: roleFilter, status: statusFilter, sort, page, perPage })
      .then(({ users, total }) => {
        setUsers(users);
        setTotal(total);
        setLoading(false);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Failed to load users';
        setError(msg);
        setLoading(false);
      });
  }, [search, roleFilter, statusFilter, sort, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, roleFilter, statusFilter, sort]);

  if (!user) return null;

  const totalPages = Math.ceil(total / perPage);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === users.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(users.map((u) => u.id)));
    }
  };

  const handleRoleConfirm = async () => {
    if (!roleModal) return;
    setActionLoading(true);
    try {
      await adminSetRole(roleModal.user.id, roleModal.role);
      setRoleModal(null);
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBanConfirm = async () => {
    if (!banModal) return;
    setActionLoading(true);
    try {
      await adminToggleBan(banModal.user.id, banModal.ban);
      setBanModal(null);
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!user || !messageModal) return;
    if (!msgSubject.trim() || !msgBody.trim()) return;
    setActionLoading(true);
    try {
      if (messageModal.group) {
        const ids = Array.from(selected);
        await adminMessageGroup(ids, user.id, msgSubject.trim(), msgBody.trim());
      } else {
        if (!detailUser) return;
        await adminMessageUser(detailUser.id, user.id, msgSubject.trim(), msgBody.trim());
      }
      setMessageModal(null);
      setMsgSubject('');
      setMsgBody('');
      setSelected(new Set());
      setDetailUser(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const roleBadge = (u: AdminUserWithDetails) => {
    if (u.is_admin) {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-900 text-white font-medium flex items-center gap-1"><Shield size={10} /> Admin</span>;
    }
    if (u.role === 'seller') {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium flex items-center gap-1"><StoreIcon size={10} /> Seller</span>;
    }
    return <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-medium flex items-center gap-1"><ShoppingBag size={10} /> Customer</span>;
  };

  const statusBadge = (u: AdminUserWithDetails) => {
    if (u.banned_until) {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium flex items-center gap-1"><Ban size={10} /> Banned</span>;
    }
    return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium flex items-center gap-1"><CheckCircle2 size={10} /> Active</span>;
  };

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'created_desc', label: 'Newest First' },
    { value: 'created_asc', label: 'Oldest First' },
    { value: 'name_asc', label: 'Name A–Z' },
    { value: 'name_desc', label: 'Name Z–A' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">User Management</h1>
        <p className="text-sm text-neutral-500">Manage accounts, roles, status and send messages</p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700">{error}</p>
        </div>
      )}

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            placeholder="Search by name, email or phone..." />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'customer', 'seller', 'admin'] as RoleFilter[]).map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-2.5 text-xs font-medium rounded-lg transition-colors capitalize ${
                roleFilter === r ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
              }`}>{r}</button>
          ))}
        </div>
      </div>

      {/* Sort + status filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex items-center gap-2">
          <ArrowUpDown size={14} className="text-neutral-400" />
          <select value={sort} onChange={(e) => setSort(e.target.value as SortOption)}
            className="px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900">
            {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex gap-1.5">
          {(['all', 'active', 'banned'] as StatusFilter[]).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors capitalize ${
                statusFilter === s ? 'bg-neutral-700 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
              }`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Group actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3">
          <span className="text-sm text-neutral-600">{selected.size} selected</span>
          <button onClick={() => setMessageModal({ group: true })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors">
            <Send size={12} /> Message All
          </button>
          <button onClick={() => setSelected(new Set())}
            className="text-xs text-neutral-500 hover:text-neutral-700">Clear</button>
        </div>
      )}

      {/* User list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-neutral-400" />
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
          <UsersIcon size={28} className="text-neutral-300 mx-auto mb-3" />
          <p className="text-sm text-neutral-500">No users found.</p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 border-b border-neutral-100 text-xs font-medium text-neutral-500 uppercase tracking-wide">
              <div className="col-span-1 flex items-center gap-2">
                <input type="checkbox" checked={selected.size === users.length && users.length > 0} onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900" />
              </div>
              <div className="col-span-3">Name</div>
              <div className="col-span-3">Email</div>
              <div className="col-span-1">Role</div>
              <div className="col-span-2">Store</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>
            {users.map((u) => (
              <div key={u.id} className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors items-center">
                <div className="col-span-1 hidden md:block">
                  <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleSelect(u.id)}
                    className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900" />
                </div>
                <div className="col-span-12 md:col-span-3">
                  <p className="text-sm font-medium text-neutral-900">{u.full_name || 'Unnamed'}</p>
                  <p className="text-xs text-neutral-400">Joined {new Date(u.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <div className="col-span-6 md:col-span-3">
                  <p className="text-sm text-neutral-600 truncate">{u.email || '—'}</p>
                </div>
                <div className="col-span-3 md:col-span-1">{roleBadge(u)}</div>
                <div className="col-span-3 md:col-span-2">
                  {u.store ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs text-neutral-600 truncate">{u.store.name}</span>
                      {!u.store.is_active && <span className="text-xs text-rose-600 shrink-0">Suspended</span>}
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-400">—</span>
                  )}
                </div>
                <div className="col-span-3 md:col-span-1">{statusBadge(u)}</div>
                <div className="col-span-12 md:col-span-1 flex md:justify-end gap-1">
                  <button onClick={() => setDetailUser(u)} className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors" title="View details">
                    <UsersIcon size={14} />
                  </button>
                  <button onClick={() => setDetailUser(u)} className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors" title="Send message">
                    <MessageSquare size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-neutral-500">Page {page} of {totalPages} · {total} users</p>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-2 border border-neutral-200 rounded-lg text-neutral-600 hover:bg-neutral-50 disabled:opacity-30 transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-2 border border-neutral-200 rounded-lg text-neutral-600 hover:bg-neutral-50 disabled:opacity-30 transition-colors">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* User detail modal */}
      {detailUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetailUser(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-neutral-900">{detailUser.full_name || 'Unnamed'}</h3>
                <p className="text-sm text-neutral-500">{detailUser.email}</p>
              </div>
              <button onClick={() => setDetailUser(null)} className="p-1 text-neutral-400 hover:text-neutral-900">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500">Role</span>
                {roleBadge(detailUser)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500">Status</span>
                {statusBadge(detailUser)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500">Phone</span>
                <span className="text-sm text-neutral-900">{detailUser.phone || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500">Joined</span>
                <span className="text-sm text-neutral-900">{new Date(detailUser.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500">Orders</span>
                <span className="text-sm text-neutral-900">{detailUser.order_count || 0}</span>
              </div>
              {detailUser.store && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-500">Store</span>
                  <div className="text-right">
                    <p className="text-sm text-neutral-900">{detailUser.store.name}</p>
                    <p className="text-xs text-neutral-400">{detailUser.store.is_active ? 'Active' : 'Suspended'} · {detailUser.store.is_verified ? 'Verified' : 'Unverified'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Role management */}
            <div className="border-t border-neutral-100 pt-4 mb-4">
              <p className="text-xs font-medium text-neutral-500 uppercase mb-2">Set Role</p>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setRoleModal({ user: detailUser, role: 'customer' })}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center justify-center gap-1 ${detailUser.role === 'customer' && !detailUser.is_admin ? 'border-neutral-900 bg-neutral-50 text-neutral-900' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}>
                  <ShoppingBag size={12} /> Customer
                </button>
                <button onClick={() => setRoleModal({ user: detailUser, role: 'seller' })}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center justify-center gap-1 ${detailUser.role === 'seller' && !detailUser.is_admin ? 'border-neutral-900 bg-neutral-50 text-neutral-900' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}>
                  <StoreIcon size={12} /> Seller
                </button>
                <button onClick={() => setRoleModal({ user: detailUser, role: 'admin' })}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center justify-center gap-1 ${detailUser.is_admin ? 'border-neutral-900 bg-neutral-50 text-neutral-900' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}>
                  <Shield size={12} /> Admin
                </button>
              </div>
            </div>

            {/* Account status management */}
            {!detailUser.is_admin && detailUser.id !== user.id && (
              <div className="border-t border-neutral-100 pt-4 mb-4">
                <p className="text-xs font-medium text-neutral-500 uppercase mb-2">Account Status</p>
                {detailUser.banned_until ? (
                  <button onClick={() => setBanModal({ user: detailUser, ban: false })}
                    className="w-full px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                    <CheckCircle2 size={16} /> Unban User
                  </button>
                ) : (
                  <button onClick={() => setBanModal({ user: detailUser, ban: true })}
                    className="w-full px-4 py-2.5 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 transition-colors flex items-center justify-center gap-2">
                    <Ban size={16} /> Ban User
                  </button>
                )}
              </div>
            )}

            <button onClick={() => setMessageModal({ group: false })}
              className="w-full px-4 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2">
              <MessageSquare size={16} /> Send Message
            </button>
          </div>
        </div>
      )}

      {/* Role confirmation modal */}
      {roleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRoleModal(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-2 mb-3">
              {roleModal.role === 'admin' ? <ShieldCheck size={20} className="text-neutral-900" /> : roleModal.role === 'seller' ? <StoreIcon size={20} className="text-neutral-900" /> : <ShoppingBag size={20} className="text-neutral-900" />}
              <h3 className="font-bold text-neutral-900">Change Role to {roleModal.role}</h3>
            </div>
            <p className="text-sm text-neutral-500 mb-1">User: <span className="font-medium text-neutral-900">{roleModal.user.full_name || roleModal.user.email}</span></p>
            {roleModal.role === 'admin' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-amber-700">This will grant full administrative access to this user, including store management, order oversight and financial reconciliation.</p>
              </div>
            )}
            {roleModal.role === 'customer' && roleModal.user.is_admin && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-rose-700">This will revoke admin privileges from this user.</p>
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRoleModal(null)}
                className="px-5 py-2.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors">Cancel</button>
              <button onClick={handleRoleConfirm} disabled={actionLoading}
                className="flex-1 px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {actionLoading && <Loader2 size={16} className="animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban confirmation modal */}
      {banModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setBanModal(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-2 mb-3">
              <Ban size={20} className={banModal.ban ? 'text-rose-600' : 'text-green-600'} />
              <h3 className="font-bold text-neutral-900">{banModal.ban ? 'Ban User' : 'Unban User'}</h3>
            </div>
            <p className="text-sm text-neutral-500 mb-1">User: <span className="font-medium text-neutral-900">{banModal.user.full_name || banModal.user.email}</span></p>
            {banModal.ban ? (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-rose-700">This user will be prevented from signing in. They can be unbanned at any time.</p>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-green-700">This user will be able to sign in again immediately.</p>
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setBanModal(null)}
                className="px-5 py-2.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors">Cancel</button>
              <button onClick={handleBanConfirm} disabled={actionLoading}
                className={`flex-1 px-5 py-2.5 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${banModal.ban ? 'bg-rose-600 hover:bg-rose-700' : 'bg-green-600 hover:bg-green-700'}`}>
                {actionLoading && <Loader2 size={16} className="animate-spin" />}
                {banModal.ban ? 'Ban User' : 'Unban User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message modal */}
      {messageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setMessageModal(null); setMsgSubject(''); setMsgBody(''); }} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-2 mb-4">
              <Send size={20} className="text-neutral-900" />
              <h3 className="font-bold text-neutral-900">
                {messageModal.group ? `Message ${selected.size} Users` : 'Send Message'}
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Subject</label>
                <input type="text" required value={msgSubject} onChange={(e) => setMsgSubject(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Message</label>
                <textarea required value={msgBody} onChange={(e) => setMsgBody(e.target.value)} rows={4}
                  className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setMessageModal(null); setMsgSubject(''); setMsgBody(''); }}
                className="px-5 py-2.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors">Cancel</button>
              <button onClick={handleSendMessage} disabled={actionLoading || !msgSubject.trim() || !msgBody.trim()}
                className="flex-1 px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {actionLoading && <Loader2 size={16} className="animate-spin" />}
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
