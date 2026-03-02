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
