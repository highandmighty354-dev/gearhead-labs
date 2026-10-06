-- DATA-FOUNDATION 1.1.0 · 0201 value-write boundary (owner-approved amendment design §3, §9)
-- Applied ON TOP of the frozen DATA-FOUNDATION-1.0.0 migrations 0001-0005; no 1.0.0 file is edited.
--
-- Exactly two changes to existing objects; nothing is created:
--   1. the authenticated INSERT privilege on public.value_records is withdrawn   (granted at 0004_rls.sql:79)
--   2. the now-inert permissive policy df_values_insert is dropped                (created at 0004_rls.sql:83)
-- After this migration the only writer of value_records is trusted server code using the service role
-- (data-foundation-1.1.0/src), which derives the owner from verified authentication.
--
-- Preserved unchanged: SELECT to authenticated and policy df_values_select; triggers df_stamp, df_validate,
-- df_append_only, df_no_truncate; every constraint, foreign key and index; enums; all functions.
--
-- Idempotent (a repeat run is a no-op), deterministic, single transaction. The post-conditions abort the whole
-- transaction if the resulting state is not exactly the approved one. Rollback:
--   data-foundation-1.1.0/supabase/rollback/0201_value_write_boundary.rollback.sql

BEGIN;

REVOKE INSERT ON public.value_records FROM authenticated;
DROP POLICY IF EXISTS df_values_insert ON public.value_records;

DO $$
DECLARE missing text;
BEGIN
  IF has_table_privilege('authenticated', 'public.value_records', 'INSERT') THEN
    RAISE EXCEPTION 'DF_0201_POSTCONDITION: authenticated still holds INSERT on public.value_records';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.value_records', 'SELECT') THEN
    RAISE EXCEPTION 'DF_0201_POSTCONDITION: authenticated lost SELECT on public.value_records';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'value_records'
             AND policyname = 'df_values_insert') THEN
    RAISE EXCEPTION 'DF_0201_POSTCONDITION: policy df_values_insert still present';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'value_records'
                 AND policyname = 'df_values_select' AND cmd = 'SELECT') THEN
    RAISE EXCEPTION 'DF_0201_POSTCONDITION: policy df_values_select missing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'value_records'
             AND cmd IN ('INSERT', 'ALL')) THEN
    RAISE EXCEPTION 'DF_0201_POSTCONDITION: an INSERT-capable policy remains on public.value_records';
  END IF;
  SELECT string_agg(t, ',') INTO missing
    FROM unnest(ARRAY['df_stamp', 'df_validate', 'df_append_only', 'df_no_truncate']) AS t
   WHERE NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.value_records'::regclass
                     AND tgname = t AND NOT tgisinternal);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'DF_0201_POSTCONDITION: value_records trigger(s) missing: %', missing;
  END IF;
END $$;

COMMIT;
