// POST with the user's JWT -> {url} of the Stripe Customer Portal for that account (TEST MODE ONLY).
import { makePortalHandler } from '../_shared/handlers.js';
import { billingDeps } from '../_shared/wiring.ts';
Deno.serve(makePortalHandler(billingDeps()));
