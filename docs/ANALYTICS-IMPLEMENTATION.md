# First-party analytics and owner dashboard — implementation record

Branch `feature/analytics-dashboard` (PR #29, draft). Specification: `docs/ANALYTICS-BLUEPRINT.md`.
Status on 2026-11-09: **built and tested on synthetic data only. Not deployed. Not deployable yet (see §6). Tracking is OFF.**
Nothing here has received real website traffic, so nothing is validated against real visitors.

Revision 2 (independent-review corrections): environment fixed by the server, shared database rate limits, stricter
calculator-completion detection, mutually exclusive new / returning visitors.

## 1. What is in this branch

| Part | File(s) | State |
|---|---|---|
| Database | `supabase/migrations/0501_analytics.sql`, rollback `supabase/rollback/0501_analytics.rollback.sql` | In the branch only. **Not applied anywhere.** |
| Ingestion endpoint | `supabase/functions/analytics-ingest/index.ts` + `supabase/functions/_shared/analytics-ingest.js` | Not deployed. Accepts nothing unless enabled and given an environment. |
| Site tracking | `analytics.js`, `analytics-config.js` (`enabled: false`), two script tags in `index.html` | Ships OFF: the script returns immediately. |
| Owner dashboard | `owner/analytics.html`, `owner/analytics.js`, `owner/analytics.css` | Not linked anywhere; `noindex`. Needs the migration to show anything. |
| Tests | `premium-foundation/tests/analytics.test.js`, `premium/tests/analytics-client.test.js`, `premium/tests/analytics-dashboard.test.js` | Results in §7. |

PR #27 and PR #28 are not touched. No hosted database, production setting, secret or record was changed.

## 2. How it works

**Browser → `analytics-ingest` Edge Function → `analytics_ingest()` → `analytics_events` → rollup → `analytics_dashboard()` → owner page.**

- The site script batches events (≤ 20 per request, ≤ 8 KB) and sends them with `sendBeacon` / `fetch(keepalive, no-cors, no
  cookies)` every 15 s, on navigation and when the tab hides. Queue capped at 50; backs off when the endpoint is down.
- `analytics_ingest()` (service role only) validates every event against the catalogue and a per-event property allow-list,
  drops duplicates by `event_id`, caps 500 events per session per 24 h, and counts every outcome for Data health.
- `analytics_rollup(day)` re-sessionises on the server (> 30 min gap or New York midnight = new session), computes landing /
  exit pages, engaged time (≤ 30 min per page view), channel, daily metrics and each visitor id's first / last day. Bot
  sessions are excluded and counted. `analytics_rollup_pending()` rolls up every day whose events arrived after its last
  rollup (pg_cron every 15 min; the dashboard's Refresh runs it too), so no day is missed when cron is not running.
- Retention (`analytics_purge()`): raw events 90 days (rolled up again first), sessions / counters / visitor first-seen
  days 13 months, daily totals kept, rate-limit counters and salts ≤ 2 days.

## 3. Security and abuse controls — what is verified, what is best-effort

### Verified protections (tested against real PostgreSQL permissions and RLS)
- All nine analytics tables: RLS enabled and forced, no policies, no privileges for `anon`, `authenticated` or
  `service_role`. Clients cannot read raw events, sessions, visitors or counters. A migration post-condition fails if this
  ever changes.
- Raw events are append-only (update / delete / truncate refused except inside the purge function).
- Reports come only from `analytics_dashboard()` / `analytics_refresh()` / `analytics_billing_metrics()`, which raise 42501
  unless `auth.uid()` is listed in `analytics_owners` (empty at install). Anon, signed-in non-owners, tokens without a user
  and the service role are all refused. Only aggregates are returned.
- `analytics_ingest()` is executable by the service role only; the rate-limit and rollup functions by nobody but the owner
  of the database.
- **The environment is fixed by the server.** The Edge Function stores every event under its `ANALYTICS_ENV` setting
  (live / test / dev). Origin, Referer, User-Agent and the request body cannot change it. A batch whose page-supplied `env`
  differs is rejected whole (`env_mismatch`, counted), and an event cannot carry its own `env` field. A deployment with no
  valid `ANALYTICS_ENV` accepts nothing.
- Hostile payloads are rejected with counted reasons: unknown events or fields, unlisted properties (including calculator
  values, result text, search words, email, `__proto__`), wrong types, out-of-range numbers, URLs or markup in page keys,
  look-alike Unicode, oversize batches / bodies, non-JSON.
- No IP address, full user agent, account id, email, full URL or query string is stored in any table (tested by scanning
  every analytics table after ingestion).

### Best-effort abuse controls
- **Origin allow-list:** browser CORS hygiene only. It is not authentication: any script can send the real site's Origin.
- **Database rate limits (shared by every Edge Function instance):** per sender network (IPv4 address or IPv6 /64)
  600 events / 10 min and 5,000 / day; per environment 60,000 / hour. Exceeding a limit rejects the batch (counted as
  `rate_limited`). The network is hashed with a random salt that changes daily (`sha256(salt | network)`); the address is
  never stored, the salt is deleted after two days, the counters after two days. The address does pass, unstored, through
  the Edge Function and the RPC call. Limits are in `analytics_limits()`; easy to change.
- **In-memory limiter in the Edge Function (120 requests / min per address):** a first line inside ONE function instance.
  Supabase runs several instances and restarts them at will, so this is **not a global limit**; the database limits are.
- **Bot flag:** known bot / tool user agents and `navigator.webdriver`, plus rollup heuristics (> 300 events, or > 30 page
  views at > 30 / min, in one session). Bot sessions are excluded from every figure and shown in Data health.
- Per-session cap (500 events / 24 h) and duplicate suppression.

### Known limitation (stated plainly)
An anonymous, public ingestion endpoint **cannot prove an event came from a real human visitor**. Random browser ids and
request validation are not authentication. A script that copies a browser's headers and the event format is accepted like
a visitor (a test demonstrates this); only the rate limits, caps and bot rules bound how much it can add. Someone could
inflate live figures within those limits. Stronger options need an owner decision (§5, decision 8).

## 4. Events and definitions as implemented

Envelope: `event_id, name, ts_client, vid, sid, seq, page, pv_id, viewport(s/m/l), props`. Page keys: `home`, `calc:<id>`,
`lab:<key>`, `page:<name>`, `view:<premium view>` — never a URL or query string.

| Event | When | Properties |
|---|---|---|
| `page_view` | the page key changes (a live re-render does not change it) | session start: `is_session_start`, `is_new_visitor`*, `ref_host`, `utm_*` |
| `page_leave` / `page_ping` | leaving / every 5 min | `engaged_ms` (not yet reported) / `engaged_ms_delta` |
| `nav_click` | a click followed by a page view within 3 s | `to_page`, `element` |
| `search` | 1.5 s after typing stops; on a result click (with rank), a new search, or after 20 s | `result_count`, `clicked_rank` (never the words) |
| `calc_view`, `calc_start`, `calc_complete` | see below | `calc_id`; complete adds `fields_touched` (count), `ms_to_complete` |
| `premium_gate_view`, `premium_offer_view`, `signin_request`, `signin_complete`, `trial_click`, `checkout_redirect`, `checkout_return`, `portal_open` | Premium funnel (as in revision 1) | allow-listed only |

\* kept as data from the page; **not used** for the new / returning figures (see below).

**Calculator start / completion / abandonment.**
- Start: the first *trusted* (real keyboard / pointer) input or change inside the calculator on that page view. Scripted
  fills are ignored; a default result already on screen never counts.
- Completion: 2 s after the visitor's last input, the calculator must have re-rendered since that input **and** show at
  least one finite numeric result and no NaN / Infinity / error value. Results are read from `.result-value` and
  `.mini-result .value`, with unit spans ignored; accepted formats include integers, decimals, thousands separators,
  signs (including −), currency, `~` / `≈`, ratios (14.7:1), fractions, scientific notation and units. Empty, "—",
  placeholders ("Enter…", "Select…"), NaN, Infinity, error / invalid text and text-only results do not count. If the
  result appears late (within 30 s of the last input) it is checked again shortly after it appears. Once per page view.
- Abandonment: a start with no completion on the same page view (computed in the rollup).
- The result text is only classified (number / empty / text / bad); it is never stored or sent.
- **Catalogue coverage (measured, not assumed):** every catalogue calculator was rendered in the real page with a scripted
  value in its first field and the detector's verdict recorded. 573 of the 585 free calculators show a result it accepts
  (diesel 42/42, EV 39/39, towing 26/27, gasoline 159/162, universal 307/315). The 12 exceptions never record a completion
  (starts and abandonment still do): no input fields — `christmas_tree`, `ct_push_loose`, `resistor_color`, `rotor_heat`;
  their own result layout — `cam_card`, `sim_braking`, `sim_gear_rpm`, `sim_weight_transfer`,
  `universal_automotive_converter`; text-only or chart-selection results — `nitrous_jet`, `octane_for_cr`, `trailer_sway`.
  The 172 Premium calculators were not swept (they show the upgrade card on the free site).

**New vs returning visitors (mutually exclusive).** The rollup records each anonymous visitor id's first and last reporting
day (`analytics_visitors`; bot sessions never create one). For a period:
- Visitors = distinct ids with a session in the period.
- New = of those, ids whose first recorded day is inside the period.
- Returning = of those, ids whose first recorded day is before the period.
New + returning = visitors, always. A browser that cleared or blocks storage, or sends GPC / Do Not Track (session-only id),
appears as a new visitor each time; an id unseen for 13 months is forgotten and would count as new.

Never collected: calculator inputs or results, search words, email, account id (no visitor-to-account link), IP address,
full user agent, full URL or query string, payment data, fingerprints.

## 5. Owner decisions (unchanged unless noted)

1. **Consent approach** — Privacy-page notice + GPC / DNT honoured (built) or a consent banner (not built). Take advice if
   EU / UK visitors matter; I am not a lawyer.
2. **Privacy page text** — must describe the analytics before launch. Suggested wording: *"We measure how our site is used
   with our own first-party analytics: which pages and calculators are opened, whether a calculator produced a result, how
   visitors arrived (the referring site or campaign tag) and time spent. We never record what you type into a calculator,
   your search words, your IP address or your email. A random identifier is kept in your browser for up to 13 months (only
   for the current visit if your browser sends Global Privacy Control or Do Not Track). Raw records are deleted after 90
   days; only daily totals are kept. To limit abuse, the sending network is checked against short-lived counters keyed by a
   one-way code that changes daily; the address itself is not kept."*
3. **Retention** — raw 90 days, sessions and visitor first-seen days 13 months, daily totals indefinitely. Confirm.
4. **Owner account** — the user id to add to `analytics_owners` (one reviewed statement; I can prepare it).
5. **Allowed origins** — suggested `https://www.gearhead-labs.com`, `https://gearhead-labs.com` (CORS only).
6. **Search words** — not stored. Keep?
7. **Reporting day** — America/New_York assumed. Confirm.
8. **NEW — how much proof of a real visitor is worth.** What is built cannot verify humans (§3). Options, in rising cost:
   (a) accept it: figures are "best-effort, rate-limited" and are cross-checked against Google Search Console and Stripe;
   (b) add a free human-check service such as Cloudflare Turnstile on the endpoint — stronger, but adds a third party, a
   privacy-page mention and a site change; (c) only count events from signed-in sessions — contradicts the no-account-
   linking rule. Recommendation: (a) now, revisit if numbers look inflated. Nothing beyond (a) has been built.
9. **NEW — rate-limit levels** — 600 / 10 min and 5,000 / day per network, 60,000 / hour overall are starting values.
   Shared networks (offices, schools, mobile carriers) put many people behind one address; raise them if Data health shows
   `rate_limited` on a normal day.

## 6. Migration and provisioning dependency — PR #29 is NOT deployable yet

Migration 0501 is **not** in the pinned 19-file provisioning package that PR #27's approval-gated workflow applies. It
must not be applied by hand or through any other path. Before PR #29 can be enabled:
1. A separate, approved change adds 0501 to the provisioning package (PR #27's area; not done here).
2. 0501 is applied through that workflow.

Then, each with owner approval: enable `pg_cron` (Supabase → Integrations → Cron; UNVERIFIED on hosted Supabase); deploy
`analytics-ingest` with JWT verification off and secrets `ANALYTICS_ENV`, `ANALYTICS_ALLOWED_ORIGINS`,
`ANALYTICS_INGEST_ENABLED=true`; add the owner row; update the Privacy page; set the endpoint and matching `env` in
`analytics-config.js` and `enabled: true`. For a trial period run the function with `ANALYTICS_ENV=test` (and the page with
`env: 'test'`), check Data health, then switch both to `live`.

## 7. Tests (2026-11-09, this sandbox; every event synthetic)

| Suite | What it exercises | Result |
|---|---|---|
| `premium-foundation/tests/analytics.test.js` | **Real PostgreSQL 16 permissions and RLS** (throwaway cluster, all migrations): table / function privileges for anon, authenticated, owner, service role; owner-only reporting; 33 validation / hostile-payload cases; duplicates; per-session cap; bot flag; environment fixed by the server (forged production Origin, page-supplied env, missing env, unconfigured deployment); database rate limits (10-min, IPv6 /64, daily, global, per environment, counted, no address stored, salt / counter purge); in-memory limiter shown to be per instance; Edge Function handler end to end against the database; sessionisation; rollup accuracy and idempotency; dashboard KPIs, previous period, date boundaries, environment separation, funnel, health; new vs returning (8 visitor histories incl. cleared storage, period boundaries, previous period, order-independence, bot ids); purge; billing pending / test-mode-only / live | **21 / 21 passed** |
| `premium/tests/analytics-client.test.js` | **Real Chromium**, the real `index.html` and calculators, fake ingest endpoint, synthetic visitors | **26 / 26 passed** |
| — of which completion | classifier (36 strings, 10 result areas); synthetic calculator with real typing (12 cases: default result, scripted fill, integer, decimal, multiple fields, NaN, error, text, no re-render, 1 s and 3 s delayed results, invalidated then valid); 10 real calculators, two per LAB; real "abc" input; catalogue sweep (above) | included |
| `premium/tests/analytics-dashboard.test.js` | Real Chromium, real pinned supabase-js, fake Supabase API; report = real function output | **12 / 12 passed** |
| `premium/tests/frontend.test.js` | static frontend rules | 55 / 55 passed |
| `premium-foundation/tests/pf.test.js` (`TZ=UTC`) | premium-foundation suite with 0501 present | 46 / 48 — see below |

**Pre-existing failures, with baseline evidence.** On `main` (`d25afa2`) the suite has 1 failure: migration 0409 is in the
folder but not in the suite's approved list (47 / 48). The suite must list 0409 for 0501 to be accepted; listing it makes
two older checks fail because their expected counts predate 0409 (582 formula versions, not 581). Applying only that one
change to `main` — listing 0409, nothing from this branch — gives the identical 2 failures (46 / 48). They belong to 0409's
test update, not to analytics, and are left for that work. Without `TZ=UTC` a third, time-zone-only failure (`extended end`)
appears on any branch.

Performance (40 real keystrokes, each a live re-render, medians of 6 alternating runs): 422 ms off vs 458 ms on, inside the
run-to-run spread (off 387–448, on 281–548). No slowdown detectable beyond noise.

`browser-smoke.js` was not re-run for revision 2 (its scripts and script order did not change; it passed 19 / 19 in
revision 1).

**Not performed:** anything on hosted Supabase (Edge Function under Deno, the RPC path through supabase-js, `pg_cron`,
`x-forwarded-for` behaviour of the Supabase edge), real beacon delivery on page unload, the real magic-link
`signin_complete` path, Premium calculators in the completion sweep, any real traffic.

## 8. Other known limits

- Sessions continue across tabs and reloads within 30 minutes; a new external referrer inside that window does not start a
  new session (a new campaign tag does).
- Funnel steps are counted per session independently, not as a strict ordered funnel.
- `calc_unit_toggle`, `calc_help_open` and `max_scroll_pct` are accepted by the database but not sent yet.
