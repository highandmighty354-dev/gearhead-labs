-- PREMIUM-FOUNDATION 1.1.0 · 0408 formula_versions rows for the four registry formulas corrected after the 0005 seed was exported
--
-- Owner approval (2026-10-15): the four-row GH-ENG-014 proposal (docs/ENG-014-FORMULA-VERSION-MIGRATION-PROPOSAL.md, Sections 12-13).
-- Prepared on premium/full-calculator-expansion; applying it to production is a separate authorization.
--
--   calculator          new fingerprint  registry            corrected by   original row (kept)
--   dew_point           fv1-73ddeaf4     GH_LEGACY_FORMULAS  GH-DEF-005     fv1-260e7f34
--   distance_converter  fv1-4001b424     GH_LEGACY_FORMULAS  GH-DEF-019     fv1-36d27af2
--   bolt_torque_spec    fv1-25b1f973     GH_LEGACY_FORMULAS  GH-DEF-034     fv1-f63ea4c8
--   bolt_stretch        fv1-8e827c77     GH_E1_FORMULAS      GH-DEF-036     fv1-d48e7340
--
-- Additive only: four inserts, no update, no delete. Formula versions are history (df_never_changed / df_no_truncate), so the
-- original rows and every calculation_records row that references them stay exactly as they are. No rollback file by design:
-- a formula_versions row cannot be deleted; reverting the engine leaves the new rows unreferenced, which is harmless.
-- Idempotent (ON CONFLICT DO NOTHING). Single transaction. Each new row is checked against ITS OWN registry (bolt_stretch is in
-- GH_E1_FORMULAS, the other three in GH_LEGACY_FORMULAS); any other state aborts the whole transaction and writes nothing.
BEGIN;

INSERT INTO public.formula_versions (calculator_id, formula_version, engine_version, formula_registry, first_release) VALUES
  ('dew_point',          'fv1-73ddeaf4', '1.1.0', 'GH_LEGACY_FORMULAS', 'F1.12.4'),
  ('distance_converter', 'fv1-4001b424', '1.1.0', 'GH_LEGACY_FORMULAS', 'F1.12.4'),
  ('bolt_torque_spec',   'fv1-25b1f973', '1.1.0', 'GH_LEGACY_FORMULAS', 'F1.12.4'),
  ('bolt_stretch',       'fv1-8e827c77', '1.1.0', 'GH_E1_FORMULAS',     'F1.12.4')
ON CONFLICT (calculator_id, formula_version) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.formula_versions f
    JOIN (VALUES ('dew_point', 'fv1-73ddeaf4', 'GH_LEGACY_FORMULAS'), ('distance_converter', 'fv1-4001b424', 'GH_LEGACY_FORMULAS'),
                 ('bolt_torque_spec', 'fv1-25b1f973', 'GH_LEGACY_FORMULAS'), ('bolt_stretch', 'fv1-8e827c77', 'GH_E1_FORMULAS'))
         AS v (calculator_id, formula_version, formula_registry)
      ON f.calculator_id = v.calculator_id AND f.formula_version = v.formula_version AND f.formula_registry = v.formula_registry
   WHERE f.engine_version = '1.1.0' AND f.first_release = 'F1.12.4';
  IF n <> 4 THEN
    RAISE EXCEPTION 'PF_0408_POSTCONDITION: expected all four corrected formula versions with their own registry, found %', n;
  END IF;
  SELECT count(*) INTO n FROM public.formula_versions
   WHERE (calculator_id, formula_version) IN (('dew_point', 'fv1-260e7f34'), ('distance_converter', 'fv1-36d27af2'),
                                              ('bolt_torque_spec', 'fv1-f63ea4c8'), ('bolt_stretch', 'fv1-d48e7340'));
  IF n <> 4 THEN
    RAISE EXCEPTION 'PF_0408_POSTCONDITION: the original formula versions must remain, found %', n;
  END IF;
END $$;

COMMIT;
