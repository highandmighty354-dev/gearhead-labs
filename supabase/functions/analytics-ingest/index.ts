// POST analytics batches from the Gearhead Labs site -> public.analytics_ingest() (service role). Always 204.
// Deploy WITHOUT JWT verification (navigator.sendBeacon cannot send an Authorization header):
//   supabase functions deploy analytics-ingest --no-verify-jwt
// Function secrets (set by the owner; never in source control or the browser):
//   ANALYTICS_INGEST_ENABLED   "true" to accept events (anything else: every request is dropped)  — kill switch
//   ANALYTICS_ALLOWED_ORIGINS  comma-separated origins allowed to send, e.g. https://www.gearhead-labs.com,https://gearhead-labs.com
//   ANALYTICS_LIVE_ORIGINS     the subset whose events count as LIVE traffic (others are stored as test; localhost as dev)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the Supabase runtime.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { makeAnalyticsIngestHandler } from '../_shared/analytics-ingest.js';

const list = (name: string) => (Deno.env.get(name) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const url = Deno.env.get('SUPABASE_URL') ?? '', key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const service = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

Deno.serve(makeAnalyticsIngestHandler({
  enabled: Deno.env.get('ANALYTICS_INGEST_ENABLED') === 'true' && !!service,
  rpc: (fn: string, args: Record<string, unknown>) => service!.rpc(fn, args),
  config: { allowedOrigins: list('ANALYTICS_ALLOWED_ORIGINS'), liveOrigins: list('ANALYTICS_LIVE_ORIGINS') },
  log: (msg: string) => console.log(msg),
}));
