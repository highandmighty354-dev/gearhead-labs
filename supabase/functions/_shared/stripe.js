/* Gearhead Labs Premium — minimal Stripe REST client and webhook signature verification.
 *
 * TEST MODE ONLY. The client refuses any key that is not a Stripe test key (sk_test_ / rk_test_), and webhook events
 * with livemode=true are rejected by the webhook handler. Going live is a deliberate, reviewed code change, never a
 * configuration switch.
 *
 * Plain JavaScript with Web Crypto and fetch only, so the same file runs in Supabase Edge Functions (Deno) and in the
 * Node test suite. No secret is ever logged or returned. */

export const STRIPE_API_VERSION = '2025-03-31.basil';   // pinned; the webhook endpoint must use the same version
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export class BillingError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

const TEST_KEY = /^(sk|rk)_test_[A-Za-z0-9]+$/;
export function assertTestModeKey(key) {
  if (typeof key !== 'string' || !TEST_KEY.test(key)) {
    throw new BillingError(500, 'stripe_not_test_mode', 'Stripe is not configured with a TEST-mode secret key; billing is disabled.');
  }
}

/* Stripe's form encoding: nested objects and arrays as a[b][0][c]=v. Undefined/null values are omitted. */
export function formEncode(params, prefix = '', out = []) {
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === 'object' && item !== null)
      ? formEncode(item, `${key}[${i}]`, out) : out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`));
    else if (typeof v === 'object') formEncode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.join('&');
}

/* The four calls billing needs. fetchImpl is injectable for tests. */
export function createStripeClient(secretKey, { fetchImpl = globalThis.fetch, apiBase = 'https://api.stripe.com/v1' } = {}) {
  assertTestModeKey(secretKey);
  async function call(method, path, params, idempotencyKey) {
    const headers = { Authorization: `Bearer ${secretKey}`, 'Stripe-Version': STRIPE_API_VERSION };
    let body;
    if (method === 'POST') { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = formEncode(params); }
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const url = method === 'GET' && params ? `${apiBase}${path}?${formEncode(params)}` : `${apiBase}${path}`;
    let res;
    try { res = await fetchImpl(url, { method, headers, body }); }
    catch (e) { throw new BillingError(502, 'stripe_unreachable', 'Stripe could not be reached.'); }
    let json = null; try { json = await res.json(); } catch (e) { /* non-JSON */ }
    if (!res.ok) {
      const type = json && json.error && json.error.type;
      throw new BillingError(res.status >= 500 ? 502 : 400, 'stripe_error', `Stripe request failed (${res.status}${type ? ', ' + type : ''}).`);
    }
    if (json && json.livemode === true) throw new BillingError(500, 'stripe_live_object', 'Stripe returned a live-mode object; refused.');
    return json;
  }
  return {
    createCustomer: (params, key) => call('POST', '/customers', params, key),
    createCheckoutSession: (params, key) => call('POST', '/checkout/sessions', params, key),
    createPortalSession: (params) => call('POST', '/billing_portal/sessions', params),
    retrieveSubscription: (id) => call('GET', `/subscriptions/${encodeURIComponent(id)}`),
  };
}

/* ---------------------------------------------------------------- webhook signatures */
const enc = new TextEncoder();
async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
  return Array.from(sig, b => b.toString(16).padStart(2, '0')).join('');
}
function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* Verifies the Stripe-Signature header against the RAW request body (never a re-serialised object).
 * Header: t=<unix seconds>,v1=<hex>[,v1=<hex>...]. Returns the parsed event, or throws BillingError(400). */
export async function verifyStripeSignature(rawBody, header, secret, { nowSeconds = Math.floor(Date.now() / 1000), tolerance = SIGNATURE_TOLERANCE_SECONDS } = {}) {
  if (typeof secret !== 'string' || !/^whsec_[A-Za-z0-9]+$/.test(secret)) throw new BillingError(500, 'webhook_not_configured', 'Webhook signing secret is not configured.');
  if (typeof header !== 'string' || !header) throw new BillingError(400, 'signature_missing', 'Missing Stripe-Signature header.');
  let t = null; const v1 = [];
  for (const part of header.split(',')) {
    const i = part.indexOf('='); if (i < 0) continue;
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k === 't' && /^\d+$/.test(v)) t = Number(v); else if (k === 'v1' && /^[0-9a-f]{64}$/.test(v)) v1.push(v);
  }
  if (t === null || !v1.length) throw new BillingError(400, 'signature_malformed', 'Malformed Stripe-Signature header.');
  if (Math.abs(nowSeconds - t) > tolerance) throw new BillingError(400, 'signature_expired', 'Stripe-Signature timestamp outside the tolerance.');
  const expected = await hmacHex(secret, `${t}.${rawBody}`);
  if (!v1.some(s => timingSafeEqualHex(s, expected))) throw new BillingError(400, 'signature_invalid', 'Stripe-Signature does not match.');
  let event; try { event = JSON.parse(rawBody); } catch (e) { throw new BillingError(400, 'payload_invalid', 'Webhook body is not JSON.'); }
  if (!event || typeof event !== 'object' || typeof event.id !== 'string' || typeof event.type !== 'string') throw new BillingError(400, 'payload_invalid', 'Webhook body is not a Stripe event.');
  return event;
}

/* For tests and local tooling only: produce a valid header for a body. */
export async function signStripePayload(rawBody, secret, timestamp) {
  return `t=${timestamp},v1=${await hmacHex(secret, `${timestamp}.${rawBody}`)}`;
}
