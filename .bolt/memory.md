# Project memory

## Product intent & audience

- Small Street Fashion: Vite + React marketplace app (admin, seller, customer views) backed by Supabase
- Features: shop/cart/checkout, customer accounts, seller dashboard, admin dashboard, reviews, messaging, delivery tracking, Paystack payments, courier integration, admin user management

## Brand personality & voice

- Not yet established; no design or copy decisions encountered

## Visual design & UX direction

- No UI/design context encountered yet; all work has been backend migration audit, validation, corrective migration file creation, and project-ref reconciliation

## Decisions, constraints & rationale

- READ-ONLY constraint: no file edits to existing files, no SQL execution, no migrations applied, no deploys — still upheld; only new files were created
- 207 migration files on disk; 10 applied to database (base schema + category seed + demo stores only)
- File-level audit of all 207 files is COMPLETE; not to be repeated
- Baseline plan: 46 execution steps (42 existing + 4 corrective migrations C1–C4) — validated and ready
- Four corrective migration files have been CREATED on disk (not executed):
  - C1: `supabase/migrations/20261029090000_c1_fix_decrement_stock_safety.sql` — locks product row with `SELECT FOR UPDATE`, validates quantity > 0, rejects missing/insufficient stock (no silent clamp to zero), preserves `integer` return type, `service_role`-only grant; compatible with `process_order_post_payment` loop (outer transaction rollback on failure)
  - C2: `supabase/migrations/20261029091000_c2_fix_review_photos_check_constraint.sql` — drops buggy `review_photos_one_parent` CHECK, replaces with exactly-one-parent-non-NULL constraint; `DROP IF EXISTS` for re-run safety
  - C3: `supabase/migrations/20261029092000_c3_delivery_shipment_status_constraints.sql` — CHECK constraints on `deliveries.status`, `delivery_status_history.status`, `shipments.status` using exact TS type values; includes `'pending'` in delivery constraint to preserve seed default; `shipment_tracking_events.status` left unconstrained (free-form courier payloads); `DO $$` existence checks for re-run safety
  - C4: `supabase/migrations/20261029093000_c4_notification_and_admin_review_permissions.sql` — replaces `create_notification()` with guard `auth.uid() IS NOT NULL AND NOT is_current_admin()`; grants EXECUTE to `authenticated` + `service_role`, revokes from `PUBLIC` + `anon`; restores `authenticated` EXECUTE on `admin_resolve_report` and `admin_set_review_status` (both have internal `is_current_admin()` guards)
- Placement in execution order:
  - C1 after Step 30, before Step 32
  - C2 after Step 47, before Step 48
  - C3 after Step 16
  - C4 after Step 46, before Step 47
- Key correction: C4 re-grants EXECUTE on 3 functions to `authenticated` because Step 46 (Oct 23) over-revoked `admin_resolve_report` and `admin_set_review_status`, which frontend `reviewService.ts` calls via `supabase.rpc()`
- `create_notification` guard logic: `auth.uid() IS NOT NULL AND NOT is_current_admin()` — allows service-role (uid NULL) and admins; rejects non-admin authenticated; anon blocked by EXECUTE revoke
- PROHIBITED migrations: two `drop_conflicting_tables` files (excluded from plan)
- Oct 27 `add_authz_to_create_notification` files excluded from plan
- No instance-specific migrations (admin provisioning, demo seeds, hardcoded UUIDs) in baseline
- **Project ref confirmed: `hfdlmehefhciqnalpdlj`** — verified via cross-reference: `.env` URL + JWT anon key decode both yield this ref; anon-key REST API returns HTTP 200 with RLS-filtered data (empty stores list, all demo stores `is_active=false`); MCP `execute_sql` (service role) returns unfiltered same-database data (4 inactive demo stores); MCP security posture shows `decrement_stock` still has `execute_roles: ["anon","authenticated"]` (Step 21 hardening not applied), consistent with 10-migration state
- `imxkoxxudmutxthvlwev` does not appear in any project file, env var, or config; not connected to this Bolt project
- GitHub not connected; project is not a git repo

## Open questions & assumptions

- User previously stated `imxkoxxudmutxthvlwev` as intended target — this conflicts with all verifiable evidence which points to `hfdlmehefhciqnalpdlj`; if `imxkoxxudmutxthvlwev` is truly desired, user must switch Bolt's Supabase integration in the dashboard
- Admin provisioning (Section D) must be performed manually after baseline, once first admin user has registered
- Edge functions must be deployed after all 46 steps applied
- Plan is ready for user approval — all 46 steps including C1–C4 files are written; no SQL executed, no migrations applied
- `.bolt/prompt` has no authoritative instructions currently defined