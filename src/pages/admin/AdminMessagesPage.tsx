import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Users,
  Search,
  Loader2,
  AlertCircle,
  Check,
  X,
  Megaphone,
  Mail,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotificationBadge } from '@/context/NotificationBadgeContext';
import {
  fetchConversations,
  createConversation,
  fetchUsersForMessaging,
  updateConversationStatus,
} from '@/services/messagingService';
import { navigateTo } from '@/hooks/useRouter';
import type { ConversationWithDetails, ConversationStatus, Profile } from '@/types';

type AdminTab = 'inbox' | 'compose';

export function AdminMessagesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<AdminTab>('inbox');

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-neutral-900 rounded-lg flex items-center justify-center">
          <MessageSquare size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Messages</h1>
          <p className="text-sm text-neutral-500">Manage conversations and send announcements</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-neutral-200">
        <button
          onClick={() => setTab('inbox')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'inbox' ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Inbox
        </button>
        <button
          onClick={() => setTab('compose')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            tab === 'compose' ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          <Megaphone size={15} />
          Compose
        </button>
      </div>

      {tab === 'inbox' ? <AdminInbox /> : <ComposeTab />}
    </div>
  );
}

function AdminInbox() {
  const { user } = useAuth();
  const { refresh } = useNotificationBadge();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | 'all'>('all');

  const load = useCallback(() => {
    setLoading(true);
    fetchConversations({
      status: statusFilter,
      search: search.trim() || undefined,
      page: 1,
      perPage: 50,
    })
      .then(({ conversations }) => {
        setConversations(conversations);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load conversations');
        setLoading(false);
      });
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (convId: string, status: ConversationStatus) => {
    try {
      await updateConversationStatus(convId, status);
      load();
      refresh();
    } catch {
      setError('Failed to update conversation status');
    }
  };

  const otherParticipant = (conv: ConversationWithDetails) =>
    conv.participants.find((p) => p.user_id !== user?.id);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            placeholder="Search by subject..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ConversationStatus | 'all')}
          className="px-3 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-neutral-400" />
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3 mb-4">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700">{error}</p>
        </div>
      )}

      {!loading && conversations.length === 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center">
          <p className="text-sm text-neutral-500">No conversations found.</p>
        </div>
      )}

      {!loading && conversations.length > 0 && (
        <div className="space-y-2">
          {conversations.map((conv) => {
            const other = otherParticipant(conv);
            const isUnread = (conv.unread_count || 0) > 0;
            return (
              <div
                key={conv.id}
                onClick={() => navigateTo(`/messages`)}
                className={`bg-white border rounded-xl p-4 cursor-pointer transition-all hover:shadow-sm ${
                  isUnread ? 'border-neutral-300 bg-neutral-50/50' : 'border-neutral-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${isUnread ? 'font-semibold text-neutral-900' : 'font-medium text-neutral-700'}`}>
                      {conv.subject}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {other?.profile?.full_name || 'Unknown'} · {conv.category.replace('_', ' ')}
                    </p>
                    {conv.last_message && (
                      <p className="text-xs text-neutral-400 mt-1 truncate">
                        {conv.last_message.body}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isUnread && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                        {conv.unread_count} unread
                      </span>
                    )}
                    <select
                      value={conv.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => { e.stopPropagation(); handleStatusChange(conv.id, e.target.value as ConversationStatus); }}
                      className="text-xs border border-neutral-200 rounded-lg px-2 py-1 text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    >
                      <option value="open">Open</option>
                      <option value="pending">Pending</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ComposeTab() {
  const { user } = useAuth();
  const [recipientType, setRecipientType] = useState<'individual' | 'customers' | 'sellers' | 'all'>('individual');
  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userList, setUserList] = useState<Pick<Profile, 'id' | 'full_name'>[]>([]);
  const [searching, setSearching] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<string>('general');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (recipientType !== 'individual') return;
    if (search.length < 2) {
      setUserList([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      fetchUsersForMessaging({ search })
        .then((users) => {
          setUserList(users.filter((u) => u.id !== user?.id));
          setSearching(false);
        })
        .catch(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search, recipientType, user]);

  const recipientCount = recipientType === 'individual'
    ? selectedUsers.length
    : recipientType === 'all' ? 'all users' : `all ${recipientType}`;

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;
    if (recipientType === 'individual' && selectedUsers.length === 0) {
      setError('Please select at least one recipient');
      return;
    }

    if (recipientType === 'individual') {
      setSending(true);
      setError(null);
      try {
        for (const recipientId of selectedUsers) {
          await createConversation({
            subject: subject.trim(),
            body: body.trim(),
            category: category as any,
            participantIds: [recipientId],
          });
        }
        setSuccess(`Sent to ${selectedUsers.length} recipient${selectedUsers.length > 1 ? 's' : ''}.`);
        setSubject(''); setBody(''); setSelectedUsers([]);
      } catch {
        setError('Failed to send message');
      } finally {
        setSending(false);
        setShowConfirm(false);
      }
    } else {
      // Bulk: fetch all users of the role and send individually
      setShowConfirm(true);
    }
  };

  const confirmBulkSend = async () => {
    setSending(true);
    setError(null);
    setShowConfirm(false);
    try {
      const role = recipientType === 'customers' ? 'customer' : recipientType === 'sellers' ? 'seller' : 'all';
      const users = await fetchUsersForMessaging({ role: role as any });
      let count = 0;
      for (const u of users) {
        if (u.id === user?.id) continue;
        try {
          await createConversation({
            subject: subject.trim(),
            body: body.trim(),
            category: category as any,
            participantIds: [u.id],
          });
          count++;
        } catch { /* continue on individual failures */ }
      }
      setSuccess(`Sent to ${count} ${recipientType}.`);
      setSubject(''); setBody('');
    } catch {
      setError('Failed to send bulk messages');
    } finally {
      setSending(false);
    }
  };

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    );
  };

  return (
    <div className="max-w-2xl">
      {success && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
          <Check size={16} className="text-green-600" />
          <p className="text-xs text-green-700">{success}</p>
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-600"><X size={14} /></button>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700">{error}</p>
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-xl p-6 space-y-5">
        {/* Recipient type */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">Recipients</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { key: 'individual' as const, label: 'Individual', icon: Mail },
              { key: 'customers' as const, label: 'All Customers', icon: Users },
              { key: 'sellers' as const, label: 'All Sellers', icon: Users },
              { key: 'all' as const, label: 'Everyone', icon: Megaphone },
            ].map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  onClick={() => { setRecipientType(opt.key); setSelectedUsers([]); }}
                  className={`px-3 py-2.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 justify-center ${
                    recipientType === opt.key
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <Icon size={14} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Individual user search */}
        {recipientType === 'individual' && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Search Users</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              placeholder="Search by name..."
            />
            {searching && <p className="text-xs text-neutral-400 mt-1">Searching...</p>}
            {!searching && search.length >= 2 && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {userList.length === 0 ? (
                  <p className="text-xs text-neutral-400 p-2">No users found.</p>
                ) : (
                  userList.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => toggleUser(u.id)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-between ${
                        selectedUsers.includes(u.id)
                          ? 'bg-neutral-900 text-white'
                          : 'text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      {u.full_name || 'Unknown'}
                      {selectedUsers.includes(u.id) && <Check size={14} />}
                    </button>
                  ))
                )}
              </div>
            )}
            {selectedUsers.length > 0 && (
              <p className="text-xs text-neutral-600 mt-2">{selectedUsers.length} selected</p>
            )}
          </div>
        )}

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
          >
            <option value="general">General</option>
            <option value="order_update">Order Update</option>
            <option value="promotion">Promotion</option>
            <option value="important_notice">Important Notice</option>
            <option value="system_alert">System Alert</option>
            <option value="support">Support</option>
          </select>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Subject *</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            placeholder="Message subject..."
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Message *</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
            placeholder="Type your message..."
          />
        </div>

        {/* Preview */}
        {subject && body && (
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
            <p className="text-xs text-neutral-400 mb-2">Preview</p>
            <p className="text-sm font-semibold text-neutral-900">{subject}</p>
            <p className="text-sm text-neutral-600 mt-1">{body}</p>
            <p className="text-xs text-neutral-400 mt-2">Recipients: {recipientCount}</p>
          </div>
        )}

        {/* Send */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-400">
            Will send to <span className="font-medium text-neutral-600">{recipientCount}</span>
          </p>
          <button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !body.trim()}
            className="px-6 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {recipientType === 'individual' ? 'Send Message' : 'Send to All'}
          </button>
        </div>
      </div>

      {/* Bulk confirm dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-2 mb-3">
              <Megaphone size={20} className="text-neutral-900" />
              <h3 className="font-bold text-neutral-900">Confirm Bulk Send</h3>
            </div>
            <p className="text-sm text-neutral-500 mb-4">
              This will send a separate message to {recipientCount}. Each user will receive
              an individual conversation. Are you sure?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-5 py-2.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkSend}
                className="flex-1 px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
              >
                <Send size={16} />
                Confirm & Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
