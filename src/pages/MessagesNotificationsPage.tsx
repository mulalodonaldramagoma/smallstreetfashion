import { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  MessageSquare,
  Search,
  Check,
  CheckCheck,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Package,
  CreditCard,
  Truck,
  Store,
  ShoppingBag,
  Settings,
  User,
  AlertCircle,
  Loader2,
  Mail,
  MailOpen,
  Send,
  ArrowLeft,
  X,
  Filter,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotificationBadge } from '@/context/NotificationBadgeContext';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  fetchNotificationPreferences,
  upsertNotificationPreferences,
} from '@/services/notificationCentreService';
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  markConversationRead,
  createConversation,
  updateConversationStatus,
} from '@/services/messagingService';
import { navigateTo } from '@/hooks/useRouter';
import { formatPrice } from '@/utils/format';
import type {
  AppNotification,
  NotificationCategory,
  ConversationWithDetails,
  Message,
  ConversationStatus,
  NotificationPreferences,
  Profile,
} from '@/types';

type Tab = 'notifications' | 'messages' | 'preferences';
type NotifFilter = 'all' | 'unread' | NotificationCategory;
type ConvFilter = 'all' | 'unread' | ConversationStatus;

const NOTIF_FILTERS: { key: NotifFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'order', label: 'Orders' },
  { key: 'payment', label: 'Payments' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'store', label: 'Stores' },
  { key: 'product', label: 'Products' },
  { key: 'message', label: 'Messages' },
  { key: 'system', label: 'System' },
  { key: 'account', label: 'Account' },
];

const CONV_FILTERS: { key: ConvFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'open', label: 'Open' },
  { key: 'pending', label: 'Pending' },
  { key: 'resolved', label: 'Resolved' },
];

function categoryIcon(category: NotificationCategory) {
  switch (category) {
    case 'order': return <ShoppingBag size={16} />;
    case 'payment': return <CreditCard size={16} />;
    case 'delivery': return <Truck size={16} />;
    case 'store': return <Store size={16} />;
    case 'product': return <Package size={16} />;
    case 'message': return <MessageSquare size={16} />;
    case 'system': return <AlertCircle size={16} />;
    case 'account': return <User size={16} />;
  }
}

function categoryColor(category: NotificationCategory) {
  switch (category) {
    case 'order': return 'bg-blue-50 text-blue-600';
    case 'payment': return 'bg-green-50 text-green-600';
    case 'delivery': return 'bg-amber-50 text-amber-600';
    case 'store': return 'bg-purple-50 text-purple-600';
    case 'product': return 'bg-teal-50 text-teal-600';
    case 'message': return 'bg-neutral-100 text-neutral-600';
    case 'system': return 'bg-rose-50 text-rose-600';
    case 'account': return 'bg-neutral-100 text-neutral-600';
  }
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

// --- Notification List Component ---

function NotificationList() {
  const { refresh } = useNotificationBadge();
  const [filter, setFilter] = useState<NotifFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const perPage = 10;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchNotifications({ category: filter === 'unread' ? 'all' : filter, unreadOnly: filter === 'unread', search: search.trim() || undefined, page, perPage })
      .then(({ notifications, total }) => {
        setNotifications(notifications);
        setTotal(total);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load notifications');
        setLoading(false);
      });
  }, [filter, search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filter, search]);

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      load();
      refresh();
    } catch {
      setError('Failed to mark all as read');
    }
  };

  const handleNotifClick = async (notif: AppNotification) => {
    if (!notif.is_read) {
      setMarkingRead(notif.id);
      try {
        await markNotificationRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notif.id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
          )
        );
        if (filter === 'unread') {
          setTotal((prev) => Math.max(0, prev - 1));
        }
        refresh();
      } catch {
        setError('Failed to mark notification as read');
      } finally {
        setMarkingRead(null);
      }
    }
    if (notif.action_url) {
      navigateTo(notif.action_url);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      load();
      refresh();
    } catch {
      setError('Failed to delete notification');
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      {/* Search + Mark all read */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            placeholder="Search notifications..."
          />
        </div>
        <button
          onClick={handleMarkAll}
          className="px-3 py-2.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
        >
          <CheckCheck size={16} />
          <span className="hidden sm:inline">Mark all read</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {NOTIF_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              filter === f.key
                ? 'bg-neutral-900 text-white'
                : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-neutral-400" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3 mb-4">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700">{error}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && notifications.length === 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center">
          <div className="w-14 h-14 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell size={24} className="text-neutral-300" />
          </div>
          <p className="text-sm font-medium text-neutral-900 mb-1">No notifications</p>
          <p className="text-xs text-neutral-500">You're all caught up. New notifications will appear here.</p>
        </div>
      )}

      {/* Notification list */}
      {!loading && !error && notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotifClick(notif)}
              className={`bg-white border rounded-xl p-4 flex items-start gap-3 cursor-pointer transition-all hover:shadow-sm ${
                notif.is_read ? 'border-neutral-200' : 'border-neutral-300 bg-neutral-50/50'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${categoryColor(notif.category)}`}>
                {categoryIcon(notif.category)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-sm ${notif.is_read ? 'font-medium text-neutral-700' : 'font-semibold text-neutral-900'}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{notif.body}</p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(notif.id, e)}
                    className="p-1.5 text-neutral-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  {!notif.is_read && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  )}
                  <span className="text-xs text-neutral-400">{timeAgo(notif.created_at)}</span>
                  {notif.action_url && (
                    <span className="text-xs text-neutral-400">·</span>
                  )}
                  {notif.action_url && (
                    <span className="text-xs text-blue-500">View</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
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
    </div>
  );
}

// --- Conversation List + Chat View ---

function MessagesTab() {
  const { user, profile, isAdmin } = useAuth();
  const { refresh } = useNotificationBadge();
  const [filter, setFilter] = useState<ConvFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedConv, setSelectedConv] = useState<ConversationWithDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewConv, setShowNewConv] = useState(false);
  const perPage = 10;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchConversations({
      status: filter === 'unread' ? 'all' : filter,
      search: search.trim() || undefined,
      page,
      perPage,
    })
      .then(({ conversations, total }) => {
        setConversations(conversations);
        setTotal(total);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load conversations');
        setLoading(false);
      });
  }, [filter, search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filter, search]);

  const openConversation = async (conv: ConversationWithDetails) => {
    setSelectedConv(conv);
    setMsgLoading(true);
    try {
      const msgs = await fetchMessages(conv.id);
      setMessages(msgs);
      await markConversationRead(conv.id);
      refresh();
    } catch {
      setError('Failed to load messages');
    } finally {
      setMsgLoading(false);
    }
  };

  const handleSend = async () => {
    if (!selectedConv || !replyText.trim()) return;
    setSending(true);
    try {
      const msg = await sendMessage(selectedConv.id, replyText.trim());
      setMessages((prev) => [...prev, msg]);
      setReplyText('');
      await markConversationRead(selectedConv.id);
      refresh();
    } catch {
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (status: ConversationStatus) => {
    if (!selectedConv) return;
    try {
      await updateConversationStatus(selectedConv.id, status);
      setSelectedConv({ ...selectedConv, status });
      load();
    } catch {
      setError('Failed to update status');
    }
  };

  const totalPages = Math.ceil(total / perPage);
  const otherParticipant = (conv: ConversationWithDetails) =>
    conv.participants.find((p) => p.user_id !== user?.id);
  const displayName = (conv: ConversationWithDetails) => {
    const other = otherParticipant(conv);
    return other?.profile?.full_name || 'Unknown';
  };

  // New conversation form
  if (showNewConv) {
    return (
      <NewConversationForm
        onCancel={() => setShowNewConv(false)}
        onCreated={() => { setShowNewConv(false); load(); refresh(); }}
      />
    );
  }

  // Chat view (selected conversation)
  if (selectedConv) {
    return (
      <ChatView
        conversation={selectedConv}
        messages={messages}
        loading={msgLoading}
        replyText={replyText}
        setReplyText={setReplyText}
        onSend={handleSend}
        sending={sending}
        onBack={() => { setSelectedConv(null); setMessages([]); }}
        onStatusChange={handleStatusChange}
        isAdmin={isAdmin}
        currentUserId={user?.id || ''}
      />
    );
  }

  return (
    <div>
      {/* Search + New conversation */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            placeholder="Search conversations..."
          />
        </div>
        <button
          onClick={() => setShowNewConv(true)}
          className="px-3 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors flex items-center gap-1.5 whitespace-nowrap"
        >
          <MessageSquare size={16} />
          <span className="hidden sm:inline">New</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {CONV_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              filter === f.key
                ? 'bg-neutral-900 text-white'
                : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {f.label}
          </button>
        ))}
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

      {!loading && !error && conversations.length === 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center">
          <div className="w-14 h-14 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare size={24} className="text-neutral-300" />
          </div>
          <p className="text-sm font-medium text-neutral-900 mb-1">No conversations</p>
          <p className="text-xs text-neutral-500">
            {isAdmin ? 'Start a conversation with a customer or seller.' : 'Need help? Start a conversation with our support team.'}
          </p>
        </div>
      )}

      {!loading && !error && conversations.length > 0 && (
        <div className="space-y-2">
          {conversations.map((conv) => {
            const isUnread = (conv.unread_count || 0) > 0;
            const lastMsg = conv.last_message;
            const lastMsgSender = lastMsg
              ? (lastMsg.sender_id === user?.id ? 'You' : (lastMsg.sender_profile?.full_name || 'Them'))
              : '';
            return (
              <div
                key={conv.id}
                onClick={() => openConversation(conv)}
                className={`bg-white border rounded-xl p-4 cursor-pointer transition-all hover:shadow-sm ${
                  isUnread ? 'border-neutral-300 bg-neutral-50/50' : 'border-neutral-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                    <MessageSquare size={16} className="text-neutral-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${isUnread ? 'font-semibold text-neutral-900' : 'font-medium text-neutral-700'}`}>
                        {conv.subject}
                      </p>
                      <span className="text-xs text-neutral-400 shrink-0">{timeAgo(conv.updated_at)}</span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {displayName(conv)} · {conv.category.replace('_', ' ')}
                    </p>
                    {lastMsg && (
                      <p className="text-xs text-neutral-400 mt-1 truncate">
                        {lastMsgSender}: {lastMsg.body}
                      </p>
                    )}
                  </div>
                  {isUnread && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 border border-neutral-200 rounded-lg text-neutral-600 hover:bg-neutral-50 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-neutral-600">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 border border-neutral-200 rounded-lg text-neutral-600 hover:bg-neutral-50 disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// --- Chat View ---

function ChatView({
  conversation,
  messages,
  loading,
  replyText,
  setReplyText,
  onSend,
  sending,
  onBack,
  onStatusChange,
  isAdmin,
  currentUserId,
}: {
  conversation: ConversationWithDetails;
  messages: Message[];
  loading: boolean;
  replyText: string;
  setReplyText: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  onBack: () => void;
  onStatusChange: (status: ConversationStatus) => void;
  isAdmin: boolean;
  currentUserId: string;
}) {
  const otherParticipant = conversation.participants.find((p) => p.user_id !== currentUserId);

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="bg-white border border-neutral-200 rounded-t-xl p-4 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-900 truncate">{conversation.subject}</p>
          <p className="text-xs text-neutral-500">
            {otherParticipant?.profile?.full_name || 'Unknown'} · {conversation.category.replace('_', ' ')}
          </p>
        </div>
        {isAdmin && (
          <select
            value={conversation.status}
            onChange={(e) => onStatusChange(e.target.value as ConversationStatus)}
            className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900"
          >
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
          </select>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-neutral-50 border-x border-neutral-200 px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-neutral-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-neutral-400">No messages yet. Start the conversation below.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  isOwn ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-900'
                }`}>
                  {!isOwn && msg.sender_profile?.full_name && (
                    <p className="text-xs font-semibold text-neutral-500 mb-0.5">{msg.sender_profile.full_name}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                  <p className={`text-xs mt-1 ${isOwn ? 'text-neutral-400' : 'text-neutral-400'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply */}
      <div className="bg-white border border-neutral-200 rounded-b-xl p-3 flex items-center gap-2">
        <input
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !sending) onSend(); }}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2.5 bg-neutral-100 border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all"
          disabled={sending}
        />
        <button
          onClick={onSend}
          disabled={sending || !replyText.trim()}
          className="p-2.5 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-30"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}

// --- New Conversation Form ---

function NewConversationForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const { user, isAdmin } = useAuth();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Pick<Profile, 'id' | 'full_name'>[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin || recipientSearch.length < 2) return;
    setSearching(true);
    const timer = setTimeout(() => {
      import('@/services/messagingService').then(({ fetchUsersForMessaging }) => {
        fetchUsersForMessaging({ search: recipientSearch })
          .then((users) => {
            setRecipients(users.filter((u) => u.id !== user?.id));
            setSearching(false);
          })
          .catch(() => setSearching(false));
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [recipientSearch, isAdmin, user]);

  const handleCreate = async () => {
    if (!subject.trim() || !body.trim()) return;
    if (isAdmin && !selectedRecipient) {
      setError('Please select a recipient');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const { createConversation } = await import('@/services/messagingService');
      const participantIds = isAdmin && selectedRecipient ? [selectedRecipient] : [];
      await createConversation({
        subject: subject.trim(),
        body: body.trim(),
        participantIds,
      });
      onCreated();
    } catch {
      setError('Failed to start conversation');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onCancel} className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-lg font-bold text-neutral-900">New Conversation</h2>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-6 space-y-4">
        {isAdmin && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Recipient *</label>
            <input
              value={recipientSearch}
              onChange={(e) => { setRecipientSearch(e.target.value); setSelectedRecipient(null); }}
              className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              placeholder="Search by name..."
            />
            {searching && <p className="text-xs text-neutral-400 mt-1">Searching...</p>}
            {!searching && recipientSearch.length >= 2 && !selectedRecipient && (
              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {recipients.length === 0 ? (
                  <p className="text-xs text-neutral-400 p-2">No users found.</p>
                ) : (
                  recipients.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => { setSelectedRecipient(r.id); setRecipientSearch(r.full_name || 'Unknown'); }}
                      className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 rounded-lg transition-colors"
                    >
                      {r.full_name || 'Unknown'}
                    </button>
                  ))
                )}
              </div>
            )}
            {selectedRecipient && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <Check size={12} /> Recipient selected
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Subject *</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            placeholder="e.g. Question about my order"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Message *</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
            placeholder="Type your message..."
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3">
            <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-700">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 border border-neutral-200 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !subject.trim() || !body.trim() || (isAdmin && !selectedRecipient)}
            className="flex-1 px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Start Conversation
          </button>
        </div>
      </div>
      {!isAdmin && (
        <p className="text-xs text-neutral-400 mt-3">
          Your message will be sent to the Small Street Fashion support team.
        </p>
      )}
    </div>
  );
}

// --- Notification Preferences ---

const PREF_CATEGORIES: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'order_updates', label: 'Order Updates', description: 'New orders, cancellations, and status changes' },
  { key: 'delivery_updates', label: 'Delivery Updates', description: 'Dispatch, tracking, and delivery status' },
  { key: 'payment_updates', label: 'Payment Updates', description: 'Payment confirmation and transaction alerts' },
  { key: 'messages', label: 'Messages', description: 'New messages from admin or other users' },
  { key: 'store_updates', label: 'Store Updates', description: 'Store approval, suspension, and status changes' },
  { key: 'product_updates', label: 'Product Updates', description: 'Product moderation actions by admin' },
  { key: 'promotions', label: 'Promotions', description: 'Special offers and promotional announcements' },
  { key: 'system_alerts', label: 'System Alerts', description: 'Important system-wide notices' },
];

function makeDefaultPreferences(): NotificationPreferences {
  return {
    id: '',
    user_id: '',
    order_updates: true,
    delivery_updates: true,
    payment_updates: true,
    messages: true,
    store_updates: true,
    product_updates: true,
    promotions: false,
    system_alerts: true,
    updated_at: new Date().toISOString(),
  };
}

function PreferencesTab() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchNotificationPreferences()
      .then((data) => {
        setPrefs(data ?? makeDefaultPreferences());
        setLoading(false);
      })
      .catch(() => { setError('Failed to load preferences'); setLoading(false); });
  }, []);

  const handleToggle = (key: keyof NotificationPreferences) => {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: !prefs[key] });
    setSaved(false);
  };

  const handleSave = async () => {
    if (!prefs) return;
    setSaving(true);
    setError(null);
    try {
      const { id, user_id, updated_at, ...rest } = prefs;
      void id; void user_id; void updated_at;
      await upsertNotificationPreferences(rest);
      setSaved(true);
      setSaving(false);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save preferences');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3 mb-4">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700">{error}</p>
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100">
        {PREF_CATEGORIES.map((cat) => (
          <div key={cat.key} className="flex items-center justify-between p-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900">{cat.label}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{cat.description}</p>
            </div>
            <button
              onClick={() => handleToggle(cat.key)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ml-4 ${
                prefs?.[cat.key] ? 'bg-neutral-900' : 'bg-neutral-200'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                prefs?.[cat.key] ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Save Preferences
        </button>
        {saved && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <Check size={14} /> Saved
          </span>
        )}
      </div>
    </div>
  );
}

// --- Main Page ---

export function MessagesNotificationsPage() {
  const { user } = useAuth();
  const { unreadCount, unreadMessages } = useNotificationBadge();
  const [tab, setTab] = useState<Tab>('notifications');

  if (!user) {
    navigateTo('/login');
    return null;
  }

  return (
    <div className="pt-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-neutral-900 rounded-lg flex items-center justify-center">
          <Bell size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Messages & Notifications</h1>
          <p className="text-sm text-neutral-500">Stay updated on your orders, messages, and account</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6 border-b border-neutral-200">
        <button
          onClick={() => setTab('notifications')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            tab === 'notifications'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          <Bell size={16} />
          Notifications
          {unreadCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500 text-white font-semibold">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('messages')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            tab === 'messages'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          <MessageSquare size={16} />
          Messages
          {unreadMessages > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500 text-white font-semibold">
              {unreadMessages}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('preferences')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            tab === 'preferences'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          <Settings size={16} />
          Preferences
        </button>
      </div>

      {tab === 'notifications' ? <NotificationList /> : tab === 'messages' ? <MessagesTab /> : <PreferencesTab />}
    </div>
  );
}
