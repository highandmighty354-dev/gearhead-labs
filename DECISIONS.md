# Architecture Decision Record

Owner decisions and the implementation choices that follow from them. Newest first.

## D-006 · Engine migration proof standard (F1.11.0, implementation decision)

- A calculator is "migrated" to `GH_ENGINE` only after **LIVE_PARITY** passes (see ENGINE.md).
- The static DIFFERENTIAL suite is *not* sufficient: 44 of its 259 passes agree only at default inputs.
- Renderers keep their own math until a later step retires it, calculator by calculator, with parity re-proven after each change.

## D-005 · Categories: 50 is authoritative (owner, 2026-09-22)

- The Master Architecture's 50 categories stand.
- Reconciliation (`CATEGORY-RECONCILIATION.md`): the live page has all 50, and every one has live calculators.
- The spreadsheet shows 45 because its category cell is blank for all 26 diesel calculators, which belong to 6 live diesel categories: 50 − 6 + 1 blank = 45.
- No architectural category is empty, and no calculators were added.

## D-004 · understeer_gradient keeps its engineering definition (owner, 2026-09-22)

- Keep the id and the governing relationship: Kus = Wf/Cf − Wr/Cr (deg/g, axle weights in lb).
- Do not relabel as "Balance Index", and do not change its meaning silently.
- Add the vehicle-weight input the definition requires.
- **Status: not yet implemented.** Scheduled as its own step (M1.3) because it changes a live calculator's displayed value and its example. See HANDOFF "Next steps".

## D-003 · No mandatory Project level (owner, 2026-09-22)

- Hierarchy: User → Garage → Machine → Components → Labs → Test Setups → Calculations → Results.
- Machine (real or hypothetical) is the core personal engineering object. A Project relationship can be added later if a real need appears.

## D-002 · Canonical storage units = engine-native US/Imperial (owner, 2026-09-22)

- Stored value → engine → unit-conversion layer → user display preference. Storage units ≠ display units.
- Existing calculator-specific conventions are preserved.
- `GH_ENGINE` takes and returns native units and never converts.

## D-001 · Managed hosting (owner, 2026-09-22)

- GitHub for source, managed frontend hosting, Supabase + PostgreSQL for database / auth / RLS / storage, Stripe later.
- No self-managed servers.
- Stay portable: the engine is plain JavaScript with no vendor dependency, and runs identically in the browser and in Node.
