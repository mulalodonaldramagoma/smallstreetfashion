import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { fetchUnreadCount } from '@/services/notificationCentreService';
import { fetchAdminUnreadMessageCount } from '@/services/messagingService';
import { useAuth } from '@/context/AuthContext';

interface NotificationBadgeValue {
  unreadCount: number;
  unreadMessages: number;
  refresh: () => void;
}

const NotificationBadgeContext = createContext<NotificationBadgeValue | null>(null);

export function NotificationBadgeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const userId = user?.id ?? null;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      setUnreadMessages(0);
      return;
    }
    try {
      const [notifResult, msgResult] = await Promise.allSettled([
        fetchUnreadCount(),
        fetchAdminUnreadMessageCount(),
      ]);
      setUnreadCount(notifResult.status === 'fulfilled' ? notifResult.value : 0);
      setUnreadMessages(msgResult.status === 'fulfilled' ? msgResult.value : 0);
    } catch {
      setUnreadCount(0);
      setUnreadMessages(0);
    }
  }, [userId]);

  // Initial load + re-load when user changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Real-time subscription — keyed only on userId, not on refresh callback
  // to prevent duplicate channel creation
  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      setUnreadMessages(0);
      return;
    }

    // Clean up any existing channel before creating a new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`notification-badge-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => refresh()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => refresh()
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => refresh()
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => refresh()
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${userId}`,
        },
        () => refresh()
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId, refresh]);

  // Fallback: refresh on window focus (covers cases where realtime is delayed)
  useEffect(() => {
    if (!userId) return;
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [userId, refresh]);

  return (
    <NotificationBadgeContext.Provider value={{ unreadCount, unreadMessages, refresh }}>
      {children}
    </NotificationBadgeContext.Provider>
  );
}

export function useNotificationBadge(): NotificationBadgeValue {
  const ctx = useContext(NotificationBadgeContext);
  if (!ctx) throw new Error('useNotificationBadge must be used within NotificationBadgeProvider');
  return ctx;
}
