# Restored Chat Context (ImPACTS Web App)

Restored from workspace storage `state.vscdb` (ItemTable: `aiService.generations`, `aiService.prompts`).  
This is a summary of **your prompts** from the lost chat; full AI responses are not stored in workspace DB.

Use this for context when continuing work. Deploy target: **Vercel project "impacts"** (push to `origin main`).

---

## Settings & Cohorts (Mentors)

- **Settings tab**: Fixed; confirmed need to keep functionality for choosing which specific cohorts Mentors can invite PECCs to.
- **Cohorts (Mentors)**: Mentors’ Cohorts page should be laid out like the PECC’s page with the same text box functionalities.
- **Discussion replies**: Mentors, Managers, and Admins must be able to **reply** to cohort discussion posts (not only start new discussions). Admins and Managers should be able to delete other people’s posts.

---

## Mentor Snapshot & Activities

- **Mentor Snapshot tab**: Full review — should reflect their activity metrics, development of their PECCs, and PECC engagement. Clean, modern, intuitive; one-liner per chart for what it denotes and where data comes from (like PECC Snapshot).
- **Mentor Snapshot content**: Add: number of simulations per hospital, which simulations done most, activities mentor did with each hospital, hours spent with each hospital; if input, chart of hospitals’ Pediatric Readiness Scores over time. PRS chart: toggle hospitals, dot-and-line plot; single hospital = time-based, multiple = "PRS 1", "PRS 2", etc.
- **Mentor tab order**: Snapshot tab moved to be first for Mentors.
- **Add Activity**: When choosing “Which of your hospital(s) was this with?”, list should be **alphabetically ordered**.

---

## Manager Tier

- **Dashboard**: Remove from top tier; rename like other tiers. Page should show their Mentors, number of sites/PECCs, and allow clicking through to CRM with notes/info.
- **Mentors tab**: Manager sees list of mentors; click/expand for info; from this tab, view each Mentor’s (and their PECCs’) accounts — activities, checklists, progress, etc.
- **CRM (Managers)**: See only hospitals they manage; can add new hospitals and contacts; toggle what specific PECCs/Mentors/cohorts can see/do (e.g. mass-hide pediatric readiness assessment, or hide checklist for one person).
- **Programs**: Hidden for Managers.
- **Cohorts**: Full functionality; monitor/manage discussion posts.
- **Managers doing Mentor work**: Those directly working with PECCs should have Mentor-level functionality in the Manager tier.
- **Wages & Expenses**: Merged into Mentors tab in a clean way; easily toggled on/off by managers/admins.
- **Manager Snapshot**: Comprehensive Snapshot tab added; Managers doing Mentor work can track their activities too.
- **Manager add hospital**: Default to pulling from existing CRM list; if not there, allow adding unlisted site. Contact adding improved. Then: state → city → hospitals dropdown for choosing/adding hospital.
- **Mentors tab (Manager)**: Snapshot and Overview combined; quick action buttons at bottom (Mentors, CRM, Overview) removed for Mentors snapshot.
- **Manager invite Mentors**: When inviting or viewing Mentors in CRM, allow inviting them to **specific cohorts**.

---

## Admin CRM & Permissions

- **Admin CRM**: Must be **100% fully restored** — layout, functionalities, nuances. There was strong concern when CRM functions appeared missing; everything must remain.
- **Admin Cohorts tab**: Admins have a Cohort tab: see all discussion posts, fully post, reply, manage, delete, give announcements.
- **Granular Permissions**: Fix so Users show correctly (e.g. staff not listed as PECCs vs admins). Need way to search users; ideally integrated into each person’s CRM page. Making someone Admin should override PECC/Mentor/Manager. Admin toggle options should properly reflect that. There was ongoing disconnect between CRM positions/tiers and Granular Permissions Management.

---

## Education, Gap Plan, Learn More

- **Education (Gaps/Education tab)**: Pre-canned questions removed; questions only from Admin education settings. Restore bullet points and formatting: bold, underline, italicize, hyperlink. Deploy to impacts.
- **Admin education settings – adding question**: Category (shows next to question number); in full “learn more” page, add the actual assessment question. No required fields; allow adding whatever is available.
- **Gap Plan – add**: When PECC adds a Gap Plan, it must show in the table right after Add (no refresh needed). When viewing a question, show any **associated gaps** tagged on it (interconnected).
- **“Gap plans for this question”**: Show actual gap(s) for that question, not activities from Activities tab. Category display: e.g. “Question 22: Physician/APP coordinator (PECC)” then “’X’ gap plan for this question”; on click show full question text, Why, Background, Example, Sustainability Practices, Additional Resources, Gap Plans for this question.
- **Gap Plan list**: Show only question number and category; full question only in “learn more.” Full question hidden from list. Deploy.
- **Learn more popup – additional resources**: Each entry a bullet point; text color classic hyperlink blue.
- **Gap Plan table**: Remove ranking column; add sorting by question number, status, due date (all as columns). Show category instead of full question. Drag to reorder. “Education Resources” section default open accordion. Deploy to impacts.
- **Gap Plan “+ Gap Plan” button**: Fix so popup opens for each question (was not opening; console logs were provided). Redeploy.

---

## Usage & CRM Visibility

- **Usage data**: Much more robust — per user on CRM page and in Snapshot reports. Track: links clicked, time on each page, checklists, activities, etc. As strong as possible.
- **CRM**: Ensure usage/analytics shows up on CRM page for each user properly.
- **Cohort discussions**: For each tier, ensure user can **type/post** in cohort discussions (not only view). Restore rich capabilities: bold, italicize, hyperlink, upload, etc. Then deploy.

---

## SCORM Packages (Admin)

- **SCORM management (Admin settings)**: When uploading SCORM packages, need to manage: who can see them, which cohorts, tracking who clicked, who completed, certificate of completion, icon/badge in profile with completion date/time. Some packages only for specific programs, cohorts, people, states. Control **where** user sees it: Education tab, Cohort tab, Checklist, etc. Manage from admin settings. Then deploy.

---

## Deployments

- Deploy target is **impacts** (not “impacts-web-app”). Push to `origin main` after changes; auto-deploy via GitHub → Vercel.
- Multiple “Deploy to impacts” / “Redeploy” requests throughout the conversation.

---

## Workspace Metadata (from storage)

- **Workspace**: `file:///Volumes/4TB%20Ext%20HD/.../ImPACTS-Web-App`
- **Composer**: Single head composer ID referenced; no full thread content in workspace DB.
- **Cursor rule**: `.cursor/rules/push-after-updates.mdc` — commit with clear message, push `origin main` after updates.

---

*Last restored: from `a3124e0b0eaaeaf5e9d761131a09b5b8` workspaceStorage state.vscdb.*
