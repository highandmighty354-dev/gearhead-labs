/* Gearhead Labs Premium — HTTP layer for the three billing Edge Functions (Request -> Response).
 * Runtime-neutral (Deno and Node 18+): the index.ts entry points only read secrets and wire dependencies.
 *   POST /billing-checkout  {interval:'month'|'year'}  (user JWT)  -> {url, trial, trialDays}
 *   POST /billing-portal    {}                         (user JWT)  -> {url}
 *   POST /stripe-webhook    raw Stripe event + Stripe-Signature   -> {received, ...}
 * Errors never echo internal details or secrets. */
import { BillingError, verifyStripeSignature } from './stripe.js';
import { startCheckout, openPortal, handleEvent } from './billing.js';

function corsHeaders(req, allowedOrigins) {
  const origin = req.headers.get('origin');
  const h = { 'Vary': 'Origin' };
  if (origin && allowedOrigins.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Headers'] = 'authorization, x-client-info, apikey, content-type';
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  }
  return h;
}
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
function fail(e, headers) {
  if (e instanceof BillingError) return json(e.status, { error: e.code, message: e.message }, headers);
  console.error('billing: unexpected error', e && e.name);
  return json(500, { error: 'internal_error', message: 'Billing is unavailable right now.' }, headers);
}

/* deps: { getUser(jwt) -> {id, email}|null, stripe, db, config: {returnUrl, allowedOrigins[]}, now } */
function userEndpoint(action) {
  return (deps) => async (req) => {
    const headers = corsHeaders(req, deps.config.allowedOrigins || []);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' }, headers);
    try {
      const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') || '');
      const user = m ? await deps.getUser(m[1]) : null;
      if (!user || !user.id) throw new BillingError(401, 'not_signed_in', 'Sign in first.');
      let body = {}; try { body = await req.json(); } catch (e) { body = {}; }
      return json(200, await action(user, body || {}, deps), headers);
    } catch (e) { return fail(e, headers); }
  };
}
export const makeCheckoutHandler = userEndpoint((user, body, deps) => startCheckout({ accountId: user.id, email: user.email, interval: body.interval }, deps));
export const makePortalHandler = userEndpoint((user, body, deps) => openPortal({ accountId: user.id }, deps));

/* deps: { webhookSecret, stripe, db, now, nowSeconds? } */
export const makeWebhookHandler = (deps) => async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  try {
    const raw = await req.text();                     // the raw body: the signature covers these exact bytes
    const event = await verifyStripeSignature(raw, req.headers.get('stripe-signature'), deps.webhookSecret,
      deps.nowSeconds ? { nowSeconds: deps.nowSeconds() } : undefined);
    const r = await handleEvent(event, deps);
    return json(r.status, r.body);
  } catch (e) { return fail(e); }
};
