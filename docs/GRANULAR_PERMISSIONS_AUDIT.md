# Granular Permissions – 10-Round Audit Summary

## Overview
Granular permissions control tab visibility (PECC tool tabs, cohort/program tabs, PRS section) and permission overrides per user, cohort, and program. Sources: `view_tabs`, `user_permissions`, `cohort_permissions`, `program_permissions`, RPCs `is_tab_visible`, `user_has_permission`, `get_users_for_granular_permissions`.

---

## Round 1–2: Source of truth for PECC tab visibility
- **Issue:** Navbar and PECC tool tabs used `site_tab_visibility` (by site_id) only; Granular Permissions writes to `view_tabs` (user_id). Settings in Admin → Tab Visibility (user scope) were not applied.
- **Fix:** In `UserProfileContext`:
  - **fetchUserProfile:** For PECC, load `view_tabs` where `user_id = currentUser.id` first. If any rows exist, compute visible tabs as PECC_TAB_KEYS filtered by `is_visible` (default true when no row). Else fall back to `site_tab_visibility` then all tabs.
  - **enterViewAsUser:** Same for the viewed-as user: load `view_tabs` by `user_id`, then fallback to site_tab_visibility then default.

## Round 3–4: view_tabs upsert and scope
- **Issue:** Upserting a user-scope row did not set `cohort_id`/`program_id` to null; row could violate one-scope CHECK or leave stale scope.
- **Fix:** In `GranularPermissionsManager.handleSaveTabVisibility`, payload explicitly sets the other scope IDs to `null` (e.g. user scope → `cohort_id: null`, `program_id: null`).

## Round 5–6: usePermission and “view as”
- **Verification:** `usePermission` and tab visibility hooks use `userProfile` from context; when viewing as another user, context exposes that user’s profile, so the effective user is already correct. No code change.
- **Improvement:** `usePermission` fallback when RPC fails: use `DEFAULT_ROLE_PERMISSIONS[role]` instead of always `true`, so fallback is role-aware and safer.

## Round 7–8: GPM UX and errors
- **Snackbar:** Success/error feedback for: save user/cohort/program permission, save tab visibility, save primary program, delete permission. Auto-dismiss 5s, aria-live for accessibility.
- **Refresh button:** `aria-label="Refresh permissions and data"`.
- **Error handling:** All save/delete handlers set snack on error so failures are visible.

## Round 9–10: Consistency and docs
- **usePermission:** Uses `userProfile.id` and `userProfile.role`; on RPC error or missing RPC, falls back to `DEFAULT_ROLE_PERMISSIONS[role]` (no longer default true).
- **Docs:** This file; GRANULAR_PERMISSIONS_MIGRATION.sql and GRANULAR_PERMISSIONS_USERS_LIST_RLS.sql remain the schema/RLS reference.

---

## Files touched
- `client/src/context/UserProfileContext.tsx` – view_tabs as source of truth for PECC tabs; view-as uses view_tabs.
- `client/src/components/admin/GranularPermissionsManager.tsx` – view_tabs upsert scope cleanup; snackbar and error handling; aria-label on Refresh.
- `client/src/hooks/usePermissions.ts` – usePermission fallback to DEFAULT_ROLE_PERMISSIONS; dependency on role.
- `docs/GRANULAR_PERMISSIONS_AUDIT.md` – this summary.

## DB / RLS
No migration changes. Ensure `FIX_VIEW_TABS_RLS.sql` and `GRANULAR_PERMISSIONS_USERS_LIST_RLS.sql` are applied so admins/managers see all tiers and view_tabs RLS allows “Users manage own tabs” and “Mentors manage mentee tabs”.
