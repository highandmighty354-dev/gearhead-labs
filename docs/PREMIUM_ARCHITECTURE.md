# Gearhead Labs — Premium architecture (Phase 3A)

> **Superseded (database layer), 2026-10-05.** The Phase 3A schema `supabase/migrations/0001_premium_schema.sql` is retired (`docs/retired/phase-3a/RETIRED.md`). The database is defined by PREMIUM-FOUNDATION (`premium-foundation/PREMIUM-FOUNDATION.md`, migrations `0401`–`0406` on top of the frozen foundations). The `premium/` frontend described here still targets the retired tables and must be adapted before use.

## Layers

```
index.html  (product shell — parent page)
│
├── premium/shell.js ............ navigation, router, views, gating (UI only)
│     │ reads/writes only through ↓
├── premium/services.js ......... auth · ENTITLEMENT SERVICE · repositories · event bus
│     │ one adapter per page load ↓
├── premium/adapters/
│     ├── dev-local.js .......... DEVELOPMENT: mock auth + mock entitlement, browser-local tables
│     └── supabase.js ........... PRODUCTION: Supabase Auth + PostgreSQL + RLS (anon key only)
│     (built-in "none" adapter .. production without a backend: no accounts, everyone FREE)
├── premium/models.js ........... schemas, enums, validation, evaluateEntitlement(), analyzer manifest
├── premium/engineering-bridge.js  loads/opens E01–E14 in the engine; captures/restores JSON state
│
└── #app iframe → F1.12.3 calculator engine (unchanged)
      ├── 606 Free calculators
      └── engineering-expansion-v1.js (E01–E14) — injected by app-shell.js ONLY when
          the entitlement service grants `engineering_lab`

supabase/migrations/0001_premium_schema.sql — tables, RLS, has_premium(), signup trigger
```

> This diagram describes the frozen F1.12.3 file, which this document's own architecture never shipped against live.
> The current live engine is F1.12.4, and since 2026-10-06 it is 585 Free calculators + 21 migrated to Premium (also
> gated by app-shell.js, visible but locked for non-Premium), not 606 Free. Since 2026-10-07 a further 18 net-new
> Premium Calculator Expansion calculators (no Free companion, same gating) have shipped, batch by batch, growing
> that 606 calculator-kind total — see `docs/PREMIUM-CATALOG.md` for the current, authoritative split and count.
> The 14-tool Engineering Lab is otherwise unchanged from this diagram's shape.

## Adapter selection

| Condition | Adapter | Accounts | Entitlement source |
|---|---|---|---|
| `localhost`, or `?gh_dev=1` while `development.allowQueryFlag` is true | development | mock sign-in (email only) | mock, set in Profile → Development tools |
| `GHP_CONFIG.backend.url` + `anonKey` set | supabase | email magic link | `entitlements` table (read-only to clients) |
| neither | none | unavailable | always FREE |

`?gh_dev=0` turns development mode off for the session, including on localhost.

## Entitlements

`GHP.models.evaluateEntitlement(row, source)` is the only function that decides access.
Premium = plan `PREMIUM` or `PREMIUM_TRIAL`, status `active`/`trialing`, and not past `expires_at`.
Premium features: `engineering_lab`, `garage`, `projects`, `saved_analyses`.
The UI asks `GHP.services.entitlements.has(feature)`; repositories check the same service
before every Premium read/write. In production the database enforces it again (`has_premium()` in RLS).

## Security notes

* No secrets in the frontend. `premium/config.js` holds only the public Supabase URL and anon key.
* Clients cannot write entitlements (no RLS write policy, privileges revoked). A future Stripe
  webhook running with the service role writes them.
* The analyzer JavaScript is public static code. Gating controls who gets the Engineering Lab UI and
  who can store data; it cannot hide client-side source. Moving analyzers server-side would be a separate decision.
* Before launch: set `development.allowQueryFlag` to `false`.

## Connecting Supabase

1. Create a project; run `supabase/migrations/0001_premium_schema.sql`.
2. Enable email (magic link) auth; add the site URL to the redirect allow-list.
3. Put the project URL and **anon** key in `premium/config.js`; set `allowQueryFlag: false`.
4. Grant Premium from a server context (SQL editor / service role) until Stripe is wired:
   `update public.entitlements set plan='PREMIUM', status='active', provider='manual' where user_id='…';`
