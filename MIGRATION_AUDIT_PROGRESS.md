# Migration Audit Progress — Small Street Fashion

Updated: 29 October 2026

## Scope

- Move the existing Small Street Fashion project to a new Bolt account/project without rebuilding it.
- Source repository: https://github.com/mulalodonaldramagoma/smallstreetfashion
- This audit is analysis-only. No SQL has been executed, no migrations applied, no files modified, and no Supabase settings changed as part of this audit.
- The migration plan is not yet approved. Do not run migrations until the correct Supabase project URL/ref has been confirmed.

## Repository state

- Total migration files in `supabase/migrations/`: 207
- Migrations recorded as applied in the database: 10 (files #1–10, ending at `20261010103029_006_...step4_stores.sql`)
- The file count differs from the handover's approximate figure of ~188. The handover was written before the latest files were added.
- The database applied-migration count (10) is far lower than the file count, confirming that most migration files have not been run against this database.

## Batch tracking

Batch size preference: 35 files per batch.

| Batch | File range (current ordering) | Files | Status |
|-------|------------------------------|-------|--------|
| 1–23  | #1–#132 (approx.)            | ~132  | Previously reviewed per handover and prior conversation. Exact filename coverage has NOT been independently verified against the repository. |
| 24    | #133–#167                    | 35    | Reviewed this session (see findings below). |
| 25    | #168–#202                    | 35    | Next batch. Filenames must be rechecked against the repository before review begins. |
| Tail  | #203–#207                    | 5     | Remaining after Batch 25. |

### Stopping point verification

The handover states ~132 files were reviewed and Batch 24 was prepared but not yet run. The exact Batch 24 file list was in a ChatGPT conversation that is not accessible from this session. The stopping point was inferred from: (a) the ~132 file count, (b) the handover note that the October 27 `create_notification()` migration should be in Batch 24, and (c) that migration is file #163 in the current ordering, which falls within #133–#167. This is consistent but not independently confirmed. If the prior sessions used a different filename ordering, the boundary may shift.

---

## Batch 24 findings — files #133–#167 (35 files)

### File inventory

| # | Filename | Summary |
|---|----------|---------|
| 133 | `20261026091245_014_stage9_admin_dashboard_access_audit.sql` | Admin dashboard: enforce_role_immutable trigger, admin_audit_log table, admin RLS policies, admin_set_user_role function. Uses `profiles.role = 'admin'`. |
| 134 | `20261026091559_014_stage9_admin_dashboard_access_audit.sql` | Byte-identical copy of #133. |
| 135 | `20261026091753_014_stage9_admin_dashboard_access_audit.sql` | Byte-identical copy of #133. |
| 136 | `20261026091817_015_016_security_hardening.sql` | Rebuilds handle_new_user to block admin self-promotion. Revokes anon execute. Adds admin SELECT policies on stores/products. |
| 137 | `20261026091831_020_revoke_public_execute.sql` | Revokes PUBLIC/anon execute on all SECURITY DEFINER functions. Grants insert_tracking_event to service_role only. |
| 138 | `20261026091858_021_fix_profiles_policy_recursion.sql` | Creates `private.is_admin()` using `profiles.role = 'admin'`. Rewrites all admin policies to use the helper, fixing recursion. |
| 139 | `20261026091909_022_to_025_security_hardening.sql` | Restricts privileged functions to service_role. Creates `private.admin_allowlist`. Upgrades `private.is_admin()` to check the allowlist. Creates provision_admin, set_audit_actor, is_current_admin, explicit deny policy. |
| 140 | `20261026091921_026_027_column_privileges.sql` | Column-level privilege tightening. Stores UPDATE excludes is_active/is_verified/is_demo. Products INSERT/UPDATE exclude moderation columns. Orders/payment_transactions made non-mutable. |
| 141 | `20261026092608_032_notification_centre_and_messaging.sql` | Creates notifications, conversations, messages, notification_preferences tables with RLS. `create_notification()` has no internal authz check — any authenticated user can call it for any user_id. |
| 142 | `20261026092615_enable_realtime_notifications_messages.sql` | Adds notifications, messages, conversation_participants to realtime publication. |
| 143 | `20261026092623_028_stage10_notification_events.sql` | Creates notification_events table with RLS. Seller SELECT joins order_items to stores. Admin via private.is_admin(). SELECT-only for authenticated. |
| 144 | `20261026092633_add_messaging_profile_fk.sql` | Adds FK constraints from conversation_participants and messages to profiles. |
| 145 | `20261026092641_fix_preferences_and_profile_peer_read.sql` | Sets auth.uid() default on notification_preferences.user_id. Adds peer-read policy on profiles for conversation participants. |
| 146 | `20261026092656_fix_rls_recursion_conversation_participants.sql` | Creates `private.is_conversation_participant()` helper. Rewrites cp_select_participant, profiles peer read, conversations select to use helper — fixes RLS recursion. |
| 147 | `20261026092708_fix_role_assignment_and_admin_detection.sql` | Rebuilds handle_new_user to honor customer/seller role. Restores is_current_admin() as SECURITY DEFINER calling private.is_admin() (allowlist-based). |
| 148 | `20261026093307_20261016090000_seller_earnings_ledger.sql.sql` | Creates seller_earnings and order_processing_log tables with RLS. create_seller_earnings_for_order (idempotent via unique constraint). process_order_post_payment v1 (no row locking). Service_role only. |
| 149 | `20261026093314_20261016130000_fix_function_permissions.sql.sql` | Revokes PUBLIC execute on the two new SECURITY DEFINER functions. Re-grants to service_role only. |
| 150 | `20261026112245_20261026100000_concurrency_locking_post_payment.sql.sql` | Replaces process_order_post_payment with SELECT ... FOR UPDATE row locking. Stock decrement outside subtransaction. Earnings in subtransaction. Service_role only. |
| 151 | `20261026112516_20261026120000_refund_and_earnings_adjustment.sql.sql` | Creates refunds and seller_earnings_adjustments tables with RLS. process_refund_notification v1 — idempotent, FOR UPDATE lock, ratio-based adjustments. No cumulative cap yet. Admin SELECT uses profiles.role not private.is_admin(). |
| 152 | `20261026112525_20261026121000_add_partially_refunded_status.sql.sql` | Drops and recreates orders_status_check to include partially_refunded. Redundant with #151's DO block. |
| 153 | `20261026112540_20261026130000_audit_fixes_refund_capping_and_grants.sql.sql` | Replaces process_refund_notification v2 — cumulative refund capping. Revokes DML from authenticated on refunds/adjustments. SELECT only. Service_role only. |
| 154 | `20261026112601_20261026140000_admin_reconciliation_function.sql.sql` | Creates get_reconciliation_summary — admin-only via private.is_admin(). Read-only CTE-based reconciliation. Service_role only. |
| 155 | `20261026112607_20261026150000_grant_reconciliation_to_authenticated.sql.sql` | Grants get_reconciliation_summary to authenticated (function body enforces is_admin internally). |
| 156 | `20261026112627_20261026160000_add_missing_refund_adjustment_detection.sql.sql` | Recreates get_reconciliation_summary with issue_missing_refund_adjustment flag. Re-applies grants. |
| 157 | `20261026112639_20261026170000_revoke_anon_reconciliation_execute.sql.sql` | Revokes get_reconciliation_summary from anon (defense in depth). |
| 158 | `20261026112702_20261026180000_fix_recon_revoke_public_execute.sql.sql` | Revokes get_reconciliation_summary from PUBLIC. Re-grants to authenticated + service_role. Closes anon gap from function recreation. |
| 159 | `20261026112943_20261026190000_add_store_location_social_hours.sql.sql` | Adds nullable columns to stores: address, coordinates, social links, opening_hours. Additive. |
| 160 | `20261026112950_20261026200000_add_orders_seller_select_policy.sql.sql` | Creates private.is_seller_order() helper. Adds seller SELECT policy on orders. Uses SECURITY DEFINER to break RLS recursion. |
| 161 | `20261026113247_20261026210000_stage_a_ratings_and_reviews.sql.sql` | Comprehensive review system: product_reviews, store_reviews, review_replies, review_reports. Self-promotion prevention. Purchase verification. Admin moderation. Column-level privileges. |
| 162 | `20261026113256_20261026220000_add_review_tables_profiles_fks.sql.sql` | Adds FKs from review tables to profiles. Idempotent via DO blocks. |
| 163 | `20261027083342_20261027090000_add_authz_to_create_notification.sql.sql` | Fixes create_notification vulnerability — adds is_current_admin() check. Service_role bypasses. Revokes from PUBLIC/anon. |
| 164 | `20261027084322_20261027100000_provision_admin_account.sql.sql` | Instance-specific: inserts hardcoded user ID into admin_allowlist and sets profiles.role = 'admin'. |
| 165 | `20261027115439_20261026090048_009_stage7_delivery_management_step1_tables.sql` | Re-issued delivery_methods + deliveries tables. Admin policies use profiles.role = 'admin'. deliveries.status has no CHECK constraint. |
| 166 | `20261027115501_20261026090106_010_stage7_expansion_delivery_zones_history.sql` | Re-issued delivery zones, status history. Admin policies use profiles.role = 'admin'. delivery_status_history.status has no CHECK constraint. Seeds hardcoded Johannesburg zones. |
| 167 | `20261027115511_20261026090119_011_fix_trigger_search_paths.sql` | Fixes search_path warnings on trigger functions. |

### Findings summary

| # | Finding | Severity | Status | Related files |
|---|---------|----------|--------|---------------|
| 1 | Store self-verification columns (is_active, is_verified, is_demo) not in authenticated UPDATE grant | LOW | Hardened in #140 — not exposed to sellers | #140 |
| 2 | Admin allowlist regression risk from duplicate `014_stage9` files using `profiles.role = 'admin'` | HIGH | If files #133–135 run after #139, admin detection regresses to profiles.role | #133, #134, #135, #138, #139 |
| 3 | `create_notification()` had no authorization check — any authenticated user could send notifications to anyone | RESOLVED | Fixed in #163 (Oct 27) with is_current_admin() check | #141, #163 |
| 4 | Financial function safety — row locking, stock safety, cumulative refund caps, idempotency | SAFE | All present in final definitions within this batch | #148–#153 |
| 5 | Conversation RLS recursion from self-referential policy | RESOLVED | Fixed in #146 via private.is_conversation_participant() helper | #141, #146 |
| 6 | Missing CHECK constraints on deliveries.status and delivery_status_history.status | MEDIUM | Confirmed still missing in this batch | #165, #166 |
| 7 | Courier function (insert_tracking_event) permissions | SAFE | Service_role only, hardened in #137 | #137 |
| 8 | Instance-specific migrations (hardcoded admin seed, hardcoded delivery zones) | INFO | Exclude from portable production baseline | #164, #166 |
| 9 | Three byte-identical copies of `014_stage9_admin_dashboard_access_audit` | HIGH | Redundant; regression risk if ordered after allowlist migration | #133, #134, #135 |
| 10 | Refund admin SELECT policy uses `profiles.role = 'admin'` instead of `private.is_admin()` | LOW | Minor inconsistency in #151; function itself is service_role only | #151 |

### Detailed notes on critical findings

**Finding 2 + 9 — Admin allowlist regression from duplicate `014_stage9` files:**
Files #133, #134, and #135 are byte-identical. All admin RLS policies within them check `profiles.role = 'admin'` directly (not via `private.is_admin()`). File #139 upgrades `private.is_admin()` to check the allowlist. If any of the three duplicate `014` files run after file #139, they will DROP and re-CREATE the admin policies using `profiles.role = 'admin'`, regressing admin detection back from the allowlist. Under alphabetical-by-timestamp ordering, files #133–135 (timestamps 091245, 091559, 091753) run before #139 (timestamp 091909), which is safe. But if any later batch re-issues these, or if the runner reorders, the regression returns. These three files should be deduplicated to a single copy before any production run.

**Finding 3 — Notification authorization fix:**
File #141 creates `create_notification()` as SECURITY DEFINER, granted to authenticated + service_role, with no internal authorization check. Any authenticated user could call it for any `user_id`. File #163 (October 27) fixes this by adding `IF NOT public.is_current_admin() THEN RAISE EXCEPTION`. Service_role callers (edge functions using the service_role key) bypass this check. The `send-notification` Edge Function uses the service_role key, so it is unaffected. Admin-triggered notifications from the frontend pass the `is_current_admin()` check. Regular customers and sellers are blocked. The fix is correct and complete.

**Finding 4 — Financial safeguards:**
- `process_order_post_payment()`: Row locking via `SELECT ... FOR UPDATE` on `order_processing_log` (file #150). Stock decrement runs outside subtransaction — if `decrement_stock` raises, the entire function aborts and the outer transaction rolls back. Earnings creation runs in a subtransaction — on failure, earnings rows roll back but stock changes persist. Idempotency via processing-log flags. Service_role only.
- `process_refund_notification()`: Cumulative refund capping in v2 (file #153). Calculates `v_remaining_refundable` from existing processed refunds. Caps `v_effective_amount`. Full refund determined by cumulative total, not individual amount. `FOR UPDATE` lock on refund row. Idempotent via `ON CONFLICT` and per-earning adjustment count. Service_role only.
- `get_reconciliation_summary()`: Admin-only via `private.is_admin()` internal check. Read-only. Final grant state: PUBLIC revoked, authenticated + service_role granted (file #158).

**Finding 6 — Missing CHECK constraints:**
`deliveries.status` (file #165) and `delivery_status_history.status` (file #166) are `text NOT NULL` columns with no CHECK constraint. Invalid status strings could be inserted. `shipments.status` is not created in this batch, so that item from the handover cannot be verified here. These constraints should be added in a future hardening migration.

---

## Prohibited migrations

Never run these migrations against production — they drop core marketplace tables:

1. `20261015135409_drop_conflicting_tables.sql`
2. `20261019111756_20261015135409_drop_conflicting_tables.sql.sql`

---

## Instance-specific migrations to exclude from portable baseline

These contain hardcoded instance-specific data and should not be included in a portable production baseline:

1. `20261027084322_20261027100000_provision_admin_account.sql.sql` — hardcoded admin user ID
2. `20261027115501_20261026090106_010_stage7_expansion_delivery_zones_history.sql` — hardcoded Johannesburg delivery zones
3. `20261023092313_20261023110000_repair_melis_collection_skus.sql` — hardcoded SKU repair (outside Batch 24, noted from handover)
4. Various demo store/product seed migrations (outside Batch 24, noted from handover)

---

## Critical findings preserved from prior batches (handover)

These findings were reported in prior sessions and are preserved here for continuity. Their status within Batches 1–23 has not been independently verified in this session.

1. **Store self-verification vulnerability:** A migration grants authenticated users UPDATE rights over `stores.is_active`, `stores.is_verified`, and `stores.is_demo`. In Batch 24, file #140 hardens this by excluding those columns from the UPDATE grant. The vulnerable migration may exist in an earlier batch.
2. **Admin authorization regression risk:** Duplicate `private.is_admin()` definitions check `profiles.role = 'admin'` instead of the admin allowlist. Migration ordering must ensure the allowlist-based definition is final. In Batch 24, this is confirmed — the allowlist version (#139) comes after the profiles.role version (#138), but the three duplicate `014` files (#133–135) are a regression risk.
3. **Notification authorization:** October 22 `create_notification()` version permits trusted server calls where `auth.uid()` is NULL and checks admin status for authenticated callers. The October 27 version (file #163) adds `is_current_admin()` check. Verified safe in Batch 24. The `send-notification` Edge Function call path uses service_role, which bypasses the check.
4. **Financial regression risk:** Final definitions retain row locking and insufficient-stock errors in `decrement_stock()` / `process_order_post_payment()`, and pending-first processing, cumulative refund caps, and idempotency in `process_refund_notification()`. Verified safe in Batch 24.
5. **Conversation RLS recursion:** Resolved by `private.is_conversation_participant()` helper and policy rewrites. Verified in Batch 24 (file #146).
6. **Missing status CHECK constraints:** `deliveries.status`, `delivery_status_history.status`, and `shipments.status` were reported without CHECK constraints. Confirmed for the first two in Batch 24 (#165, #166).
7. **Courier function permissions:** Later migration revokes `insert_tracking_event()` from anon and authenticated and grants it to service_role only. Verified in Batch 24 (file #137).
8. **Excluded instance-specific/demo migrations:** Exclude hardcoded demo product seeds, hardcoded admin promotion/user-store assignments, and hardcoded SKU repair migrations from a portable production baseline.
9. **Prohibited migrations:** Never run either `drop_conflicting_tables` migration.

## Known project/database caution

A prior audit found a blank starter Bolt/Supabase environment while the actual app source was on GitHub. A target discrepancy was noted between `.env` (`jngaxmamgfqgyxxahiwr.supabase.co`) and a previously expected project ref (`0ec90b57d6e95fcbda19832f`). Confirm the intended Supabase project before any database changes. Do not assume either ref is correct without checking.

---

## Next task

- Review files #168–#202 (35 files) as Batch 25.
- Before beginning, re-verify the filename ordering against the repository to confirm the file range.
- Do not execute SQL, apply migrations, modify existing migration files, change Supabase settings, or modify the database.
- After Batch 25, 5 files remain (#203–#207) as a tail batch.

## Audit rules

- Analysis-only: no SQL executed, no files modified, no Supabase settings changed.
- The migration plan is not yet approved.
- Do not run any migration until the correct Supabase project URL/ref has been confirmed.
- Do not run either `drop_conflicting_tables` migration.
- Batch size: 35 files.
