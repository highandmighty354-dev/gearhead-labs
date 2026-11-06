// Gearhead Labs Premium — wiring for the billing Edge Functions (Deno). Secrets come only from Supabase function
// secrets (never from source control or the browser). SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are
// provided by the Supabase runtime; the others are set by the owner (see docs/BILLING-STRIPE.md).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { createStripeClient } from './stripe.js';
import { createSupabaseBillingDb } from './db-supabase.js';

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing function secret ${name}`);
  return v;
}

export function billingDeps() {
  const service = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
  const anon = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    stripe: createStripeClient(env('STRIPE_SECRET_KEY')),          // refuses anything but a TEST key
    db: createSupabaseBillingDb(service),
    config: {
      returnUrl: env('BILLING_RETURN_URL'),
      allowedOrigins: env('BILLING_ALLOWED_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean),
    },
    async getUser(jwt: string) {
      const { data, error } = await anon.auth.getUser(jwt);
      return error || !data?.user ? null : { id: data.user.id, email: data.user.email ?? null };
    },
    webhookSecret: Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '',
    now: () => new Date(),
  };
}
