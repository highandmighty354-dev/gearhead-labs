/* Gearhead Labs Premium — public client configuration.
   PUBLIC VALUES ONLY. Never put a Supabase service-role key, a database password,
   a Stripe secret key or any other private credential in this file or anywhere
   in the frontend: everything here is shipped to every visitor.

   backend.url / backend.anonKey: the Supabase project URL and its public anon key.
   Leave them empty until a project exists. With no backend configured, nobody can
   sign in and every visitor is FREE (production behaviour).

   development: a local mock adapter for building and testing the Premium UI.
   It stores data only in the current browser and its entitlement is a mock.
   It is enabled on localhost, or with ?gh_dev=1 while allowQueryFlag is true.
   Set allowQueryFlag to false before launch so visitors cannot opt into it. */
window.GHP_CONFIG = {
  backend: {
    provider: 'supabase',
    url: '',
    anonKey: ''
  },
  development: {
    allowOnLocalhost: true,
    allowQueryFlag: false,
    queryFlag: 'gh_dev'
  }
};
