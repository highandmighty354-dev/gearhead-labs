-- PREMIUM-FOUNDATION 1.0.0 · 0402 plans, billing, entitlements, central feature check
-- Additive. Stripe-READY, not Stripe-integrated: no keys, no HTTP; the trusted writer is server code running as
-- service_role (a future Supabase Edge Function, D-001). Owner decisions: Free = 1 machine, no saved calculations.
--
--   plans / plan_prices        reference data (migrations only); clients read
--   billing_customers          account <-> Stripe customer; server only, invisible to clients
--   subscriptions              mirror of Stripe subscription state; server-written, owner-readable
--   entitlement_grants         THE source of Premium access; append-only audit; server-written, owner-readable
--   stripe_events              webhook idempotency log; server only, invisible to clients
--   pf_has_feature(feature)    the ONLY access check (RLS policies and the UI use it)
--   pf_my_entitlement()        the caller's effective plan for the frontend
--
-- Clients can never write any table in this file: privileges are revoked (including Supabase's default grants),
-- no write policy exists, RLS is enabled AND forced, and triggers refuse DELETE/TRUNCATE for every role.
-- Idempotent, single transaction, post-conditions. Rollback: supabase/rollback/0402_premium_entitlements.rollback.sql
BEGIN;

-- ---------------------------------------------------------------- generic helpers (shared by 0402-0406)
CREATE OR REPLACE FUNCTION public.pf_refuse() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'PF_IMMUTABLE: % on % is not permitted (%)', TG_OP, TG_TABLE_NAME, TG_ARGV[0] USING ERRCODE = 'P0001';
END $$;

-- Server-forced created_at (+ updated_at where the table has it); a row cannot be created already deleted.
CREATE OR REPLACE FUNCTION public.pf_stamp_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE j jsonb := to_jsonb(NEW);
BEGIN
  IF j ? 'deleted_at' AND j->>'deleted_at' IS NOT NULL THEN
    RAISE EXCEPTION 'PF_IMMUTABLE: a % row cannot be created already deleted', TG_TABLE_NAME USING ERRCODE = 'P0001';
  END IF;
  NEW := jsonb_populate_record(NEW, jsonb_build_object('created_at', now())
           || CASE WHEN j ? 'updated_at' THEN jsonb_build_object('updated_at', now()) ELSE '{}'::jsonb END);
  RETURN NEW;
END $$;

-- On update: the columns named in the trigger arguments are immutable; created_at kept; updated_at refreshed;
-- a soft deletion is permanent (deleted_at can never change once set).
CREATE OR REPLACE FUNCTION public.pf_guard_update() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE n jsonb := to_jsonb(NEW); o jsonb := to_jsonb(OLD); c text;
BEGIN
  FOREACH c IN ARRAY TG_ARGV LOOP
    IF n -> c IS DISTINCT FROM o -> c THEN
      RAISE EXCEPTION 'PF_IMMUTABLE: %.% cannot change', TG_TABLE_NAME, c USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  IF o ? 'deleted_at' AND o ->> 'deleted_at' IS NOT NULL AND n -> 'deleted_at' IS DISTINCT FROM o -> 'deleted_at' THEN
    RAISE EXCEPTION 'PF_IMMUTABLE: a deleted % row cannot be restored or re-stamped', TG_TABLE_NAME USING ERRCODE = 'P0001';
  END IF;
  NEW := jsonb_populate_record(NEW, jsonb_build_object('created_at', o -> 'created_at')
           || CASE WHEN n ? 'updated_at' THEN jsonb_build_object('updated_at', now()) ELSE '{}'::jsonb END);
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------- reference: plans and prices
CREATE TABLE IF NOT EXISTS public.plans (
  plan_key  text    PRIMARY KEY CHECK (plan_key ~ '^[a-z][a-z0-9_]*$'),
  name      text    NOT NULL CHECK (length(btrim(name)) > 0),
  is_paid   boolean NOT NULL,
  features  text[]  NOT NULL DEFAULT '{}',
  active    boolean NOT NULL DEFAULT true,
  CONSTRAINT plans_feature_vocabulary CHECK (features <@ ARRAY['engineering_lab','saved_calculations','garage_unlimited']::text[])
);

CREATE TABLE IF NOT EXISTS public.plan_prices (
  stripe_price_id   text    PRIMARY KEY CHECK (stripe_price_id ~ '^price_[A-Za-z0-9]+$'),
  plan_key          text    NOT NULL REFERENCES public.plans (plan_key) ON DELETE RESTRICT,
  billing_interval  text    NOT NULL CHECK (billing_interval IN ('month','year')),
  currency          text    NOT NULL CHECK (currency ~ '^[a-z]{3}$'),
  unit_amount       integer NOT NULL CHECK (unit_amount >= 0),
  active            boolean NOT NULL DEFAULT true,
  CONSTRAINT plan_prices_paid_plan_only CHECK (plan_key <> 'free')
);

INSERT INTO public.plans (plan_key, name, is_paid, features, active) VALUES
  ('free',    'Free',    false, '{}', true),
  ('premium', 'Premium', true,  ARRAY['engineering_lab','saved_calculations','garage_unlimited'], true)
ON CONFLICT (plan_key) DO NOTHING;

-- ---------------------------------------------------------------- billing (Stripe mirror)
CREATE TABLE IF NOT EXISTS public.billing_customers (
  account_id          uuid        PRIMARY KEY REFERENCES public.accounts (id) ON DELETE RESTRICT,
  stripe_customer_id  text        NOT NULL UNIQUE CHECK (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_customers_account_customer_uq UNIQUE (account_id, stripe_customer_id)
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  stripe_subscription_id  text        PRIMARY KEY CHECK (stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  account_id              uuid        NOT NULL,
  stripe_customer_id      text        NOT NULL,
  status                  text        NOT NULL CHECK (status IN
    ('incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused')),
  stripe_price_id         text        NULL REFERENCES public.plan_prices (stripe_price_id) ON DELETE RESTRICT,
  current_period_start    timestamptz NULL,
  current_period_end      timestamptz NULL,
  cancel_at_period_end    boolean     NOT NULL DEFAULT false,
  trial_end               timestamptz NULL,
  canceled_at             timestamptz NULL,
  -- Stripe time of the state mirrored here (event.created, or when the subscription object was retrieved).
  -- Webhooks can arrive late or out of order: an older state never overwrites a newer one.
  stripe_state_at         timestamptz NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  -- the subscription's customer must be THIS account's customer
  CONSTRAINT subscriptions_account_customer_fk FOREIGN KEY (account_id, stripe_customer_id)
    REFERENCES public.billing_customers (account_id, stripe_customer_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS subscriptions_account_idx ON public.subscriptions (account_id);

-- ---------------------------------------------------------------- entitlement grants (source of access)
CREATE TABLE IF NOT EXISTS public.entitlement_grants (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid        NOT NULL REFERENCES public.accounts (id) ON DELETE RESTRICT,
  plan_key    text        NOT NULL REFERENCES public.plans (plan_key) ON DELETE RESTRICT,
  source      text        NOT NULL CHECK (source IN ('stripe','manual','trial','promo')),
  source_ref  text        NULL,
  starts_at   timestamptz NOT NULL DEFAULT now(),
  ends_at     timestamptz NULL,                       -- NULL = open-ended
  revoked_at  timestamptz NULL,
  note        text        NULL CHECK (note IS NULL OR length(note) <= 500),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grants_paid_plan_only  CHECK (plan_key <> 'free'),      -- Free is the absence of a grant
  CONSTRAINT grants_window_valid    CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT grants_stripe_has_ref  CHECK (source <> 'stripe' OR source_ref ~ '^sub_[A-Za-z0-9]+$')
);
CREATE INDEX IF NOT EXISTS grants_account_idx ON public.entitlement_grants (account_id);
-- at most one OPEN Stripe grant per subscription (renewals extend it; plan changes revoke and replace it)
CREATE UNIQUE INDEX IF NOT EXISTS grants_one_open_per_subscription
  ON public.entitlement_grants (source_ref) WHERE source = 'stripe' AND revoked_at IS NULL;

-- Grants are an audit trail: only ends_at (extension, before revocation) and revoked_at (once) may change.
CREATE OR REPLACE FUNCTION public.pf_grant_guard_update() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.account_id IS DISTINCT FROM OLD.account_id OR NEW.plan_key IS DISTINCT FROM OLD.plan_key
     OR NEW.source IS DISTINCT FROM OLD.source OR NEW.source_ref IS DISTINCT FROM OLD.source_ref
     OR NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.note IS DISTINCT FROM OLD.note THEN
    RAISE EXCEPTION 'PF_GRANT: only ends_at and revoked_at of a grant may change' USING ERRCODE = 'P0001';
  END IF;
  IF OLD.revoked_at IS NOT NULL AND (NEW.revoked_at IS DISTINCT FROM OLD.revoked_at OR NEW.ends_at IS DISTINCT FROM OLD.ends_at) THEN
    RAISE EXCEPTION 'PF_GRANT: a revoked grant is final' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------- Stripe webhook idempotency log
CREATE TABLE IF NOT EXISTS public.stripe_events (
  event_id           text        PRIMARY KEY CHECK (event_id ~ '^evt_[A-Za-z0-9]+$'),
  event_type         text        NOT NULL CHECK (length(btrim(event_type)) > 0),
  stripe_created_at  timestamptz NULL,
  payload            jsonb       NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  received_at        timestamptz NOT NULL DEFAULT now(),
  processed_at       timestamptz NULL
);

CREATE OR REPLACE FUNCTION public.pf_stripe_event_guard_update() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.event_id IS DISTINCT FROM OLD.event_id OR NEW.event_type IS DISTINCT FROM OLD.event_type
     OR NEW.stripe_created_at IS DISTINCT FROM OLD.stripe_created_at OR NEW.payload IS DISTINCT FROM OLD.payload
     OR NEW.received_at IS DISTINCT FROM OLD.received_at OR OLD.processed_at IS NOT NULL THEN
    RAISE EXCEPTION 'PF_EVENT: a Stripe event is immutable except for being marked processed once' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.pf_stripe_event_stamp() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.received_at := now(); NEW.processed_at := NULL; RETURN NEW; END $$;

-- ---------------------------------------------------------------- triggers
CREATE OR REPLACE TRIGGER pf_stamp       BEFORE INSERT ON public.billing_customers FOR EACH ROW EXECUTE FUNCTION public.pf_stamp_insert();
CREATE OR REPLACE TRIGGER pf_guard       BEFORE UPDATE ON public.billing_customers FOR EACH ROW EXECUTE FUNCTION public.pf_guard_update('account_id','stripe_customer_id');
CREATE OR REPLACE TRIGGER pf_no_delete   BEFORE DELETE ON public.billing_customers FOR EACH ROW EXECUTE FUNCTION public.pf_refuse('billing history is retained');
CREATE OR REPLACE TRIGGER pf_no_truncate BEFORE TRUNCATE ON public.billing_customers FOR EACH STATEMENT EXECUTE FUNCTION public.pf_refuse('billing history is retained');

CREATE OR REPLACE TRIGGER pf_stamp       BEFORE INSERT ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.pf_stamp_insert();
CREATE OR REPLACE TRIGGER pf_guard       BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.pf_guard_update('stripe_subscription_id','account_id','stripe_customer_id');
CREATE OR REPLACE TRIGGER pf_no_delete   BEFORE DELETE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.pf_refuse('billing history is retained');
CREATE OR REPLACE TRIGGER pf_no_truncate BEFORE TRUNCATE ON public.subscriptions FOR EACH STATEMENT EXECUTE FUNCTION public.pf_refuse('billing history is retained');

CREATE OR REPLACE TRIGGER pf_stamp       BEFORE INSERT ON public.entitlement_grants FOR EACH ROW EXECUTE FUNCTION public.pf_stamp_insert();
CREATE OR REPLACE TRIGGER pf_guard       BEFORE UPDATE ON public.entitlement_grants FOR EACH ROW EXECUTE FUNCTION public.pf_grant_guard_update();
CREATE OR REPLACE TRIGGER pf_no_delete   BEFORE DELETE ON public.entitlement_grants FOR EACH ROW EXECUTE FUNCTION public.pf_refuse('grants are an audit trail; revoke instead');
CREATE OR REPLACE TRIGGER pf_no_truncate BEFORE TRUNCATE ON public.entitlement_grants FOR EACH STATEMENT EXECUTE FUNCTION public.pf_refuse('grants are an audit trail');

CREATE OR REPLACE TRIGGER pf_stamp       BEFORE INSERT ON public.stripe_events FOR EACH ROW EXECUTE FUNCTION public.pf_stripe_event_stamp();
CREATE OR REPLACE TRIGGER pf_guard       BEFORE UPDATE ON public.stripe_events FOR EACH ROW EXECUTE FUNCTION public.pf_stripe_event_guard_update();
CREATE OR REPLACE TRIGGER pf_no_delete   BEFORE DELETE ON public.stripe_events FOR EACH ROW EXECUTE FUNCTION public.pf_refuse('the webhook log is append-only');
CREATE OR REPLACE TRIGGER pf_no_truncate BEFORE TRUNCATE ON public.stripe_events FOR EACH STATEMENT EXECUTE FUNCTION public.pf_refuse('the webhook log is append-only');

CREATE OR REPLACE TRIGGER pf_no_delete   BEFORE DELETE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.pf_refuse('plans are reference data; deactivate instead');
CREATE OR REPLACE TRIGGER pf_no_truncate BEFORE TRUNCATE ON public.plans FOR EACH STATEMENT EXECUTE FUNCTION public.pf_refuse('plans are reference data');
CREATE OR REPLACE TRIGGER pf_no_delete   BEFORE DELETE ON public.plan_prices FOR EACH ROW EXECUTE FUNCTION public.pf_refuse('prices are reference data; deactivate instead');
CREATE OR REPLACE TRIGGER pf_no_truncate BEFORE TRUNCATE ON public.plan_prices FOR EACH STATEMENT EXECUTE FUNCTION public.pf_refuse('prices are reference data');

-- ---------------------------------------------------------------- central access check
-- True when the CURRENT user (auth.uid()) holds an active, unrevoked grant whose plan includes the feature.
-- No account parameter: a caller can never ask about anyone else. SECURITY DEFINER so policies can call it
-- without granting clients any access to the grants table beyond their own rows.
CREATE OR REPLACE FUNCTION public.pf_has_feature(p_feature text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.entitlement_grants g
    JOIN public.plans p ON p.plan_key = g.plan_key AND p.active
    WHERE g.account_id = auth.uid()
      AND g.revoked_at IS NULL
      AND g.starts_at <= now()
      AND (g.ends_at IS NULL OR g.ends_at > now())
      AND p_feature = ANY (p.features));
$$;

-- The caller's effective plan (what the frontend gates on). One row for an authenticated caller, none for anon.
CREATE OR REPLACE FUNCTION public.pf_my_entitlement()
RETURNS TABLE (plan_key text, is_premium boolean, features text[], source text, ends_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT g.plan_key, true,
           ARRAY(SELECT DISTINCT f FROM public.entitlement_grants g2 JOIN public.plans p2 ON p2.plan_key = g2.plan_key AND p2.active,
                 unnest(p2.features) f
                 WHERE g2.account_id = uid AND g2.revoked_at IS NULL AND g2.starts_at <= now()
                   AND (g2.ends_at IS NULL OR g2.ends_at > now()) ORDER BY f),
           g.source, g.ends_at
      FROM public.entitlement_grants g JOIN public.plans p ON p.plan_key = g.plan_key AND p.active
     WHERE g.account_id = uid AND g.revoked_at IS NULL AND g.starts_at <= now() AND (g.ends_at IS NULL OR g.ends_at > now())
     ORDER BY (g.ends_at IS NULL) DESC, g.ends_at DESC, g.id
     LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'free'::text, false, (SELECT p.features FROM public.plans p WHERE p.plan_key = 'free'), NULL::text, NULL::timestamptz;
  END IF;
END $$;

-- ---------------------------------------------------------------- trusted server path (service_role only)
-- SECURITY INVOKER: they run with service_role's own privileges (RLS bypass); clients cannot execute them.

CREATE OR REPLACE FUNCTION public.pf_grant_manual(p_account uuid, p_plan text, p_ends_at timestamptz, p_note text)
RETURNS uuid LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE gid uuid;
BEGIN
  INSERT INTO public.entitlement_grants (account_id, plan_key, source, ends_at, note)
  VALUES (p_account, p_plan, 'manual', p_ends_at, p_note) RETURNING id INTO gid;
  RETURN gid;
END $$;

CREATE OR REPLACE FUNCTION public.pf_revoke_grant(p_grant_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  UPDATE public.entitlement_grants SET revoked_at = now() WHERE id = p_grant_id AND revoked_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'PF_NOT_FOUND: no open grant %', p_grant_id USING ERRCODE = 'P0002'; END IF;
END $$;

-- Webhook idempotency: true the first time an event id is seen, false on every replay (nothing changes).
CREATE OR REPLACE FUNCTION public.pf_record_stripe_event(p_event_id text, p_event_type text, p_stripe_created_at timestamptz, p_payload jsonb)
RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  INSERT INTO public.stripe_events (event_id, event_type, stripe_created_at, payload)
  VALUES (p_event_id, p_event_type, p_stripe_created_at, p_payload)
  ON CONFLICT (event_id) DO NOTHING;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.pf_mark_stripe_event_processed(p_event_id text) RETURNS void
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  UPDATE public.stripe_events SET processed_at = now() WHERE event_id = p_event_id AND processed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'PF_NOT_FOUND: no unprocessed event %', p_event_id USING ERRCODE = 'P0002'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.pf_upsert_billing_customer(p_account uuid, p_stripe_customer_id text) RETURNS void
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  INSERT INTO public.billing_customers (account_id, stripe_customer_id) VALUES (p_account, p_stripe_customer_id)
  ON CONFLICT (account_id) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.billing_customers WHERE account_id = p_account AND stripe_customer_id = p_stripe_customer_id) THEN
    RAISE EXCEPTION 'PF_BILLING: account % is already linked to a different Stripe customer', p_account USING ERRCODE = '23505';
  END IF;
END $$;

-- Apply one Stripe subscription state and derive the access grant from it.
--   active | trialing | past_due with a future period end -> one open grant for the price's plan, ending at period end
--   anything else (canceled, unpaid, incomplete, incomplete_expired, paused, or a stale period) -> open grant revoked
-- Re-applying the same state changes nothing. A plan change revokes the old grant and opens a new one.
-- Ordering: p_state_at is the Stripe time of this state. A state OLDER than the one already mirrored is ignored and
-- the function returns false (a late or replayed webhook can never re-open access after a cancellation); otherwise
-- it returns true. The check and the write are one atomic upsert, so concurrent deliveries cannot interleave.
CREATE OR REPLACE FUNCTION public.pf_sync_stripe_subscription(
  p_subscription_id text, p_account uuid, p_stripe_customer_id text, p_status text, p_price_id text,
  p_current_period_start timestamptz, p_current_period_end timestamptz, p_cancel_at_period_end boolean,
  p_trial_end timestamptz, p_canceled_at timestamptz, p_state_at timestamptz) RETURNS boolean
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_plan text; v_open public.entitlement_grants; n int;
BEGIN
  IF p_state_at IS NULL THEN
    RAISE EXCEPTION 'PF_BILLING: the Stripe state time is required' USING ERRCODE = '22004';
  END IF;
  INSERT INTO public.subscriptions AS s (stripe_subscription_id, account_id, stripe_customer_id, status, stripe_price_id,
         current_period_start, current_period_end, cancel_at_period_end, trial_end, canceled_at, stripe_state_at)
  VALUES (p_subscription_id, p_account, p_stripe_customer_id, p_status, p_price_id,
          p_current_period_start, p_current_period_end, coalesce(p_cancel_at_period_end, false), p_trial_end, p_canceled_at, p_state_at)
  ON CONFLICT (stripe_subscription_id) DO UPDATE SET
    account_id = EXCLUDED.account_id, stripe_customer_id = EXCLUDED.stripe_customer_id,   -- guard trigger refuses a change
    status = EXCLUDED.status, stripe_price_id = EXCLUDED.stripe_price_id,
    current_period_start = EXCLUDED.current_period_start, current_period_end = EXCLUDED.current_period_end,
    cancel_at_period_end = EXCLUDED.cancel_at_period_end, trial_end = EXCLUDED.trial_end, canceled_at = EXCLUDED.canceled_at,
    stripe_state_at = EXCLUDED.stripe_state_at
  WHERE s.stripe_state_at <= EXCLUDED.stripe_state_at;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RETURN false; END IF;   -- stale state: nothing changes

  SELECT plan_key INTO v_plan FROM public.plan_prices WHERE stripe_price_id = p_price_id;
  SELECT * INTO v_open FROM public.entitlement_grants
   WHERE source = 'stripe' AND source_ref = p_subscription_id AND revoked_at IS NULL;

  IF p_status IN ('active','trialing','past_due') AND v_plan IS NOT NULL AND p_current_period_end > now() THEN
    IF v_open.id IS NOT NULL AND v_open.plan_key = v_plan THEN
      IF v_open.ends_at IS DISTINCT FROM p_current_period_end THEN
        UPDATE public.entitlement_grants SET ends_at = p_current_period_end WHERE id = v_open.id;
      END IF;
    ELSE
      IF v_open.id IS NOT NULL THEN
        UPDATE public.entitlement_grants SET revoked_at = now() WHERE id = v_open.id;
      END IF;
      INSERT INTO public.entitlement_grants (account_id, plan_key, source, source_ref, ends_at)
      VALUES (p_account, v_plan, 'stripe', p_subscription_id, p_current_period_end);
    END IF;
  ELSIF v_open.id IS NOT NULL THEN
    UPDATE public.entitlement_grants SET revoked_at = now() WHERE id = v_open.id;
  END IF;
  RETURN true;
END $$;

-- ---------------------------------------------------------------- RLS and privileges
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['plans','plan_prices','billing_customers','subscriptions','entitlement_grants','stripe_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', t);
  END LOOP;
END $$;

GRANT SELECT ON public.plans, public.plan_prices TO authenticated, service_role;
GRANT SELECT ON public.subscriptions TO authenticated;
-- grants: every column except the operator's internal note
GRANT SELECT (id, account_id, plan_key, source, source_ref, starts_at, ends_at, revoked_at, created_at) ON public.entitlement_grants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.billing_customers, public.subscriptions, public.entitlement_grants, public.stripe_events TO service_role;

DROP POLICY IF EXISTS pf_plans_read ON public.plans;
DROP POLICY IF EXISTS pf_plan_prices_read ON public.plan_prices;
DROP POLICY IF EXISTS pf_subscriptions_select ON public.subscriptions;
DROP POLICY IF EXISTS pf_grants_select ON public.entitlement_grants;
CREATE POLICY pf_plans_read        ON public.plans        FOR SELECT TO authenticated USING (true);
CREATE POLICY pf_plan_prices_read  ON public.plan_prices  FOR SELECT TO authenticated USING (true);
CREATE POLICY pf_subscriptions_select ON public.subscriptions      FOR SELECT TO authenticated USING (account_id = auth.uid());
CREATE POLICY pf_grants_select        ON public.entitlement_grants FOR SELECT TO authenticated USING (account_id = auth.uid());

-- Functions: revoke PUBLIC/anon (and Supabase's default grants), then grant narrowly.
REVOKE ALL ON FUNCTION public.pf_refuse(), public.pf_stamp_insert(), public.pf_guard_update(), public.pf_grant_guard_update(),
  public.pf_stripe_event_guard_update(), public.pf_stripe_event_stamp() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.pf_has_feature(text), public.pf_my_entitlement() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pf_has_feature(text), public.pf_my_entitlement() TO authenticated;
REVOKE ALL ON FUNCTION public.pf_grant_manual(uuid, text, timestamptz, text), public.pf_revoke_grant(uuid),
  public.pf_record_stripe_event(text, text, timestamptz, jsonb), public.pf_mark_stripe_event_processed(text),
  public.pf_upsert_billing_customer(uuid, text),
  public.pf_sync_stripe_subscription(text, uuid, text, text, text, timestamptz, timestamptz, boolean, timestamptz, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pf_grant_manual(uuid, text, timestamptz, text), public.pf_revoke_grant(uuid),
  public.pf_record_stripe_event(text, text, timestamptz, jsonb), public.pf_mark_stripe_event_processed(text),
  public.pf_upsert_billing_customer(uuid, text),
  public.pf_sync_stripe_subscription(text, uuid, text, text, text, timestamptz, timestamptz, boolean, timestamptz, timestamptz, timestamptz)
  TO service_role;

-- ---------------------------------------------------------------- post-conditions
DO $$ DECLARE t text; p text;
BEGIN
  FOREACH t IN ARRAY ARRAY['plans','plan_prices','billing_customers','subscriptions','entitlement_grants','stripe_events'] LOOP
    IF NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'PF_0402_POSTCONDITION: RLS not enabled and forced on %', t; END IF;
    FOREACH p IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF has_table_privilege('authenticated', 'public.' || t, p) OR has_table_privilege('anon', 'public.' || t, p) THEN
        RAISE EXCEPTION 'PF_0402_POSTCONDITION: client holds % on %', p, t; END IF;
    END LOOP;
    IF has_table_privilege('anon', 'public.' || t, 'SELECT') THEN RAISE EXCEPTION 'PF_0402_POSTCONDITION: anon can read %', t; END IF;
  END LOOP;
  IF has_table_privilege('authenticated', 'public.billing_customers', 'SELECT') OR has_table_privilege('authenticated', 'public.stripe_events', 'SELECT') THEN
    RAISE EXCEPTION 'PF_0402_POSTCONDITION: clients can read server-only billing tables'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
             AND tablename IN ('plans','plan_prices','billing_customers','subscriptions','entitlement_grants','stripe_events')
             AND cmd <> 'SELECT') THEN
    RAISE EXCEPTION 'PF_0402_POSTCONDITION: a write policy exists on a billing/entitlement table'; END IF;
  IF has_column_privilege('authenticated', 'public.entitlement_grants', 'note', 'SELECT') THEN
    RAISE EXCEPTION 'PF_0402_POSTCONDITION: clients can read operator notes on grants'; END IF;
  IF has_function_privilege('authenticated', 'public.pf_grant_manual(uuid, text, timestamptz, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.pf_sync_stripe_subscription(text, uuid, text, text, text, timestamptz, timestamptz, boolean, timestamptz, timestamptz, timestamptz)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.pf_has_feature(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PF_0402_POSTCONDITION: function privileges too broad'; END IF;
  IF (SELECT count(*) FROM public.plans) <> 2
     OR NOT EXISTS (SELECT 1 FROM public.plans WHERE plan_key = 'free' AND NOT is_paid AND features = '{}')
     OR NOT EXISTS (SELECT 1 FROM public.plans WHERE plan_key = 'premium' AND is_paid
                    AND features = ARRAY['engineering_lab','saved_calculations','garage_unlimited']) THEN
    RAISE EXCEPTION 'PF_0402_POSTCONDITION: plans seed differs from the approved plans'; END IF;
END $$;

COMMIT;
