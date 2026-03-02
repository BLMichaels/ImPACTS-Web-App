# CRM & User Role/Assignment Audit (10 Rounds)

## Problem
When "viewing as" a staff member who is also an admin, the app showed them as PECC. Contact type in CRM did not always match the user's actual role after recategorization in Team. Role from DB could be mixed case or inconsistent.

## Round 1 – Single source of truth for role
- **normalizeUserRole()** added in `types/database.ts`: normalizes any role from DB (mixed case, null, invalid) to `UserRole` (lowercase enum). Defaults to PECC when invalid.
- **UserProfileContext**: When loading profile from Supabase (`fetchUserProfile` and `enterViewAsUser`), role is normalized before storing so all comparisons use a consistent value.

## Round 2 – View-as effective role
- **effectiveRole** when viewing as another user: if that user has **is_admin === true**, we now use **UserRole.ADMIN** so the UI and nav show "Admin" instead of their primary role. This fixes "staff who is also admin" showing as PECC.
- **Navbar** "Viewing as" banner now uses **userRole** (effective role) instead of `viewAsUserProfile.role`, so the label always matches assignment (Admin vs PECC vs Manager, etc.). Role string is formatted with underscore replaced by space (e.g. hospital_system → HOSPITAL SYSTEM).

## Round 3 – CRM contact type from users.role
- **CRM load**: After building the contact list (hospitals + crm_organizations + users), a second pass runs: for every contact whose email matches a row in **users**, the contact’s **type** is set from **users.role** via `roleToContactType`. So if a user is recategorized in Team (e.g. pecc → admin), the next CRM load shows them as Staff, not PECC.
- **roleToContactType** now includes **hospital_system** and **hiring_group** (mapped to contact type `other`) so those users appear in CRM with a consistent type.

## Round 4 – Normalize role in CRM and Team
- **AdminCRMPage**: Uses `normalizeUserRole(u.role)` when mapping users to contacts and when overwriting contact type by email. Ensures CRM type is always derived from normalized role.
- **AdminTeamTab**: When loading the users list, **role** is set with `normalizeUserRole(r.role)` so filters and role display match the DB regardless of case.

## Rounds 5–10 – Related areas
- **AccountPage**: Already uses `userProfile?.role` (now normalized from context). No change.
- **AdminSettingsPage**: Uses `u.role` for hospital_system/hiring_group; comparisons are string equality. Normalization in Team/context ensures consistency when those users are loaded elsewhere.
- **Registration / cohorts**: Role is set server-side or via invitation; once stored, it is read through the same profile/context and now normalized. No code changes in registration for this audit.
- **Granular permissions**: Use profile/role from context; normalized role and effective role (including is_admin) are used for permissions, so assignment and visibility stay in sync.

## Files changed
- `client/src/types/database.ts` – added `normalizeUserRole()`
- `client/src/context/UserProfileContext.tsx` – normalize role on fetch and enterViewAsUser; effectiveRole = is_admin ? ADMIN : role; use normalized role for PECC/site logic
- `client/src/components/Navbar.tsx` – view-as banner uses userRole (effective) for label
- `client/src/pages/admin/AdminCRMPage.tsx` – roleToContactType includes hospital_system/hiring_group; normalize user role; overwrite contact type from users.role by email
- `client/src/pages/admin/AdminTeamTab.tsx` – normalize role when mapping users from API
- `client/src/components/admin/GranularPermissionsManager.tsx` – normalize role when loading users so displayed role matches assignment
- `client/src/components/admin/SendInvitationDialog.tsx` – filter mentors/managers by normalized role so lists load correctly

## Result
- "View as" always shows the correct role (Admin when is_admin, else actual role).
- CRM contact type for app users always reflects **users.role** (and recategorization in Team).
- Role from DB is always normalized for display and comparison across CRM, Team, settings, and nav.
