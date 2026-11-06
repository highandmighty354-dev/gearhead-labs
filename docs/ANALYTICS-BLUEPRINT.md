# Gearhead Labs — First-Party Analytics & Owner Dashboard Blueprint

Status: **planning document only (2026-11-06). Nothing here is implemented, deployed or enabled.** Written against `main` at `6a4d08f`, with reference to draft PR #28 (Stripe billing, test mode) at `ff8210c`. Neither was modified.

Labels used throughout:
- **[V]** verified in the code or repository;
- **[R]** recommendation;
- **[A]** assumption or open question.

---

## 1. Executive summary

- **[V]** Gearhead Labs has **no analytics of any kind**: no tracker, beacon, pixel, event table or log. The catalogue build records this explicitly ("the site has no analytics"), and its "most-used" sort is disabled for that reason.
- **[R]** Build a small **first-party** system on the existing Supabase project:
  - a ~6 KB script in the site shell;
  - one Edge Function ingestion endpoint;
  - two server-only tables (raw events plus a nightly daily rollup);
  - an owner allow-list;
  - read-only reporting functions that return **aggregates only**;
  - a standalone, unlinked, owner-only dashboard page in the black-and-gold style.

  It needs no paid service and no cookies, and it collects nothing a user types into a calculator.
- **[R]** **Subscription and revenue metrics come from the billing tables** that already exist (0402) and that PR #28 fills: `subscriptions`, `stripe_events`, `plan_prices` and `entitlement_grants`. They are never duplicated as analytics events. Analytics events cover only the steps *before* Stripe: Premium views, sign-in, trial clicks, checkout redirects and returns.
- **[R]** Everything that does not involve Stripe can be built and tested now, against local PostgreSQL, the same way the billing work was. Revenue panels show **"Pending: Stripe not connected"** until real billing rows exist.
- **[A]** The main open decisions (section 12): a privacy notice and consent approach; whether to store search text; raw-event retention; and whether analytics may link a visitor to an account at sign-up.

---

## 2. Existing architecture findings

| Area | Finding |
| --- | --- |
| Hosting | **[V]** Static site on GitHub Pages. `index.html` is a shell page that loads the encyclopedia `F1_12_4_…batch9_1.html` in a **same-origin iframe** (`#app`), the Premium scripts (`premium/*.js`), `app-shell.js` and pinned supabase-js 2.117.2 with SRI. |
| Routing | **[V]** Query-string routes: `?calc=<id>` (calculator), `?lab=<key>` (lab page), `?view=<home\|calculators\|lab\|run\|garage\|saved\|profile>` (Premium shell, `VIEWS` in `premium/shell.js`). `app-shell.js` `route()` / `sync()` mirror the route into the iframe, and the iframe's `ghRoute()` renders it. Its in-app static pages (`?page=about\|methodology\|privacy\|terms\|contact`) are rendered by `ghE110RenderStatic`. |
| Calculators | **[V]** `renderCalc(id, scroll)` renders a calculator. It runs on a genuine navigation (`scroll=true`, which also calls `addRecentCalc`) **and on every keystroke** (`scroll=false`, a live re-render). Results appear as `.result-box` / `.result-value` elements (105 occurrences). There is also a generic engine, `calculate(id, inputs)`, which returns `{state, outputs, warnings…}`. |
| Labs | **[V]** `GH_LABS` keys: `gasoline`, `diesel`, `ev`, `towing`, `universal` (labels GASOLINE LAB … UNIVERSAL LAB), each with a list of categories (`cats`). |
| Search | **[V]** One search box in the iframe, `#search-input` (`.search-wrap`). |
| Browser storage | **[V]** `localStorage` is used through a small wrapper and for the vehicle store and the "recent" list. Nothing is sent anywhere. |
| Premium gating | **[V]** `premium-calculator-gating.js` shows a locked card ("See Premium →") on Premium calculators. The Profile offer card is `premiumOfferCard()` in `premium/shell.js`. |
| Auth | **[V]** Supabase Auth with **email magic link only** (`signInWithOtp` in `premium/adapters/foundation.js`); a development adapter is used on localhost. |
| Database | **[V]** Migrations 0001–0409 (23 public tables). The Premium layer (0401–0407) uses strict RLS. In particular, 0402's server-only tables (`stripe_events`, `billing_customers`, …) have no client privileges, plus `pf_stamp` / `pf_guard` / `pf_no_delete` / `pf_no_truncate` triggers and service-role-only `SECURITY DEFINER` functions. **There is no admin or owner role or allow-list anywhere.** |
| Edge Functions | **[V]** None on `main`. PR #28 adds `billing-checkout`, `billing-portal` and `stripe-webhook`, with a shared module pattern (`supabase/functions/_shared/`: CORS allow-list, error mapping, service-role adapter). |
| Privacy text | **[V]** The in-app Privacy page says calculators run in the browser and that ad providers may use cookies. It says **nothing about first-party analytics**. |
| Ads | **[A]** Earlier records mention AdSense wiring behind a `GH_ADS_ENABLED` flag (off). That code is **not on this repository's `main`**, so it was not verified here. |
| Migrations process | **[V]** Database changes reach production only through the approval-gated provisioning workflow (PR #27, Option B), with a pinned package. Analytics migrations will be part of a future package, not applied ad hoc. |

---

## 3. Existing analytics capabilities and gaps

- **Exists [V]:**
  - the per-browser "recent calculators" list (local only, never sent);
  - the billing event log `stripe_events` and the subscription mirror `subscriptions`, both server-only, empty in production and filled by PR #28 once Stripe is connected;
  - a strong precedent for server-only tables and owner-less RLS.
- **Missing [V]:**
  - page or calculator measurement of any kind;
  - sessions and visitors;
  - referrer and UTM capture;
  - an owner/admin authorization mechanism;
  - reporting functions;
  - a dashboard;
  - a privacy notice covering analytics.
- **Conflicts or duplication to avoid [R]:**
  - Do not log billing outcomes as analytics events; `stripe_events` and `subscriptions` are the record.
  - Do not reuse `entitlement_grants` for owner access. Access to Premium is a different concept from authority over analytics.
  - Do not add the dashboard to the Premium shell's `VIEWS` or navigation.

---

## 4. Recommended measurement plan

### 4.1 Definitions (counting methods) [R]
- **Page view:**
  - one per **route change** in the shell (`?calc=`, `?lab=`, `?view=`, `?page=`, or home), including the first load;
  - a live re-render of the same calculator is **not** a page view;
  - the page key is the normalised route: `calc:<canonical id>`, `lab:<key>`, `view:<name>`, `page:<name>`, `home`, `encyclopedia`.
- **Visitor:** a random UUID (`vid`) generated in the browser and kept in `localStorage` (`gh_a_vid`) for **13 months**.
  - No cookies, no fingerprinting.
  - If Global Privacy Control or Do Not Track is on, or storage is unavailable, a **per-tab, session-only** id is used instead. That visitor counts as "unknown" for new versus returning.
  - **Unique visitors** for a period is the count of distinct `vid` with at least one non-bot event. This is an approximation: clearing storage or switching device counts as a new visitor.
- **Session:**
  - a random UUID (`sid`) stored in `localStorage` with its last-activity time;
  - a new session starts after **30 minutes** without activity, at local midnight, or when a new UTM campaign arrives;
  - it is shared across tabs.
  - The server also re-checks the gaps when rolling up, so a forged or stale `sid` cannot stretch a session.
- **New versus returning:**
  - the visitor's first session ever, according to a `first_seen` date kept with the `vid` in storage and sent as a flag, is "new";
  - otherwise "returning".
- **Landing page / exit page:** the first and last page view of a session (derived in the rollup).
- **Engaged time** (see 4.2) and **engaged session**: a session with at least 10 seconds of engaged time, **or** at least 2 page views, **or** at least one key event (calculator completion, search with a result click, any Premium funnel event).
- **Bounce:** a session that is not engaged.

### 4.2 Time on page: how it is actually measured [R]
A page-load timestamp does not measure engagement: a tab left open overnight would count as 8 hours. Engaged time is accumulated **in the browser** instead:
- The clock runs only while `document.visibilityState === 'visible'` **and** the window has focus **and** the user was active (pointer, key, scroll or touch) within the last **30 seconds**.
- It pauses on hidden, blur or inactivity, and resumes on activity.
- The accumulated time for a page view is sent with the `page_leave` event when the route changes, on `pagehide`, or when the tab becomes hidden; whichever comes first wins, and duplicates are prevented by `event_id`.
- A long visible session also flushes every **5 minutes** (a `page_ping` event carrying the increment), so a crash loses at most 5 minutes.
- Each page view is capped at **30 minutes** of engaged time.
- Reports show **median and average engaged time** per page.

**Documented limits:**
- Time between the last activity and a hard close (browser killed, phone sleeping) is lost.
- Reading without moving anything for more than 30 seconds stops the clock. That is intended: it undercounts rather than overcounts.

### 4.3 Calculator measurement [R]
Calculator pages re-render on every keystroke, so events are attached to a **calculator view instance**: one per page view of `calc:<id>`.
- **View:** the `calc_view` event, fired on a genuine navigation to a calculator. It records whether the calculator is Premium-locked.
- **Start:** `calc_start`, fired **once per instance** on the first **trusted** (`isTrusted`) `input` or `change` event inside `#calc-container`. Programmatic fills, live re-renders and unit toggles do not count.
- **Completion:** `calc_complete`, fired **once per instance** when, after a start:
  - at least one `.result-value` in the container shows a finite numeric result; and
  - no further input has arrived for **2 seconds** (a debounce, so typing "350" is one completion, not three).

  Its properties: `fields_touched` (a count of distinct input names; **never values**) and `ms_to_complete`.
- **Abandoned:** an instance with a start and no completion by the time the user leaves. This is derived in the rollup; no extra event is sent.
- **Not collected, ever:** input values, results, units chosen per field, vehicle data, or anything typed into a calculator.
- **Movement between calculators and content:** from the sequence of page views within a session, the rollup builds "next page after calculator X". Clicks on related tools or encyclopedia links inside a calculator page are `nav_click` events, with the destination's page key only.
- **Lab engagement:** each calculator has a lab and category, attached at **reporting** time from the catalogue (`GH_LABS` categories), not stored on every event. Lab page views come from `lab:<key>`.

**[A] To validate during implementation:** some calculators may show results from default values before any input. Under the definition above (start required first), those are not completions until the user changes something. Calculators whose result markup differs from `.result-value` need a per-calculator check, and the build should list any calculator where completion never fires in an automated sweep.

### 4.4 Traffic sources [R]
- The source is attributed on the **first page view of each session**, from:
  - `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` and `utm_term`, each capped at 100 characters, lower-cased and kept to letters, digits and `-_.`; and
  - `document.referrer`, reduced to its **host only** (no path or query); internal referrers are ignored.
- **Channel grouping** is computed in the rollup:
  - Direct;
  - Organic search (known search engines);
  - Social (known social networks);
  - Referral (any other host, for example moparcenter.com);
  - Campaign (UTM present);
  - AI assistants (hosts such as chatgpt.com, perplexity.ai, claude.ai and copilot).

### 4.5 Internal search [R]
- A `search` event is sent after 1.5 seconds of typing idle, or on a result click. Its properties:
  - `result_count`;
  - `clicked_rank` (if a result was clicked);
  - `query`, **only if the owner approves storing search text** (section 12): trimmed, lower-cased, at most 64 characters, and dropped if it looks like an email address or contains a run of 7 or more digits.
- Zero-result searches are the main content-gap report.

---

## 5. Event catalogue

**Common envelope (every event) [R]:**
- `event_id` (client UUID; the de-duplication key);
- `name`;
- `ts_client`;
- `vid`;
- `sid`;
- `seq` (counter within the session);
- `page` (page key);
- `pv_id` (page-view instance id);
- `viewport` (`s` / `m` / `l`, three buckets only).

The server adds `ts_server`, a `bot` flag and `ua_family` (browser family and major version only, never the full user-agent string).

**Never sent:**
- IP address (it is used transiently for rate limiting and never stored);
- full user-agent;
- email address;
- calculator inputs or outputs;
- passwords or payment details.

**Page and session events**

| Event | When it fires | Required properties (beyond the envelope) | Purpose |
| --- | --- | --- | --- |
| `page_view` | Each route change and the first load | `is_new_visitor`, `is_session_start`; on a session start: `ref_host`, `utm_*` | Traffic, top/bottom pages, landing, sources, new vs returning |
| `page_leave` | Route change, `pagehide` or hidden (first to occur) | `engaged_ms` (capped at 1,800,000), `max_scroll_pct` (0/25/50/75/100) | Engaged time, exit pages, scroll depth |
| `page_ping` | Every 5 minutes of engaged time | `engaged_ms_delta` | Crash-safe engaged time on long visits |
| `nav_click` | Click on an internal link or tile (lab tile, related tool, encyclopedia link, Premium CTA) | `to_page`, `element` (from a fixed list) | Click-through and navigation paths |
| `search` | 1.5 s typing idle, or a result click | `result_count`, `clicked_rank?`, `query?` (if approved) | Search use, zero-result content gaps |

**Calculator events**

| Event | When it fires | Required properties | Purpose |
| --- | --- | --- | --- |
| `calc_view` | Genuine navigation to a calculator | `calc_id` (canonical), `premium_locked` | Calculator views, rankings |
| `calc_start` | First trusted input in that view | `calc_id` | Starts; abandonment base |
| `calc_complete` | First valid result 2 s after the last input | `calc_id`, `fields_touched`, `ms_to_complete` | Completions, time to answer |
| `calc_unit_toggle` | User switches unit system on a calculator page | `calc_id`, `to` (`us` / `metric`) | Unit preference (product decision input) |
| `calc_help_open` | User opens a calculator's help or "why" content | `calc_id` | Content usefulness |

**Premium funnel events (analytics side only; billing truth is in section 9)**

| Event | When it fires | Required properties | Purpose |
| --- | --- | --- | --- |
| `premium_gate_view` | A locked Premium calculator card is shown | `calc_id` | Demand for Premium content |
| `premium_offer_view` | The Profile offer card is rendered | `signed_in` | Funnel step 1 |
| `signin_request` | Magic-link email requested | none (the email is **never** sent) | Funnel step 2a |
| `signin_complete` | Auth state changes to signed in | `first_sign_in` (if known) | Funnel step 2b |
| `trial_click` | A trial or subscribe button is clicked (PR #28 UI) | `interval` (`month` / `year`), `trial` | Funnel step 3 |
| `checkout_redirect` | The checkout function returned a Stripe URL and the browser is leaving | `interval` | Funnel step 4, client side |
| `checkout_return` | Profile loaded with `?checkout=success\|cancelled` | `outcome` | Funnel step 4/5 hand-off |
| `portal_open` | "Manage billing" clicked | none | Retention signal |

The catalogue is closed. The ingestion endpoint rejects unknown event names and unknown properties (section 7).

---

## 6. Database and Supabase architecture

All of this would be one new migration in a future provisioning package (for example `05xx_analytics.sql`), following the 0402 patterns. **[R]**

### 6.1 Tables
```
analytics_owners   (user_id uuid PK references auth.users, added_at timestamptz)
                   -- the owner allow-list; rows only via migration; no client privileges
analytics_events   (id bigint identity PK, event_id uuid UNIQUE, name text CHECK (name IN (...catalogue...)),
                    ts_server timestamptz default now(), ts_client timestamptz, vid uuid, sid uuid, pv_id uuid, seq int,
                    page text CHECK (length <= 120), props jsonb CHECK (pg_column_size(props) <= 1024),
                    ua_family text, viewport char(1), bot boolean default false)
                   -- append-only raw events; no client privileges; pf_no_update / pf_no_delete-style guards
                   -- (deletion only by the retention job)
analytics_daily    (day date, metric text, dim1 text, dim2 text, value numeric, PRIMARY KEY (day, metric, dim1, dim2))
                   -- nightly rollup: pageviews / visitors / sessions / engaged by page, source, lab, calculator, funnel step
analytics_sessions (sid uuid PK, vid uuid, day date, started_at, ended_at, landing_page, exit_page, page_views int,
                    engaged_ms int, engaged boolean, channel text, ref_host text, utm_campaign text, is_new boolean, bot boolean)
                   -- one row per session, built by the rollup; drives landing/exit, bounce and channel reports
```
**Indexes:**
- `analytics_events (ts_server)` (BRIN: cheap, append-ordered);
- `(sid, seq)`;
- `(name, ts_server)`;
- `analytics_sessions (day)`;
- `(vid)`;
- `analytics_daily` uses its primary key.

### 6.2 Ingestion [R]
- **An Edge Function, `analytics-ingest`, deployed without JWT verification** (like PR #28's webhook), because:
  - `navigator.sendBeacon` cannot send Supabase's `apikey` / `Authorization` headers, and the beacon is the only reliable way to deliver `page_leave` on close;
  - the function can see the client IP for **in-memory rate limiting** without ever storing it;
  - it validates centrally and writes with the service role, so the table needs **no anon or authenticated INSERT privilege at all**.
- **It accepts** a JSON batch of at most 20 events and 8 KB from an allow-listed `Origin` (the GitHub Pages origin and localhost for development).
- **It validates:**
  - each event against the catalogue (name, allowed properties, types, lengths);
  - the time skew: client time within ±24 h of server time, otherwise clamped and flagged.
- **It flags bots** (`bot = true`): known crawler user-agent patterns, headless markers, `navigator.webdriver` (sent as a flag), more than 300 events in a session, or more than 30 page views per minute.
- **Duplicates** are handled by `INSERT … ON CONFLICT (event_id) DO NOTHING`.
- **Rate limits:**
  - per IP, best-effort and in-memory (for example 120 events per minute);
  - per `sid` (a hard cap of 500 events per session, enforced in the insert function).
- It always answers `204`, **even on rejection**, so the endpoint teaches abusers nothing and the page never waits.

### 6.3 Aggregation, reporting and retention [R]
- **Nightly rollup** with `pg_cron` (included in Supabase at no cost; enabling it is part of the migration):
  - `analytics_rollup(day)` sessionises (30-minute gaps), builds `analytics_sessions` and refreshes `analytics_daily`;
  - it is re-runnable (idempotent upsert per day).
  - "Today" panels read raw events directly, limited to the last 48 h.
- **Retention:**
  - raw events **90 days** [A, section 12];
  - sessions **13 months**;
  - daily rollups kept indefinitely (small).
  - A nightly purge deletes older raw rows; it is the **only** delete path.
- **Reporting functions:** `SECURITY DEFINER`, `STABLE`, granted to `authenticated` only, each beginning with `IF NOT EXISTS (SELECT 1 FROM analytics_owners WHERE user_id = auth.uid()) THEN RAISE … '42501'`. They return **aggregates only**, for example:
  - `analytics_overview(from, to)`;
  - `analytics_pages(from, to, sort, limit)`;
  - `analytics_sources(...)`;
  - `analytics_calculators(...)`;
  - `analytics_labs(...)`;
  - `analytics_funnel(...)`;
  - `analytics_search(...)`;
  - `billing_metrics(...)` (section 9).

  The date range is capped at 400 days, with row limits.
- **Size estimate [A]:** about 5–8 events per page view, at roughly 400 bytes per row including indexes.
  - 1,000 page views a day is about 3 MB/day, about 270 MB over 90 days.
  - That fits a 500 MB free-tier database **only at low traffic**. Above roughly 1,500 page views a day, shorten raw retention (for example to 30 days) or move to a paid tier.
  - The rollups keep long-term trends either way.

### 6.4 Client script and resilience [R]
- `analytics.js`, about 6 KB, loaded with `defer` from the shell. It attaches listeners to the same-origin iframe the way `app-shell.js` already does (`inject` / `ready`).
- All code is wrapped in `try/catch`; it never throws into the page and never blocks rendering or calculation.
- The queue lives in memory and in `sessionStorage` (at most 50 events). It is flushed every 15 s, on route change and on hide (`sendBeacon`, falling back to `fetch` with `keepalive`). Failures are dropped silently after 2 retries.
- **Kill switch:** `analytics.enabled` in config (default **false** until launch), plus a server-side flag in the function.
- Nothing analytics-related may run before the first calculator render.

---

## 7. Security and privacy design

| Requirement | How it is met |
| --- | --- |
| Raw events not publicly readable | **[R]** `analytics_events`, `analytics_sessions`, `analytics_daily` and `analytics_owners`: RLS enabled, **no** grants to `anon` or `authenticated`, and a self-check in the migration (like 0402's) that fails the migration if any client privilege or policy appears. |
| Owner-only dashboard | **[R]** Reporting functions check `analytics_owners`, which is filled only by migration with Trent's `auth.users` id. Being Premium, signed in, or holding a valid JWT is not enough. Non-owners get `42501` and no data. The dashboard page itself holds no data; it is a static shell. |
| No raw data through public APIs | **[R]** PostgREST can only reach the functions, which return aggregates; the tables are not exposed. Ingestion is write-only and always answers `204`. |
| Strict RLS / server-side controls | **[R]** The 0402 pattern: stamping and no-update/no-delete triggers on raw events, service-role-only writes, and a migration self-test. |
| No sensitive collection | **[R]** A closed event catalogue with per-property allow-lists. Server-side validation rejects anything else. Calculator values, emails, IPs, full user-agents and payment data are never accepted. |
| No full IP / no fingerprinting | **[R]** The IP is read only in memory for rate limiting. The user-agent is reduced to its browser family. The visitor id is random, never derived from the device. |
| Consent | **[A, owner decision]** No cookies are used. A `localStorage` identifier is still "storage on the device", which EU/UK ePrivacy rules generally treat as needing consent unless strictly necessary. Section 12 has the options. Global Privacy Control and Do Not Track are always honoured (session-only id). |
| Abuse of public submission | **[R]** Origin allow-list, size and batch caps, catalogue validation, rate limits, bot flags and per-session caps. **Residual risk:** someone can still inject plausible fake events and skew the statistics. They cannot read data, affect billing or access, or grow the database beyond the caps. Reports exclude `bot = true`, and the owner can see the excluded volume. |
| Never interfere with the site | **[R]** Deferred script, no dependencies, everything in `try/catch`, a fixed budget, the kill switch. The tests (section 11) include running every calculator with the analytics endpoint down. |

**Why this model:** it reuses the security pattern this project already proved on billing (server-only tables, definer functions, migration self-checks), which avoids a new class of risk. An owner allow-list keeps "business data" separate from "paid features", and aggregates-only reporting limits what any leak could expose.

---

## 8. Dashboard layout and reporting requirements

- **Location [R]:** a standalone page, `owner/analytics.html`:
  - not linked from any navigation;
  - `noindex,nofollow`;
  - kept out of any sitemap;
  - reusing supabase-js and the existing magic-link sign-in.
- Non-owners see "Not authorised", with no hint of what exists.
- Black background (#060708 to #0a0c0f) with gold accents, matching the site's tokens.
- **Charts are inline SVG** (no chart library to load or pin). Tables are sortable.

**Filters (top bar):**
- 7 days, 30 days (default), 90 days, 12 months, Custom (date picker), compared with the previous period;
- device size;
- channel;
- an "include bots" toggle (off).

**Overview (one screen, answers "how is the site doing and is it making money"):**
1. **KPI strip:**
   - visitors;
   - sessions;
   - page views;
   - engaged-session rate;
   - median engaged time;
   - calculator completions;
   - trial starts (**Pending: Stripe not connected** until billing data exists).

   Each with a delta against the previous period.
2. **Trend:** daily visitors, sessions and page views (line), with a weekly and monthly toggle.
3. **Top 10 calculators** by completions, with views, start rate, completion rate and abandonment.
4. **Channels:** a bar chart of sessions by channel, plus the top 5 referring hosts and campaigns.
5. **Funnel snapshot:**
   - offer view → sign-in → trial click → checkout redirect (analytics);
   - → trial started → paid → active (billing, otherwise Pending).
6. **Lab comparison:** sessions, completions and completion rate for the five labs.

**Secondary reports (tabs):**
- **Pages:** all pages with views, visitors, engaged time, entrances, exits and exit rate. Sortable both ways, so it shows the bottom performers too, with a "zero views in the period" list from the catalogue.
- **Acquisition:** channels, referrers, campaigns, landing pages, new versus returning.
- **Engagement:** engaged time distribution, pages per session, scroll depth, navigation paths ("after calculator X, people go to …").
- **Calculators:** the full ranking (views, starts, completions, completion and abandonment rates, median time to complete), filterable by lab and category; Premium-locked views, as a demand signal.
- **Search:** top queries (if stored) and zero-result queries.
- **Premium funnel:** full step counts, conversion between steps, and the date-cohort view.
- **Subscriptions and revenue** (billing data, section 9): active subscriptions, trials, MRR, ARR, renewals, failed payments, cancellations, churn. Every tile shows "Pending: Stripe not connected" until the billing tables hold non-test rows.
- **Data health:** events received per day, rejected and bot-flagged volume, rollup status, retention dates.

---

## 9. Stripe integration plan

- **[V] PR #28** syncs Stripe into existing 0402 tables through `pf_sync_stripe_subscription`:
  - `subscriptions` holds the *current* state: status, price, period, trial end, cancel flags, `stripe_state_at`;
  - `stripe_events` is an append-only log of every webhook, with its type, Stripe creation time and **payload**;
  - `entitlement_grants` records who has access.
- **Rule [R]:** billing metrics are read **only** from these tables (and, for revenue checks, Stripe's own dashboard), never from analytics events.

| Metric | Source of truth | Derivation |
| --- | --- | --- |
| Trial starts | `stripe_events` (primary), `subscriptions` (check) | The first `customer.subscription.created` with status `trialing` per subscription, dated by its Stripe creation time. Cross-check: `subscriptions` rows with `trial_end` set (that table keeps only the latest state, so it cannot date the start on its own) |
| Paid conversions | `stripe_events` | First `invoice.paid` with amount > 0 per subscription (`billing_reason` = `subscription_cycle` after a trial) |
| Active subscriptions | `subscriptions` | Status `active` or `past_due` with `current_period_end > now()` (trialing reported separately) |
| MRR | `subscriptions` × `plan_prices` | Sum over active paying subscriptions of `unit_amount` (yearly ÷ 12), in USD cents. Trials excluded |
| ARR | derived | MRR × 12 |
| Renewals | `stripe_events` | `invoice.paid` with `billing_reason = subscription_cycle` |
| Failed payments | `stripe_events` | `invoice.payment_failed`, deduplicated per invoice |
| Cancellations | `subscriptions` + `stripe_events` | `canceled_at`, plus `customer.subscription.deleted` events. Cancel-at-period-end is reported separately as "scheduled" |
| Churn | derived | Paying subscriptions cancelled in the period ÷ paying subscriptions at the period start |

- **Needs analytics events:** only the pre-Stripe steps: offer view, sign-in, trial click, checkout redirect and return.
- **Joining the two halves [R]:** the funnel joins on **account**, not on visitor.
  - When a signed-in user clicks a trial button, `trial_click` carries no account id. Instead, the ingest function (which can verify the user's JWT if one is sent) writes **one row** into a small server-only table, `analytics_account_link (account_id, vid, first_ts, first_channel, first_campaign)`.
  - That links acquisition source to subscriptions without attaching identity to every event.
  - This is an owner decision (section 12). Without it, the funnel is reported as two halves with the step counts side by side.
- **[V] Caveats:**
  - `subscriptions` holds only the latest state, so time series must come from `stripe_events`.
  - Payloads follow the Stripe API version pinned in PR #28 (`2025-03-31.basil`); field paths must be re-checked once real test events exist.
  - Test-mode rows must be excluded from production reporting. `stripe_events.payload->>'livemode'` makes this possible.
- **[R] Do not modify PR #28.** The `billing_metrics` reporting function is added in the analytics migration as **read-only `SECURITY DEFINER`** over the 0402 tables, behind the owner check.

---

## 10. Phased implementation roadmap

| Phase | Content | Depends on | Migration |
| --- | --- | --- | --- |
| **A. Foundations** (now, no Stripe) | Migration: owner allow-list, event/session/daily tables, guards, self-checks, ingest-side insert function, rollup/purge functions, `pg_cron` schedule, owner-checked reporting functions (traffic, pages, calculators, labs, search, funnel analytics half). Edge Function `analytics-ingest`. Local PostgreSQL tests in the PR #28 style | none | yes (one file) |
| **B. Client** (now) | `analytics.js` with page/session/engaged-time, calculator start/complete, search, nav clicks and funnel clicks; kill switch off by default; browser tests with the endpoint up, down and slow | A (interface only) | no |
| **C. Dashboard** (now) | `owner/analytics.html`: overview plus the secondary tabs, with billing tiles "Pending" | A | no |
| **D. Billing metrics** | `billing_metrics` over 0402 tables; tested with PR #28's Stripe simulator data locally, then with real Stripe test-mode events | PR #28 merged, Stripe test account | can ride in A as a read-only function; verify field paths after real test events |
| **E. Launch** | Privacy page update and consent decision implemented; the owner's account id added to `analytics_owners`; deploy the migration through the provisioning workflow; deploy `analytics-ingest`; flip `analytics.enabled` on; one-week data-quality check against GitHub Pages / search-console numbers | owner decisions, provisioning package | applied via Option B |

- **Deployment sequence [R]:** migration (provisioning workflow, rehearsal first) → Edge Function → dashboard page → client script with the switch off → privacy text → switch on → verify the Data health tab.
- **Coordination:** the analytics migration takes a number **after** the billing price-registration migration and goes into the next pinned package, so it doesn't disturb PR #27's frozen manifest.

---

## 11. Testing and launch-readiness checklist

**Security:**
- [ ] `anon` and `authenticated` cannot select, insert, update or delete any analytics table (privilege and policy self-test in the migration, plus a test).
- [ ] A non-owner signed-in user gets `42501` from every reporting function; the owner gets data.
- [ ] Reporting functions never return raw rows, IPs or user-agents; the date-range and row caps are enforced.
- [ ] The ingest endpoint rejects unknown events and properties, oversize batches, foreign origins and malformed JSON, and still answers `204`. Duplicate `event_id`s are inserted once.
- [ ] No stored value can contain calculator input: property allow-lists are tested with hostile payloads.

**Correctness:**
- [ ] Page-view counting, with live re-renders not counted.
- [ ] Session rules: 30-minute gap, midnight, new campaign.
- [ ] Engaged time: paused on hidden, blur and inactivity; capped; flushed on hide.
- [ ] Calculator start and completion on a sample from every lab, plus an automated sweep listing calculators where completion never fires.
- [ ] Rollup is idempotent; purge deletes only expired raw rows.
- [ ] Billing metrics are computed correctly from the PR #28 simulator data; test-mode rows are excluded in production.

**Resilience and performance:**
- [ ] Every calculator works with the endpoint down, slow or returning 500, with storage blocked, and with GPC on.
- [ ] Script size of 8 KB or less; no main-thread task over 50 ms; no layout shift.

**Privacy:**
- [ ] Privacy page updated: what is collected, why, retention, no sale or sharing, how to opt out.
- [ ] Consent decision implemented; GPC and DNT honoured.

**Launch:**
- [ ] The owner's account is in `analytics_owners`.
- [ ] The kill switch has been tested.
- [ ] The Data health tab is green for 7 days.
- [ ] Numbers are sanity-checked against an external count (for example Search Console clicks).

---

## 12. Open questions and owner decisions

1. **Consent approach** (the main one).
   - **(a)** No banner: a `localStorage` id, GPC and DNT honoured, the privacy page updated. Simplest; typical for US-focused sites, but weaker for EU/UK visitors.
   - **(b)** A banner shown only in the EU and UK. This needs a location signal the site does not have. **[A]**
   - **(c)** A cookieless mode by default (session-only ids, so no new-versus-returning or unique-visitor counts across days), with a persistent id only after the user opts in.

   **[R]** Choose (a) for launch if the audience is mainly North American, and revisit if AdSense is turned on for EEA traffic, which needs a certified consent tool anyway. This is not legal advice.
2. **Store search text?** It shows what people look for, including zero-result searches (useful), but text could occasionally contain personal data. **[R]** Yes, with the filters in 4.5.
3. **Raw-event retention:** **[R]** 90 days, dropping to 30 if traffic exceeds the free-tier estimate (6.3). Rollups are kept long-term.
4. **Account linking for the funnel** (9): one link row per account at trial click, to attribute subscriptions to acquisition channels. **[R]** Yes. It is limited to people who start checkout and is disclosed in the privacy page.
5. **Owner identity:** which `auth.users` id (Trent's sign-in email) goes into `analytics_owners`, and whether anyone else is ever added. **[R]** Trent only.
6. **[A] Traffic volume:** unknown today. It determines retention and whether the free database size is enough. Check it in the first week via the Data health tab.
