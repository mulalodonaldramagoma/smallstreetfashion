import { supabase } from '@/lib/supabase';
import type { Profile, Store } from '@/types';

export interface AdminUserWithDetails extends Profile {
  email: string | null;
  banned_until: string | null;
  is_admin: boolean;
  store?: Pick<Store, 'id' | 'name' | 'slug' | 'is_active' | 'is_verified'> | null;
  order_count?: number;
}

export type SortOption = 'name_asc' | 'name_desc' | 'created_asc' | 'created_desc';
export type StatusFilter = 'all' | 'active' | 'banned';

async function callAdminFunction(payload: Record<string, unknown>): Promise<unknown> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const errBody = await response.json();
      if (errBody?.error) message = errBody.error;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(message);
  }

  const data = await response.json();
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function fetchAdminUsers(params: {
  search?: string;
  role?: 'all' | 'customer' | 'seller' | 'admin';
  status?: StatusFilter;
  sort?: SortOption;
  page?: number;
  perPage?: number;
}): Promise<{ users: AdminUserWithDetails[]; total: number }> {
  const result = await callAdminFunction({
    action: 'list',
    search: params.search,
    role: params.role || 'all',
    status: params.status || 'all',
    sort: params.sort || 'created_desc',
    page: params.page || 1,
    perPage: params.perPage || 20,
  }) as { users: AdminUserWithDetails[]; total: number };

  return { users: result.users || [], total: result.total || 0 };
}

export async function adminSetRole(
  targetUserId: string,
  newRole: 'customer' | 'seller' | 'admin',
): Promise<void> {
  await callAdminFunction({
    action: 'set_role',
    target_user_id: targetUserId,
    new_role: newRole,
  });
}

export async function adminToggleBan(
  targetUserId: string,
  ban: boolean,
): Promise<void> {
  await callAdminFunction({
    action: 'toggle_ban',
    target_user_id: targetUserId,
    ban,
  });
}

export async function adminMessageUser(
  targetUserId: string,
  adminId: string,
  subject: string,
  body: string,
  category: 'general' | 'support' | 'important_notice' = 'general'
): Promise<void> {
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .insert({
      subject,
      category,
      status: 'open',
      initiated_by: adminId,
    })
    .select()
    .single();

  if (convError) throw convError;

  const { error: partError } = await supabase
    .from('conversation_participants')
    .insert([
      { conversation_id: conv.id, user_id: adminId },
      { conversation_id: conv.id, user_id: targetUserId },
    ]);
  if (partError) throw partError;

  const { error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conv.id,
      sender_id: adminId,
      body,
    });
  if (msgError) throw msgError;

  await supabase.rpc('create_notification', {
    p_user_id: targetUserId,
    p_category: 'message',
    p_type: 'admin_message',
    p_title: subject,
    p_body: body,
    p_entity_type: 'conversation',
    p_entity_id: conv.id,
    p_action_url: '/messages',
  }).then(({ error: notifError }) => {
    if (notifError) console.warn('Failed to create notification:', notifError.message);
  });

  await supabase.from('admin_audit_log').insert({
    actor_id: adminId,
    action: 'user_message',
    target_type: 'user',
    target_id: targetUserId,
    target_name: subject,
  });
}

export async function adminMessageGroup(
  targetUserIds: string[],
  adminId: string,
  subject: string,
  body: string,
): Promise<void> {
  for (const userId of targetUserIds) {
    try {
      await adminMessageUser(userId, adminId, subject, body, 'important_notice');
    } catch (err) {
      console.warn(`Failed to message user ${userId}:`, err);
    }
  }
}
