# Retired: Phase 3A Premium schema (`0001_premium_schema.sql`)

**Status:** retired 2026-10-05. **Never applied** to any database. Kept here, renamed to `.sql.retired`, so its history and reasoning stay reviewable.

## Why it was retired

The Phase 3A schema (commit `802f38d`) was written before the existing database foundation (tag `VALUE-FOUNDATION-1.0.0`) was found. Its architecture conflicts with that foundation and with the owner's decisions.

1. **Version collision.** In `supabase/migrations/` it would be version `0001`, the same as the frozen `0001_enums.sql`. The Supabase CLI keys migrations by version, so the two cannot coexist.
2. **Competing model.** It defined `vehicles`, `builds` and `projects`. The approved hierarchy is User → Garage → Machine → Test Setup (D-003): Vehicle = `machines`, Build = `test_setups`, and Projects are deferred.
3. **A weaker entitlement model.** It used a single mutable `entitlements` row per user. PREMIUM-FOUNDATION uses append-only `entitlement_grants` written only by trusted server code (D-001), with Stripe-ready billing tables beside them.
4. **No foundation conventions.** It lacked composite owner FKs, server-forced timestamps, append-only history, forced RLS and narrow column grants.

## What replaced it

`supabase/migrations/0401`–`0406` (PREMIUM-FOUNDATION 1.0.0), applied on top of the frozen foundation migrations `0001`–`0005`, `0101`–`0103`, `0201` and `0301`. See `premium-foundation/PREMIUM-FOUNDATION.md`.

## How it was retired

`git mv supabase/migrations/0001_premium_schema.sql docs/retired/phase-3a/0001_premium_schema.sql.retired`

The new extension stops the Supabase CLI from picking it up. `git log --follow` on the new path shows its full history. The Phase 3A frontend (`premium/`) still has a development adapter written against the retired tables; it must be re-targeted to the PREMIUM-FOUNDATION tables before any production use.
