-- DATA-FOUNDATION 1.0.0 · 0004 row-level security (spec F)
-- RLS ENABLED + FORCED on every table. Ownership always from auth.uid().
-- Privileges: revoke everything from anon/authenticated, then grant narrowly.
-- No client DELETE anywhere (soft delete via UPDATE of deleted_at; values/history append-only).
-- calculation_records: NO client INSERT until the server-side Calculation API exists (OPEN #12).
-- anon: no access to user tables; anon read of reference data is OPEN (#17) -> not granted.
-- Idempotent: policies dropped-if-exists then recreated.

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','garages','machines','components','component_connections',
                           'canonical_fields','value_records','calculators','formula_versions','calculation_records'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- ---------- accounts: SELECT own; no client INSERT/UPDATE/DELETE ----------
GRANT SELECT ON public.accounts TO authenticated;
DROP POLICY IF EXISTS df_accounts_select ON public.accounts;
CREATE POLICY df_accounts_select ON public.accounts FOR SELECT TO authenticated USING (id = auth.uid());

-- ---------- garages ----------
GRANT SELECT, INSERT ON public.garages TO authenticated;
GRANT UPDATE (name, deleted_at) ON public.garages TO authenticated;
DROP POLICY IF EXISTS df_garages_select ON public.garages;
DROP POLICY IF EXISTS df_garages_insert ON public.garages;
DROP POLICY IF EXISTS df_garages_update ON public.garages;
CREATE POLICY df_garages_select ON public.garages FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND deleted_at IS NULL);
CREATE POLICY df_garages_insert ON public.garages FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY df_garages_update ON public.garages FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND deleted_at IS NULL) WITH CHECK (owner_id = auth.uid());

-- ---------- machines ----------
GRANT SELECT, INSERT ON public.machines TO authenticated;
GRANT UPDATE (name, machine_type, marine_type, propulsion, power_source, is_hypothetical, deleted_at) ON public.machines TO authenticated;
DROP POLICY IF EXISTS df_machines_select ON public.machines;
DROP POLICY IF EXISTS df_machines_insert ON public.machines;
DROP POLICY IF EXISTS df_machines_update ON public.machines;
CREATE POLICY df_machines_select ON public.machines FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM public.garages g WHERE g.id = machines.garage_id AND g.deleted_at IS NULL));
CREATE POLICY df_machines_insert ON public.machines FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY df_machines_update ON public.machines FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND deleted_at IS NULL) WITH CHECK (owner_id = auth.uid());

-- ---------- components ----------
GRANT SELECT, INSERT ON public.components TO authenticated;
GRANT UPDATE (kind, parent_component_id, manufacturer, model, part_number, label, deleted_at) ON public.components TO authenticated;
DROP POLICY IF EXISTS df_components_select ON public.components;
DROP POLICY IF EXISTS df_components_insert ON public.components;
DROP POLICY IF EXISTS df_components_update ON public.components;
CREATE POLICY df_components_select ON public.components FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM public.machines m WHERE m.id = components.machine_id));
CREATE POLICY df_components_insert ON public.components FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY df_components_update ON public.components FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND deleted_at IS NULL) WITH CHECK (owner_id = auth.uid());

-- ---------- component_connections (immutable except soft delete) ----------
GRANT SELECT, INSERT ON public.component_connections TO authenticated;
GRANT UPDATE (deleted_at) ON public.component_connections TO authenticated;
DROP POLICY IF EXISTS df_connections_select ON public.component_connections;
DROP POLICY IF EXISTS df_connections_insert ON public.component_connections;
DROP POLICY IF EXISTS df_connections_update ON public.component_connections;
CREATE POLICY df_connections_select ON public.component_connections FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM public.machines m WHERE m.id = component_connections.machine_id));
CREATE POLICY df_connections_insert ON public.component_connections FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY df_connections_update ON public.component_connections FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND deleted_at IS NULL) WITH CHECK (owner_id = auth.uid());

-- ---------- value_records: SELECT own, INSERT own; append-only ----------
GRANT SELECT, INSERT ON public.value_records TO authenticated;
DROP POLICY IF EXISTS df_values_select ON public.value_records;
DROP POLICY IF EXISTS df_values_insert ON public.value_records;
CREATE POLICY df_values_select ON public.value_records FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY df_values_insert ON public.value_records FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

-- ---------- calculation_records: SELECT own only (no client INSERT; immutable) ----------
GRANT SELECT ON public.calculation_records TO authenticated;
DROP POLICY IF EXISTS df_calc_select ON public.calculation_records;
CREATE POLICY df_calc_select ON public.calculation_records FOR SELECT TO authenticated USING (owner_id = auth.uid());

-- ---------- reference data: authenticated read-only; written only by migrations ----------
GRANT SELECT ON public.canonical_fields, public.calculators, public.formula_versions TO authenticated;
DROP POLICY IF EXISTS df_canonical_fields_read ON public.canonical_fields;
DROP POLICY IF EXISTS df_calculators_read ON public.calculators;
DROP POLICY IF EXISTS df_formula_versions_read ON public.formula_versions;
CREATE POLICY df_canonical_fields_read ON public.canonical_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY df_calculators_read      ON public.calculators      FOR SELECT TO authenticated USING (true);
CREATE POLICY df_formula_versions_read ON public.formula_versions FOR SELECT TO authenticated USING (true);

-- ---------- Decision B: owner soft delete through narrow server-side functions ----------
-- Why: the SELECT policies hide soft-deleted rows (owner AND deleted_at IS NULL). PostgreSQL checks an
-- UPDATE's new row against the SELECT policy whenever the UPDATE needs read access (any WHERE on the
-- table), so an owner could never set deleted_at with a normal UPDATE. These functions are the
-- implementation mechanism; they do NOT change the approved semantics:
--   * one fixed table per function - no general-purpose deletion mechanism
--   * caller must be authenticated (auth.uid() present); owner taken ONLY from auth.uid()
--   * affects only an ACTIVE row with id = target AND owner_id = auth.uid()
--   * deleted_at set server-side; triggers still keep owner_id / created_at immutable
--   * returns nothing (never exposes the row)
--   * already-deleted, other users' and non-existent rows: same error, nothing changes, nothing revealed
--     (narrowest behaviour: the owner UPDATE policy already treats deleted rows as not modifiable;
--      a repeat call never re-stamps deleted_at)
--   * EXECUTE granted to authenticated only (revoked from PUBLIC and anon)
-- SECURITY DEFINER requires the function owner to bypass RLS (local: superuser; hosted Supabase: the
-- migration owner 'postgres' - to be verified at provisioning, OPEN #6).
CREATE OR REPLACE FUNCTION public.df_soft_delete_garage(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid(); n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'DF_AUTH: authentication required' USING ERRCODE = '42501'; END IF;
  UPDATE public.garages SET deleted_at = now() WHERE id = p_id AND owner_id = uid AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'DF_NOT_FOUND: no active garage owned by the caller' USING ERRCODE = 'P0002'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.df_soft_delete_machine(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid(); n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'DF_AUTH: authentication required' USING ERRCODE = '42501'; END IF;
  UPDATE public.machines SET deleted_at = now() WHERE id = p_id AND owner_id = uid AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'DF_NOT_FOUND: no active machine owned by the caller' USING ERRCODE = 'P0002'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.df_soft_delete_component(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid(); n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'DF_AUTH: authentication required' USING ERRCODE = '42501'; END IF;
  UPDATE public.components SET deleted_at = now() WHERE id = p_id AND owner_id = uid AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'DF_NOT_FOUND: no active component owned by the caller' USING ERRCODE = 'P0002'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.df_soft_delete_connection(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid(); n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'DF_AUTH: authentication required' USING ERRCODE = '42501'; END IF;
  UPDATE public.component_connections SET deleted_at = now() WHERE id = p_id AND owner_id = uid AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'DF_NOT_FOUND: no active connection owned by the caller' USING ERRCODE = 'P0002'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.df_soft_delete_garage(uuid), public.df_soft_delete_machine(uuid),
                       public.df_soft_delete_component(uuid), public.df_soft_delete_connection(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.df_soft_delete_garage(uuid), public.df_soft_delete_machine(uuid),
                          public.df_soft_delete_component(uuid), public.df_soft_delete_connection(uuid) TO authenticated;
