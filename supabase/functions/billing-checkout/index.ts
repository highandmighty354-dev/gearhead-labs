// POST {interval: 'month' | 'year'} with the user's JWT -> {url} of a Stripe Checkout page (TEST MODE ONLY).
import { makeCheckoutHandler } from '../_shared/handlers.js';
import { billingDeps } from '../_shared/wiring.ts';
Deno.serve(makeCheckoutHandler(billingDeps()));
