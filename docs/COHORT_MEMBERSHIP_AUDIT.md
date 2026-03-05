# Cohort membership – 25-point audit

## 1. InviteMemberDialog – user list source
- **Fix:** Use RPC `get_users_for_granular_permissions` for both admin and manager when `canAddDirectly` is true so the Add Member list shows everyone (not limited by users table RLS).
- **Status:** Done. Fallback to users table with clear error if RPC and fallback both fail.

## 2. InviteMemberDialog – empty list messaging
- **Fix:** When list is empty and user can add directly, show hint to run `GRANULAR_PERMISSIONS_USERS_LIST_RLS.sql` in Supabase.
- **Status:** Done.

## 3. InviteMemberDialog – duplicate insert (23505)
- **Fix:** Catch unique violation and show “This user is already a member of this cohort.”
- **Status:** Done.

## 4. InviteMemberDialog – insert response shape
- **Fix:** Normalize insert response (user can be object or array) and set `added_at` fallback so new member renders correctly.
- **Status:** Done.

## 5. MemberList – existingMemberIds and canAddDirectly
- **Check:** `existingMemberIds={members.map(m => m.user_id)}` and `canAddDirectly={canManage}`. Correct.
- **Status:** Verified.

## 6. MemberList – role order (all tiers)
- **Check:** roleOrder includes Admin, Manager, Mentor, PECC, Hospital System, Hiring Group.
- **Status:** Done previously.

## 7. CohortDetail – handleMemberAdded
- **Fix:** Optimistic update only (no refetch) so new member stays visible.
- **Status:** Done.

## 8. CohortDetail – handleMemberRemoved
- **Check:** Removes from state and calls `loadData()` for fresh list.
- **Status:** Verified.

## 9. CohortDetail – loadData members merge
- **Check:** Fetches cohort_members (active) and cohort_managers, merges and dedupes. Correct.
- **Status:** Verified.

## 10. CohortDetail – refetch when opening Members tab
- **Fix:** When switching to Members tab, call `loadData()` so the list is live.
- **Status:** Done.

## 11. CohortsPage – canManage / canInvite for PECC and Mentor
- **Check:** canManage false, canInvite for mentor. Members tab not shown for PECC/Mentor (stacked layout).
- **Status:** Verified.

## 12. AdminCohortsPage – canManage / canInvite
- **Check:** canManage and canInvite true. Correct for full Add Member.
- **Status:** Verified.

## 13. ManagerCohortsPage – canManage / canInvite
- **Check:** canManage and canInvite when manager. RPC now used so manager sees full user list when adding.
- **Status:** Fixed via InviteMemberDialog RPC for canAddDirectly.

## 14. PendingInvitationsPanel – approve adds to cohort_members
- **Check:** On approve, inserts into cohort_members and calls onInvitationProcessed. Admin/Manager pages pass loadCohorts() to refresh.
- **Status:** Verified.

## 15. InvitationPage – add to cohort_members on accept
- **Check:** On PECC accept, upserts cohort_members with status 'active' for cohort_ids.
- **Status:** Verified (status already present).

## 16. AdminCRMPage – sync cohort_members when saving contact
- **Check:** Person contacts with cohorts get cohort_members synced (add/remove by cohort_ids). Uses upsert with onConflict.
- **Status:** Verified.

## 17. CohortSnapshotTab – uses cohort_members
- **Check:** Reads cohort_members for snapshot. No add/remove here.
- **Status:** Verified.

## 18. ScormPackagesSection – cohort_members for “my cohorts”
- **Check:** Selects cohort_id from cohort_members for current user. Read-only.
- **Status:** Verified.

## 19. usePermissions – cohort_members for tab visibility
- **Check:** Uses cohort_members for PRS section tab visibility. Read-only.
- **Status:** Verified.

## 20. useCohortNotifications – cohort_members
- **Check:** Subscribes to cohort_members for notifications. No write.
- **Status:** Verified.

## 21. Live updating – Members tab refetch
- **Fix:** Refetch members when user switches to Members tab.
- **Status:** Done.

## 22. Visual efficiency – Member list grouping
- **Check:** Members grouped by role with chips and counts. Remove button only for removable members.
- **Status:** Verified.

## 23. Intuitive design – Add Member dialog
- **Check:** Clear title “Add Member”, Select User autocomplete, role chip in options, Add/Cancel, error and empty-state messages.
- **Status:** Verified; empty-state hint added.

## 24. RLS and RPC – backend requirement
- **Requirement:** Run `GRANULAR_PERMISSIONS_USERS_LIST_RLS.sql` in Supabase so `get_users_for_granular_permissions` exists and admins/managers can see all users.
- **Status:** Documented in dialog and audit.

## 25. End-to-end flow
- **Check:** Open cohort → Members → + Add Member → full list (admin/manager) → select user → Add → member appears in list; duplicate shows message; remove works and list refetches.
- **Status:** Implemented and verified.
