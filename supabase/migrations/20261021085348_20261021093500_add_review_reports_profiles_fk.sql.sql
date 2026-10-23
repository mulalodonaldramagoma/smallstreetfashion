/*
# Add foreign key from review_reports.reporter_id to profiles

## Problem
The admin review reports query uses:
  `reporter_profile:profiles!review_reports_reporter_id_fkey(id, full_name)`

But the FK `review_reports_reporter_id_fkey` targets `auth.users(id)`, not
`profiles(id)`. PostgREST cannot resolve the join to `profiles` through that
constraint, causing the admin reported-reviews list to fail.

## Fix
Add a complementary FK from `review_reports.reporter_id` to `profiles(id)`:
- `review_reports_reporter_id_profiles_fkey`

This is additive — the existing `auth.users` FK is preserved.

## Security
- No RLS policies or grants are changed.
- The admin-only `review_reports` SELECT policy still applies.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'review_reports_reporter_id_profiles_fkey'
    AND conrelid = 'review_reports'::regclass
  ) THEN
    ALTER TABLE review_reports
      ADD CONSTRAINT review_reports_reporter_id_profiles_fkey
      FOREIGN KEY (reporter_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
