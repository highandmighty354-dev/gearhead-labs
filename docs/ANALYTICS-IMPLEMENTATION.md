# First-party analytics and owner dashboard — implementation record

**This is the authoritative operational record** for the analytics in PR #29 (branch `feature/analytics-dashboard`).
`docs/ANALYTICS-BLUEPRINT.md` is the original plan; where the two differ, this document describes what was actually
built (§10 lists the differences).

| | Status (2026-11-09) |
|---|---|
| Code, database migration, tests | Implemented and tested on a throwaway local database and in a real browser, using **synthetic traffic only** |
| PR #29 | **Draft, unmerged** |
| Deployment | **Nothing deployed.** Migration 0501 not applied to any hosted database |
| Website tracking | **Disabled** (`analytics-config.js`: `enabled: false`) |
| Real-world validation | **None** — no real visitor traffic has ever reached this system |
| Release blocker | Migration 0501 is outside the locked migration package (§9) |

Labels used below: **Implemented** (in the code), **Tested** (a test in §8 exercises it), **Untested** (built, not
exercised), **Proposed** (not built), **Awaiting owner decision** (§11).

---

## 1. Files

| Part | File(s) |
|---|---|
| Database | `supabase/migrations/0501_analytics.sql`; rollback `supabase/rollback/0501_analytics.rollback.sql` (removes all analytics objects **and all analytics data**) |
| Receiver (Supabase Edge Function) | `supabase/functions/analytics-ingest/index.ts` (reads settings) + `supabase/functions/_shared/analytics-ingest.js` (the logic) |
| Website tracking | `analytics.js`, `analytics-config.js`, two script tags in `index.html` |
| Owner dashboard | `owner/analytics.html`, `owner/analytics.js`, `owner/analytics.css` |
| Tests | `premium-foundation/tests/analytics.test.js`, `premium/tests/analytics-client.test.js`, `premium/tests/analytics-dashboard.test.js`; results in `premium-foundation/evidence/analytics-*.json` |

---

## 2. How it works

```
 Visitor's browser                     Supabase Edge Function            Database (0501)                         Owner
 ─────────────────                     ──────────────────────            ───────────────                         ─────
 analytics.js watches the page   ──►   analytics-ingest            ──►   analytics_ingest()  (service role only)
 (page key, clicks, calculator         • drops if switched off           • rate limits (shared)
  start / completion, engaged time)    • CORS check on Origin            • environment cross-check
 batches ≤ 20 events, ≤ 8 KB           • stamps ITS OWN environment      • validates every event
 sendBeacon / fetch, no cookies          (ANALYTICS_ENV)                  ──► analytics_events (raw, 90 days)
                                       • always answers 204                         │
                                                                         rollup (pg_cron every 15 min, or Refresh)
                                                                          ──► analytics_sessions / analytics_daily /
                                                                              analytics_visitors
                                                                                    │
                                                         owner-only report functions (aggregates only) ◄── owner/analytics.html
                                                         analytics_billing_metrics() reads the existing  (signed-in owner)
                                                         billing tables (0402) — never analytics events
```

**Website → receiver (Implemented, Tested).** When switched on, `analytics.js` gives each page a short key (`home`,
`calc:<id>`, `lab:<key>`, `page:<name>`, `view:<premium view>` — never a URL or query string), records the events in §4–5,
and sends them in batches every 15 seconds, on navigation and when the tab is hidden. It never calls or alters calculator
code; every handler is wrapped so a fault cannot reach the page. The queue holds at most 50 events and backs off when the
receiver is unreachable.

**Receiver → database (Implemented, Tested).** The Edge Function has no sign-in check (a page-close beacon cannot send one).
It forwards the batch to `analytics_ingest()` with the environment **it** is configured for, the sender's network address
(for rate limiting only), the browser family and a bot flag. It always answers `204` with no body.

**Storage and summaries (Implemented, Tested).** Valid events go to `analytics_events`. The rollup rebuilds each day's
sessions (a gap of more than 30 minutes, or New York midnight, starts a new one), daily totals, and each visitor id's
first and last recorded day. It is safe to re-run.

**Reporting (Implemented, Tested).** The dashboard signs the owner in with the site's existing Supabase sign-in, then calls
database functions that return **totals only** and refuse anyone not listed in `analytics_owners` (§3.6).

**Billing kept separate (Implemented, Tested).** Revenue figures come from the billing tables created by migration 0402
(`subscriptions`, `stripe_events`, `plan_prices`), which PR #28's webhook fills. No analytics event is ever treated as a
payment. A subscription is counted only if a Stripe event marked `livemode: true` refers to it; until one exists the
dashboard shows **"Pending"**, so Stripe test-mode data can never appear as revenue.

**Test, development and live data kept apart (Implemented, Tested).** Every stored row carries an environment (`live`,
`test` or `dev`) chosen by the receiver's setting (§3.2). Every report is for one environment; the dashboard has a
Live / Test / Dev selector and shows a "TEST DATA" banner when not on Live.

---

## 3. Security, abuse controls and limitations

### 3.1 What the Origin header does and does not establish
Origin is the "which website sent this" header. The receiver uses it **only for browser permissions (CORS)**: browsers on
other websites are refused, and requests from unlisted origins are dropped. **It is not authentication.** Any script can
send the real site's Origin. Origin, Referer and User-Agent are all supplied by the sender and prove nothing about who sent
the request.

### 3.2 Environment chosen by the server
- The receiver stores every event under its own `ANALYTICS_ENV` setting (`live`, `test` or `dev`). Nothing in the request
  — Origin, headers or body — can change it. *(Implemented, Tested)*
- The page also states its environment (`env` in `analytics-config.js`), but only as a cross-check. If it differs from
  the receiver's setting, or is missing, the **whole batch is rejected** and counted in Data health as `env_mismatch`.
  An individual event cannot carry its own environment field (rejected as `unknown_field`). *(Implemented, Tested)*
- If `ANALYTICS_ENV` is missing or not one of the three values, the receiver **accepts nothing**: it answers `204` and
  sends nothing to the database (so these requests are not counted anywhere). *(Implemented, Tested)*
- A separate switch, `ANALYTICS_INGEST_ENABLED=true`, must also be set, or every request is dropped the same way.

### 3.3 A public receiver cannot prove a real person sent an event
The receiver must accept anonymous requests, because ordinary visitors are not signed in. A random browser id and
request validation are **not** proof of a human. **A script that reproduces acceptable browser headers and the event format
can submit events that are stored exactly like a real visitor's, up to the limits below.** A test demonstrates this on
purpose. Someone could therefore inflate live figures within those limits. None of the controls here are fraud-proof,
bot-proof, or human verification. Stronger options are an open owner decision (§11, decision 8); none is built.

### 3.4 Shared rate limits, kept in the database (Implemented, Tested)
| Limit | Value | Counted per |
|---|---|---|
| Per sender, short | **600 events per 10 minutes** | sender network: an IPv4 address, or an IPv6 /64 block (so rotating addresses within one connection does not escape it) |
| Per sender, daily | **5,000 events per day** (New York day) | same |
| Overall | **60,000 events per hour** | each environment separately |

- The counters live in the `analytics_rate` table, so every running copy of the receiver shares them.
- Each batch is counted **before** it is checked, so rejected batches (including environment mismatches) still use up
  the sender's quota. A batch that would exceed any limit is rejected whole and counted as `rate_limited` in Data health.
- The values are in `analytics_limits()` and are starting values (§11, decision 9).
- Senders whose network address cannot be read share one bucket called `unknown` (see §12, item 2).

### 3.5 How sender networks are scrambled and deleted (Implemented, Tested)
- The database keeps one random value (a "salt") per New York day in `analytics_rate_salt`.
- The counter key is a one-way code: `sha256(today's salt | network)`. The same network gets an unrelated code the next
  day. The address itself is never written to any table (a test scans every analytics table for it).
- The address does pass, unstored, through the Edge Function and the database call.
- Salts older than yesterday and counters older than two days are deleted **by the daily purge job**. This depends on
  `pg_cron` running (§12, item 1). Anyone with full database access could, while a salt still exists, try every IPv4
  address against a code; deleting the salt after two days ends that possibility.

### 3.6 The in-memory limiter in the receiver (Implemented, Tested)
Each running copy of the Edge Function remembers, in its own memory, how many **requests** (not events) each address sent
in the current minute and refuses more than 120. This only spares the database from obvious floods hitting that one copy.
**It is not a shared or site-wide limit:** Supabase may run several copies and restart them at any time, and each
starts empty. It also forgets everything once it is tracking more than 10,000 addresses. The database limits (§3.4) are
the shared ones.

### 3.7 Other controls
| Control | Status |
|---|---|
| Event validation: only catalogued events and listed properties of the right type and size; hostile content (markup, look-alike characters, `__proto__`, injection strings, oversize data) rejected with a counted reason | Implemented, Tested |
| Duplicate suppression by event id | Implemented, Tested |
| Per-session cap: 500 events per 24 hours | Implemented, Tested |
| Bot flag: known bot / tool browser names, the browser's automation flag, and in the rollup any session with > 300 events or > 30 page views at > 30 a minute. Bot sessions are left out of every figure and shown in Data health | Implemented, Tested (best-effort: a script can avoid all of these signs) |
| Size and batch caps: ≤ 20 events, ≤ 8 KB | Implemented, Tested |

### 3.8 Owner access and aggregate-only reporting (Implemented, Tested)
- All nine analytics tables have row-level security on and forced, with no access rules, and no privileges for the
  public (`anon`), signed-in users (`authenticated`) or the service role. Nobody using the website's keys can read raw
  events, sessions, visitor records or counters. The migration refuses to finish if that ever changes.
- Raw events cannot be edited or deleted except by the purge job.
- The dashboard's data comes only from `analytics_dashboard()`, `analytics_refresh()` and `analytics_billing_metrics()`.
  Each refuses (error 42501) unless the signed-in user is listed in `analytics_owners`. That list starts empty; adding
  the owner is an owner action (§11, decision 4).
- These functions return totals only. Being signed in, being Premium, or knowing the page address gives nothing.
- The dashboard page is not linked from the site and is marked `noindex`; that is housekeeping, not the protection.

### 3.9 What is never collected (Implemented, Tested)
Calculator inputs and results, search words, email addresses, account ids (no link between a browser's visits and a
Supabase account), IP addresses, full browser descriptions, full URLs or query strings, payment details, and browser
fingerprints. Under Global Privacy Control or Do Not Track the visitor id lasts only for the browsing session.

---

## 4. Calculator tracking

### 4.1 Definitions (Implemented, Tested)
- **Start:** the first *trusted* interaction — a real keystroke, click or selection — inside the calculator, once per
  calculator view. Inputs filled by scripts are ignored.
- **Completion** is recorded only when **all** of these hold:
  1. there was a trusted interaction;
  2. the calculator recalculated (its display changed) after that interaction;
  3. 2 seconds after the last interaction, at least one result shows a valid finite number;
  4. no result shows NaN, Infinity, or error / invalid text;
  5. no completion has already been recorded for this calculator view.

  If the result appears late (up to 30 seconds after the last interaction), it is checked again shortly after it appears.
- **Abandonment:** a start with no completion in the same calculator view (worked out in the rollup).
- A default result already on screen before anyone types never counts.

### 4.2 What counts as a valid result
The detector reads the result boxes the calculators use (`.result-value` and `.mini-result .value`), ignoring the unit
label. Accepted: whole numbers, decimals, thousands separators, signs (including the "−" character), currency, "~" and "≈",
ratios (14.7:1), fractions, scientific notation, with any unit. Not accepted: empty, "—", placeholders ("Enter…",
"Select…"), NaN, Infinity, error / invalid text, and text-only results. With several result boxes, one valid number is
enough unless another shows NaN, Infinity or an error. Warnings or notes shown **outside** the result boxes are not checked.

The result text is only sorted into categories inside the browser. **Neither result text nor calculator inputs are ever
sent**; a completion carries only the calculator id, the number of fields touched and the time taken.

### 4.3 Verified coverage
Each calculator in the catalogue was opened in the real site, a value was put into its first field by script, and the
detector's verdict on the result was recorded. This checks the result formats; the real-typing tests in §8 cover the
start and trusted-input rules.

| | Count |
|---|---|
| Free calculators inspected | **585** |
| Accepted by the completion detector | **573** |
| Do not currently produce completion events (starts and abandonment still recorded) | **12** |
| Premium calculators | **172 — not checked** (the free site shows them as locked) |

By LAB: diesel 42 of 42, EV 39 of 39, towing 26 of 27, gasoline 159 of 162, universal 307 of 315.

| Reason | Calculators |
|---|---|
| No input fields | `christmas_tree`, `ct_push_loose`, `resistor_color`, `rotor_heat` |
| Different result layout (not in the standard result boxes) | `cam_card`, `sim_braking`, `sim_gear_rpm`, `sim_weight_transfer`, `universal_automotive_converter` |
| Text-only result (no number to check) | `nitrous_jet`, `octane_for_cr`, `trailer_sway` |

This does **not** mean all 757 calculators are verified.

---

## 5. Visitors and the daily summaries

### 5.1 Definitions (Implemented, Tested)
For any reporting period:
- **Visitors:** distinct anonymous visitor ids active in the period.
- **New:** of those, ids **first recorded during** the period.
- **Returning:** of those, ids **first recorded before** the period.

Every active id was first recorded either before the period or during it, never both, so **new + returning = visitors**
exactly. The first recorded day comes from the database (`analytics_visitors`), not from anything the browser reports;
the page's own "new visitor" flag is still stored but is not used for these figures. Bot-only ids are never recorded.

**Known effects:** a person who clears their browser storage, blocks storage, or uses Global Privacy Control / Do Not
Track gets a new anonymous id and is counted as **new** each time. The same person on two devices counts twice. An id not
seen for 13 months is forgotten and would count as new.

### 5.2 Daily summary catch-up (Implemented, Tested)
`analytics_rollup_pending()` rebuilds every day whose events arrived after that day was last summarised, plus today. It
runs every 15 minutes through `pg_cron`, and whenever the owner presses Refresh. This matters because a visitor's "first
recorded day" and the daily totals are only correct if no day was skipped: if the scheduled job stops for a while, the
next run fills the gap instead of leaving holes. It can only rebuild days whose raw events are still kept (90 days).

### 5.3 Other definitions (Implemented, Tested)
Session: ends after 30 minutes without events or at New York midnight. Engaged time: counted only while the tab is
visible, focused and used within the last 30 seconds; at most 30 minutes per page view. Engaged session: ≥ 10 s engaged,
≥ 2 page views, or a key event. Channel: campaign (UTM tags), direct, organic search, social, AI assistant or referral,
from the referring site's host name only. The Premium funnel counts each step per session independently, not as a strict
ordered sequence.

### 5.4 Retention (Implemented; runs only with pg_cron)
Raw events 90 days (each day is summarised again first); sessions, ingestion counters and visitor first-seen days 13
months; daily totals kept; rate counters and salts about two days.

---

## 6. Events sent by the website

| Event | Sent when | Properties (nothing else is accepted) |
|---|---|---|
| `page_view` | the page key changes | at session start: `is_session_start`, `is_new_visitor`, `ref_host`, `utm_*` |
| `page_leave` / `page_ping` | leaving a page / every 5 minutes on it | engaged milliseconds not yet reported |
| `nav_click` | a click followed by a page view within 3 s | `to_page`, `element` type |
| `search` | 1.5 s after typing stops | `result_count`, `clicked_rank` — never the words |
| `calc_view` / `calc_start` / `calc_complete` | §4 | `calc_id`; completion adds `fields_touched` (a count) and `ms_to_complete` |
| `premium_gate_view`, `premium_offer_view`, `signin_request`, `signin_complete`, `trial_click`, `checkout_redirect`, `checkout_return`, `portal_open` | Premium funnel steps | interval / outcome / signed-in flag only |

`signin_complete` is detected by a Supabase session appearing in the browser (only the storage key's name is checked).
`trial_click` and `portal_open` rely on PR #28's button attributes, which are not on `main`. `calc_unit_toggle`,
`calc_help_open` and scroll depth are accepted by the database but not sent.

---

## 7. The owner dashboard
Sections: Overview (with previous-period comparison), Pages, Traffic, Calculators (including LAB comparison and
never-viewed free calculators), Engagement, Premium funnel, Revenue (Pending until live Stripe data), Data health
(accepted, rejected by reason, duplicates, rate-limited, bot, browser-side errors and drops, last event, last summary).
Periods: 7, 30, 90 days, 12 months, custom (up to about 13 months). Charts are drawn in the page; no charting library.
Black-and-gold, owner-only, not linked from the site.

---

## 8. Tests and evidence

**All test traffic is synthetic.** Database tests use made-up events in a throwaway local PostgreSQL 16 database. Browser
tests drive a real Chromium browser against the real site files, with the receiver faked inside the browser. The dashboard
test uses a fake Supabase service whose report is the real output of the database function on made-up data. None of
these figures describe real visitors.

| Suite | Result | What it runs on |
|---|---|---|
| Analytics database (`analytics.test.js`) | **21/21** | Real database permissions and row-level security; the receiver's logic end to end against the database |
| Website tracking (`analytics-client.test.js`) | **26/26** | Real browser, real calculators, fake receiver; includes the calculator-completion cases and the 585-calculator check |
| Dashboard (`analytics-dashboard.test.js`) | **12/12** | Real browser, real sign-in library, fake Supabase service |
| Frontend checks (`frontend.test.js`) | **55/55** | Static checks of site files |
| Existing database suite (`pf.test.js`, run with `TZ=UTC`) | **46/48** | Real database |

**The two existing-suite failures.** On current `main` the suite reports 47/48: its one failure is that migration 0409 is
in the folder but not in the suite's list of migrations. For 0501 to be accepted the list must include 0409. Adding only
0409 to the list on `main`, with none of the PR #29 changes, produces the same two failures seen here. Both are checks
whose expected counts were written before 0409 (it adds one formula version: 582 instead of 581). They are not caused by
analytics, and the suite does not pass completely. Without `TZ=UTC` a third, time-zone-only failure appears on any branch.

**Not re-run:** the site smoke test (`browser-smoke.js`) was not re-run after the corrections because the site's script
list did not change (it passed 19/19 before them).

**Not tested:**
- hosted Supabase integration (the Edge Function under Supabase's runtime, the database call through Supabase's API,
  `pg_cron`, and what address information Supabase's front end passes to the function);
- page-close event delivery against a hosted environment;
- real magic-link sign-in;
- real-world traffic;
- Premium calculators in the completion check.

Performance: 40 real keystrokes in a calculator took a median 422 ms with tracking off and 458 ms with it on, within the
run-to-run spread. No slowdown was detectable beyond that noise.

---

## 9. Deployment boundary

- PR #29 is a **draft** and is **not deployable** yet.
- Migration 0501 is **not** in the locked 19-file migration package. PR #27 is the separate, approval-gated workflow that
  applies that package. PR #29 cannot be deployed through it until adding 0501 to the package is separately done and
  approved. 0501 must not be applied by hand.
- No hosted database, production setting, production secret, live website or live analytics setting has been changed.
- Tracking remains disabled.

Once that dependency is resolved, enabling it would take, each with owner approval: enabling `pg_cron`; deploying
`analytics-ingest` with sign-in checking off and the settings `ANALYTICS_ENV`, `ANALYTICS_ALLOWED_ORIGINS` and
`ANALYTICS_INGEST_ENABLED=true`; adding the owner to `analytics_owners`; updating the Privacy page; and setting the
receiver address, a matching `env` and `enabled: true` in `analytics-config.js`. A trial run would use `test` in both
places before switching both to `live`.

---

## 10. Differences from the blueprint

| Topic | Blueprint (plan) | As built |
|---|---|---|
| Environment | Not specified; Origin allow-list only | Fixed by the receiver's `ANALYTICS_ENV`; page value only cross-checked; Origin is CORS only |
| Rate limits | In-memory per address, plus per-session cap | Shared database limits (per network, per day, per environment) plus the per-session cap; in-memory limiter kept as a per-copy first line |
| New vs returning | Flag sent by the browser | First recorded day kept in the database |
| Completion | `.result-value` with a finite number after 2 s | Also `.mini-result .value`; requires a recalculation after the input; rejects NaN / Infinity / error; late results re-checked |
| Search words | Recommended to store, filtered | Not stored (open decision 6) |
| Account linking for the funnel | Recommended at trial click | **Not built**; no visitor activity is linked to accounts |
| Report functions | Several separate functions | One owner-checked report function plus refresh and billing functions |
| Rollup schedule | Nightly | Every 15 minutes, with catch-up |

---

## 11. Outstanding owner decisions (none made)

| # | Decision | Notes |
|---|---|---|
| 1 | Consent approach | Built: Privacy-page notice with GPC / DNT honoured. A consent banner is not built. Take advice if EU / UK visitors matter |
| 2 | Privacy page wording | Must describe the analytics before launch. Draft below; not approved |
| 3 | Data retention | Built values: raw 90 days; sessions and visitor first-seen days 13 months; daily totals indefinitely |
| 4 | Owner account id | The Supabase user to list in `analytics_owners` |
| 5 | Allowed website origins | Suggested `https://www.gearhead-labs.com`, `https://gearhead-labs.com` (CORS only) |
| 6 | Collect search words? | Not collected now |
| 7 | Reporting time zone | America/New_York is built in |
| 8 | Visitor authenticity | (a) accept best-effort figures and cross-check against Google Search Console and Stripe; (b) add a free human-check service such as Cloudflare Turnstile — a third party, a Privacy-page mention and a site change; (c) count only signed-in visitors — conflicts with the no-account-linking rule. **Current recommendation: (a). This is a recommendation, not an approval.** Only (a) is in place |
| 9 | Rate limits | Keep 600 / 10 min, 5,000 / day per sender and 60,000 / hour overall, or adjust if Data health shows legitimate visitors being blocked (offices and mobile networks put many people behind one address) |

Draft Privacy-page wording (decision 2, not approved): *"We measure how our site is used with our own first-party
analytics: which pages and calculators are opened, whether a calculator produced a result, how visitors arrived (the
referring site or campaign tag) and time spent. We never record what you type into a calculator, your search words, your
IP address or your email. A random identifier is kept in your browser for up to 13 months (only for the current visit if
your browser sends Global Privacy Control or Do Not Track). Raw records are deleted after 90 days; only daily totals are
kept. To limit abuse, the sending network is checked against short-lived counters keyed by a one-way code that changes
daily; the address itself is not kept."*

---

## 12. Implementation points found while writing this record (not changed)

These are reported for the next engineering pass; no code was changed in this documentation update.

1. **Clean-up depends on `pg_cron`.** All deletion — raw events after 90 days, 13-month data, and the two-day salts and
   rate counters — runs only in the daily `analytics_purge()` job. The owner's Refresh button catches up the summaries
   but does not purge. If `pg_cron` is not enabled, nothing is ever deleted, and the retention and two-day promises do
   not hold. If `pg_cron` is enabled after 0501 is applied, the migration's scheduling step has to run again.
2. **Senders with no readable address share one bucket.** If the function cannot read the sender's address, both the
   in-memory and database limits put that request in a shared `unknown` bucket, so many visitors could be throttled
   together. What address information Supabase passes to the function is untested.
3. **Rejected batches use up quota.** Rate counting happens before the environment cross-check, so a misconfigured page
   (wrong `env`) also uses up its sender's limits.
4. **The in-memory limiter counts requests, not events**, and resets entirely when it is tracking more than 10,000
   addresses.
5. **Error messages outside the result boxes are not checked** by the completion detector (§4.2).
