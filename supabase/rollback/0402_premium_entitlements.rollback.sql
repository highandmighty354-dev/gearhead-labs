-- Rollback of PREMIUM-FOUNDATION 0402. Requires 0403-0406 rolled back first. Destroys billing/entitlement history:
-- run only on an empty or disposable project.
BEGIN;
DROP FUNCTION IF EXISTS public.pf_sync_stripe_subscription(text, uuid, text, text, text, timestamptz, timestamptz, boolean, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.pf_upsert_billing_customer(uuid, text);
DROP FUNCTION IF EXISTS public.pf_mark_stripe_event_processed(text);
DROP FUNCTION IF EXISTS public.pf_record_stripe_event(text, text, timestamptz, jsonb);
DROP FUNCTION IF EXISTS public.pf_revoke_grant(uuid);
DROP FUNCTION IF EXISTS public.pf_grant_manual(uuid, text, timestamptz, text);
DROP FUNCTION IF EXISTS public.pf_my_entitlement();
DROP FUNCTION IF EXISTS public.pf_has_feature(text);
DROP TABLE IF EXISTS public.stripe_events, public.entitlement_grants, public.subscriptions, public.billing_customers,
                     public.plan_prices, public.plans;
DROP FUNCTION IF EXISTS public.pf_stripe_event_stamp(), public.pf_stripe_event_guard_update(), public.pf_grant_guard_update(),
                        public.pf_guard_update(), public.pf_stamp_insert(), public.pf_refuse();
COMMIT;
