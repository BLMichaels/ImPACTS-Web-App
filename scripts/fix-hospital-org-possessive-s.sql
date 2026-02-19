-- One-time fix: replace apostrophe + capital S with apostrophe + lowercase s
-- in hospital names (e.g. "St. Mary'S" -> "St. Mary's").
-- Run in Supabase: SQL Editor → New query → paste → Run.

-- Straight apostrophe (')
UPDATE public.hospitals
SET name = REPLACE(name, '''S', '''s')
WHERE name LIKE '%''S%';

-- Curly apostrophe (') — Unicode U+2019
UPDATE public.hospitals
SET name = REPLACE(name, CHR(8217) || 'S', CHR(8217) || 's')
WHERE name LIKE '%' || CHR(8217) || 'S%';

-- Optional: fix organization names if you have a similar table
-- UPDATE public.crm_organizations
-- SET name = REPLACE(REPLACE(name, '''S', '''s'), CHR(8217) || 'S', CHR(8217) || 's')
-- WHERE name LIKE '%''S%' OR name LIKE '%' || CHR(8217) || 'S%';
