import { supabase } from '@/lib/supabase';
import type {
  Conversation,
  ConversationWithDetails,
  ConversationParticipant,
  Message,
  ConversationCategory,
  ConversationStatus,
  Profile,
} from '@/types';

// --- Conversations ---

export async function fetchConversations(params: {
  status?: ConversationStatus | 'all';
  category?: ConversationCategory | 'all';
  search?: string;
  page?: number;
  perPage?: number;
}): Promise<{ conversations: ConversationWithDetails[]; total: number }> {
  const page = params.page || 1;
  const perPage = params.perPage || 20;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  // First get conversation IDs the user participates in
  const { data: participations, error: partError } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at');

  if (partError) throw partError;
  if (!participations || participations.length === 0) {
    return { conversations: [], total: 0 };
  }

  const convIds = participations.map((p) => p.conversation_id);
  const lastReadMap = new Map(participations.map((p) => [p.conversation_id, p.last_read_at]));

  let query = supabase
    .from('conversations')
    .select('*', { count: 'exact' })
    .in('id', convIds);

  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status);
  }
  if (params.category && params.category !== 'all') {
    query = query.eq('category', params.category);
  }
  if (params.search) {
    query = query.ilike('subject', `%${params.search}%`);
  }

  query = query.order('updated_at', { ascending: false }).range(from, to);

  const { data: conversations, error: convError, count } = await query;
  if (convError) throw convError;
  if (!conversations || conversations.length === 0) {
    return { conversations: [], total: count || 0 };
  }

  // Fetch participants for each conversation
  const convIdsForDetails = conversations.map((c) => c.id);
  const { data: participants, error: partDataError } = await supabase
    .from('conversation_participants')
    .select('*, profile:profiles!conversation_participants_user_id_fkey(id, full_name)')
    .in('conversation_id', convIdsForDetails);

  if (partDataError) throw partDataError;

  // Fetch last messages for each conversation
  const lastMessagesPromises = convIdsForDetails.map(async (convId) => {
    const { data: msgs } = await supabase
      .from('messages')
      .select('*, sender_profile:profiles!messages_sender_id_fkey(id, full_name)')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return { convId, msg: msgs as unknown as Message | null };
  });

  const lastMessages = await Promise.all(lastMessagesPromises);
  const lastMsgMap = new Map(lastMessages.map((lm) => [lm.convId, lm.msg]));

  // Fetch unread message counts for each conversation
  const unreadPromises = convIdsForDetails.map(async (convId) => {
    const lastRead = lastReadMap.get(convId);
    let msgQuery = supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', convId);
    if (lastRead) {
      msgQuery = msgQuery.gt('created_at', lastRead);
    }
    const { count: unreadCount } = await msgQuery;
    return { convId, unread: unreadCount || 0 };
  });

  const unreadResults = await Promise.all(unreadPromises);
  const unreadMap = new Map(unreadResults.map((u) => [u.convId, u.unread]));

  const result: ConversationWithDetails[] = conversations.map((conv) => {
    const convParticipants = (participants || []).filter(
      (p) => p.conversation_id === conv.id
    ) as unknown as ConversationParticipant[];
    return {
      ...(conv as Conversation),
      participants: convParticipants,
      last_message: lastMsgMap.get(conv.id) || null,
      unread_count: unreadMap.get(conv.id) || 0,
    };
  });

  return { conversations: result, total: count || 0 };
}

export async function fetchConversationById(conversationId: string): Promise<ConversationWithDetails | null> {
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();
  if (convError) throw convError;
  if (!conv) return null;

  const { data: participants, error: partError } = await supabase
    .from('conversation_participants')
    .select('*, profile:profiles!conversation_participants_user_id_fkey(id, full_name)')
    .eq('conversation_id', conversationId);
  if (partError) throw partError;

  return {
    ...(conv as Conversation),
    participants: (participants || []) as unknown as ConversationParticipant[],
    last_message: null,
    unread_count: 0,
  };
}

export async function createConversation(params: {
  subject: string;
  category?: ConversationCategory;
  participantIds: string[];
  body: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}): Promise<Conversation> {
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .insert({
      subject: params.subject,
      category: params.category || 'general',
      initiated_by: (await supabase.auth.getUser()).data.user?.id,
      related_entity_type: params.relatedEntityType || null,
      related_entity_id: params.relatedEntityId || null,
    })
    .select()
    .single();

  if (convError) throw convError;

  const currentUserId = (await supabase.auth.getUser()).data.user?.id;
  const allParticipantIds = [...new Set([currentUserId, ...params.participantIds])];

  const participantInserts = allParticipantIds.map((userId) => ({
    conversation_id: conv.id,
    user_id: userId,
  }));

  const { error: partError } = await supabase
    .from('conversation_participants')
    .insert(participantInserts);
  if (partError) throw partError;

  if (params.body.trim()) {
    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conv.id,
        sender_id: currentUserId,
        body: params.body,
      });
    if (msgError) throw msgError;
  }

  return conv as Conversation;
}

export async function updateConversationStatus(
  conversationId: string,
  status: ConversationStatus
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', conversationId);
  if (error) throw error;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id);
  if (error) throw error;
}

// --- Messages ---

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*, sender_profile:profiles!messages_sender_id_fkey(id, full_name)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as Message[];
}

export async function sendMessage(conversationId: string, body: string): Promise<Message> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: userData.user.id,
      body,
    })
    .select('*, sender_profile:profiles!messages_sender_id_fkey(id, full_name)')
    .single();
  if (error) throw error;
  return data as unknown as Message;
}

// --- Admin: Fetch users for recipient selection ---

export async function fetchUsersForMessaging(params: {
  role?: 'customer' | 'seller' | 'all';
  search?: string;
}): Promise<Pick<Profile, 'id' | 'full_name'>[]> {
  let query = supabase.from('profiles').select('id, full_name');
  if (params.role && params.role !== 'all') {
    query = query.eq('role', params.role);
  }
  if (params.search) {
    query = query.ilike('full_name', `%${params.search}%`);
  }
  query = query.order('full_name', { ascending: true }).limit(100);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Pick<Profile, 'id' | 'full_name'>[];
}

export async function fetchAdminUnreadMessageCount(): Promise<number> {
  const { data: participations, error } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at');
  if (error) throw error;
  if (!participations || participations.length === 0) return 0;

  let total = 0;
  for (const p of participations) {
    let msgQuery = supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', p.conversation_id)
      .neq('sender_id', (await supabase.auth.getUser()).data.user?.id || '');
    if (p.last_read_at) {
      msgQuery = msgQuery.gt('created_at', p.last_read_at);
    }
    const { count } = await msgQuery;
    total += count || 0;
  }
  return total;
}
