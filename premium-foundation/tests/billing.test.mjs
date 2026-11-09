#!/usr/bin/env node
/* Gearhead Labs Premium — Stripe billing tests (TEST MODE design; no Stripe account, no network).
 * LOCAL THROWAWAY POSTGRESQL ONLY (started by tests/run-tests.sh). Never point this at a real Supabase project.
 *
 * Runs the REAL billing code (supabase/functions/_shared/*.js: signature verification, Checkout, Portal, webhook
 * handling, the HTTP handlers) against the REAL migrations (0001-0408) on a fresh database, through a PostgreSQL
 * implementation of the same service-role adapter interface the Edge Functions use. Stripe itself is an in-memory
 * simulator that keeps subscription objects and emits signed webhook events, so the whole lifecycle is exercised:
 * checkout -> trial -> trial end (paid / failed) -> renewal -> past_due -> cancellation, plus retries, replays,
 * out-of-order delivery, forged signatures, live-mode refusal and account-binding attacks.
 * What it cannot prove: Stripe's real API behaviour and payload shapes (see docs/BILLING-STRIPE.md, "Remaining"). */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { Client } = require('pg');
const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '..', '..');
const SH = path.join(REPO, 'supabase', 'functions', '_shared');
const S = await import(path.join(SH, 'stripe.js')), B = await import(path.join(SH, 'billing.js')), H = await import(path.join(SH, 'handlers.js'));
const HOST = process.env.PF_PGHOST, PORT = +process.env.PF_PGPORT;
if (!HOST || !PORT) { console.error('PF_PGHOST / PF_PGPORT not set (use tests/run-tests.sh)'); process.exit(2); }

let checks = 0, failures = 0;
function check(name, ok, detail) { checks++; if (ok) console.log(`  ok   ${name}`); else { failures++; console.log(`  FAIL ${name}${detail !== undefined ? '\n       ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 600) : ''}`); } }
async function rejects(p, code) { try { await p; return false; } catch (e) { return code ? e.code === code : true; } }

/* ---------------------------------------------------------------- database */
const MIG = fs.readdirSync(path.join(REPO, 'supabase', 'migrations')).filter(f => /^\d{4}_.+\.sql$/.test(f)).sort();
const SHIM = fs.readFileSync(path.join(HERE, 'sql', '000_hosted_supabase_shim.sql'), 'utf8');
const connect = async (db, user) => { const c = new Client({ host: HOST, port: PORT, user, database: db }); await c.connect(); return c; };
const DB = 'billing_' + process.pid;
{ const a = await connect('postgres', 'supabase_admin'); await a.query(`CREATE DATABASE ${DB} OWNER supabase_admin TEMPLATE template0`); await a.end();
  const sa = await connect(DB, 'supabase_admin'); await sa.query(SHIM); await sa.end();
  const pg = await connect(DB, 'postgres'); for (const f of MIG) await pg.query(fs.readFileSync(path.join(REPO, 'supabase', 'migrations', f), 'utf8')); await pg.end(); }
const U = { A: 'a1111111-0000-4000-8000-00000000000a', B: 'b2222222-0000-4000-8000-00000000000b', C: 'c3333333-0000-4000-8000-00000000000c', M: 'd4444444-0000-4000-8000-00000000000d' };
{ const sa = await connect(DB, 'supabase_admin'); for (const [k, id] of Object.entries(U)) await sa.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [id, `${k.toLowerCase()}@example.test`]); await sa.end(); }
const pg = await connect(DB, 'postgres');
async function asRole(role, claims, fn) {
  await pg.query('BEGIN');
  try { await pg.query(`SET LOCAL ROLE ${role}`); await pg.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    const r = await fn(); await pg.query('COMMIT'); return r; } catch (e) { await pg.query('ROLLBACK'); throw e; }
}
const svc = (sql, params) => asRole('service_role', { role: 'service_role' }, async () => (await pg.query(sql, params)).rows);
const asUser = (u, sql, params) => asRole('authenticated', { sub: u, role: 'authenticated' }, async () => (await pg.query(sql, params)).rows);
const ent = async (u) => (await asUser(u, 'SELECT * FROM public.pf_my_entitlement()'))[0];
const hasLab = async (u) => (await asUser(u, `SELECT public.pf_has_feature('engineering_lab') AS f`))[0].f;
const grants = (u) => svc(`SELECT source, source_ref, ends_at, revoked_at FROM public.entitlement_grants WHERE account_id = $1 ORDER BY created_at, id`, [u]);

/* The PostgreSQL implementation of db-supabase.js's interface (same queries, as service_role). */
function wrapPg(e) { const b = new S.BillingError(e.code === '23505' ? 409 : 500, 'database_error', e.message); b.pgcode = e.code; return b; }
const db = {
  async priceFor(plan, interval) {
    const r = await svc(`SELECT p.stripe_price_id, p.currency, p.unit_amount FROM public.plan_prices p
      JOIN public.plan_offers o USING (plan_key, billing_interval, currency, unit_amount)
      WHERE p.plan_key = $1 AND p.billing_interval = $2 AND p.active AND o.active`, [plan, interval]);
    if (r.length > 1) throw new S.BillingError(500, 'price_ambiguous', 'ambiguous'); return r[0] || null;
  },
  async priceKnown(id) { return id ? (await svc(`SELECT 1 FROM public.plan_prices WHERE stripe_price_id = $1`, [id])).length === 1 : false; },
  async hasOpenGrant(a) { return (await svc(`SELECT 1 FROM public.entitlement_grants WHERE account_id = $1 AND revoked_at IS NULL AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()) LIMIT 1`, [a])).length > 0; },
  async subscriptionsFor(a) { return svc(`SELECT stripe_subscription_id, status FROM public.subscriptions WHERE account_id = $1`, [a]); },
  async customerFor(a) { const r = await svc(`SELECT stripe_customer_id FROM public.billing_customers WHERE account_id = $1`, [a]); return r[0] ? r[0].stripe_customer_id : null; },
  async accountForCustomer(c) { const r = await svc(`SELECT account_id FROM public.billing_customers WHERE stripe_customer_id = $1`, [c]); return r[0] ? r[0].account_id : null; },
  async linkCustomer(a, c) { try { await svc(`SELECT public.pf_upsert_billing_customer($1, $2)`, [a, c]); } catch (e) { const w = wrapPg(e); w.code = 'customer_link_failed'; throw w; } },
  async recordEvent(id, type, at, payload) { return (await svc(`SELECT public.pf_record_stripe_event($1, $2, $3, $4) AS r`, [id, type, at, payload]))[0].r === true; },
  async eventProcessed(id) { const r = await svc(`SELECT processed_at FROM public.stripe_events WHERE event_id = $1`, [id]); return r.length === 1 && r[0].processed_at !== null; },
  async markProcessed(id) { try { await svc(`SELECT public.pf_mark_stripe_event_processed($1)`, [id]); } catch (e) { if (e.code !== 'P0002') throw wrapPg(e); } },
  async syncSubscription(a) {
    return (await svc(`SELECT public.pf_sync_stripe_subscription(p_subscription_id => $1, p_account => $2, p_stripe_customer_id => $3, p_status => $4,
      p_price_id => $5, p_current_period_start => $6, p_current_period_end => $7, p_cancel_at_period_end => $8, p_trial_end => $9,
      p_canceled_at => $10, p_state_at => $11) AS r`, [a.p_subscription_id, a.p_account, a.p_stripe_customer_id, a.p_status, a.p_price_id,
      a.p_current_period_start, a.p_current_period_end, a.p_cancel_at_period_end, a.p_trial_end, a.p_canceled_at, a.p_state_at]))[0].r === true;
  },
};

/* ---------------------------------------------------------------- Stripe simulator (test mode semantics) */
const DAY = 86400, nowS = () => Math.floor(Date.now() / 1000);
let seq = 0; const nid = (p) => `${p}_${(++seq).toString(36).padStart(8, '0')}SIM`;
const PRICE = { month: 'price_ghTestMonth', year: 'price_ghTestYear' };
function makeStripe() {
  const st = { customers: {}, sessions: {}, subs: {}, idem: {}, calls: [], failRetrieve: 0, basil: true };
  const idem = (k, mk) => (k && st.idem[k]) ? st.idem[k] : (k ? (st.idem[k] = mk()) : mk());
  const api = {
    async createCustomer(params, key) { st.calls.push(['createCustomer', params, key]); return idem(key, () => { const c = { id: nid('cus'), object: 'customer', livemode: false, ...params }; st.customers[c.id] = c; return c; }); },
    async createCheckoutSession(params, key) { st.calls.push(['createCheckoutSession', params, key]); return idem(key, () => { const s = { id: nid('cs_test'), object: 'checkout.session', livemode: false, url: 'https://checkout.stripe.com/c/pay/sim', ...params }; st.sessions[s.id] = s; return s; }); },
    async createPortalSession(params) { st.calls.push(['createPortalSession', params]); return { id: nid('bps'), url: 'https://billing.stripe.com/p/session/sim', ...params }; },
    async retrieveSubscription(id) { st.calls.push(['retrieveSubscription', id]); if (st.failRetrieve > 0) { st.failRetrieve--; throw new S.BillingError(502, 'stripe_unreachable', 'simulated outage'); }
      const s = st.subs[id]; if (!s) throw new S.BillingError(400, 'stripe_error', 'no such subscription'); return JSON.parse(JSON.stringify(s)); },
  };
  // Stripe-side lifecycle (what Stripe would do), each returning the events it emits
  const ev = (type, object, extra = {}) => ({ id: nid('evt'), object: 'event', type, created: nowS(), livemode: false, data: { object: JSON.parse(JSON.stringify(object)) }, ...extra });
  function setPeriod(s, start, end) { if (st.basil) { s.items.data[0].current_period_start = start; s.items.data[0].current_period_end = end; } else { s.current_period_start = start; s.current_period_end = end; } }
  const sim = {
    completeCheckout(sessionId) {
      const cs = st.sessions[sessionId]; const interval = Object.keys(PRICE).find(k => PRICE[k] === cs.line_items[0].price);
      const trialDays = cs.subscription_data && cs.subscription_data.trial_period_days; const t = nowS();
      const s = { id: nid('sub'), object: 'subscription', livemode: false, customer: cs.customer, status: trialDays ? 'trialing' : 'active', cancel_at_period_end: false,
        trial_end: trialDays ? t + trialDays * DAY : null, canceled_at: null, metadata: cs.subscription_data.metadata,
        items: { data: [{ id: nid('si'), price: { id: cs.line_items[0].price, recurring: { interval } } }] } };
      setPeriod(s, t, trialDays ? t + trialDays * DAY : t + (interval === 'year' ? 365 : 30) * DAY); st.subs[s.id] = s;
      cs.subscription = s.id; cs.status = 'complete';
      return [ev('customer.subscription.created', s), ev('checkout.session.completed', cs)];
    },
    trialEnds(subId, paid) { const s = st.subs[subId], t = nowS(); s.trial_end = s.trial_end; s.status = paid ? 'active' : 'past_due'; setPeriod(s, t, t + 30 * DAY);
      const inv = { id: nid('in'), object: 'invoice', livemode: false, customer: s.customer, parent: { subscription_details: { subscription: s.id } } };
      return [ev('customer.subscription.updated', s), ev(paid ? 'invoice.paid' : 'invoice.payment_failed', inv)]; },
    renew(subId) { const s = st.subs[subId], t = nowS(); s.status = 'active'; setPeriod(s, t, t + 60 * DAY);
      return [ev('invoice.paid', { id: nid('in'), object: 'invoice', livemode: false, customer: s.customer, subscription: s.id }), ev('customer.subscription.updated', s)]; },
    unpaid(subId) { const s = st.subs[subId]; s.status = 'unpaid'; return [ev('customer.subscription.updated', s)]; },
    cancelAtPeriodEnd(subId) { const s = st.subs[subId]; s.cancel_at_period_end = true; return [ev('customer.subscription.updated', s)]; },
    cancelNow(subId) { const s = st.subs[subId]; s.status = 'canceled'; s.canceled_at = nowS(); return [ev('customer.subscription.deleted', s)]; },
    ev,
  };
  return { api, st, sim };
}

/* ---------------------------------------------------------------- wiring */
const SECRET = 'whsec_testOnlyLocalSecret0123456789';
const config = { returnUrl: 'https://highandmighty354-dev.github.io/gearhead-labs/index.html?x=1#h', allowedOrigins: ['https://highandmighty354-dev.github.io'] };
let clock = Date.now();
const now = () => new Date(clock += 1000);          // monotonic state times (the database still uses its own now())
function deps(stripe) { return { stripe, db, config, now, webhookSecret: SECRET, getUser: async (jwt) => ({ 'jwt-A': { id: U.A, email: 'a@example.test' }, 'jwt-B': { id: U.B, email: 'b@example.test' }, 'jwt-C': { id: U.C, email: 'c@example.test' }, 'jwt-M': { id: U.M, email: 'm@example.test' } })[jwt] || null }; }
async function deliver(d, event, { secret = SECRET, tamper = null, header = undefined, at = nowS() } = {}) {
  const raw = JSON.stringify(event); const sig = header !== undefined ? header : await S.signStripePayload(raw, secret, at);
  const res = await H.makeWebhookHandler(d)(new Request('https://x.test/stripe-webhook', { method: 'POST', body: tamper ? tamper(raw) : raw, headers: sig === null ? {} : { 'stripe-signature': sig } }));
  return { status: res.status, body: await res.json() };
}
const deliverAll = async (d, evs) => { const out = []; for (const e of evs) out.push(await deliver(d, e)); return out; };
async function checkout(d, jwt, interval, origin = 'https://highandmighty354-dev.github.io') {
  const res = await H.makeCheckoutHandler(d)(new Request('https://x.test/billing-checkout', { method: 'POST', body: JSON.stringify({ interval }),
    headers: { ...(jwt ? { authorization: `Bearer ${jwt}` } : {}), origin, 'content-type': 'application/json' } }));
  return { status: res.status, body: await res.json(), headers: res.headers };
}

try {
  /* ============================================================ 1. signature verification and test-mode guards */
  console.log('== signatures and test-mode guards');
  const body = JSON.stringify({ id: 'evt_1', type: 'x', object: 'event' }), t0 = nowS();
  const good = await S.signStripePayload(body, SECRET, t0);
  check('valid signature verifies', (await S.verifyStripeSignature(body, good, SECRET, { nowSeconds: t0 })).id === 'evt_1');
  check('wrong secret is refused', await rejects(S.verifyStripeSignature(body, await S.signStripePayload(body, 'whsec_other0000', t0), SECRET, { nowSeconds: t0 }), 'signature_invalid'));
  check('tampered body is refused', await rejects(S.verifyStripeSignature(body.replace('evt_1', 'evt_2'), good, SECRET, { nowSeconds: t0 }), 'signature_invalid'));
  check('timestamp older than 5 minutes is refused (replay)', await rejects(S.verifyStripeSignature(body, good, SECRET, { nowSeconds: t0 + 301 }), 'signature_expired'));
  check('missing header is refused', await rejects(S.verifyStripeSignature(body, '', SECRET, { nowSeconds: t0 }), 'signature_missing'));
  check('header without v1 is refused', await rejects(S.verifyStripeSignature(body, `t=${t0},v0=abc`, SECRET, { nowSeconds: t0 }), 'signature_malformed'));
  check('a second, valid v1 among several is accepted (secret rotation)', (await S.verifyStripeSignature(body, `t=${t0},v1=${'0'.repeat(64)},${good.split(',')[1]}`, SECRET, { nowSeconds: t0 })).id === 'evt_1');
  check('webhook refuses to run without a whsec_ secret', await rejects(S.verifyStripeSignature(body, good, '', { nowSeconds: t0 }), 'webhook_not_configured'));
  check('a LIVE secret key is refused', (() => { try { S.createStripeClient('sk_live_abc123'); return false; } catch (e) { return e.code === 'stripe_not_test_mode'; } })());
  check('a publishable key is refused as a secret key', (() => { try { S.createStripeClient('pk_test_abc123'); return false; } catch (e) { return e.code === 'stripe_not_test_mode'; } })());
  check('a restricted TEST key is accepted', (() => { try { S.createStripeClient('rk_test_abc123', { fetchImpl: async () => ({}) }); return true; } catch (e) { return false; } })());

  /* REST client request shape (fake fetch) */
  const seen = []; const rest = S.createStripeClient('sk_test_123abc', { fetchImpl: async (url, o) => { seen.push({ url, ...o }); return { ok: true, status: 200, json: async () => ({ id: 'cs_test_1', url: 'https://checkout.stripe.com/x', livemode: false }) }; } });
  await rest.createCheckoutSession({ mode: 'subscription', line_items: [{ price: 'price_a', quantity: 1 }], subscription_data: { trial_period_days: 14, metadata: { gh_account_id: 'u1' } } }, 'idem-1');
  const r0 = seen[0];
  check('REST: POST https://api.stripe.com/v1/checkout/sessions with bearer key, pinned Stripe-Version and Idempotency-Key',
    r0.url === 'https://api.stripe.com/v1/checkout/sessions' && r0.method === 'POST' && r0.headers.Authorization === 'Bearer sk_test_123abc'
    && r0.headers['Stripe-Version'] === S.STRIPE_API_VERSION && r0.headers['Idempotency-Key'] === 'idem-1', r0.headers);
  check('REST: nested form encoding (line_items[0][price], subscription_data[trial_period_days], metadata)',
    decodeURIComponent(r0.body) === 'mode=subscription&line_items[0][price]=price_a&line_items[0][quantity]=1&subscription_data[trial_period_days]=14&subscription_data[metadata][gh_account_id]=u1', decodeURIComponent(r0.body));
  const liveFetch = S.createStripeClient('sk_test_123abc', { fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ id: 'sub_1', livemode: true }) }) });
  check('REST: a live-mode object returned by Stripe is refused', await rejects(liveFetch.retrieveSubscription('sub_1'), 'stripe_live_object'));
  const errFetch = S.createStripeClient('sk_test_123abc', { fetchImpl: async () => ({ ok: false, status: 402, json: async () => ({ error: { type: 'card_error', message: 'secret-ish detail' } }) }) });
  check('REST: Stripe errors are reported without Stripe\'s message text', await (async () => { try { await errFetch.retrieveSubscription('sub_1'); return false; } catch (e) { return e.code === 'stripe_error' && !/secret-ish/.test(e.message); } })());

  /* ============================================================ 2. checkout */
  console.log('== checkout');
  const A = makeStripe(), dA = deps(A.api);
  let r = await checkout(dA, 'jwt-A', 'month');
  check('no Stripe price configured (plan_prices empty, as in production today): 503 price_not_configured, nothing created',
    r.status === 503 && r.body.error === 'price_not_configured' && A.st.calls.length === 0, r);
  // the owner's test-mode price registration (a migration or seed on the TEST project): must match the approved offers
  check('a price that differs from the approved offer cannot be registered (plan_offers FK)', await rejects(pg.query(`INSERT INTO public.plan_prices VALUES ('price_wrongAmount','premium','month','usd',499,true)`)));
  await pg.query(`INSERT INTO public.plan_prices (stripe_price_id, plan_key, billing_interval, currency, unit_amount, active) VALUES ($1,'premium','month','usd',599,true), ($2,'premium','year','usd',5999,true)`, [PRICE.month, PRICE.year]);

  r = await checkout(dA, null, 'month');
  check('signed out: 401, nothing created', r.status === 401 && A.st.calls.length === 0, r);
  r = await checkout(dA, 'jwt-forged', 'month');
  check('unknown/forged JWT: 401', r.status === 401, r);
  r = await checkout(dA, 'jwt-A', 'week');
  check('invalid interval: 400', r.status === 400 && r.body.error === 'invalid_interval', r);
  r = await checkout(dA, 'jwt-A', 'month');
  const csCall = A.st.calls.find(c => c[0] === 'createCheckoutSession'), cusCall = A.st.calls.find(c => c[0] === 'createCustomer');
  check('signed-in Free account: 200 with a Stripe Checkout URL and a 14-day trial', r.status === 200 && r.body.url.startsWith('https://checkout.stripe.com/') && r.body.trial === true && r.body.trialDays === 14, r);
  check('CORS: the allowed site origin is echoed', r.headers.get('access-control-allow-origin') === 'https://highandmighty354-dev.github.io');
  check('Stripe customer created once, keyed by account (idempotency key), linked server-side in billing_customers',
    cusCall && cusCall[2] === `gh-customer-${U.A}` && (await db.customerFor(U.A)) === Object.keys(A.st.customers)[0]);
  const p = csCall && csCall[1];
  check('session: subscription mode, the server-side price for the interval, quantity 1, card always collected, trial 14 days',
    p && p.mode === 'subscription' && p.line_items[0].price === PRICE.month && p.line_items[0].quantity === 1 && p.payment_method_collection === 'always'
    && p.subscription_data.trial_period_days === 14 && p.customer === (await db.customerFor(U.A)) && p.client_reference_id === U.A, p);
  check('session: return URLs come from server configuration only (query and fragment stripped), no promotion codes',
    p.success_url === 'https://highandmighty354-dev.github.io/gearhead-labs/index.html?view=profile&checkout=success'
    && p.cancel_url === 'https://highandmighty354-dev.github.io/gearhead-labs/index.html?view=profile&checkout=cancelled' && p.allow_promotion_codes === false, p);
  r = await checkout(dA, 'jwt-A', 'year');
  check('the yearly button uses the yearly price', A.st.calls.filter(c => c[0] === 'createCheckoutSession').pop()[1].line_items[0].price === PRICE.year);
  check('a second checkout reuses the same customer (no duplicate Stripe customer)', A.st.calls.filter(c => c[0] === 'createCustomer').length === 1);
  const hostile = await H.makeCheckoutHandler(dA)(new Request('https://x.test/billing-checkout', { method: 'POST', body: JSON.stringify({ interval: 'month', price: 'price_evil', success_url: 'https://evil.test', accountId: U.B }), headers: { authorization: 'Bearer jwt-A', origin: 'https://evil.test' } }));
  const hp = A.st.calls.filter(c => c[0] === 'createCheckoutSession').pop()[1];
  check('a hostile body cannot choose the price, the redirect or another account; a foreign origin gets no CORS grant',
    hostile.status === 200 && hp.line_items[0].price === PRICE.month && hp.success_url.startsWith('https://highandmighty354-dev.github.io/') && hp.client_reference_id === U.A
    && hostile.headers.get('access-control-allow-origin') === null, hp);
  const badCfg = await checkout({ ...dA, config: { ...config, returnUrl: 'http://evil.test/' } }, 'jwt-A', 'month');
  check('a non-https return URL in configuration is refused (500 billing_not_configured)', badCfg.status === 500 && badCfg.body.error === 'billing_not_configured', badCfg);

  /* ============================================================ 3. trial start, trial end, renewal, cancellation */
  console.log('== subscription lifecycle');
  check('before checkout completes: A is Free', (await ent(U.A)).plan_key === 'free' && !(await hasLab(U.A)));
  const sessA = csCall[1] && Object.values(A.st.sessions)[0].id;
  let evs = A.sim.completeCheckout(sessA); const subA = Object.keys(A.st.subs)[0];
  let res = await deliverAll(dA, evs);
  const eA = await ent(U.A);
  check('checkout completed (trialing): webhooks 200; A has Premium through the trial end', res.every(x => x.status === 200) && eA.is_premium && eA.source === 'stripe' && await hasLab(U.A), { res, eA });
  const trialEnd = new Date(A.st.subs[subA].trial_end * 1000).toISOString();
  check('the grant ends exactly at the trial end', new Date(eA.ends_at).toISOString() === trialEnd, eA);
  check('subscription mirrored: trialing, the monthly price, trial_end set', (await svc(`SELECT status, stripe_price_id, trial_end FROM public.subscriptions WHERE stripe_subscription_id = $1`, [subA]))[0].status === 'trialing');
  check('the webhook payload is never trusted for state: every subscription event re-fetched the subscription from Stripe', A.st.calls.filter(c => c[0] === 'retrieveSubscription').length === 2);

  r = await checkout(dA, 'jwt-A', 'month');
  check('while Premium (trial): a new checkout is refused (409) - no double subscription', r.status === 409, r);

  evs = A.sim.trialEnds(subA, true); res = await deliverAll(dA, evs);
  let e2 = await ent(U.A);
  check('trial ends, first payment succeeds (invoice.paid, basil invoice shape): still Premium, grant extended to the new period end',
    res.every(x => x.status === 200) && e2.is_premium && new Date(e2.ends_at) > new Date(trialEnd), { res, e2 });
  check('still exactly one open Stripe grant (extended, not duplicated)', (await grants(U.A)).filter(g => g.revoked_at === null).length === 1);

  evs = A.sim.renew(subA); res = await deliverAll(dA, evs);
  const e3 = await ent(U.A);
  check('renewal: grant extended again to the renewed period end', e3.is_premium && new Date(e3.ends_at) > new Date(e2.ends_at), e3);

  evs = A.sim.cancelAtPeriodEnd(subA); await deliverAll(dA, evs);
  const e4 = await ent(U.A);
  check('cancel at period end (via portal): access continues until the period end, cancel_at_period_end mirrored',
    e4.is_premium && (await svc(`SELECT cancel_at_period_end FROM public.subscriptions WHERE stripe_subscription_id = $1`, [subA]))[0].cancel_at_period_end === true);
  evs = A.sim.cancelNow(subA); res = await deliverAll(dA, evs);
  check('subscription deleted (canceled): access revoked immediately; A is Free again', res[0].status === 200 && !(await ent(U.A)).is_premium && !(await hasLab(U.A)));
  check('the revoked grant is kept as audit history (revoked_at set, not deleted)', (await grants(U.A)).every(g => g.revoked_at !== null) && (await grants(U.A)).length >= 1);

  r = await checkout(dA, 'jwt-A', 'month');
  const reCs = A.st.calls.filter(c => c[0] === 'createCheckoutSession').pop()[1];
  check('a former subscriber can subscribe again, but WITHOUT a second free trial', r.status === 200 && r.body.trial === false && reCs.subscription_data.trial_period_days === undefined, r);

  /* ============================================================ 4. payment failure */
  console.log('== payment failure');
  const Bs = makeStripe(), dB = deps(Bs.api);
  await checkout(dB, 'jwt-B', 'month'); evs = Bs.sim.completeCheckout(Object.values(Bs.st.sessions)[0].id); const subB = Object.keys(Bs.st.subs)[0];
  await deliverAll(dB, evs);
  evs = Bs.sim.trialEnds(subB, false); res = await deliverAll(dB, evs);
  const eB = await ent(U.B);
  check('trial ends and the card is declined (invoice.payment_failed, past_due): access kept until the period end (existing 0402 rule; see dunning decision)',
    res.every(x => x.status === 200) && eB.is_premium && (await svc(`SELECT status FROM public.subscriptions WHERE stripe_subscription_id = $1`, [subB]))[0].status === 'past_due', { res, eB });
  evs = Bs.sim.unpaid(subB); await deliverAll(dB, evs);
  check('retries exhausted (unpaid): access revoked', !(await ent(U.B)).is_premium && !(await hasLab(U.B)));

  /* ============================================================ 5. retries, replays, ordering, outages */
  console.log('== retries, replays and ordering');
  const Cs = makeStripe(), dC = deps(Cs.api);
  await checkout(dC, 'jwt-C', 'year'); const [subCreated, completed] = Cs.sim.completeCheckout(Object.values(Cs.st.sessions)[0].id); const subC = Object.keys(Cs.st.subs)[0];
  Cs.st.failRetrieve = 1;
  res = [await deliver(dC, completed)];
  check('Stripe unreachable while processing: 502 (Stripe will retry); event recorded but NOT marked processed; no access yet',
    res[0].status === 502 && (await svc(`SELECT processed_at FROM public.stripe_events WHERE event_id = $1`, [completed.id]))[0].processed_at === null && !(await ent(U.C)).is_premium, res);
  res = [await deliver(dC, completed)];
  check('Stripe retries the same event: processed this time; C gets Premium', res[0].status === 200 && res[0].body.outcome === 'synced' && (await ent(U.C)).is_premium, res);
  res = [await deliver(dC, completed)];
  check('a third delivery of an already processed event: 200 duplicate, Stripe not called again', res[0].status === 200 && res[0].body.duplicate === true && Cs.st.calls.filter(c => c[0] === 'retrieveSubscription').length === 2, res);
  await deliver(dC, subCreated);
  const cancelEvs = Cs.sim.cancelNow(subC); await deliverAll(dC, cancelEvs);
  check('cancellation processed: C is Free', !(await ent(U.C)).is_premium);
  // a late, out-of-order delivery of an OLD "active" state must not re-open access
  const staleState = { ...Cs.st.subs[subC], status: 'active', canceled_at: null };
  const syncedBefore = (await svc(`SELECT stripe_state_at FROM public.subscriptions WHERE stripe_subscription_id = $1`, [subC]))[0].stripe_state_at;
  const staleApplied = await db.syncSubscription(B.syncArgsFrom(staleState, U.C, new Date(new Date(syncedBefore).getTime() - 60000)));
  check('an older state arriving late is ignored by the database (returns false); access stays revoked', staleApplied === false && !(await ent(U.C)).is_premium);
  const lateEvent = Cs.sim.ev('customer.subscription.updated', staleState); res = [await deliver(dC, lateEvent)];
  check('a late "active" event is re-fetched from Stripe (now canceled), so it cannot re-open access', res[0].status === 200 && !(await ent(U.C)).is_premium, res);

  /* ============================================================ 6. forged, live and hostile webhooks */
  console.log('== webhook security');
  const Ms = makeStripe(), dM = deps(Ms.api);
  await checkout(dM, 'jwt-M', 'month'); const [mCreated, mCompleted] = Ms.sim.completeCheckout(Object.values(Ms.st.sessions)[0].id);
  const countEvents = async () => +(await svc(`SELECT count(*) AS n FROM public.stripe_events`))[0].n;
  let n0 = await countEvents();
  res = [await deliver(dM, mCompleted, { secret: 'whsec_attackerSecret000' })];
  check('forged signature: 400, nothing recorded, no access', res[0].status === 400 && (await countEvents()) === n0 && !(await ent(U.M)).is_premium, res);
  res = [await deliver(dM, mCompleted, { header: null })];
  check('no signature header: 400, nothing recorded', res[0].status === 400 && (await countEvents()) === n0, res);
  res = [await deliver(dM, mCompleted, { tamper: (raw) => raw.replace(U.M, U.A) })];
  check('body altered after signing: 400', res[0].status === 400, res);
  res = [await deliver(dM, mCompleted, { at: nowS() - 600 })];
  check('validly signed but 10 minutes old (replay): 400', res[0].status === 400 && res[0].body.error === 'signature_expired', res);
  res = [await deliver(dM, { ...mCompleted, id: 'evt_liveCopy1', livemode: true })];
  check('a live-mode event is refused (400) and grants nothing', res[0].status === 400 && res[0].body.error === 'live_event' && !(await ent(U.M)).is_premium, res);
  // a subscription on a customer Gearhead Labs never linked (e.g. created in the Stripe dashboard), with metadata naming account M
  const rogue = { id: 'sub_rogueSIM1', object: 'subscription', livemode: false, customer: 'cus_notOursSIM', status: 'active', cancel_at_period_end: false, trial_end: null, canceled_at: null,
    metadata: { gh_account_id: U.M }, items: { data: [{ price: { id: PRICE.month }, current_period_start: nowS(), current_period_end: nowS() + 30 * DAY }] } };
  Ms.st.subs[rogue.id] = rogue;
  res = [await deliver(dM, Ms.sim.ev('customer.subscription.created', rogue))];
  check('a subscription for a customer not linked by Gearhead Labs grants nothing, whatever its metadata says (outcome unknown_customer)',
    res[0].status === 200 && res[0].body.outcome === 'unknown_customer' && !(await ent(U.M)).is_premium, res);
  const mismatch = { ...mCompleted, id: 'evt_mismatchSIM', data: { object: { ...mCompleted.data.object, client_reference_id: U.A } } };
  res = [await deliver(dM, mismatch)];
  check('checkout.session.completed whose client_reference_id disagrees with the linked account: ignored (account_mismatch), no access',
    res[0].status === 200 && res[0].body.outcome === 'account_mismatch' && !(await ent(U.M)).is_premium, res);
  res = await deliverAll(dM, [mCreated, mCompleted]);
  check('the genuine events then grant M Premium', res.every(x => x.status === 200) && (await ent(U.M)).is_premium, res);
  Ms.st.subs[Object.keys(Ms.st.subs)[0]].items.data[0].price.id = 'price_unregisteredSIM';
  const unk = Ms.sim.ev('customer.subscription.updated', Ms.st.subs[Object.keys(Ms.st.subs)[0]]);
  res = [await deliver(dM, unk)];
  check('a price that is not in plan_prices: 500, event left unprocessed for retry, current access unchanged',
    res[0].status === 500 && res[0].body.error === 'price_not_configured' && (await ent(U.M)).is_premium
    && (await svc(`SELECT processed_at FROM public.stripe_events WHERE event_id = $1`, [unk.id]))[0].processed_at === null, res);
  res = [await deliver(dM, Ms.sim.ev('payment_intent.succeeded', { id: 'pi_1', object: 'payment_intent', livemode: false }))];
  check('an unrelated event type is recorded and acknowledged (ignored)', res[0].status === 200 && res[0].body.outcome === 'ignored', res);
  check('pre-basil subscription shape (period on the subscription) maps to the same sync arguments',
    B.syncArgsFrom({ id: 'sub_x1', customer: 'cus_x1', status: 'active', current_period_start: 100, current_period_end: 200, cancel_at_period_end: false, trial_end: null, canceled_at: null, items: { data: [{ price: { id: 'price_a' } }] } }, U.A, new Date(0)).p_current_period_end === new Date(200000).toISOString());
  check('a subscription with two items is refused (Premium has exactly one price)', (() => { try { B.syncArgsFrom({ id: 'sub_x2', items: { data: [{}, {}] } }, U.A, new Date()); return false; } catch (e) { return e.code === 'unexpected_items'; } })());

  /* ============================================================ 7. portal */
  console.log('== customer portal');
  const portal = await H.makePortalHandler(dA)(new Request('https://x.test/billing-portal', { method: 'POST', body: '{}', headers: { authorization: 'Bearer jwt-A' } }));
  const pj = await portal.json(), pc = A.st.calls.filter(c => c[0] === 'createPortalSession').pop();
  check('portal: 200 with a Stripe portal URL for the caller\'s own customer, server-side return URL',
    portal.status === 200 && pj.url.startsWith('https://billing.stripe.com/') && pc[1].customer === (await db.customerFor(U.A))
    && pc[1].return_url === 'https://highandmighty354-dev.github.io/gearhead-labs/index.html?view=profile', { pj, pc });
  const Ns = makeStripe(); const noCust = await H.makePortalHandler({ ...deps(Ns.api), getUser: async () => ({ id: '00000000-0000-4000-8000-000000000000' }) })(new Request('https://x.test/billing-portal', { method: 'POST', headers: { authorization: 'Bearer x' } }));
  check('portal for an account with no billing record: 404, Stripe not called', noCust.status === 404 && Ns.st.calls.length === 0);
  const anonPortal = await H.makePortalHandler(dA)(new Request('https://x.test/billing-portal', { method: 'POST' }));
  check('portal signed out: 401', anonPortal.status === 401);

  /* ============================================================ 8. security boundary unchanged */
  console.log('== database security unchanged');
  const denied = async (sql, params) => { try { await asUser(U.A, sql, params); return false; } catch (e) { return e.code === '42501'; } };
  check('a signed-in client still cannot call pf_sync_stripe_subscription', await denied(`SELECT public.pf_sync_stripe_subscription('sub_x', $1, 'cus_x', 'active', NULL, now(), now() + interval '1 year', false, NULL, NULL, now())`, [U.A]));
  check('a signed-in client still cannot call pf_upsert_billing_customer', await denied(`SELECT public.pf_upsert_billing_customer($1, 'cus_mine')`, [U.A]));
  check('a signed-in client still cannot read billing_customers or stripe_events', await denied(`SELECT * FROM public.billing_customers`) && await denied(`SELECT * FROM public.stripe_events`));
  check('a signed-in client still cannot insert a grant', await denied(`INSERT INTO public.entitlement_grants (account_id, plan_key, source) VALUES ($1, 'premium', 'promo')`, [U.A]));
  check('a client sees only its own subscription rows', (await asUser(U.B, `SELECT DISTINCT account_id FROM public.subscriptions`)).every(x => x.account_id === U.B));
} catch (e) {
  failures++; console.log('  FAIL unexpected exception: ' + (e && e.stack || e));
} finally {
  await pg.end();
  const a = await connect('postgres', 'supabase_admin'); await a.query(`DROP DATABASE ${DB} WITH (FORCE)`); await a.end();
}
console.log(`billing tests: ${checks} checks, ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
