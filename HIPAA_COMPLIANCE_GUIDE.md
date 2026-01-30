# HIPAA Compliance Guide for ImPACTS Web App

This guide outlines how to align the ImPACTS application with HIPAA (Health Insurance Portability and Accountability Act) requirements. **This is not legal advice.** Work with your compliance officer and legal counsel for your specific obligations.

---

## 1. Scope: Are You a Covered Entity or Business Associate?

- **Covered Entity (CE):** Healthcare providers, health plans, clearinghouses that transmit health information electronically.
- **Business Associate (BA):** A person/entity that creates, receives, maintains, or transmits PHI on behalf of a CE.

**ImPACTS today:** The app is designed as an **educational and pediatric readiness tool** that **does not store PHI**. Your Terms of Service explicitly prohibit users from entering patient data (names, MRNs, diagnoses, etc.). That design keeps you out of the “we hold PHI” category **if** users comply.

**If you ever:**  
- Receive or process real patient data (e.g., from a hospital partner), or  
- Provide services to a CE that involve handling PHI  

then you become a **Business Associate** and need a **Business Associate Agreement (BAA)** with that CE and must implement the safeguards below.

---

## 2. Technical Safeguards (What You Can Implement in Code/Infra)

### 2.1 Access Control (You Already Have Much of This)

- **Authentication:** Supabase Auth (email/password) is in place.
- **Authorization:** Row Level Security (RLS) on Supabase tables restricts who can read/write which rows (e.g., users see own profile; admins/managers see more).
- **Recommendations:**
  - Enforce **strong password policy** (length, complexity) in Supabase Auth settings.
  - Consider **session timeout** (e.g., short idle timeout) and **re-authentication** for sensitive actions.
  - Ensure **principle of least privilege**: only grant admin/manager/mentor/pecc access as needed.

### 2.2 Encryption

- **In transit:** All traffic to Supabase and Vercel should use **HTTPS only** (TLS). Supabase and Vercel provide this by default.
- **At rest:** Supabase provides encryption at rest for database and storage. Confirm your Supabase plan includes this and that you do not disable it.
- **Optional (if you ever store PHI):** Application-level encryption for specific PHI fields (encrypt before insert, decrypt after read) with keys managed in a secure vault (e.g., Supabase Vault or external KMS). Not required if you truly store zero PHI.

### 2.3 Audit Controls (Track Who Accessed/Changed What)

HIPAA requires “hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use ePHI.”

- **Current state:** You have `created_at` / `updated_at` on tables but no **who** for every read/change.
- **Recommendation:** Add an **audit log** that records:
  - **Who** (user id / auth.uid())
  - **What** (table name, row id, action: SELECT / INSERT / UPDATE / DELETE)
  - **When** (timestamp)
  - Optionally: IP, user agent, or session id if you need it later.

An optional SQL migration is provided in this repo: **`HIPAA_AUDIT_LOG_MIGRATION.sql`**. It adds a table and triggers so that access and changes to sensitive tables (e.g., `users`, `hospitals`, `hospital_contacts`, `crm_organizations`) are logged. Run it in Supabase SQL Editor if you want database-level audit trails.

- **Retention:** Define how long you keep audit logs (e.g., 6 years) and enforce it (e.g., scheduled job or Supabase Edge Function).

### 2.4 Integrity

- **Current state:** RLS and application logic prevent unauthorized changes. Supabase handles replication/backups.
- **Recommendation:** Avoid giving direct database write access to untrusted users; keep all writes through the app and RLS. Consider checksums or hashes for critical data if you have strict integrity requirements.

### 2.5 Transmission Security

- Use **HTTPS only** for the web app and API (Vercel/Supabase default).
- Do not log request/response bodies that could contain PHI or passwords.

---

## 3. Administrative Safeguards

### 3.1 Business Associate Agreements (BAAs)

- **Supabase:** If you might ever store or process PHI in Supabase, you need a BAA. Supabase offers BAA on certain plans (e.g., Team/Enterprise); confirm with Supabase.
- **Vercel (hosting):** If your app only serves the frontend and calls Supabase (no PHI in serverless logs or env), risk is lower. If you process PHI on Vercel, check whether Vercel offers a BAA for your plan.
- **Other vendors:** Any third party that could access or store PHI (email, analytics, error tracking) should have a BAA or equivalent commitment.

### 3.2 Policies and Procedures

- **Privacy and security policies:** Document how you collect, use, store, and delete data; how you handle breaches; and how you restrict access.
- **Risk assessment:** Periodically assess risks to ePHI (or to PII you do store, e.g., staff names in CRM) and document mitigations.
- **Workforce training:** Train anyone with access to the system on HIPAA basics, no-PHI policy, and incident reporting.

### 3.3 Incident Response and Breach Notification

- Define steps: detect → contain → assess → notify. HIPAA has specific breach notification rules (e.g., to individuals, HHS, and sometimes media) with timelines.
- Document who is responsible and how you would notify users/partners if data were compromised.

---

## 4. What the App Already Does Well

- **No-PHI policy:** Terms of Service clearly prohibit PHI and warn of consequences. This is your main design control.
- **Access control:** RLS and role-based access (admin, manager, mentor, PECC) limit what each user can see and edit.
- **Authentication:** Centralized auth via Supabase; no PHI in URLs or client-side storage by design.
- **Sensitive tables:** Users, hospitals, contacts, CRM data are behind RLS; no public read-all.

---

## 5. Checklist Summary

| Area | Action |
|------|--------|
| **Design** | Keep “no PHI in the app” as policy; enforce via ToS and training. |
| **Access** | Strong passwords, session timeout, least privilege (already partly done via RLS). |
| **Encryption** | HTTPS only; confirm Supabase encryption at rest. |
| **Audit** | Add and retain audit log for access/changes to sensitive tables (use `HIPAA_AUDIT_LOG_MIGRATION.sql` if desired). |
| **BAAs** | Get BAA with Supabase (and any other processor) if you might ever handle PHI. |
| **Policies** | Document privacy/security policies, risk assessment, and incident response. |
| **Training** | Train staff and users on no-PHI policy and security practices. |

---

## 6. If You Never Store PHI

If ImPACTS will **never** create, receive, maintain, or transmit PHI (only de-identified or training data), you may not be a HIPAA Business Associate for that use. You still have obligations for **PII** (e.g., staff names, emails in CRM) under other laws and good practice. The same technical and administrative measures (access control, encryption, audit, policies) strengthen privacy and security overall and prepare you if your scope ever changes.

---

*Document version: 1.0. For questions, consult your compliance and legal team.*
