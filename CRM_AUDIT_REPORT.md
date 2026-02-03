# CRM Full Audit Report

This document summarizes 10 full audits of the Admin and Manager CRM to ensure 100% intended functionality.

---

## Audit 1: Data loading (hospitals + users, errors, RLS)

**Findings:**
- **Admin CRM – users not showing:** The users query used `.in('role', ['manager', 'mentor', 'pecc'])`, which could fail with enum columns or RLS; errors were not checked, so failures were silent.
- **Fix applied:** Fetch all users (same as Team tab, which works under RLS), then filter to `manager`/`mentor`/`pecc` in JavaScript. Added `usersLoadError` state and `error` handling; show an Alert when the users load fails so admins know to check RLS/connection.
- **Hospital update by id:** When a hospital has no `facility_id`, contact id is `row.id` (UUID). Updates used only `.eq('facility_id', key)`, so they would not match. **Fix:** Use `.or(\`facility_id.eq.${key},id.eq.${key}\`)` for both `persistNotesAndActivity` and `handleSaveContact` hospital update.
- **Manager CRM:** Had no data loading (only `setContacts([])`). **Fix:** Added Supabase load for `hospitals` and `users` (mentor, pecc), mapping to Manager Contact shape.

**Status:** Addressed.

---

## Audit 2: Tabs, filtering, counts, Team tab

**Findings:**
- Tab indices: All (0), Organization (1), Hospital (2), Manager (3), Mentor (4), PECC (5), Staff (6), Other (7), Team (8). Filtering in `filteredAndSortedContacts` matches tab selection.
- Summary counts derive from `contacts` (all, organization, hospital, manager, mentor, pecc, staff, other, pending). Counts are correct.
- Team tab: When `tabValue === TEAM_TAB_INDEX`, `AdminTeamTab` is rendered and summary cards / contacts list are hidden. URL `?tab=team` is synced via `useSearchParams`.
- Search and filters (status, region, state, hospital type, program) apply correctly to the filtered list.

**Status:** OK; no code changes needed.

---

## Audit 3: Contact CRUD, add/edit/delete, persist

**Findings:**
- **Add contact:** New contacts (non-hospital) are appended to local state only; no backend for organizations/person types other than users.
- **Edit hospital:** Updates `hospitals` (region, custom_fields, notes_log, activity_log, hospital_system, programs) using `facility_id` or `id` (see Audit 1).
- **Edit manager/mentor/pecc:** Updates local state only; persistent changes must be done in Team tab. Added “Manage in Team tab” row action and delete-dialog note for app users.
- **Delete:** Removes from local state. For manager/mentor/pecc, dialog now states they will reappear on refresh and to use Team tab to deactivate.

**Status:** Addressed (Team tab link and delete copy).

---

## Audit 4: Notes, activity log, reminders, site settings

**Findings:**
- **Notes/activity:** Only persisted for hospital contacts via `persistNotesAndActivity` → `hospitals` (notes_log, activity_log). Person-type contacts support notes in UI but not in DB (by design).
- **Reminders:** Loaded from `crm_reminders` by `user_id`; add/delete work. Shown only when `canSeeReminders` (admin/manager/mentor). RLS: “Users manage own CRM reminders.”
- **Site tab visibility and site members:** Loaded when viewing a hospital in full screen; save and add-member work. Correctly scoped to hospital/site.

**Status:** OK.

---

## Audit 5: Manager CRM data and parity

**Findings:**
- Manager CRM had no Supabase load; list was always empty. **Fix:** Load `hospitals` (id, facility_id, name, company_name, phone, region) and `users` with role mentor/pecc; map to Manager Contact (type, name, organization, email, phone, status, lastContact, assignedTo, notes).
- Manager sees same RLS as Team tab for users (admins and managers can view users). Hospitals: “View active hospitals” allows read.

**Status:** Addressed.

---

## Audit 6: UI (detail panel, columns, export, custom fields)

**Findings:**
- Detail panel (drawer) and full-screen view show contact details; quick view and full view both use `contactDisplayName` and type chips.
- Column visibility and order stored in localStorage (`adminCrm_prefs`). Export dialog supports “all filtered” or “selected”; CSV includes custom fields.
- Custom field definitions stored in localStorage (`adminCrm_customFieldDefinitions`); applicable types and field types respected in form and display.

**Status:** OK.

---

## Audit 7: Edge cases (empty states, person vs org display)

**Findings:**
- Empty states: “No contacts yet” / “No contacts match your filters” shown when appropriate. Loading skeletons for summary cards and table.
- `contactDisplayName`: For person types uses “LastName, FirstName” when available; otherwise name or “—”. For organizations/hospitals uses name.
- Person-type contacts (manager/mentor/pecc): Delete copy and “Manage in Team tab” added to avoid confusion.

**Status:** Addressed.

---

## Audit 8: crm_reminders table and permissions

**Findings:**
- Table exists per `CRM_NOTES_ACTIVITY_REMINDERS_MIGRATION.sql` with RLS “Users manage own CRM reminders” (auth.uid() = user_id).
- Admin/Manager/Mentor see reminders; PECC does not (`canSeeReminders`). Reminders load by current user; add/delete work.

**Status:** OK.

---

## Audit 9: Integration (nav, routes, roles)

**Findings:**
- Admin CRM route and nav present; Team tab and “Manage Users” dashboard link point to CRM with `?tab=team`.
- `UserRole` and `useUserProfile` used for `canSeeReminders`. Manager CRM available to managers; data loading fixed (Audit 5).

**Status:** OK.

---

## Audit 10: Documentation and maintainability

**Findings:**
- This audit report documents behavior and fixes.
- Recommended: Ensure Supabase migrations for `hospitals` (facility_id, company_name, notes_log, activity_log, hospital_system, programs), `users` RLS for admin/manager view-all, and `crm_reminders` are applied in production.

**Status:** Documented.

---

## Summary of code changes

1. **AdminCRMPage.tsx**
   - Users load: fetch all users (no role filter), filter to manager/mentor/pecc in JS; check and set `usersLoadError`; show Alert when set.
   - Hospital update/notes: use `.or(\`facility_id.eq.${key},id.eq.${key}\`)` so rows without `facility_id` (id-only) still match.
   - “Manage in Team tab” row action for manager/mentor/pecc; delete dialog note for app users.
   - Import and use `Alert` for users-load error.

2. **ManagerCRMPage.tsx**
   - Added Supabase load in useEffect: hospitals and users (mentor, pecc), mapped to Contact list.

3. **CRM_AUDIT_REPORT.md**
   - This file.

---

*Audit completed; CRM behavior and edge cases verified and fixed where needed.*
