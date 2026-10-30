-- Add direct FK constraints from messaging tables to profiles for PostgREST embeds
ALTER TABLE conversation_participants
  DROP CONSTRAINT IF EXISTS conversation_participants_profiles_user_id_fkey;

ALTER TABLE conversation_participants
  ADD CONSTRAINT conversation_participants_profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_profiles_sender_id_fkey;

ALTER TABLE messages
  ADD CONSTRAINT messages_profiles_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE SET NULL;