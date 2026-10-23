-- PREMIUM-FOUNDATION 1.1.0 · 0409 formula_versions row for Fuel Pump Sizing after M1 decision D1 (validity rule moved into the registry)
--
-- Owner instruction (2026-10-21): prepare in a separate PR for review. PREPARED, NOT APPLIED; applying it to production is a separate authorization.
-- Engine change: draft PR #12, commit ae4212c (M1 decision D1).
--
--   calculator        new fingerprint  registry            changed by        original row (kept)
--   fuel_pump_sizing  fv1-f5c74781     GH_LEGACY_FORMULAS  M1 D1 (ae4212c)   fv1-c9780487 (F1.12.3)
--
-- What changed in the formula: both outputs (Fuel Mass Flow, Required Pump Delivery) are now computed only when
-- Target HP > 0, BSFC > 0, Fuel Density > 0 and Capacity Margin >= 1.0; otherwise the engine returns OUT_OF_RANGE (no value).
-- For every input that satisfies those conditions the numbers are identical to fv1-c9780487.
--
-- Additive only: one insert, no update, no delete. Formula versions are history (df_never_changed / df_no_truncate), so the
-- original row and any calculation_records row that references it stay exactly as they are. No rollback file by design:
-- a formula_versions row cannot be deleted; reverting the engine leaves the new row unreferenced, which is harmless.
-- Idempotent (ON CONFLICT DO NOTHING). Single transaction; the post-condition aborts the whole transaction on any other state.
BEGIN;

INSERT INTO public.formula_versions (calculator_id, formula_version, engine_version, formula_registry, first_release) VALUES
  ('fuel_pump_sizing', 'fv1-f5c74781', '1.1.0', 'GH_LEGACY_FORMULAS', 'F1.12.4')
ON CONFLICT (calculator_id, formula_version) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.formula_versions
   WHERE calculator_id = 'fuel_pump_sizing' AND formula_version = 'fv1-f5c74781'
     AND engine_version = '1.1.0' AND formula_registry = 'GH_LEGACY_FORMULAS' AND first_release = 'F1.12.4';
  IF n <> 1 THEN
    RAISE EXCEPTION 'PF_0409_POSTCONDITION: expected the fuel_pump_sizing fv1-f5c74781 row with its metadata, found %', n;
  END IF;
  SELECT count(*) INTO n FROM public.formula_versions
   WHERE calculator_id = 'fuel_pump_sizing' AND formula_version = 'fv1-c9780487';
  IF n <> 1 THEN
    RAISE EXCEPTION 'PF_0409_POSTCONDITION: the original fuel_pump_sizing formula version must remain, found %', n;
  END IF;
END $$;

COMMIT;
