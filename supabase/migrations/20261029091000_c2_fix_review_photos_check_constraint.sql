/*
# C2: Fix review_photos CHECK Constraint

## Problem
The review_photos table (migration 20261027122633) has a CHECK constraint
named review_photos_one_parent that incorrectly allows BOTH
product_review_id and store_review_id to be NULL simultaneously:

  CONSTRAINT review_photos_one_parent CHECK (
    (product_review_id IS NOT NULL AND store_review_id IS NULL) OR
    (product_review_id IS NULL AND store_review_id IS NULL) OR   <-- BUG
    (product_review_id IS NULL AND store_review_id IS NOT NULL)
  )

The second branch permits a review photo with no parent review at all,
which violates the intended invariant: exactly one parent must be set.

## Fix
Drop the buggy constraint and replace it with one that requires exactly
one of the two parent columns to be non-NULL:

  CHECK (
    (product_review_id IS NOT NULL AND store_review_id IS NULL) OR
    (product_review_id IS NULL AND store_review_id IS NOT NULL)
  )

## Safety
- Uses ALTER TABLE ... DROP CONSTRAINT IF EXISTS so it is safe to re-run.
- No data is modified or deleted. Existing rows that violate the corrected
  constraint (orphan photos with both parents NULL) would cause the ADD
  CONSTRAINT to fail, surfacing the problem rather than silently hiding it.
  However, since this migration runs immediately after the table is created
  (no rows inserted yet), no violations are expected.
- The corrected constraint name matches the original for consistency.
*/

ALTER TABLE public.review_photos
  DROP CONSTRAINT IF EXISTS review_photos_one_parent;

ALTER TABLE public.review_photos
  ADD CONSTRAINT review_photos_one_parent CHECK (
    (product_review_id IS NOT NULL AND store_review_id IS NULL) OR
    (product_review_id IS NULL AND store_review_id IS NOT NULL)
  );
