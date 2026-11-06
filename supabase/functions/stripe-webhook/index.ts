// Stripe webhook endpoint (TEST MODE ONLY). Deploy WITHOUT JWT verification (Stripe sends no Supabase JWT); every
// request is authenticated by its Stripe-Signature instead (verified against the raw body before anything else).
import { makeWebhookHandler } from '../_shared/handlers.js';
import { billingDeps } from '../_shared/wiring.ts';
Deno.serve(makeWebhookHandler(billingDeps()));
