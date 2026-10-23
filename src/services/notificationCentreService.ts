import { supabase } from '@/lib/supabase';
import type { AppNotification, NotificationPreferences, NotificationCategory } from '@/types';

// --- Notifications CRUD ---

export async function fetchNotifications(params: {
  category?: NotificationCategory | 'all';
  unreadOnly?: boolean;
  search?: string;
  page?: number;
  perPage?: number;
}): Promise<{ notifications: AppNotification[]; total: number }> {
  const page = params.page || 1;
  const perPage = params.perPage || 20;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' });

  if (params.category && params.category !== 'all') {
    query = query.eq('category', params.category);
  }
  if (params.unreadOnly) {
    query = query.eq('is_read', false);
  }
  if (params.search) {
    query = query.or(`title.ilike.%${params.search}%,body.ilike.%${params.search}%`);
  }

  query = query.order('created_at', { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    notifications: (data as AppNotification[]) ?? [],
    total: count || 0,
  };
}

export async function fetchUnreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_unread_notification_count');
  if (error) throw error;
  return data as number;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('is_read', false);
  if (error) throw error;
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// --- Notification Preferences ---

export async function fetchNotificationPreferences(): Promise<NotificationPreferences | null> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as NotificationPreferences | null;
}

export async function upsertNotificationPreferences(
  prefs: Partial<Omit<NotificationPreferences, 'id' | 'user_id' | 'updated_at'>>
): Promise<void> {
  const { data: existing } = await supabase
    .from('notification_preferences')
    .select('id')
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('notification_preferences')
      .update({ ...prefs, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('notification_preferences')
      .insert({ ...prefs });
    if (error) throw error;
  }
}
