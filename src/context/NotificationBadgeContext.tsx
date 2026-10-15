import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
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

  const refresh = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      setUnreadMessages(0);
      return;
    }
    try {
      const [notifCount, msgCount] = await Promise.all([
        fetchUnreadCount(),
        fetchAdminUnreadMessageCount(),
      ]);
      setUnreadCount(notifCount);
      setUnreadMessages(msgCount);
    } catch {
      // silent fail — don't block UI
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notification-badge')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => refresh()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

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
