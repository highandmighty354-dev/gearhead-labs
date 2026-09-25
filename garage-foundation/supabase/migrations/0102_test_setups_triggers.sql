-- GARAGE-FOUNDATION 1.0.0 · 0102 test_setups triggers
-- Rules that hold for EVERY role (incl. service role and superuser), mirroring DATA-FOUNDATION 0003.
-- Garage uses its OWN trigger functions: the frozen df_stamp_insert / df_guard_update select behaviour by
-- hard-coded table name, so they are neither altered nor reused. Idempotent (CREATE OR REPLACE).

-- Insert: server-forced timestamps and baseline pin; a row can never be created already deleted.
CREATE OR REPLACE FUNCTION public.gf_test_setup_stamp_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'GF_IMMUTABLE: a test setup cannot be created already deleted' USING ERRCODE = 'P0001';
  END IF;
  NEW.created_at := now();
  NEW.updated_at := now();
  NEW.baseline_pinned_at := now();
  RETURN NEW;
END $$;

-- Update: identity immutable; created_at kept; the baseline pin never moves implicitly.
CREATE OR REPLACE FUNCTION public.gf_test_setup_guard_update() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'GF_IMMUTABLE: test setup id cannot change' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'GF_IMMUTABLE: test setup owner_id cannot change' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.machine_id IS DISTINCT FROM OLD.machine_id THEN
    RAISE EXCEPTION 'GF_IMMUTABLE: test setup machine_id cannot change' USING ERRCODE = 'P0001';
  END IF;
  NEW.created_at := OLD.created_at;
  IF NEW.baseline_pinned_at IS DISTINCT FROM OLD.baseline_pinned_at THEN
    IF OLD.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'GF_BASELINE: the baseline of a deleted test setup cannot be re-pinned' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.baseline_pinned_at <> now() THEN
      RAISE EXCEPTION 'GF_BASELINE: the baseline can only be re-pinned to the server time of an explicit re-pin' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- Hard DELETE refused for every role (soft delete only).
CREATE OR REPLACE FUNCTION public.gf_test_setup_refuse_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'GF_IMMUTABLE: DELETE on test_setups is not permitted (soft delete only)' USING ERRCODE = 'P0001';
END $$;

CREATE OR REPLACE TRIGGER gf_stamp     BEFORE INSERT ON public.test_setups FOR EACH ROW EXECUTE FUNCTION public.gf_test_setup_stamp_insert();
CREATE OR REPLACE TRIGGER gf_guard     BEFORE UPDATE ON public.test_setups FOR EACH ROW EXECUTE FUNCTION public.gf_test_setup_guard_update();
CREATE OR REPLACE TRIGGER gf_no_delete BEFORE DELETE ON public.test_setups FOR EACH ROW EXECUTE FUNCTION public.gf_test_setup_refuse_delete();
