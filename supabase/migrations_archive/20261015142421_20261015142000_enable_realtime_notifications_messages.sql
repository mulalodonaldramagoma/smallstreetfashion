-- Add notification and messaging tables to the realtime publication
-- Without this, supabase.channel('...').on('postgres_changes', ...) subscriptions
-- never fire because the tables aren't broadcast by Postgres logical replication.
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
