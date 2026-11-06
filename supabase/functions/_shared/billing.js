/* Gearhead Labs Premium — billing core (Stripe Checkout, Customer Portal, webhook), TEST MODE ONLY.
 *
 * Reuses the PREMIUM-FOUNDATION billing layer (migration 0402/0407) unchanged. The database stays the only authority
 * for access: this code never writes a grant itself, it only calls the existing service-role functions
 *   pf_upsert_billing_customer  pf_record_stripe_event  pf_sync_stripe_subscription  pf_mark_stripe_event_processed
 * and pf_sync_stripe_subscription derives (or revokes) the entitlement grant from the subscription state.
 *
 * Trust rules (PREMIUM-FOUNDATION "Stripe readiness" contract):
 *   - The account comes from the AUTHENTICATED user who starts Checkout. Its Stripe customer is linked server-side
 *     (billing_customers) before Checkout opens. A webhook maps customer -> account through that table only; metadata
 *     or client_reference_id in an event is never trusted to choose the account.
 *   - The price comes only from plan_prices (Stripe price ids that must match an approved offer in plan_offers),
 *     never from the browser.
 *   - Redirect URLs come only from server configuration, never from the browser.
 *   - Every subscription state is RE-FETCHED from Stripe and mirrored with the fetch time as its state time, so late,
 *     retried or out-of-order webhooks can never re-open access (the function ignores older states).
 *
 * Dependencies are injected so the same code runs in Deno (Edge Functions) and in the Node tests:
 *   deps.stripe  { createCustomer, createCheckoutSession, createPortalSession, retrieveSubscription }
 *   deps.db      see db-supabase.js (service-role adapter)
 *   deps.config  { returnUrl, trialDays }
 *   deps.now     () => Date */
import { BillingError } from './stripe.js';

export const TRIAL_DAYS = 14;                       // owner decision: 14-day trial, payment card required
const LIVE_STATUSES = ['trialing', 'active', 'past_due'];
const SUBSCRIPTION_EVENTS = new Set(['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'customer.subscription.paused', 'customer.subscription.resumed', 'customer.subscription.trial_will_end',
  'customer.subscription.pending_update_applied', 'customer.subscription.pending_update_expired']);
const INVOICE_EVENTS = new Set(['invoice.paid', 'invoice.payment_succeeded', 'invoice.payment_failed', 'invoice.payment_action_required']);

const tenMinuteBucket = (d) => Math.floor(d.getTime() / 600000);
const ts = (secs) => (secs === null || secs === undefined) ? null : new Date(secs * 1000).toISOString();

function checkReturnUrl(url) {
  let u; try { u = new URL(url); } catch (e) { throw new BillingError(500, 'billing_not_configured', 'Billing return URL is not configured.'); }
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))) {
    throw new BillingError(500, 'billing_not_configured', 'Billing return URL must be https.');
  }
  u.search = ''; u.hash = '';
  return u.toString();
}
const withQuery = (base, q) => `${base}?${q}`;

/* ---------------------------------------------------------------- Checkout */
export async function startCheckout({ accountId, email, interval }, deps) {
  const { stripe, db, config, now = () => new Date() } = deps;
  if (!accountId) throw new BillingError(401, 'not_signed_in', 'Sign in to start Premium.');
  if (interval !== 'month' && interval !== 'year') throw new BillingError(400, 'invalid_interval', 'Choose monthly or yearly billing.');
  const base = checkReturnUrl(config.returnUrl);

  const price = await db.priceFor('premium', interval);
  if (!price) throw new BillingError(503, 'price_not_configured', 'Premium checkout is not configured yet.');

  if (await db.hasOpenGrant(accountId)) throw new BillingError(409, 'already_premium', 'This account already has Premium. Use Manage billing to change it.');
  const subs = await db.subscriptionsFor(accountId);
  if (subs.some(s => LIVE_STATUSES.includes(s.status))) throw new BillingError(409, 'already_subscribed', 'This account already has a subscription. Use Manage billing to change it.');
  const trialEligible = subs.length === 0;          // owner decision pending: one trial per account (see docs)

  let customerId = await db.customerFor(accountId);
  if (!customerId) {
    const customer = await stripe.createCustomer({ email: email || undefined, metadata: { gh_account_id: accountId } }, `gh-customer-${accountId}`);
    if (!customer || !/^cus_[A-Za-z0-9]+$/.test(customer.id || '')) throw new BillingError(502, 'stripe_error', 'Stripe did not return a customer.');
    await db.linkCustomer(accountId, customer.id);   // throws if the account is already linked to another customer
    customerId = customer.id;
  }

  const trialDays = trialEligible ? (config.trialDays || TRIAL_DAYS) : undefined;
  const session = await stripe.createCheckoutSession({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: accountId,
    line_items: [{ price: price.stripe_price_id, quantity: 1 }],
    payment_method_collection: 'always',            // card required, also for the trial
    subscription_data: { trial_period_days: trialDays, metadata: { gh_account_id: accountId } },
    success_url: withQuery(base, 'view=profile&checkout=success'),
    cancel_url: withQuery(base, 'view=profile&checkout=cancelled'),
    allow_promotion_codes: false,
  }, `gh-checkout-${accountId}-${interval}-${trialDays || 0}-${tenMinuteBucket(now())}`);
  if (!session || typeof session.url !== 'string' || !session.url.startsWith('https://')) throw new BillingError(502, 'stripe_error', 'Stripe did not return a checkout page.');
  return { url: session.url, trial: Boolean(trialDays), trialDays: trialDays || 0 };
}

/* ---------------------------------------------------------------- Customer Portal */
export async function openPortal({ accountId }, deps) {
  const { stripe, db, config } = deps;
  if (!accountId) throw new BillingError(401, 'not_signed_in', 'Sign in to manage billing.');
  const base = checkReturnUrl(config.returnUrl);
  const customerId = await db.customerFor(accountId);
  if (!customerId) throw new BillingError(404, 'no_billing_account', 'This account has no billing record yet.');
  const portal = await stripe.createPortalSession({ customer: customerId, return_url: withQuery(base, 'view=profile') });
  if (!portal || typeof portal.url !== 'string' || !portal.url.startsWith('https://')) throw new BillingError(502, 'stripe_error', 'Stripe did not return a billing page.');
  return { url: portal.url };
}

/* ---------------------------------------------------------------- Webhook */
function subscriptionIdOf(event) {
  const o = event.data && event.data.object;
  if (!o) return null;
  if (event.type === 'checkout.session.completed') return o.mode === 'subscription' ? (typeof o.subscription === 'string' ? o.subscription : o.subscription && o.subscription.id) : null;
  if (SUBSCRIPTION_EVENTS.has(event.type)) return o.id;
  if (INVOICE_EVENTS.has(event.type)) {
    const s = o.subscription || (o.parent && o.parent.subscription_details && o.parent.subscription_details.subscription);
    return typeof s === 'string' ? s : (s && s.id) || null;
  }
  return null;
}

/* Map a Stripe subscription object to pf_sync_stripe_subscription arguments. Handles both the pre-2025 shape
 * (current_period_* on the subscription) and the 2025-03-31.basil shape (on the subscription item). */
export function syncArgsFrom(sub, accountId, stateAt) {
  const items = (sub.items && sub.items.data) || [];
  if (items.length !== 1) throw new BillingError(422, 'unexpected_items', `Subscription ${sub.id} has ${items.length} items; Premium has exactly one.`);
  const item = items[0];
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer && sub.customer.id;
  return {
    p_subscription_id: sub.id, p_account: accountId, p_stripe_customer_id: customer, p_status: sub.status,
    p_price_id: item.price && item.price.id,
    p_current_period_start: ts(sub.current_period_start ?? item.current_period_start),
    p_current_period_end: ts(sub.current_period_end ?? item.current_period_end),
    p_cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    p_trial_end: ts(sub.trial_end), p_canceled_at: ts(sub.canceled_at), p_state_at: stateAt.toISOString(),
  };
}

/* Process one verified event. Returns { status, body } for the HTTP layer. A 5xx makes Stripe retry; the event row is
 * then already recorded but not marked processed, so the retry processes it again (every step is idempotent). */
export async function handleEvent(event, deps) {
  const { stripe, db, now = () => new Date() } = deps;
  if (event.livemode === true) throw new BillingError(400, 'live_event', 'Live-mode events are refused (test mode only).');
  if (!/^evt_[A-Za-z0-9]+$/.test(event.id)) throw new BillingError(400, 'payload_invalid', 'Invalid event id.');

  const fresh = await db.recordEvent(event.id, event.type, ts(event.created), event);
  if (!fresh && await db.eventProcessed(event.id)) return { status: 200, body: { received: true, duplicate: true } };

  const subId = subscriptionIdOf(event);
  let outcome = 'ignored';
  if (subId) {
    if (!/^sub_[A-Za-z0-9]+$/.test(subId)) throw new BillingError(400, 'payload_invalid', 'Invalid subscription id.');
    const sub = await stripe.retrieveSubscription(subId);            // fresh state; never the (possibly stale) payload
    const stateAt = now();
    const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer && sub.customer.id;
    const accountId = customer ? await db.accountForCustomer(customer) : null;
    if (!accountId) {
      outcome = 'unknown_customer';                                   // not created by Gearhead Labs Checkout: no access
    } else {
      if (event.type === 'checkout.session.completed') {
        const ref = event.data.object.client_reference_id;
        if (ref && ref !== accountId) { outcome = 'account_mismatch'; }
      }
      if (outcome !== 'account_mismatch') {
        const args = syncArgsFrom(sub, accountId, stateAt);
        if (!(await db.priceKnown(args.p_price_id))) throw new BillingError(500, 'price_not_configured', `Price ${args.p_price_id} is not in plan_prices; event left unprocessed for retry.`);
        const applied = await db.syncSubscription(args);
        outcome = applied ? 'synced' : 'stale_ignored';
      }
    }
  }
  await db.markProcessed(event.id);
  return { status: 200, body: { received: true, outcome } };
}
