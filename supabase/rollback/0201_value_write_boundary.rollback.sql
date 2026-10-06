-- DATA-FOUNDATION 1.1.0 · ROLLBACK of 0201 value-write boundary (owner-approved amendment design §3, §9)
-- NOT a forward migration: kept outside supabase/migrations/ so no migration runner ever applies it as one
-- (a second file with the 0201 version prefix inside migrations/ would collide with 0201 itself).
-- Restores the exact DATA-FOUNDATION-1.0.0 state of the two objects 0201 changes:
--   - GRANT INSERT on public.value_records to authenticated            (as 0004_rls.sql:79)
--   - policy df_values_insert re-created verbatim                        (as 0004_rls.sql:83)
-- Idempotent (drop-if-exists then create, as 0004 does). Verified by the 1.1.0 suite: the post-rollback catalog
-- fingerprint equals a fresh DATA-FOUNDATION-1.0.0 database exactly.

BEGIN;

GRANT INSERT ON public.value_records TO authenticated;
DROP POLICY IF EXISTS df_values_insert ON public.value_records;
CREATE POLICY df_values_insert ON public.value_records FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

DO $$
BEGIN
  IF NOT has_table_privilege('authenticated', 'public.value_records', 'INSERT') THEN
    RAISE EXCEPTION 'DF_0201_ROLLBACK_POSTCONDITION: authenticated INSERT not restored';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'value_records'
                 AND policyname = 'df_values_insert' AND cmd = 'INSERT') THEN
    RAISE EXCEPTION 'DF_0201_ROLLBACK_POSTCONDITION: policy df_values_insert not restored';
  END IF;
END $$;

COMMIT;
