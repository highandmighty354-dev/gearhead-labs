# First-party analytics and owner dashboard — implementation record

Branch `feature/analytics-dashboard` (from `main` at `d25afa2`). Specification: `docs/ANALYTICS-BLUEPRINT.md` (branch
`docs/analytics-blueprint`). Status on 2026-11-09: **built and tested on synthetic data only. Not deployed. Tracking is OFF.**
Nothing in this branch has received real website traffic, so nothing here is validated against real visitors yet.

## 1. What is in this branch

| Part | File(s) | State |
|---|---|---|
| Database | `supabase/migrations/0501_analytics.sql`, rollback `supabase/rollback/0501_analytics.rollback.sql` | In the branch only. **Not applied anywhere.** |
| Ingestion endpoint | `supabase/functions/analytics-ingest/index.ts` + `supabase/functions/_shared/analytics-ingest.js` | Not deployed. Kill switch off by default. |
| Site tracking | `analytics.js`, `analytics-config.js` (`enabled: false`), two script tags in `index.html` | Ships OFF: the script returns immediately. |
| Owner dashboard | `owner/analytics.html`, `owner/analytics.js`, `owner/analytics.css` | Not linked anywhere; `noindex`. Needs the migration to show anything. |
| Tests | `premium-foundation/tests/analytics.test.js`, `premium/tests/analytics-client.test.js`, `premium/tests/analytics-dashboard.test.js` | Results in §6. |

PR #27 and PR #28 are not touched. No production setting, secret or record was changed.

## 2. How it works

**Browser → `analytics-ingest` Edge Function → `analytics_ingest()` → `analytics_events` → rollup → `analytics_dashboard()` → owner page.**

- The site script batches events (≤ 20 per request, ≤ 8 KB), sends them with `sendBeacon` / `fetch(keepalive, no-cors, no cookies)`
  every 15 s, on navigation and when the tab hides. The queue is capped at 50; when the endpoint is down it backs off and drops
  the oldest events, counting them.
- The Edge Function has no JWT check (a beacon cannot send one). Instead: kill switch, origin allow-list, size and count caps,
  a best-effort per-address rate limit kept in memory (the address is never stored or logged), user agent reduced to a browser
  family, bot flag. It always answers 204.
- The server decides the environment: allow-listed live origins → `live` (or `test` if the page says test), other allowed
  origins → `test`, localhost → `dev`. Reports are always per environment, so test traffic never mixes with real visitors.
- `analytics_ingest()` (service role only) validates every event against the catalogue and a per-event property allow-list,
  rejects anything else with a counted reason, drops duplicates by `event_id`, caps 500 events per session per 24 h, drops a
  client clock more than 24 h off, and records every outcome in `analytics_ingest_stats` (Data health).
- `analytics_rollup(day)` re-sessionises on the server (a gap of more than 30 minutes, or New York midnight, starts a new
  session), computes landing/exit pages, engaged time (capped at 30 min per page view), channel, and the daily metrics.
  Bot-flagged sessions (and sessions with > 300 events or > 30 page views at > 30/min) are excluded and counted separately.
  It is idempotent. With `pg_cron` it runs every 15 minutes; the dashboard's Refresh runs it for today and yesterday.
- Retention (`analytics_purge()`, daily with `pg_cron`): raw events 90 days (each day is rolled up again first), sessions and
  ingestion counters 13 months, daily rollups kept.

**Security.** All six tables: RLS enabled and forced, no policies, no privileges for `anon`, `authenticated` or `service_role`
(a post-condition in the migration fails it otherwise). Raw events are append-only (update/delete/truncate refused except
inside the purge function). Reports come only from `analytics_dashboard()` / `analytics_refresh()` /
`analytics_billing_metrics()`, which raise 42501 unless `auth.uid()` is in `analytics_owners`. The owner list starts empty.
The dashboard page itself only shows what those functions return; hiding its address is not the protection.

**Revenue.** `analytics_billing_metrics()` reads the 0402 billing tables (`subscriptions`, `stripe_events`, `plan_prices`), never
analytics events. A subscription counts only if a Stripe event with `livemode: true` refers to it; until one exists the result
is `pending`, so PR #28's test-mode data can never appear as revenue. When live: trials started / trialing, new paid, active
paying, MRR / ARR (yearly ÷ 12), renewals, failed payments, cancellations, scheduled cancellations, period churn.

## 3. Events as implemented (differences from the blueprint marked ◆)

Envelope: `event_id, name, ts_client, vid, sid, seq, page, pv_id, viewport(s/m/l), props`. Page keys: `home`, `calc:<id>`,
`lab:<key>`, `page:<name>`, `view:<premium view>` — never a URL or query string.

| Event | When | Properties |
|---|---|---|
| `page_view` | the page key changes (polled every 0.5 s; a live re-render does not change it) | session start: `is_session_start`, `is_new_visitor` (not under GPC/DNT), `ref_host`, `utm_*` |
| `page_leave` | navigation away / tab closed | `engaged_ms` ◆ = engaged time not yet sent by pings |
| `page_ping` | every 5 min on a page | `engaged_ms_delta` |
| `nav_click` | a click followed by a page view within 3 s | `to_page`, `element` (lab_tile, related, nav, encyclopedia, premium_cta, search_result, footer, other) |
| `search` | 1.5 s after typing stops; sent on a result click (with rank), a new search, or after 20 s | `result_count`, `clicked_rank` ◆ query text never sent |
| `calc_view` | a calculator page view | `calc_id` |
| `calc_start` | first trusted input/change in the calculator on that page view | `calc_id` |
| `calc_complete` | 2 s after the last input, if a finite result is showing; once per page view | `calc_id`, `fields_touched` (count), `ms_to_complete` |
| abandonment | derived in the rollup: a `calc_start` with no `calc_complete` on the same page view | — |
| `premium_gate_view` | a locked Premium calculator's upsell appears | `calc_id` |
| `premium_offer_view` | the Premium offer card is visible | `signed_in` |
| `signin_request` | the sign-in form is submitted (the email is not read) | — |
| `signin_complete` ◆ | a Supabase session key appears in the browser (only the key *name* is checked; never its value, the client or the user id) | — |
| `trial_click` / `portal_open` | PR #28's `data-action="checkout"` / `"portal"` buttons | `interval`, `trial` |
| `checkout_redirect` | the page is left within 15 s of a trial click | `interval` |
| `checkout_return` | `?checkout=success|cancelled`, once per session | `outcome` |

◆ `calc_unit_toggle`, `calc_help_open` and `max_scroll_pct` are accepted by the database but not sent by this first version.

Never collected: calculator inputs or results, search text, email, account id (no visitor-to-account link), IP address,
full user agent, full URL, fingerprints. Visitor id: random, 13 months in `localStorage`; **session-only** when the browser
sends Global Privacy Control or Do Not Track.

## 4. Owner decisions needed before tracking is switched on

These block live enablement, not the code. Tracking stays off until they are made.

1. **Consent approach.** The design stores a random visitor id in `localStorage` (no cookies, no third parties, no
   advertising). Decide whether that runs for everyone with a Privacy-page notice and GPC/DNT honoured (the current code), or
   only after a consent banner (would need a banner; not built). If EU/UK visitors matter, take advice — I am not a lawyer.
2. **Privacy page text.** It must describe the analytics before launch. Suggested wording: *"We measure how our site is used
   with our own first-party analytics: which pages and calculators are opened, whether a calculator produced a result, how
   visitors arrived (the referring site or campaign tag) and time spent. We never record what you type into a calculator,
   your search words, your IP address or your email. A random identifier is kept in your browser for up to 13 months
   (only for the current visit if your browser sends Global Privacy Control or Do Not Track). Raw records are deleted after
   90 days; only daily totals are kept."*
3. **Retention.** Implemented: raw 90 days, sessions 13 months, daily totals indefinitely. Confirm or change.
4. **Owner account.** The Supabase user id of the account allowed to see the dashboard, added with one reviewed statement:
   `INSERT INTO public.analytics_owners (user_id, note) VALUES ('<owner user id>', 'Trent');`
5. **Live origins.** Which addresses count as live (suggested: `https://www.gearhead-labs.com`, `https://gearhead-labs.com`).
6. **Search words.** Not stored (blueprint open question). Storing them would need its own decision and Privacy text.
7. **Reporting day.** America/New_York is assumed for "a day". Confirm.

## 5. Steps to enable (in order, each with owner approval)

1. Review and merge the PR (owner).
2. Apply 0501 through the gated provisioning workflow. The workflow's pinned package and expected pending list must be
   updated for 0501 first (that is PR #27's area; not done here).
3. Supabase dashboard → Integrations → Cron: enable `pg_cron`, then re-run the migration's scheduling block (or apply 0501
   after enabling it). Without `pg_cron`, rollups only happen when the owner presses Refresh. UNVERIFIED on hosted Supabase.
4. Deploy `analytics-ingest` with JWT verification off; set its secrets `ANALYTICS_ALLOWED_ORIGINS`, `ANALYTICS_LIVE_ORIGINS`,
   then `ANALYTICS_INGEST_ENABLED=true`.
5. Add the owner row (decision 4) and open `/owner/analytics.html` to confirm "Not authorised" turns into the dashboard.
6. Update the Privacy page (decision 2).
7. In `analytics-config.js` set the endpoint, `env: 'test'`, `enabled: true`; publish; check Data health for a day; then set
   `env: 'live'`.

## 6. Tests run (2026-11-09, this sandbox; all data synthetic)

| Suite | Result |
|---|---|
| `premium-foundation/tests/analytics.test.js` (throwaway PostgreSQL 16, all migrations + 0501): security/RLS, function privileges, owner vs non-owner/anon/service, validation (20 rejection cases incl. input values, search text, email, URLs), envelopes, duplicates, per-session cap, bot flag, clock skew, client error counters, sessionisation, rollup accuracy against hand-computed answers + idempotency, dashboard KPIs / previous period / date boundaries / environment separation / funnel / health, empty range, purge, billing pending / test-mode-only pending / live figures, Edge Function handler end to end (env decision, refusals, rate limit, kill switch, database down) | **16/16 passed** |
| `premium/tests/analytics-client.test.js` (Chromium, real `index.html`, fake endpoint) | **10/10 passed** |
| `premium/tests/analytics-dashboard.test.js` (Chromium, real pinned supabase-js, fake Supabase API, report = real function output) | **12/12 passed** |
| `premium/tests/browser-smoke.js` (script inventory updated for the two new scripts) | 19/19 passed |
| `premium/tests/frontend.test.js` (script order + "who touches the client" inventory updated: `owner/analytics.js` uses the boot client, creates none) | 55/55 passed |
| `premium-foundation/tests/pf.test.js` (EXPECTED_MIGRATIONS, table and SECURITY DEFINER inventories updated for 0501; rollback test runs the 0501 rollback first) | 46/48 with `TZ=UTC`. The 2 failures are **pre-existing on `main`** (the reference-count and 0408 checks were not updated for 0409, which adds one formula version). Without `TZ=UTC` a third, time-zone-only failure appears (`extended end`), also pre-existing. |

Performance (40 real keystrokes, each a live re-render, medians of 6 alternating runs after page start-up):
424 ms off vs 455 ms on — about 0.8 ms per keystroke, inside the run-to-run spread (off 329–593 ms, on 345–504 ms). Not a precise
measurement; no slowdown was detectable beyond noise. The input handler does not read values and does no work per re-render.

## 7. Known limits and what is not verified

- No real traffic: thresholds (bot rules, engaged-time rules, channel host lists) are untested against real visitors.
- The Deno entry point (`index.ts`) was not run; its handler module was tested in Node against the real database function.
- Delivery of beacons during real page unload, the magic-link `signin_complete` path with real Supabase Auth, `pg_cron` and
  the hosted RPC path through supabase-js are UNVERIFIED in this sandbox.
- Sessions continue across tabs and reloads within 30 minutes; a new external referrer inside that window does not start a new
  session (a new campaign tag does).
- Funnel steps are counted per session independently, not as a strict ordered funnel.
- The rate limit is per Edge Function instance (in memory), so it is best-effort; the database's per-session cap is the backstop.
