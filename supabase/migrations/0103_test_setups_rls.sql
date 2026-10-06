-- GARAGE-FOUNDATION 1.0.0 · 0103 test_setups row-level security + Decision-B-style functions
-- Mirrors DATA-FOUNDATION 0004 for the NEW table only; no frozen policy, grant or function is altered.
-- Ownership always from auth.uid(). Clients get a column-level INSERT (no owner, id, pin or deletion
-- time) and a column-level UPDATE of the descriptive fields only. No client DELETE; no client grant on
-- deleted_at or baseline_pinned_at. Idempotent: policies dropped-if-exists then recreated.

ALTER TABLE public.test_setups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_setups FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.test_setups FROM anon, authenticated;

GRANT SELECT ON public.test_setups TO authenticated;
GRANT INSERT (machine_id, name, description, notes) ON public.test_setups TO authenticated;
GRANT UPDATE (name, description, notes) ON public.test_setups TO authenticated;

DROP POLICY IF EXISTS gf_test_setups_select ON public.test_setups;
DROP POLICY IF EXISTS gf_test_setups_insert ON public.test_setups;
DROP POLICY IF EXISTS gf_test_setups_update ON public.test_setups;
-- Visible only while its machine is visible under the frozen machine policy (which hides deleted machines
-- and machines in deleted garages): the same pattern as the frozen components policy.
CREATE POLICY gf_test_setups_select ON public.test_setups FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM public.machines m WHERE m.id = test_setups.machine_id));
CREATE POLICY gf_test_setups_insert ON public.test_setups FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY gf_test_setups_update ON public.test_setups FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND deleted_at IS NULL) WITH CHECK (owner_id = auth.uid());

-- Decision-B-style owner soft delete (same semantics as the frozen df_soft_delete_* functions):
--   one fixed table; authenticated caller required; affects only an ACTIVE row owned by auth.uid();
--   deleted_at set server-side; returns nothing; already-deleted, other users' and non-existent rows give
--   the same error and change nothing (never re-stamped); no cascade.
-- SECURITY DEFINER is required because clients have no column grant on deleted_at. The function owner
-- must bypass RLS (local: superuser; hosted Supabase: the migration owner - verify at provisioning, OPEN #6).
CREATE OR REPLACE FUNCTION public.gf_soft_delete_test_setup(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid(); n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'GF_AUTH: authentication required' USING ERRCODE = '42501'; END IF;
  UPDATE public.test_setups SET deleted_at = now() WHERE id = p_id AND owner_id = uid AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'GF_NOT_FOUND: no active test setup owned by the caller' USING ERRCODE = 'P0002'; END IF;
END $$;

-- Explicit baseline re-pin (earlier decision #28): the ONLY client path that moves the pinned baseline.
-- Same shape, errors and owner / active-row restriction as the soft-delete function. The pin moves to
-- the server time of the calling transaction. SECURITY DEFINER is required because clients have no
-- column grant on baseline_pinned_at.
CREATE OR REPLACE FUNCTION public.gf_repin_test_setup_baseline(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid(); n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'GF_AUTH: authentication required' USING ERRCODE = '42501'; END IF;
  UPDATE public.test_setups SET baseline_pinned_at = now() WHERE id = p_id AND owner_id = uid AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'GF_NOT_FOUND: no active test setup owned by the caller' USING ERRCODE = 'P0002'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.gf_soft_delete_test_setup(uuid), public.gf_repin_test_setup_baseline(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gf_soft_delete_test_setup(uuid), public.gf_repin_test_setup_baseline(uuid) TO authenticated;
