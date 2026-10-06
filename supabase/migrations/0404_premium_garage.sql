-- PREMIUM-FOUNDATION 1.0.0 · 0404 garage: machine_details + Free machine allowance (owner decisions 1, 3, 4)
-- Hierarchy unchanged: User -> Garage -> Machine -> Test Setup (Build = Test Setup; no Projects).
--
-- machine_details: descriptive identity of a Machine (year/make/model/trim level/nickname/notes/primary). NOT engineering
--   values - those stay in value_records (server-written, engine-native units).
-- Free allowance: a client may hold at most ONE active machine unless pf_has_feature('garage_unlimited').
--   Enforced by an ADDITIONAL restrictive INSERT policy on public.machines; the frozen DATA-FOUNDATION policies are
--   untouched (restrictive policies AND with the permissive ones). "Active" = not soft-deleted and in an active
--   garage; soft deletion is permanent in the foundation, so a deleted machine can never be revived to exceed it.
--   A per-account transaction-level advisory lock serialises concurrent inserts, so two parallel requests cannot
--   both pass. Applies to clients (authenticated) only; the trusted server path is unaffected.
--   A lapsed Premium account keeps its existing machines (read/update) but cannot add more beyond the allowance.
-- Idempotent, single transaction, post-conditions. Rollback: supabase/rollback/0404_premium_garage.rollback.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.machine_details (
  machine_id  uuid        PRIMARY KEY,
  owner_id    uuid        NOT NULL DEFAULT auth.uid() REFERENCES public.accounts (id) ON DELETE RESTRICT,
  model_year  integer     NULL CHECK (model_year IS NULL OR model_year BETWEEN 1886 AND 2100),
  make        text        NULL CHECK (make IS NULL OR length(make) BETWEEN 1 AND 60),
  model       text        NULL CHECK (model IS NULL OR length(model) BETWEEN 1 AND 60),
  trim_level  text        NULL CHECK (trim_level IS NULL OR length(trim_level) BETWEEN 1 AND 60),
  nickname    text        NULL CHECK (nickname IS NULL OR length(nickname) BETWEEN 1 AND 60),
  notes       text        NULL CHECK (notes IS NULL OR length(notes) <= 2000),
  is_primary  boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT machine_details_machine_same_owner_fk FOREIGN KEY (machine_id, owner_id)
    REFERENCES public.machines (id, owner_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS machine_details_owner_idx ON public.machine_details (owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS machine_details_one_primary_per_owner ON public.machine_details (owner_id) WHERE is_primary;

-- Marking a machine primary MOVES the flag: the owner's other details rows (including those of soft-deleted machines
-- or machines in deleted garages, which the owner can no longer see or edit) are cleared first. Without this, deleting
-- the primary machine would leave an invisible primary row that blocks every later choice. SECURITY DEFINER only to
-- reach those hidden rows; it touches only rows of NEW.owner_id (= auth.uid() for clients: no owner_id column grant,
-- and owner_id is immutable on update) and only their is_primary flag.
CREATE OR REPLACE FUNCTION public.pf_machine_details_primary() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE public.machine_details SET is_primary = false
     WHERE owner_id = NEW.owner_id AND machine_id <> NEW.machine_id AND is_primary;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER pf_stamp       BEFORE INSERT ON public.machine_details FOR EACH ROW EXECUTE FUNCTION public.pf_stamp_insert();
CREATE OR REPLACE TRIGGER pf_guard       BEFORE UPDATE ON public.machine_details FOR EACH ROW EXECUTE FUNCTION public.pf_guard_update('machine_id','owner_id');
-- fires after pf_guard (name order), so owner_id is already proven unchanged on update
CREATE OR REPLACE TRIGGER pf_primary     BEFORE INSERT OR UPDATE OF is_primary ON public.machine_details FOR EACH ROW EXECUTE FUNCTION public.pf_machine_details_primary();
CREATE OR REPLACE TRIGGER pf_no_delete   BEFORE DELETE ON public.machine_details FOR EACH ROW EXECUTE FUNCTION public.pf_refuse('details live as long as the machine (soft delete the machine)');
CREATE OR REPLACE TRIGGER pf_no_truncate BEFORE TRUNCATE ON public.machine_details FOR EACH STATEMENT EXECUTE FUNCTION public.pf_refuse('details live as long as the machine');

ALTER TABLE public.machine_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_details FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.machine_details FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.machine_details TO authenticated, service_role;
GRANT INSERT (machine_id, model_year, make, model, trim_level, nickname, notes, is_primary) ON public.machine_details TO authenticated;
GRANT UPDATE (model_year, make, model, trim_level, nickname, notes, is_primary) ON public.machine_details TO authenticated;

DROP POLICY IF EXISTS pf_machine_details_select ON public.machine_details;
DROP POLICY IF EXISTS pf_machine_details_insert ON public.machine_details;
DROP POLICY IF EXISTS pf_machine_details_update ON public.machine_details;
-- visible only while the machine itself is visible (machines' own policy hides deleted machines / garages)
CREATE POLICY pf_machine_details_select ON public.machine_details FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.machines m WHERE m.id = machine_details.machine_id));
CREATE POLICY pf_machine_details_insert ON public.machine_details FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.machines m WHERE m.id = machine_details.machine_id));
CREATE POLICY pf_machine_details_update ON public.machine_details FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.machines m WHERE m.id = machine_details.machine_id))
  WITH CHECK (owner_id = auth.uid());

-- ---------------------------------------------------------------- Free machine allowance
-- VOLATILE on purpose: after taking the lock, the count runs on a fresh snapshot and therefore sees machines
-- committed by a concurrent request (and rows inserted earlier in the same statement). That holds only under
-- READ COMMITTED (Supabase's default, under which PostgREST requests run); under REPEATABLE READ / SERIALIZABLE the
-- snapshot is fixed for the transaction, so the check FAILS CLOSED there instead of being bypassable.
CREATE OR REPLACE FUNCTION public.pf_machine_allowance_ok() RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid(); n int;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF public.pf_has_feature('garage_unlimited') THEN RETURN true; END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('pf_machine_allowance:' || uid::text, 0));
  SELECT count(*) INTO n
    FROM public.machines m JOIN public.garages g ON g.id = m.garage_id
   WHERE m.owner_id = uid AND m.deleted_at IS NULL AND g.deleted_at IS NULL;
  RETURN n < 1;   -- owner decision 1: Free = 1 machine
END $$;
REVOKE ALL ON FUNCTION public.pf_machine_allowance_ok() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.pf_machine_details_primary() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pf_machine_allowance_ok() TO authenticated;

DROP POLICY IF EXISTS pf_machines_free_allowance ON public.machines;
CREATE POLICY pf_machines_free_allowance ON public.machines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.pf_machine_allowance_ok());

DO $$ DECLARE p text;
BEGIN
  IF NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.machine_details'::regclass) THEN
    RAISE EXCEPTION 'PF_0404_POSTCONDITION: RLS not enabled and forced on machine_details'; END IF;
  FOREACH p IN ARRAY ARRAY['DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
    IF has_table_privilege('authenticated', 'public.machine_details', p) THEN
      RAISE EXCEPTION 'PF_0404_POSTCONDITION: authenticated holds % on machine_details', p; END IF;
  END LOOP;
  IF has_table_privilege('anon', 'public.machine_details', 'SELECT')
     OR has_column_privilege('authenticated', 'public.machine_details', 'owner_id', 'INSERT')
     OR has_column_privilege('authenticated', 'public.machine_details', 'machine_id', 'UPDATE') THEN
    RAISE EXCEPTION 'PF_0404_POSTCONDITION: machine_details privileges too broad'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'machines'
                 AND policyname = 'pf_machines_free_allowance' AND permissive = 'RESTRICTIVE' AND cmd = 'INSERT') THEN
    RAISE EXCEPTION 'PF_0404_POSTCONDITION: restrictive allowance policy missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'machines' AND policyname = 'df_machines_insert') THEN
    RAISE EXCEPTION 'PF_0404_POSTCONDITION: frozen df_machines_insert policy missing'; END IF;
END $$;

COMMIT;
