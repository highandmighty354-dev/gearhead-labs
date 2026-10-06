-- PREMIUM-FOUNDATION 1.1.0 · 0407 final product model: ONE paid product (Gearhead Labs Premium), Garage inside Premium
--
-- Owner decision (supersedes design decision P-1 and the 0404 Free machine allowance):
--   FREE     = the public calculators only. No Garage, no vehicle profiles, no Test Setups (Builds), no saved work.
--   PREMIUM  = the single paid product, USD 5.99 per month or USD 59.99 per year. Includes My Garage (vehicle profiles,
--              details, components, Test Setups/Builds), saved calculations and the Engineering Lab (E01-E14).
--   The early $1.99 Garage / $3.99 additional-profile concept is retired and never existed in this schema.
--
-- What this migration changes (additive / non-destructive; no user data is removed or rewritten):
--   1. plans: the Premium feature 'garage_unlimited' is renamed 'garage' (a reference-data row update; plans only
--      ever holds the 2 seeded rows). The feature vocabulary constraint is replaced accordingly, and a new constraint
--      makes Premium the only plan that may be paid.
--   2. plan_offers (new, reference data): the approved list prices, premium/month/usd/599 and premium/year/usd/5999.
--      plan_prices (Stripe price ids, still empty: Stripe is not implemented) gains a foreign key to plan_offers, so a
--      Stripe price can never be added for an amount, interval or currency that was not approved.
--   3. Garage under Premium: RESTRICTIVE policies on garages, machines, machine_details, components,
--      component_connections and test_setups require pf_has_feature('garage') to INSERT or UPDATE. The frozen
--      DATA-/GARAGE-FOUNDATION policies are untouched (restrictive policies AND with them).
--      The 0404 Free allowance (policy pf_machines_free_allowance + function pf_machine_allowance_ok) is removed.
--   A lapsed or former Premium account keeps READ access to its garage data and can still soft-delete it (the
--   soft-delete functions are owner-checked SECURITY DEFINERs), but cannot create or edit it - the same rule as saved
--   calculations and engineering analyses.
--
-- Existing production data affected: none. plans row 'premium' changes its features array only; no account, grant,
-- garage or machine row is touched. Idempotent, single transaction, post-conditions.
-- Rollback: supabase/rollback/0407_premium_product_model.rollback.sql (restores the exact 0406 catalog).
BEGIN;

-- ---------------------------------------------------------------- 1. plans: one paid product, 'garage' feature
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_feature_vocabulary;
UPDATE public.plans SET features = ARRAY['engineering_lab','saved_calculations','garage']
 WHERE plan_key = 'premium' AND features IS DISTINCT FROM ARRAY['engineering_lab','saved_calculations','garage'];
ALTER TABLE public.plans ADD CONSTRAINT plans_feature_vocabulary
  CHECK (features <@ ARRAY['engineering_lab','saved_calculations','garage']::text[]);
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_single_paid_product;
ALTER TABLE public.plans ADD CONSTRAINT plans_single_paid_product CHECK (NOT is_paid OR plan_key = 'premium');

-- ---------------------------------------------------------------- 2. approved list prices
CREATE TABLE IF NOT EXISTS public.plan_offers (
  plan_key          text    NOT NULL REFERENCES public.plans (plan_key) ON DELETE RESTRICT,
  billing_interval  text    NOT NULL CHECK (billing_interval IN ('month','year')),
  currency          text    NOT NULL CHECK (currency ~ '^[a-z]{3}$'),
  unit_amount       integer NOT NULL CHECK (unit_amount > 0),
  active            boolean NOT NULL DEFAULT true,
  PRIMARY KEY (plan_key, billing_interval, currency),
  CONSTRAINT plan_offers_price_key UNIQUE (plan_key, billing_interval, currency, unit_amount),
  CONSTRAINT plan_offers_paid_plan_only CHECK (plan_key <> 'free')
);
INSERT INTO public.plan_offers (plan_key, billing_interval, currency, unit_amount, active) VALUES
  ('premium', 'month', 'usd', 599,  true),
  ('premium', 'year',  'usd', 5999, true)
ON CONFLICT (plan_key, billing_interval, currency) DO NOTHING;

CREATE OR REPLACE TRIGGER pf_no_delete   BEFORE DELETE ON public.plan_offers FOR EACH ROW EXECUTE FUNCTION public.pf_refuse('offers are reference data; deactivate instead');
CREATE OR REPLACE TRIGGER pf_no_truncate BEFORE TRUNCATE ON public.plan_offers FOR EACH STATEMENT EXECUTE FUNCTION public.pf_refuse('offers are reference data');

ALTER TABLE public.plan_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_offers FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.plan_offers FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.plan_offers TO authenticated, service_role;
DROP POLICY IF EXISTS pf_plan_offers_read ON public.plan_offers;
CREATE POLICY pf_plan_offers_read ON public.plan_offers FOR SELECT TO authenticated USING (true);

-- A future Stripe price must match an approved offer exactly (plan, interval, currency, amount).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.plan_prices'::regclass AND conname = 'plan_prices_approved_offer_fk') THEN
    ALTER TABLE public.plan_prices ADD CONSTRAINT plan_prices_approved_offer_fk FOREIGN KEY (plan_key, billing_interval, currency, unit_amount)
      REFERENCES public.plan_offers (plan_key, billing_interval, currency, unit_amount) ON DELETE RESTRICT;
  END IF;
END $$;

-- ---------------------------------------------------------------- 3. Garage under Premium
DROP POLICY IF EXISTS pf_machines_free_allowance ON public.machines;
DROP FUNCTION IF EXISTS public.pf_machine_allowance_ok();

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['garages','machines','machine_details','components','component_connections','test_setups'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS pf_garage_premium_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS pf_garage_premium_update ON public.%I', t);
    EXECUTE format('CREATE POLICY pf_garage_premium_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated '
                   'WITH CHECK (public.pf_has_feature(''garage''))', t);
    EXECUTE format('CREATE POLICY pf_garage_premium_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated '
                   'USING (true) WITH CHECK (public.pf_has_feature(''garage''))', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------- post-conditions
DO $$ DECLARE t text; p text;
BEGIN
  IF (SELECT count(*) FROM public.plans) <> 2
     OR NOT EXISTS (SELECT 1 FROM public.plans WHERE plan_key = 'free' AND NOT is_paid AND features = '{}')
     OR NOT EXISTS (SELECT 1 FROM public.plans WHERE plan_key = 'premium' AND is_paid
                    AND features = ARRAY['engineering_lab','saved_calculations','garage']) THEN
    RAISE EXCEPTION 'PF_0407_POSTCONDITION: plans differ from the approved product model'; END IF;
  IF (SELECT array_agg(billing_interval || ':' || currency || ':' || unit_amount ORDER BY billing_interval)
        FROM public.plan_offers WHERE plan_key = 'premium' AND active) IS DISTINCT FROM ARRAY['month:usd:599','year:usd:5999'] THEN
    RAISE EXCEPTION 'PF_0407_POSTCONDITION: Premium offers differ from 5.99/month and 59.99/year'; END IF;
  IF (SELECT count(*) FROM public.plan_offers) <> 2 THEN RAISE EXCEPTION 'PF_0407_POSTCONDITION: unexpected offers'; END IF;
  IF NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.plan_offers'::regclass) THEN
    RAISE EXCEPTION 'PF_0407_POSTCONDITION: RLS not enabled and forced on plan_offers'; END IF;
  FOREACH p IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
    IF has_table_privilege('authenticated', 'public.plan_offers', p) OR has_table_privilege('anon', 'public.plan_offers', p) THEN
      RAISE EXCEPTION 'PF_0407_POSTCONDITION: client holds % on plan_offers', p; END IF;
  END LOOP;
  IF has_table_privilege('anon', 'public.plan_offers', 'SELECT') THEN RAISE EXCEPTION 'PF_0407_POSTCONDITION: anon can read plan_offers'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'machines' AND policyname = 'pf_machines_free_allowance')
     OR to_regprocedure('public.pf_machine_allowance_ok()') IS NOT NULL THEN
    RAISE EXCEPTION 'PF_0407_POSTCONDITION: the retired Free machine allowance is still present'; END IF;
  FOREACH t IN ARRAY ARRAY['garages','machines','machine_details','components','component_connections','test_setups'] LOOP
    IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND permissive = 'RESTRICTIVE'
          AND policyname IN ('pf_garage_premium_insert','pf_garage_premium_update')
          AND coalesce(with_check, '') LIKE '%pf_has_feature(''garage''::text)%') <> 2 THEN
      RAISE EXCEPTION 'PF_0407_POSTCONDITION: Premium garage policies missing on %', t; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.plan_prices'::regclass AND conname = 'plan_prices_approved_offer_fk') THEN
    RAISE EXCEPTION 'PF_0407_POSTCONDITION: plan_prices is not tied to the approved offers'; END IF;
END $$;

COMMIT;
