/* Gearhead Labs first-party analytics — public client configuration.
   TRACKING IS OFF. It stays off until the owner decisions in docs/ANALYTICS-IMPLEMENTATION.md are made (consent approach,
   Privacy page text, retention) and the database migration and Edge Function are deployed.
   With enabled: false, analytics.js does nothing at all: no storage, no listeners, no network requests.
   endpoint: the analytics-ingest Edge Function URL, e.g. https://<project-ref>.supabase.co/functions/v1/analytics-ingest
   env:      must equal the ingest function's ANALYTICS_ENV setting. The SERVER decides the environment; this value is only
             a cross-check: a page whose env differs has every batch rejected ('env_mismatch'), so it cannot choose or
             change where its events land.
   PUBLIC VALUES ONLY: nothing secret ever goes in this file. */
window.GH_ANALYTICS_CONFIG = {
  enabled: false,
  endpoint: '',
  env: 'live'
};
