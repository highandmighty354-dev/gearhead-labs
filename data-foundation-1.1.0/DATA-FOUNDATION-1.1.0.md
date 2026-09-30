# DATA-FOUNDATION 1.1.0 — Value-Write Boundary Amendment

**Status:** implemented to the owner-approved design. Applied on top of the frozen `DATA-FOUNDATION-1.0.0`, which is unchanged.

**Authority** (verbatim copies in `design/`):

| Artifact | SHA-256 |
|---|---|
| `DATA-FOUNDATION-AMENDMENT-DESIGN.md` | `8c9260ad3eb2926f63279be0549b403b41d2020d4a4db62068c1d2bf03ca0883` |
| `DATA-FOUNDATION-1_1_0-OWNER-DECISION-RECONCILIATION.md` | `e5ccb53deaf168e085da1fca61ea54d0cb9211f288c1a0f28a604e805ebf03b3` |
| `DATA-FOUNDATION-1.1.0-TEST-RECONCILIATION.csv` | `de97cfc17ea69fe1184c43d57bd3b5bf1d66548471c7e528b45a588d3a0836db` |

Owner decisions applied: version `1.1.0`; −0 normalized to +0; service-role application code (no new SECURITY DEFINER function); this milestone precedes `VALUE-FOUNDATION-1.0.0`.

## 1. What changes in the database

Migration `supabase/migrations/0201_value_write_boundary.sql`, one transaction:

```sql
REVOKE INSERT ON public.value_records FROM authenticated;
DROP POLICY IF EXISTS df_values_insert ON public.value_records;
```

followed by post-conditions that abort the transaction unless: authenticated has no INSERT and still has SELECT; `df_values_insert` is absent; `df_values_select` is present; no INSERT-capable policy remains; the four value triggers are present.

**Nothing is created.** No table, column, trigger, function, index, constraint, enum or seed row. The suite proves this with a full catalog fingerprint: compared with a fresh 1.0.0 database, exactly two entries differ (the `value_records` ACL loses `a` for `authenticated`; the `df_values_insert` policy is gone).

**Rollback:** `supabase/rollback/0201_value_write_boundary.rollback.sql` re-grants INSERT and re-creates `df_values_insert` exactly as `0004_rls.sql:83`. It lives outside `migrations/` so no runner applies it as a forward migration (a second `0201_*` file there would collide with the version prefix). The suite proves the post-rollback catalog equals a fresh 1.0.0 database exactly, and that the 1.0.0 client INSERT (df.test.js:198) works again.

## 2. The trusted write path (`src/`)

After 0201 the only writer of `value_records` is server code using the service role, the pattern established by CALCULATION-FOUNDATION (D1/D6). No transport or authentication is implemented here: the caller passes the verified owner context.

| Step | Rule |
|---|---|
| W0 owner | `{ owner_id }` from verified login only; anything else → `VW_NO_OWNER` |
| W1 shape | closed key set; a request-supplied `owner_id`, `recorded_at`, `supersedes_id`, `calculation_id` or `option_value` → `VW_MALFORMED_REQUEST`; a missing `value` key is rejected (never unknown, zero or a default) |
| W2 field | must be in the configured admitted contract set → else `VW_FIELD_NOT_ADMITTED` |
| W3 context | `specification` only (V1 §J) |
| W4 component | NULL only (V1 is machine-level) |
| W5 provenance | `user_entered`, `manufacturer_specified`, `estimated`, `measured`, `unknown` (V1 §M); `calculated`, `derived`, `empirical` rejected |
| W6 value | `unknown` ⇔ `value: null` (stored as no value in the canonical unit). Known: a finite JS number (no string coercion), a supported unit, exact normalization |
| M1 machine | the exact CALCULATION-FOUNDATION `ACTIVE_MACHINE_SQL` (asserted byte-identical to its tag): owner's machine, not soft-deleted, garage not soft-deleted, `FOR SHARE OF m, g`. **Closes the frozen gap:** `df_value_validate` never checked soft deletion |
| C1 contract | the field's contract re-checked against `canonical_fields` (storage unit = `canonical_unit`, `numeric` kind) |
| L1 series | transaction advisory lock on (machine, field, context) → read the current head → INSERT with `supersedes_id = head` (savepoint; a `values_superseded_once` refusal is retried against the fresh head, max 3 attempts) |

The frozen triggers, constraints and composite foreign keys remain the database backstop for every row. The current-value read helper returns the newest non-superseded `specification` value for (owner, machine, field) — or `absent`. No provenance priority, active value, configuration version or `input_value_ids`.

### Normalization (`src/units.js`, spec §H)

Written from the approved exact definitions; no F1 page code is used (the suite asserts this statically). Multiply or divide by the exact defining factor only; no rounded reciprocal; **no rounding on write** (the binary64 result of the single operation is stored — e.g. 76.2 mm → 3.0000000000000004 in). Display rounding (§I) is presentation-only and absent from the write path.

| Storage unit | Accepted input units |
|---|---|
| `in` | `in`, `mm` (÷ 25.4) |
| `lbf` | `lbf`, `N` (÷ 4.4482216152605) |
| `gal` | `gal`, `L` (÷ 3.785411784) |
| `cc` | `cc`, `cu in` (× 16.387064) |
| `sq in` | `sq in`, `mm²` (÷ 645.16), `cm²` (÷ 6.4516) |
| `sq ft` | `sq ft`, `m²` (÷ 0.09290304) |
| `:1`, `°`, `kWh`, `TPI` | identity only |

Rejected, nothing stored: unsupported unit (tokens matched exactly), non-finite input, non-finite result, and an **out-of-range result — defined here as a nonzero input whose result is zero or subnormal** (it cannot be stored exactly and must not be flushed toward zero). −0 → +0; explicit zero stays a known zero; sign is otherwise preserved.

The −0 normalization happens in the service, before insert. (The suite observes it at the service→repository boundary: node-pg itself happens to send −0 as `"0"`, and the contract must not rely on that.)

### Field contracts

The service is configured with `[{ key, storage_unit }]` and refuses to start on an invalid configuration. **DATA-FOUNDATION-1.1.0 configures and seeds no production fields.** The 47-key admission set, its seed migration and its configuration belong to `VALUE-FOUNDATION-1.0.0`. The suite uses throwaway `TEST FIXTURE ONLY` fields (as DATA-FOUNDATION-1.0.0's own suite does), one per §H storage unit.

## 3. The 29 historical direct-insert tests

They remain historical evidence against 1.0.0 and still pass there (219/219; that suite never applies 0201). In 1.1.0 each is re-proven at two levels per the reconciliation CSV and tagged `[df:NNN S]` / `[df:NNN T]`:

- **S** — the same rule executed as service-role SQL after 0201: the frozen database rule is unchanged (including the generic rules V1 is stricter than: `empirical`, `operating_state`, calculated/derived links, categoricals).
- **T** — the trusted path enforces the V1 contract (and rejects those stricter cases).
- **Line 198** becomes the security test: the same authenticated INSERT now fails with 42501.

The suite also proves the CSV's 29 lines are **exactly** the client value-INSERT tests in `df.test.js` at the `DATA-FOUNDATION-1.0.0` tag — no more, no fewer.

## 4. Verification

```
cd data-foundation-1.1.0 && npm ci && ./tests/run-tests.sh      # PostgreSQL >= 14 server binaries (evidence: 16.15)
./data-foundation-1.1.0/tools/isolation-check.sh                # every foundation + this one (npm ci in each package)
```

Groups: integrity, migration, security, preservation (S), trusted-path (T), values, units, semantics, ownership, combined (1.0.0 + GARAGE 0101–0103 + 0201, with the frozen CALCULATION service loaded from its tag), reconciliation — plus 36 negative controls (service components, repository, migration and rollback text). Evidence: `evidence/`.

The frozen per-foundation isolation scripts are not gates after this milestone (each asserts that no later directory or tag exists); `tools/isolation-check.sh` validates their frozen baselines by files, tags, suites and evidence instead.

## 5. Open items carried forward (unchanged by this milestone)

- **#6 hosted Supabase:** confirm `service_role` table privileges and RLS bypass before deployment; keep the service-role key server-side only.
- Future approved phases (e.g. `operating_state`) must also write through the trusted path.
- `VALUE-FOUNDATION-1.0.0` needs its own authorization, the approved specification artifact, J-pipe engineering sign-off, and the finalized conversion table / 48-field seed.
