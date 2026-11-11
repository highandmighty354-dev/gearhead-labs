-- Rollback of 0501 (first-party analytics). Removes every analytics object, INCLUDING all collected analytics data
-- (raw events, sessions, daily rollups, ingestion counters) and the owner list. Touches nothing outside analytics.
-- Run only with owner approval.
BEGIN;
DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('analytics-rollup-recent', 'analytics-purge');
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.analytics_dashboard(date, date, text);
DROP FUNCTION IF EXISTS public.analytics_billing_metrics(date, date);
DROP FUNCTION IF EXISTS public.analytics_refresh();
DROP FUNCTION IF EXISTS public.analytics_rollup_pending();
DROP FUNCTION IF EXISTS public.analytics_purge();
DROP FUNCTION IF EXISTS public.analytics_rollup(date);
DROP FUNCTION IF EXISTS public.analytics_channel(text, text, text);
DROP FUNCTION IF EXISTS public.analytics_ingest(jsonb, jsonb);
DROP FUNCTION IF EXISTS public.analytics_rate_check(text, text, integer);
DROP FUNCTION IF EXISTS public.analytics_limits();
DROP FUNCTION IF EXISTS public.analytics_count(text, text, text, bigint);
DROP FUNCTION IF EXISTS public.analytics_event_problem(jsonb);
DROP FUNCTION IF EXISTS public.analytics_prop_spec(text);
DROP FUNCTION IF EXISTS public.analytics_require_owner();
DROP FUNCTION IF EXISTS public.analytics_is_owner();
DROP TABLE IF EXISTS public.analytics_events;          -- its triggers go with it
DROP FUNCTION IF EXISTS public.analytics_events_guard();
DROP FUNCTION IF EXISTS public.analytics_tz();
DROP TABLE IF EXISTS public.analytics_ingest_stats, public.analytics_sessions, public.analytics_daily, public.analytics_rollup_runs, public.analytics_owners,
  public.analytics_visitors, public.analytics_rate, public.analytics_rate_salt;
COMMIT;
