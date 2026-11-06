/* Gearhead Labs Premium — service-role database adapter for the billing functions.
 * `client` is a supabase-js client created with the SERVICE ROLE key (server-side only, from Supabase function secrets).
 * Reads use the service role's existing SELECT privileges; every write goes through an existing 0402 function.
 * premium-foundation/tests/billing.test.js holds a PostgreSQL implementation of the same interface (same queries). */
import { BillingError } from './stripe.js';

function check({ data, error }, what) {
  if (error) throw new BillingError(500, 'database_error', `${what} failed${error.code ? ' (' + error.code + ')' : ''}.`);
  return data;
}

export function createSupabaseBillingDb(client, { now = () => new Date() } = {}) {
  return {
    async priceFor(planKey, interval) {
      const offers = check(await client.from('plan_offers').select('currency, unit_amount')
        .eq('plan_key', planKey).eq('billing_interval', interval).eq('active', true), 'offer lookup');
      if (!offers || offers.length !== 1) return null;
      const rows = check(await client.from('plan_prices').select('stripe_price_id, currency, unit_amount')
        .eq('plan_key', planKey).eq('billing_interval', interval).eq('currency', offers[0].currency)
        .eq('unit_amount', offers[0].unit_amount).eq('active', true), 'price lookup');
      if (!rows || rows.length === 0) return null;
      if (rows.length > 1) throw new BillingError(500, 'price_ambiguous', `More than one active Stripe price for ${planKey}/${interval}.`);
      return rows[0];
    },
    async priceKnown(priceId) {
      if (!priceId) return false;
      const rows = check(await client.from('plan_prices').select('stripe_price_id').eq('stripe_price_id', priceId), 'price lookup');
      return rows.length === 1;
    },
    async hasOpenGrant(accountId) {
      const t = now().toISOString();
      const rows = check(await client.from('entitlement_grants').select('id').eq('account_id', accountId).is('revoked_at', null)
        .lte('starts_at', t).or(`ends_at.is.null,ends_at.gt.${t}`).limit(1), 'grant lookup');
      return rows.length > 0;
    },
    async subscriptionsFor(accountId) {
      return check(await client.from('subscriptions').select('stripe_subscription_id, status').eq('account_id', accountId), 'subscription lookup');
    },
    async customerFor(accountId) {
      const rows = check(await client.from('billing_customers').select('stripe_customer_id').eq('account_id', accountId), 'customer lookup');
      return rows.length ? rows[0].stripe_customer_id : null;
    },
    async accountForCustomer(customerId) {
      const rows = check(await client.from('billing_customers').select('account_id').eq('stripe_customer_id', customerId), 'customer lookup');
      return rows.length ? rows[0].account_id : null;
    },
    async linkCustomer(accountId, customerId) {
      const { error } = await client.rpc('pf_upsert_billing_customer', { p_account: accountId, p_stripe_customer_id: customerId });
      if (error) throw new BillingError(error.code === '23505' ? 409 : 500, 'customer_link_failed', 'The billing customer could not be linked to this account.');
    },
    async recordEvent(id, type, createdAt, payload) {
      return check(await client.rpc('pf_record_stripe_event', { p_event_id: id, p_event_type: type, p_stripe_created_at: createdAt, p_payload: payload }), 'event record') === true;
    },
    async eventProcessed(id) {
      const rows = check(await client.from('stripe_events').select('processed_at').eq('event_id', id), 'event lookup');
      return rows.length === 1 && rows[0].processed_at !== null;
    },
    async markProcessed(id) {
      const { error } = await client.rpc('pf_mark_stripe_event_processed', { p_event_id: id });
      if (error && error.code !== 'P0002') throw new BillingError(500, 'database_error', 'Marking the event processed failed.');   // P0002: a concurrent delivery already did
    },
    async syncSubscription(args) {
      return check(await client.rpc('pf_sync_stripe_subscription', args), 'subscription sync') === true;
    },
  };
}
