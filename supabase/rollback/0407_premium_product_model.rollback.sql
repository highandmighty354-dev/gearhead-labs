-- Rollback of PREMIUM-FOUNDATION 0407 (final product model). Restores the exact 0406 catalog: the 0404 Free machine
-- allowance, the 'garage_unlimited' feature name, and no plan_offers / single-paid-product constraint.
-- Touches no user data. Run only with owner approval.
BEGIN;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['garages','machines','machine_details','components','component_connections','test_setups'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS pf_garage_premium_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS pf_garage_premium_update ON public.%I', t);
  END LOOP;
END $$;
ALTER TABLE public.plan_prices DROP CONSTRAINT IF EXISTS plan_prices_approved_offer_fk;
DROP TABLE IF EXISTS public.plan_offers;
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_single_paid_product;
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_feature_vocabulary;
UPDATE public.plans SET features = ARRAY['engineering_lab','saved_calculations','garage_unlimited'] WHERE plan_key = 'premium';
ALTER TABLE public.plans ADD CONSTRAINT plans_feature_vocabulary CHECK (features <@ ARRAY['engineering_lab','saved_calculations','garage_unlimited']::text[]);
-- The 0404 Free machine allowance, verbatim from supabase/migrations/0404_premium_garage.sql:
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
GRANT EXECUTE ON FUNCTION public.pf_machine_allowance_ok() TO authenticated;

DROP POLICY IF EXISTS pf_machines_free_allowance ON public.machines;
CREATE POLICY pf_machines_free_allowance ON public.machines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.pf_machine_allowance_ok());
COMMIT;
