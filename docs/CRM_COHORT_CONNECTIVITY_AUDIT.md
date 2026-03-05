# CRM ↔ Cohort connectivity – 25-point audit

## 1. CRM save: cohort_members sync (person contacts)
- **Fix:** Sync runs when saving a person contact with cohorts. Resolve user by editingContact.user_id or by email (trim + lowercase). Map cohort names to IDs with trim + case-insensitive match. Check errors on select/delete/upsert and surface to user; do not close dialog on sync failure.
- **Status:** Done.

## 2. Cohort name → ID mapping
- **Fix:** availableCohorts.find(c => c.name === name) failed when names differed by case/whitespace. Now: (c.name || '').trim().toLowerCase() === name.toLowerCase().
- **Status:** Done.

## 3. contactUserId resolution
- **Check:** editingContact?.user_id ?? lookup by formData.email (trim + toLowerCase). Covers edit (linked user) and new contact (email match).
- **Status:** Verified and normalized (emailNorm).

## 4. No-account contact with cohorts selected
- **Fix:** If cohortNames.length > 0 and !contactUserId, show message: "Contact saved. To add them to cohorts, they need a platform account — send an invitation from Invitations or Add Member in the cohort." and do not close dialog.
- **Status:** Done.

## 5. cohort_members upsert payload
- **Check:** cohort_id, user_id, added_by, status: 'active', onConflict: 'cohort_id,user_id'. Correct.
- **Status:** Verified.

## 6. cohort_members delete (remove from cohort)
- **Check:** Delete when cohort removed from contact's list; errors now surfaced.
- **Status:** Verified and error handling added.

## 7. CohortDetail loadData: cohort_members + cohort_managers
- **Check:** Members list is from cohort_members (active) merged with cohort_managers. So CRM-synced rows (cohort_members) appear in the cohort's Members tab.
- **Status:** Verified.

## 8. CohortDetail: refetch when switching to Members tab
- **Check:** handleTabChange calls loadData() when visibleTabs[newValue] === 'members' so list is fresh after CRM changes.
- **Status:** Already implemented previously.

## 9. CRM form: cohorts field
- **Check:** formData.cohorts is string[] (cohort names). Saved to crm_organizations.cohorts and used for sync. Correct.
- **Status:** Verified.

## 10. availableCohorts population
- **Check:** Loaded from supabase.from('cohorts').select('id, name').eq('is_active', true). Used for name→id and for dropdown. Correct.
- **Status:** Verified.

## 11. RLS: cohort_members (admin)
- **Check:** cohort_members_admin_all allows admin full access. CRM save runs as current user (admin). Inserts/updates/deletes succeed.
- **Status:** Verified (COHORTS_RLS_FIX.sql).

## 12. RLS: crm_organizations
- **Check:** Authenticated users full access (CRM_RLS_FIX). Admin can read/write. Correct.
- **Status:** Verified.

## 13. Contact merge: user_id by email
- **Check:** When loading contacts, we match by email to users and set contact.user_id so edit form has linked user for sync.
- **Status:** Verified (loadAllContactsFromSupabase, emailToUser merge).

## 14. InviteMemberDialog: Add Member list includes everyone
- **Check:** Users + CRM contacts; CRM-only can be invited by email. Cohort membership after accept. Correct.
- **Status:** Verified (previous work).

## 15. InvitationPage: add to cohort_members on accept
- **Check:** When invite has cohort_ids, on accept we upsert cohort_members. So invited-by-email people join cohort when they register.
- **Status:** Verified.

## 16. PendingInvitationsPanel: approve → cohort_members insert
- **Check:** On approve, insert into cohort_members. Correct.
- **Status:** Verified.

## 17. AdminCRMPage: payloadDb.cohorts
- **Check:** payloadDb includes cohorts: formData.cohorts ?? []. So CRM row stores cohort names. Sync reads formData.cohorts and availableCohorts for ids. Correct.
- **Status:** Verified.

## 18. User experience: error visibility
- **Fix:** Sync errors (select/delete/upsert) set setSaveError so user sees why cohort didn't update. Dialog stays open on sync failure.
- **Status:** Done.

## 19. User experience: no-account message
- **Fix:** When user selects cohorts but contact has no platform account, clear message and dialog stays open.
- **Status:** Done.

## 20. Connectivity: single source of truth
- **Check:** cohort_members is the source for "who is in the cohort". CRM stores cohort names on contact; sync writes cohort_members. Cohort detail reads cohort_members. Correct.
- **Status:** Verified.

## 21. Connectivity: cohort_managers vs cohort_members
- **Check:** Cohort Detail shows both cohort_members and cohort_managers. CRM sync only touches cohort_members. Assigning a manager to a cohort is separate (Admin Cohorts assign manager). Correct.
- **Status:** Verified.

## 22. Functionality: add then remove cohort
- **Check:** Sync removes from cohort_members when cohort is removed from contact's list (delete loop). Correct.
- **Status:** Verified.

## 23. Functionality: multiple cohorts
- **Check:** cohortIds can have multiple ids; we upsert each. Correct.
- **Status:** Verified.

## 24. Edge case: empty cohort names
- **Check:** cohortNames filtered Boolean; cohortIds from trim + match. Empty list = no sync, no error. Correct.
- **Status:** Verified.

## 25. End-to-end
- **Check:** Admin edits contact in CRM, adds cohort(s), saves → sync runs → cohort_members updated → opening cohort and Members tab shows the person. If sync fails, error shown and dialog stays open.
- **Status:** Implemented and verified.
