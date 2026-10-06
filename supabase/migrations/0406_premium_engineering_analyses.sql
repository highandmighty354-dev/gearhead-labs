-- PREMIUM-FOUNDATION 1.0.0 · 0406 engineering analyzers + engineering_analyses (Premium Engineering Lab, E01-E14)
-- E01-E14 run in the browser (engineering-expansion-v1.js) and are NOT in the GH_ENGINE catalog, so their results are
-- not engine-verified (D-006). Therefore:
--   * the saved INPUTS are authoritative: an analysis is re-run from its inputs when it is loaded;
--   * result_snapshot is optional and permanently labelled result_trust = 'client_reported';
--   * every analysis is pinned to the analyzer version that produced it (must equal the catalog version at insert).
-- When an analyzer is migrated into GH_ENGINE under D-006, new runs go through the Calculation API instead.
-- Create/update require pf_has_feature('engineering_lab'); read and soft delete remain after a lapse.
-- Idempotent, single transaction, post-conditions. Rollback: supabase/rollback/0406_premium_engineering_analyses.rollback.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.engineering_analyzers (
  analyzer_id       text PRIMARY KEY CHECK (analyzer_id ~ '^e[0-9]{2}_[a-z0-9_]+$'),
  code              text NOT NULL UNIQUE CHECK (code ~ '^E[0-9]{2}$'),
  name              text NOT NULL CHECK (length(btrim(name)) > 0),
  category          text NOT NULL CHECK (category IN ('Turbo','Two-Stroke','Valvetrain','Chassis','Driveline','Thermal')),
  analyzer_version  text NOT NULL CHECK (length(btrim(analyzer_version)) > 0)
);

INSERT INTO public.engineering_analyzers (analyzer_id, code, name, category, analyzer_version) VALUES
  ('e01_turbo_compressor_map',       'E01', 'Turbo Compressor Map Builder',                    'Turbo',      'E1-AUTO'),
  ('e02_turbo_surge_choke_margin',   'E02', 'Turbo Surge / Choke Margin Analyzer',             'Turbo',      'E1-AUTO'),
  ('e03_turbo_turbine_matching',     'E03', 'Turbo Turbine Matching Analyzer',                 'Turbo',      'E1-AUTO'),
  ('e04_turbo_pressure_ratio_stack', 'E04', 'Turbo Pressure-Ratio Stack Analyzer',             'Turbo',      'E1-AUTO'),
  ('e05_two_stroke_time_area',       'E05', '2-Stroke Port Time-Area Analyzer',                'Two-Stroke', 'E1-AUTO'),
  ('e06_two_stroke_blowdown',        'E06', '2-Stroke Blowdown Analyzer',                      'Two-Stroke', 'E1-AUTO'),
  ('e07_expansion_chamber_reverse',  'E07', '2-Stroke Expansion-Chamber Reverse Analyzer',     'Two-Stroke', 'E1-AUTO'),
  ('e08_valvetrain_dynamic_control', 'E08', 'Valvetrain Dynamic Control Analyzer',             'Valvetrain', 'E1-AUTO'),
  ('e09_valve_spring_surge',         'E09', 'Valve Spring Natural-Frequency / Surge Analyzer', 'Valvetrain', 'E1-AUTO'),
  ('e10_suspension_kinematics',      'E10', 'Suspension Kinematics Lab',                       'Chassis',    'E1-AUTO'),
  ('e11_driveline_dynamics',         'E11', 'Driveline Dynamics Lab',                          'Driveline',  'E1-AUTO'),
  ('e12_radiator_heat_rejection',    'E12', 'Radiator Heat-Rejection Analyzer',                'Thermal',    'E1-AUTO'),
  ('e13_intercooler_thermal',        'E13', 'Intercooler Thermal / Pressure-Drop Analyzer',    'Thermal',    'E1-AUTO'),
  ('e14_heat_exchanger_matching',    'E14', 'Heat-Exchanger Matching Workbench',               'Thermal',    'E1-AUTO')
ON CONFLICT (analyzer_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.engineering_analyses (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            uuid        NOT NULL DEFAULT auth.uid() REFERENCES public.accounts (id) ON DELETE RESTRICT,
  analyzer_id         text        NOT NULL REFERENCES public.engineering_analyzers (analyzer_id) ON DELETE RESTRICT,
  analyzer_version    text        NOT NULL,
  machine_id          uuid        NULL,
  test_setup_id       uuid        NULL,
  title               text        NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  notes               text        NULL CHECK (notes IS NULL OR length(notes) <= 2000),
  inputs              jsonb       NOT NULL CHECK (jsonb_typeof(inputs) = 'object' AND pg_column_size(inputs) <= 65536),
  inputs_unit_system  public.pf_unit_system_enum NOT NULL,
  result_snapshot     jsonb       NULL CHECK (result_snapshot IS NULL OR (jsonb_typeof(result_snapshot) = 'object' AND pg_column_size(result_snapshot) <= 65536)),
  result_trust        text        NOT NULL DEFAULT 'client_reported' CHECK (result_trust = 'client_reported'),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz NULL,
  CONSTRAINT engineering_analyses_id_owner_uq UNIQUE (id, owner_id),
  CONSTRAINT engineering_analyses_machine_same_owner_fk FOREIGN KEY (machine_id, owner_id)
    REFERENCES public.machines (id, owner_id) ON DELETE RESTRICT,
  CONSTRAINT engineering_analyses_test_setup_same_owner_fk FOREIGN KEY (test_setup_id, owner_id)
    REFERENCES public.test_setups (id, owner_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS engineering_analyses_owner_idx ON public.engineering_analyses (owner_id, created_at DESC);

-- Version pin (insert) and link consistency (insert/update), all roles.
CREATE OR REPLACE FUNCTION public.pf_engineering_analysis_check() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_version text; setup_machine uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT analyzer_version INTO current_version FROM public.engineering_analyzers WHERE analyzer_id = NEW.analyzer_id;
    IF current_version IS NOT NULL AND NEW.analyzer_version IS DISTINCT FROM current_version THEN
      RAISE EXCEPTION 'PF_ANALYZER: % is at version %, not %', NEW.analyzer_id, current_version, NEW.analyzer_version USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.test_setup_id IS NOT NULL THEN
    SELECT machine_id INTO setup_machine FROM public.test_setups WHERE id = NEW.test_setup_id AND owner_id = NEW.owner_id;
    IF NEW.machine_id IS NULL THEN NEW.machine_id := setup_machine;
    ELSIF NEW.machine_id IS DISTINCT FROM setup_machine THEN
      RAISE EXCEPTION 'PF_LINK: the test setup belongs to a different machine' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER pf_stamp       BEFORE INSERT ON public.engineering_analyses FOR EACH ROW EXECUTE FUNCTION public.pf_stamp_insert();
CREATE OR REPLACE TRIGGER pf_guard       BEFORE UPDATE ON public.engineering_analyses FOR EACH ROW EXECUTE FUNCTION public.pf_guard_update('id','owner_id','analyzer_id','analyzer_version','result_trust');
CREATE OR REPLACE TRIGGER pf_check       BEFORE INSERT OR UPDATE ON public.engineering_analyses FOR EACH ROW EXECUTE FUNCTION public.pf_engineering_analysis_check();
CREATE OR REPLACE TRIGGER pf_no_delete   BEFORE DELETE ON public.engineering_analyses FOR EACH ROW EXECUTE FUNCTION public.pf_refuse('soft delete only');
CREATE OR REPLACE TRIGGER pf_no_truncate BEFORE TRUNCATE ON public.engineering_analyses FOR EACH STATEMENT EXECUTE FUNCTION public.pf_refuse('soft delete only');
CREATE OR REPLACE TRIGGER pf_no_delete   BEFORE DELETE ON public.engineering_analyzers FOR EACH ROW EXECUTE FUNCTION public.pf_refuse('analyzers are reference data');
CREATE OR REPLACE TRIGGER pf_no_truncate BEFORE TRUNCATE ON public.engineering_analyzers FOR EACH STATEMENT EXECUTE FUNCTION public.pf_refuse('analyzers are reference data');

ALTER TABLE public.engineering_analyzers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engineering_analyzers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.engineering_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engineering_analyses FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.engineering_analyzers FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.engineering_analyses FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.engineering_analyzers TO authenticated, service_role;
GRANT SELECT ON public.engineering_analyses TO authenticated, service_role;
GRANT INSERT (analyzer_id, analyzer_version, machine_id, test_setup_id, title, notes, inputs, inputs_unit_system, result_snapshot)
  ON public.engineering_analyses TO authenticated;
GRANT UPDATE (machine_id, test_setup_id, title, notes, inputs, inputs_unit_system, result_snapshot)
  ON public.engineering_analyses TO authenticated;

DROP POLICY IF EXISTS pf_analyzers_read ON public.engineering_analyzers;
DROP POLICY IF EXISTS pf_engineering_analyses_select ON public.engineering_analyses;
DROP POLICY IF EXISTS pf_engineering_analyses_insert ON public.engineering_analyses;
DROP POLICY IF EXISTS pf_engineering_analyses_update ON public.engineering_analyses;
CREATE POLICY pf_analyzers_read ON public.engineering_analyzers FOR SELECT TO authenticated USING (true);
CREATE POLICY pf_engineering_analyses_select ON public.engineering_analyses FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND deleted_at IS NULL);
CREATE POLICY pf_engineering_analyses_insert ON public.engineering_analyses FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.pf_has_feature('engineering_lab'));
CREATE POLICY pf_engineering_analyses_update ON public.engineering_analyses FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (owner_id = auth.uid() AND public.pf_has_feature('engineering_lab'));

CREATE OR REPLACE FUNCTION public.pf_soft_delete_engineering_analysis(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid(); n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'PF_AUTH: authentication required' USING ERRCODE = '42501'; END IF;
  UPDATE public.engineering_analyses SET deleted_at = now() WHERE id = p_id AND owner_id = uid AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'PF_NOT_FOUND: no active engineering analysis owned by the caller' USING ERRCODE = 'P0002'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.pf_engineering_analysis_check() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.pf_soft_delete_engineering_analysis(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pf_soft_delete_engineering_analysis(uuid) TO authenticated;

DO $$ DECLARE p text; t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['engineering_analyzers','engineering_analyses'] LOOP
    IF NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'PF_0406_POSTCONDITION: RLS not enabled and forced on %', t; END IF;
    FOREACH p IN ARRAY ARRAY['DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF has_table_privilege('authenticated', 'public.' || t, p) THEN
        RAISE EXCEPTION 'PF_0406_POSTCONDITION: authenticated holds % on %', p, t; END IF;
    END LOOP;
    IF has_table_privilege('anon', 'public.' || t, 'SELECT') THEN RAISE EXCEPTION 'PF_0406_POSTCONDITION: anon can read %', t; END IF;
  END LOOP;
  IF has_table_privilege('authenticated', 'public.engineering_analyzers', 'INSERT')
     OR has_table_privilege('authenticated', 'public.engineering_analyzers', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.engineering_analyses', 'result_trust', 'INSERT')
     OR has_column_privilege('authenticated', 'public.engineering_analyses', 'owner_id', 'INSERT') THEN
    RAISE EXCEPTION 'PF_0406_POSTCONDITION: engineering privileges too broad'; END IF;
  IF (SELECT count(*) FROM public.engineering_analyzers) <> 14
     OR (SELECT count(*) FROM public.engineering_analyzers WHERE analyzer_version = 'E1-AUTO') <> 14 THEN
    RAISE EXCEPTION 'PF_0406_POSTCONDITION: analyzer catalog is not exactly E01-E14 at E1-AUTO'; END IF;
END $$;

COMMIT;
