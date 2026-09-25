# GARAGE-FOUNDATION 1.0.0

The structural Test Setup persistence layer. It comes after
CORE-ENGINE-BASELINE → DATA-FOUNDATION → MAPPING-FOUNDATION in the approved sequence. Earlier decision #25 approved
building it before the Calculation API.

**Approved structure:** Account → Garage → Machine → **Test Setup**. It is additive only (earlier decision #26). Labs are deferred (#27). The
Test Setup is the minimum pinned model (#28).

The frozen baselines are consumed **read-only** and never altered:

| Baseline | Tag and commit |
|---|---|
| F1 | `F1.12.3-UI-MOBILE-HEADER` @ `257b2cc` (page SHA-256 `02b0ceee…ec102c27`) |
| Data foundation | `DATA-FOUNDATION-1.0.0` @ `fbcebc4` |
| Mapping foundation | `MAPPING-FOUNDATION-1.0.0` @ `6421eef` |

## Scope

It covers one new table, `public.test_setups`, and everything that protects it:
- its triggers
- its RLS policies and grants
- two fixed-table `SECURITY DEFINER` functions (soft delete, explicit re-pin)
- a deterministic test suite with negative controls
- an isolation gate

**Not in this milestone:**
- Test Setup engineering values or deltas, conditions, measurements, calculator inputs
- calculations, results or recalculation (no Calculation API, write path or dependency resolution)
- Labs, of any kind
- machine or component revision history (#31 stays open)
- comparison, export, sharing
- UI, authentication implementation, hosted provisioning
- Premium, entitlement, Stripe
- localStorage migration
- the F1 profile-overwrite defect
- any change to a frozen baseline

## Run it

```
cd garage-foundation
npm install                 # pg 8.13.1 (pinned in package-lock.json)
npm test                    # = ./tests/run-tests.sh (throwaway local PostgreSQL >= 14)
./tools/isolation-check.sh  # needs `npm install` at the root, in data-foundation/ and in mapping-foundation/
```

**What the runner does:**
1. Starts a throwaway PostgreSQL cluster.
2. Reads the test-only shim and migrations `0001`–`0005` **from the `DATA-FOUNDATION-1.0.0` tag** (`git show`).
3. Applies them, then applies `0101`–`0103`.
4. Runs the suite and the negative controls, then deletes the cluster.

## Migrations (`supabase/migrations/`, idempotent, applied after DATA-FOUNDATION 0001–0005)

| File | Contents |
|---|---|
| `0101_test_setups.sql` | the `test_setups` table, its constraints and indexes |
| `0102_test_setups_triggers.sql` | server-forced timestamps and baseline pin; immutability guard; hard DELETE refused |
| `0103_test_setups_rls.sql` | RLS enabled and forced, narrow grants, owner policies, `gf_soft_delete_test_setup`, `gf_repin_test_setup_baseline` |

The `01xx` series sorts after DATA-FOUNDATION's `0001`–`0005` and cannot collide with it.

## The Test Setup

| Column | Type | Rule |
|---|---|---|
| `id` | uuid PK, `gen_random_uuid()` | immutable; server-generated for clients (not in the client INSERT grant) |
| `owner_id` | uuid NOT NULL, default `auth.uid()`, FK → `accounts` | immutable; never client-supplied (not in the client INSERT grant); RLS requires `= auth.uid()` |
| `machine_id` | uuid NOT NULL | composite FK `(machine_id, owner_id)` → `machines(id, owner_id)`: can never attach to another owner's machine; immutable |
| `name` | text NOT NULL, not blank | editable |
| `description` | text NULL | editable |
| `notes` | text NULL | editable |
| `baseline_pinned_at` | timestamptz NOT NULL | the **pinned baseline reference**; server-stamped at creation; moves only by explicit re-pin |
| `created_at` | timestamptz NOT NULL | server-forced; immutable |
| `updated_at` | timestamptz NOT NULL | server-forced on every update |
| `deleted_at` | timestamptz NULL | set only by the Decision B-style function (clients have no grant) |

Every column comes from the approved list (#28 and the implementation approval). **No other field is added.** In particular there are no engineering values, inputs, conditions, measurements, results, Lab ids, or Premium, sharing, export or API fields.

`UNIQUE (id, owner_id)` follows the DATA-FOUNDATION pattern for owned rows: it lets a future child reference a Test Setup with a same-owner composite key. Name uniqueness is **not** imposed: no source requires it.

### Baseline semantics

**The gap.** The frozen schema has no immutable structural baseline identifier: machines and components are updated in place and have no revision. Earlier decision #28 forbids inventing a revision system.

**The pin.** The smallest additive representation is a **server-stamped pin time**, `baseline_pinned_at`:
- It is the same server clock (`now()`) that stamps every frozen DATA-FOUNDATION row: `value_records.recorded_at`, `components.created_at` / `deleted_at`, `component_connections`.
- It captures **no engineering values** and **no snapshot**.

**How it is set and moved:**
- **Creation:** the pin is set to the server time of the creating transaction. No role can choose it: the insert trigger overwrites any supplied value.
- **Machine changes never move it.** A Test Setup stores no machine state. It holds a fixed reference and never reads "current machine" as its baseline.
- **Explicit re-pin:** `gf_repin_test_setup_baseline(p_id uuid)` is the only client path. It moves the pin to the server time of the calling transaction.
- **Every role:** the update trigger refuses any pin change unless the new value equals the current transaction's server time, and refuses any pin change on a soft-deleted row. So the pin can never be back-dated, client-chosen or moved on a deleted setup.
- **Privileged server roles** (`service_role`, superuser) can re-pin only to server time. This matches DATA-FOUNDATION, where the service role is the controlled server path.
- **Same transaction:** a re-pin in the same transaction as the creation (or an earlier re-pin) leaves the value unchanged, because `now()` is the transaction's start time.

**Known limit (#31, open):** machine and component *attribute* edits (type, propulsion, manufacturer, …) are not versioned. A pin time cannot reconstruct them. Values and component membership can be reconstructed as of the pin, because those frozen rows are append-only or timestamped.

### Editability and immutability

| Operation | Client (`authenticated`) | Every role (trigger) |
|---|---|---|
| change `id`, `owner_id`, `machine_id` | refused: no column grant (42501) | refused: `GF_IMMUTABLE` (P0001) |
| change `created_at` | no grant | silently restored (DATA-FOUNDATION pattern) |
| change `name`, `description`, `notes` | allowed on own active rows | `updated_at` refreshed |
| change `baseline_pinned_at` directly | refused: no grant | allowed only to the transaction's server time, never on a deleted row (`GF_BASELINE`) |
| set `deleted_at` directly | refused: no grant | not restricted beyond DATA-FOUNDATION's pattern |
| INSERT with `deleted_at` set | no grant | refused: `GF_IMMUTABLE` |
| hard DELETE | refused: no grant | refused: `GF_IMMUTABLE` (soft delete only) |

**Deviation from DATA-FOUNDATION:** clients get a **column-level INSERT grant** (`machine_id`, `name`, `description`, `notes`) instead of DATA-FOUNDATION's table-wide INSERT. This is what the approval requires:
- the owner is never client-supplied
- identity is server-generated
- there is no client-controlled deletion time or pin

Clients also get **no `deleted_at` UPDATE grant**. The frozen DATA-FOUNDATION grant on its own tables is unchanged (OPEN #19).

### Row-level security

- **Enabled and FORCED;** all privileges revoked from `anon` and `authenticated`, then granted narrowly.
- **SELECT:** `owner_id = auth.uid() AND deleted_at IS NULL AND` the machine is visible under the frozen machine policy. That policy hides deleted machines and machines in deleted garages. This mirrors the frozen `components` policy.
- **INSERT:** `WITH CHECK (owner_id = auth.uid())`, which mirrors the frozen pattern. The composite FK makes another owner's machine unattachable.
  - **Recorded behaviour:** as with frozen `components`, the INSERT policy does not check whether the owner's *own* machine is soft-deleted. Such a row is immediately hidden by the SELECT policy.
- **UPDATE:** `USING (owner_id = auth.uid() AND deleted_at IS NULL) WITH CHECK (owner_id = auth.uid())`.
- **`anon`:** no access to the table or the functions.

### Soft delete (Decision B pattern)

`gf_soft_delete_test_setup(p_id uuid)`:
- `SECURITY DEFINER`, `search_path = ''`
- EXECUTE for `authenticated` only
- requires `auth.uid()` (`GF_AUTH`, 42501)
- updates only `id = p_id AND owner_id = auth.uid() AND deleted_at IS NULL`, setting `deleted_at = now()` server-side
- returns nothing
- already-deleted, other users' and non-existent rows all give the same `GF_NOT_FOUND` (P0002); nothing changes and nothing is re-stamped
- **no cascade:** soft-deleting a Test Setup touches nothing else; soft-deleting its machine or garage does not stamp the Test Setup (it is hidden by the SELECT policy)

`gf_repin_test_setup_baseline(p_id uuid)` has the same shape, the same errors and the same owner and active-row restriction.

`SECURITY DEFINER` is required for both, because clients have no column grant on `deleted_at` or `baseline_pinned_at`. The function owner must bypass RLS: locally the superuser; on hosted Supabase the migration owner. **Verify at provisioning (OPEN #6, unchanged).**

## Engineering-value boundary

**Nothing Garage adds stores, references or links engineering data:**
- no reference to `canonical_fields`, `value_records` or `calculation_records`
- no new enum
- `canonical_fields` stays empty, and MAPPING-FOUNDATION stays draft (0 of 923 authoritative)

Test Setup values and deltas are deferred to the value-persistence and calculation layer. **Recorded constraint for that layer:** deltas must not be written to frozen `value_records`, because its "current value" rule would turn a delta into the machine's baseline.

## Isolation

`tools/isolation-check.sh`:
- F1 page SHA-256 and the 14 protected F1 files
- `data-foundation/` and `mapping-foundation/` byte-identical to their tags
- no file outside `garage-foundation/` changed
- all 10 tags at their recorded commits
- F1 gate suite by suite against its baseline
- DATA-FOUNDATION and MAPPING-FOUNDATION suites byte-identical to their committed baselines
- mapping `--check`

The frozen DATA-FOUNDATION and MAPPING-FOUNDATION isolation scripts each assert that nothing outside *their own* directory differs, so a new top-level directory makes them fail by design. The Garage gate performs their checks explicitly instead.

## Open decisions

**Unchanged:** #1–3, #6, #9–24, and the draft-taxonomy review.

**From the Garage reconciliation, still open:** #29–40, including #31 (machine and component history), #33 (F1 profile overwrite) and #36 (values of deleted machines).

**Approved and applied:** #25, #26, #27 (deferred), #28.
