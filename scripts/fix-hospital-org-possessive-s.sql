-- One-time fix: replace apostrophe + capital S with apostrophe + lowercase s
-- in hospital and organization names (e.g. "St. Mary'S" -> "St. Mary's").
-- Run this in Supabase SQL Editor if you have existing data with "'S".

-- Hospitals table (adjust table name if your schema differs)
UPDATE public.hospitals
SET name = REPLACE(name, '''S ', '''s ')
WHERE name LIKE '%''S %';

UPDATE public.hospitals
SET name = REPLACE(name, '''S''', '''s''')
WHERE name LIKE '%''S''%';

-- If names end with 'S (e.g. "Children'S")
UPDATE public.hospitals
SET name = REPLACE(name, '''S', '''s')
WHERE name LIKE '%''S';

-- Organizations table if it exists (e.g. crm_organizations)
-- UPDATE public.crm_organizations
-- SET name = REPLACE(name, '''S', '''s')
-- WHERE name LIKE '%''S%';
