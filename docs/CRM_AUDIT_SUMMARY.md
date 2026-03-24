# CRM Audit Summary (10 Rounds)

## Round 1 – Data integrity & validation
- **Critical**: Merge contacts did not merge `linkedSystemIds` / `linked_system_ids`; Hiring Group and System links were lost. **Fixed**: merge now includes `mergedLinkedSystems` and persists `linked_system_ids` in DB and local state.
- **Validation**: No client-side check for required name on Hospital/System/Hiring Group or first/last name on person. **Fixed**: Save now validates and shows clear errors before submit.

## Round 2 – Error handling
- **Critical**: On hospital update failure, local state was still updated with the failed payload, so the UI could show “saved” data that never persisted. **Fixed**: On error we `return` and do not update `contacts` state.

## Round 3 – Delete safety
- **Urgent**: Single-contact delete had no type-to-confirm; only bulk delete required typing "DELETE", increasing accidental delete risk. **Fixed**: Single and bulk delete both require typing "DELETE" to enable the Delete button; confirmation text is reset when opening the dialog.

## Round 4 – UX consistency
- **Suboptimal**: Note delete used `window.confirm`. **Fixed**: Replaced with a proper confirmation Dialog and an accessible delete button (`aria-label`).

## Round 5 – Accessibility
- **Suboptimal**: No `aria-sort` on sortable columns; row actions button had no `aria-label`. **Fixed**: Sortable column headers have `aria-sort` and keyboard support (Enter/Space); row actions button has `aria-label="Actions for {name}"`.

## Rounds 6–9 – Edge cases & consistency
- Merge already handled hospital vs crm_organizations correctly; user-sourced contacts are not deleted from DB on merge (only removed from local list). No further code changes.
- Console.error/warn retained for debugging; save errors already surface via `setSaveError` in the UI.

## Round 10 – Implementation & deploy
- All listed fixes implemented and verified with linter.
- Deploy via push to `main`.

---

## Rounds 11–20 – CRM export, Manager picker, contact permissions (batch)

### Round 11 – CRM CSV export cell quoting
- **Issue:** Every cell was wrapped in double quotes, so numeric fields opened in Excel as text.
- **Fix:** Shared `formatCsvCell()` in `client/src/utils/csvFormat.ts` (RFC 4180–style: quote only when needed). `AdminCRMPage` `runExport` uses it for headers and values.

### Round 12 – Manager CRM “Add hospital” hospital list
- **Issue:** Single `.range(0, 99999)` can still hit PostgREST per-request row limits; errors from the hospitals query were ignored.
- **Fix:** Paginate in 1000-row chunks until a short page; surface Supabase errors via snackbar; mentor list load errors surfaced too.

### Round 13 – CRM contact granular permissions load
- **Issue:** `pending_*` and live `user_permissions` / `view_tabs` queries could fail silently (empty UI, no message).
- **Fix:** `ContactGranularPermissions` checks `error` on both parallel results and shows a snackbar; save handlers include Supabase `error.message` when present.

### Round 14 – Save feedback clarity
- **Issue:** Generic “Failed to save” for permission/tab toggles.
- **Fix:** Same component: append server message when available (pending and registered user paths).

### Round 15 – Documentation parity
- **Check:** `CRM_AUDIT_REPORT.md`, `CRM_COHORT_CONNECTIVITY_AUDIT.md`, and `CRM_ROLE_ASSIGNMENT_AUDIT.md` remain the source for earlier multi-audit passes; this file now records rounds 11–20.

### Rounds 16–20 – Verified / no code change this batch
- **16:** Admin CRM `SendInvitationDialog` mounted once (duplicate removed previously).
- **17:** Cohort name → ID matching remains trim + case-insensitive in CRM save paths.
- **18:** Hospital update OR `facility_id` / `id` still required for edge rows (see CRM_AUDIT_REPORT).
- **19:** `provision-crm-portal-user` remains admin-gated server-side.
- **20:** Manager CRM contact CRUD still validates hospital scope before save/delete.

---

*Batch rounds 11–20: implement together and deploy with one commit to `main`.*

---

## Rounds 21–30 – UX parity, export safety, debounced search, import acknowledgment

### Round 21 – Manager CRM contact delete
- **Issue:** `window.confirm` for removing a contact; inconsistent with Admin CRM type-DELETE pattern.
- **Fix:** Shared `TypeDeleteConfirmDialog` (`client/src/components/crm/TypeDeleteConfirmDialog.tsx`); user must type DELETE before Remove.

### Round 22 – Debounced CRM search (Admin + Manager)
- **Issue:** Filtering ran on every keystroke on large lists.
- **Fix:** `useDebouncedValue` (300ms) for Admin CRM main search and Manager hospital/contact search inputs.

### Round 23 – CRM CSV export PII
- **Issue:** One-click download of potentially sensitive PII.
- **Fix:** After choosing columns, a second dialog explains PII; **Download CSV** runs the actual export.

### Round 24 – CSV import acknowledgment
- **Issue:** Import could run without explicit confirmation after mapping.
- **Fix:** Checkbox “I have reviewed…” required before **Import N Contact(s)**.

### Round 25 – `buildCrmExportCsv` helper
- **Issue:** Export string building lived inline in AdminCRMPage.
- **Fix:** `client/src/utils/crmExport.ts` uses `formatCsvCell` for a single place to maintain.

### Round 26 – Load retries (Admin CRM)
- **Fix:** **Retry** on primary `loadError` and `usersLoadError` alerts calling `loadAllContactsFromSupabase()`.

### Round 27 – Manager contacts load error
- **Fix:** `contactsLoadError` + **Retry** on Contacts tab when `loadContacts` fails.

### Round 28 – Manager vs Admin scope copy
- **Fix:** Info `Alert` at top of Manager CRM pointing admins to full Admin CRM for org-wide tools.

### Round 29 – Manager contacts table narrow screens
- **Fix:** `TableContainer` `overflowX: 'auto'` + `maxWidth: '100%'`.

### Round 30 – Tests
- **Fix:** `client/src/utils/csvFormat.test.ts` for `formatCsvCell` (Jest via react-scripts).

### Deferred (larger refactors)
- **Split `AdminCRMPage.tsx` into multiple files** (still recommended incrementally).
- **Virtualized table** for 10k+ rows (add `@tanstack/react-virtual` or similar when needed).
- **GranularPermissionsManager** split / tests (optional follow-up).
