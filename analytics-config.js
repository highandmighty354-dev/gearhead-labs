/* Gearhead Labs first-party analytics — public client configuration.
   TRACKING IS OFF. It stays off until the owner decisions in docs/ANALYTICS-IMPLEMENTATION.md are made (consent approach,
   Privacy page text, retention) and the database migration and Edge Function are deployed.
   With enabled: false, analytics.js does nothing at all: no storage, no listeners, no network requests.
   endpoint: the analytics-ingest Edge Function URL, e.g. https://<project-ref>.supabase.co/functions/v1/analytics-ingest
   env:      'live' on the production site; 'test' for any trial run (the server also decides: only allow-listed live
             origins can produce live data, and localhost is always 'dev').
   PUBLIC VALUES ONLY: nothing secret ever goes in this file. */
window.GH_ANALYTICS_CONFIG = {
  enabled: false,
  endpoint: '',
  env: 'live'
};
