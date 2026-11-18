-- PREMIUM-FOUNDATION 1.1.0 · 0410 formula_versions rows for the registry formulas corrected in the Stage 2 calculator repairs
--
-- Owner authorization (2026-11-18): repair GH-DEF-045, 046, 047, 048, 050, 053, 054, 055, 057, and prepare (not apply) the formula_versions
-- rows the corrected registry formulas need. PREPARED, NOT APPLIED. Applying it to production is a separate authorization, and the
-- provisioning workflow (pinned to c69ec51, 19 files) cannot apply it until it is re-pinned under that authorization.
--
--   calculator              new fingerprint  registry            corrected by   original row (kept)
--   diesel_power_from_fuel  fv1-b16d2d94     GH_LEGACY_FORMULAS  GH-DEF-045     fv1-0ab8e5a1
--
--   diesel_power_from_fuel: fuel [lb/hr] / BSFC [lb/hp-hr]; the x60 (a lb/min factor) removed
--
-- Additive only: 1 insert, no update, no delete. Formula versions are history (df_never_changed / df_no_truncate), so the
-- original rows and every calculation_records row that references them stay exactly as they are. No rollback file by design:
-- a formula_versions row cannot be deleted; reverting the engine leaves the new rows unreferenced, which is harmless.
-- Idempotent (ON CONFLICT DO NOTHING). Single transaction. Each new row is checked against ITS OWN registry; any other state aborts
-- the whole transaction and writes nothing.
BEGIN;

INSERT INTO public.formula_versions (calculator_id, formula_version, engine_version, formula_registry, first_release) VALUES
  ('diesel_power_from_fuel', 'fv1-b16d2d94', '1.1.0', 'GH_LEGACY_FORMULAS', 'F1.12.4')
ON CONFLICT (calculator_id, formula_version) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.formula_versions f
    JOIN (VALUES ('diesel_power_from_fuel', 'fv1-b16d2d94', 'GH_LEGACY_FORMULAS'))
         AS v (calculator_id, formula_version, formula_registry)
      ON f.calculator_id = v.calculator_id AND f.formula_version = v.formula_version AND f.formula_registry = v.formula_registry
   WHERE f.engine_version = '1.1.0' AND f.first_release = 'F1.12.4';
  IF n <> 1 THEN
    RAISE EXCEPTION 'PF_0410_POSTCONDITION: expected all 1 corrected formula versions with their own registry, found %', n;
  END IF;
  SELECT count(*) INTO n FROM public.formula_versions
   WHERE (calculator_id, formula_version) IN (('diesel_power_from_fuel', 'fv1-0ab8e5a1'));
  IF n <> 1 THEN
    RAISE EXCEPTION 'PF_0410_POSTCONDITION: the original formula versions must remain, found %', n;
  END IF;
END $$;

COMMIT;
