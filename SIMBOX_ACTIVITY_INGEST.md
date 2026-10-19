# SimBox → PECC Activities ingest

When a SimBox case completes at a mapped hospital site, ImPACTS appends a **Simulation Facilitation** row to that hospital’s Activities (`hospital_data.activities`).

## Components

| Piece | Location |
| --- | --- |
| Mapping table | `public.simbox_site_hospitals` (`SIMBOX_SITE_HOSPITALS.sql`) |
| Append RPC | `public.append_simbox_hospital_activity(facility_id, activity jsonb)` |
| Edge Function | `supabase/functions/ingest-simbox-activity` |
| Auth | Header `x-simbox-ingest-secret` = project secret `SIMBOX_INGEST_SECRET` |

Endpoint:

`https://ftpifgzzfwpujlvbqqhu.supabase.co/functions/v1/ingest-simbox-activity`

## Register a hospital site (admins)

```sql
INSERT INTO public.simbox_site_hospitals (site_key, facility_id, notes)
VALUES ('EMORY_ED', '110010', 'Emory University Hospital ED')
ON CONFLICT (site_key) DO UPDATE
  SET facility_id = EXCLUDED.facility_id,
      active = true,
      notes = EXCLUDED.notes,
      updated_at = now();
```

- `site_key` must match SimBox `?simbox_site=` / `metadata.siteKey` (`^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$`).
- `facility_id` must exist on `public.hospitals`.

## Curl test

```bash
export SIMBOX_INGEST_SECRET='…'   # from Supabase secrets
curl -sS -X POST \
  'https://ftpifgzzfwpujlvbqqhu.supabase.co/functions/v1/ingest-simbox-activity' \
  -H "x-simbox-ingest-secret: $SIMBOX_INGEST_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{
    "site_key": "SIMBOX_TEST",
    "case_key": "SimBox_Pediatric_Cardiac_Codes",
    "case_display_name": "Pediatric Cardiac Codes",
    "session_id": "test-session-001",
    "occurred_at": "2026-10-19T15:00:00.000Z",
    "hours": 1,
    "participants": 4
  }'
```

- Unmapped `site_key` → **404**
- Same `session_id` twice → **200** with `"duplicate": true` (no second row)

## SimBox Analytics webhook (other repo)

After `case_completed` (and a resolvable `siteKey`), POST the JSON body above to this function with the shared secret. Until that webhook exists, use curl.

## Notes

- Activities UI reads `hospital_data` only — do not write solely to legacy `pecc_activities`.
- Prefer Resend/Zoho mail is unrelated; this path is service-role + shared secret only.
