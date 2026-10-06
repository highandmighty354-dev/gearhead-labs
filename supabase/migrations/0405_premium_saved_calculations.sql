-- PREMIUM-FOUNDATION 1.0.0 · 0405 saved_calculations (Premium; owner decision 1: Free = no saved calculations)
-- User-authored organisation of the IMMUTABLE calculation history. The underlying public.calculation_records row is
-- written only by the trusted server path (CALCULATION-FOUNDATION, service role); clients still cannot insert it.
-- A saved calculation references one of the caller's own calculation records (composite FK) and may be linked to
-- the caller's machine and/or test setup (Build = Test Setup). Links must be consistent: a test setup implies its
-- machine, and a calculation recorded against a machine can only be filed under that machine.
-- Create/update require pf_has_feature('saved_calculations'); read and soft delete stay available after a lapse.
-- Idempotent, single transaction, post-conditions. Rollback: supabase/rollback/0405_premium_saved_calculations.rollback.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.saved_calculations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid        NOT NULL DEFAULT auth.uid() REFERENCES public.accounts (id) ON DELETE RESTRICT,
  calculation_id  uuid        NOT NULL,
  machine_id      uuid        NULL,
  test_setup_id   uuid        NULL,
  title           text        NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  notes           text        NULL CHECK (notes IS NULL OR length(notes) <= 2000),
  pinned          boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz NULL,
  CONSTRAINT saved_calculations_id_owner_uq UNIQUE (id, owner_id),
  CONSTRAINT saved_calculations_calc_same_owner_fk FOREIGN KEY (calculation_id, owner_id)
    REFERENCES public.calculation_records (id, owner_id) ON DELETE RESTRICT,
  CONSTRAINT saved_calculations_machine_same_owner_fk FOREIGN KEY (machine_id, owner_id)
    REFERENCES public.machines (id, owner_id) ON DELETE RESTRICT,
  CONSTRAINT saved_calculations_test_setup_same_owner_fk FOREIGN KEY (test_setup_id, owner_id)
    REFERENCES public.test_setups (id, owner_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS saved_calculations_owner_idx ON public.saved_calculations (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS saved_calculations_calc_idx  ON public.saved_calculations (calculation_id);

-- Link consistency (all roles). Reads the referenced rows directly (same owner already guaranteed by the FKs).
CREATE OR REPLACE FUNCTION public.pf_saved_calculation_links() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE calc_machine uuid; setup_machine uuid;
BEGIN
  SELECT machine_id INTO calc_machine FROM public.calculation_records WHERE id = NEW.calculation_id AND owner_id = NEW.owner_id;
  IF NEW.test_setup_id IS NOT NULL THEN
    SELECT machine_id INTO setup_machine FROM public.test_setups WHERE id = NEW.test_setup_id AND owner_id = NEW.owner_id;
    IF NEW.machine_id IS NULL THEN NEW.machine_id := setup_machine;
    ELSIF NEW.machine_id IS DISTINCT FROM setup_machine THEN
      RAISE EXCEPTION 'PF_LINK: the test setup belongs to a different machine' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF calc_machine IS NOT NULL THEN
    IF NEW.machine_id IS NULL THEN NEW.machine_id := calc_machine;
    ELSIF NEW.machine_id IS DISTINCT FROM calc_machine THEN
      RAISE EXCEPTION 'PF_LINK: the calculation was recorded for a different machine' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER pf_stamp       BEFORE INSERT ON public.saved_calculations FOR EACH ROW EXECUTE FUNCTION public.pf_stamp_insert();
CREATE OR REPLACE TRIGGER pf_guard       BEFORE UPDATE ON public.saved_calculations FOR EACH ROW EXECUTE FUNCTION public.pf_guard_update('id','owner_id','calculation_id');
CREATE OR REPLACE TRIGGER pf_links       BEFORE INSERT OR UPDATE ON public.saved_calculations FOR EACH ROW EXECUTE FUNCTION public.pf_saved_calculation_links();
CREATE OR REPLACE TRIGGER pf_no_delete   BEFORE DELETE ON public.saved_calculations FOR EACH ROW EXECUTE FUNCTION public.pf_refuse('soft delete only');
CREATE OR REPLACE TRIGGER pf_no_truncate BEFORE TRUNCATE ON public.saved_calculations FOR EACH STATEMENT EXECUTE FUNCTION public.pf_refuse('soft delete only');

ALTER TABLE public.saved_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_calculations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.saved_calculations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.saved_calculations TO authenticated, service_role;
GRANT INSERT (calculation_id, machine_id, test_setup_id, title, notes, pinned) ON public.saved_calculations TO authenticated;
GRANT UPDATE (machine_id, test_setup_id, title, notes, pinned) ON public.saved_calculations TO authenticated;

DROP POLICY IF EXISTS pf_saved_calculations_select ON public.saved_calculations;
DROP POLICY IF EXISTS pf_saved_calculations_insert ON public.saved_calculations;
DROP POLICY IF EXISTS pf_saved_calculations_update ON public.saved_calculations;
CREATE POLICY pf_saved_calculations_select ON public.saved_calculations FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND deleted_at IS NULL);
CREATE POLICY pf_saved_calculations_insert ON public.saved_calculations FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.pf_has_feature('saved_calculations'));
CREATE POLICY pf_saved_calculations_update ON public.saved_calculations FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (owner_id = auth.uid() AND public.pf_has_feature('saved_calculations'));

CREATE OR REPLACE FUNCTION public.pf_soft_delete_saved_calculation(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid(); n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'PF_AUTH: authentication required' USING ERRCODE = '42501'; END IF;
  UPDATE public.saved_calculations SET deleted_at = now() WHERE id = p_id AND owner_id = uid AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'PF_NOT_FOUND: no active saved calculation owned by the caller' USING ERRCODE = 'P0002'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.pf_saved_calculation_links() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.pf_soft_delete_saved_calculation(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pf_soft_delete_saved_calculation(uuid) TO authenticated;

DO $$ DECLARE p text;
BEGIN
  IF NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.saved_calculations'::regclass) THEN
    RAISE EXCEPTION 'PF_0405_POSTCONDITION: RLS not enabled and forced'; END IF;
  FOREACH p IN ARRAY ARRAY['DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
    IF has_table_privilege('authenticated', 'public.saved_calculations', p) THEN
      RAISE EXCEPTION 'PF_0405_POSTCONDITION: authenticated holds % on saved_calculations', p; END IF;
  END LOOP;
  IF has_table_privilege('anon', 'public.saved_calculations', 'SELECT')
     OR has_column_privilege('authenticated', 'public.saved_calculations', 'owner_id', 'INSERT')
     OR has_column_privilege('authenticated', 'public.saved_calculations', 'calculation_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.saved_calculations', 'deleted_at', 'UPDATE') THEN
    RAISE EXCEPTION 'PF_0405_POSTCONDITION: saved_calculations privileges too broad'; END IF;
  IF has_table_privilege('authenticated', 'public.calculation_records', 'INSERT') THEN
    RAISE EXCEPTION 'PF_0405_POSTCONDITION: clients can insert calculation_records'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'saved_calculations'
                 AND policyname = 'pf_saved_calculations_insert' AND with_check LIKE '%pf_has_feature(''saved_calculations''%') THEN
    RAISE EXCEPTION 'PF_0405_POSTCONDITION: insert policy is not feature-gated'; END IF;
END $$;

COMMIT;
