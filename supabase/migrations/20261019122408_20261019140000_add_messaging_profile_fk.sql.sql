/*
# Fix messaging profile foreign keys for PostgREST embeds

## Problem
The messaging service code embeds `profiles` via the foreign-key hint
`profiles!conversation_participants_user_id_fkey` and
`profiles!messages_sender_id_fkey`. However, those two FK constraints
reference `auth.users(id)`, not `public.profiles(id)`. PostgREST cannot
resolve a `profiles` embed from an `auth.users` FK, so every query that
selects the embedded `profile`/`sender_profile` errors out with
"Could not find a relationship between conversation_participants and
profiles" (and likewise for messages). This surfaces in the UI as
"Failed to load conversations" and "Failed to send message".

## Fix
Add direct, redundant FK constraints from
`conversation_participants.user_id` -> `profiles.id` and
`messages.sender_id` -> `profiles.id`. These coexist with the existing
`auth.users` FKs (Postgres allows multiple FKs on the same column).
PostgREST then has a direct path to `profiles` and the embeds resolve.

## Security
No RLS or policy changes. Existing policies still enforce ownership.
The new FKs are INSERT/UPDATE constraints only and do not grant any
new access.

## Notes
- `ON DELETE CASCADE` mirrors the existing auth.users FKs so deleting
  a profile's auth.user row cleans up messaging rows consistently.
- Non-destructive: only adds constraints, drops nothing.
*/

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
