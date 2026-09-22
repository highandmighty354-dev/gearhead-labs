# GH_ENGINE — the Gearhead calculation interface

Engine 1.0.0 · introduced in F1.11.0 (M1, step 1).

## What it is, and what it is not

```
Existing verified formula registry   <- the engineering source of truth (unchanged)
        |
  GH_ENGINE.calculate(id, inputs)     <- gh-engine.js: lookup, input validation, evaluation
        |
  Canonical Result object             <- state, outputs, units, provenance, formula version
        |
  Free UI today · My Garage / Labs / Service Station / API later
```

- **It contains no formulas.** It reads `GH_E1_FORMULAS`, `GH_E101_FORMULAS`, `GH_LEGACY_FORMULAS` and `GH_BACKFILL_FORMULAS`, first match in that order.
  - All 96 ids that appear in two registries have byte-identical entries, so the order cannot change a result.
- **One implementation.** `gh-engine.js` is embedded verbatim in the page as `<script id="GH_ENGINE">` (exposed as `window.GH_ENGINE`), and the same file is `require()`d in Node.
  - The gate fails if the embedded copy differs by one byte.
  - The gate also fails if the Node and in-page engines disagree on any of the 577 calculators.
- **It does not replace any renderer yet.** The live Free UI is unchanged. Retiring a renderer's own math in favour of `calculate()` is a later step, and only for calculators listed in `engine-migrated.json`.

## API

```js
GH_ENGINE.calculate(id, inputs)   // -> Result
GH_ENGINE.describe(id)            // -> { canonical_id, registry, formula_version, inputs[{var,label,required}], outputs[{key,label,unit}] } | null
GH_ENGINE.listCalculators()       // -> 577 ids with a registry formula
GH_ENGINE.version                 // '1.0.0'

// Node (My Garage / API / tests):
const { createEngine } = require('./gh-engine.js');
const E = createEngine(registries, aliases);   // registries extracted from the page; see engine.test.js
```

`inputs` is keyed by registry variable name. Each value is a number, or `{ value, provenance }`.

## Unknown ≠ Zero (the input contract)

| Input | Treated as |
|---|---|
| `0` | **known zero**, evaluated |
| absent, `undefined`, `null`, `NaN`, `''` | **unknown**, never evaluated |
| `'8700'` (any string) | unknown + warning `NON_NUMERIC_INPUT`, never parsed |
| `Infinity` | unknown + warning `NON_FINITE_INPUT` |

If any input is unknown, the result is `INCOMPLETE`, `missing[]` lists the variables, and every output value is `null`. The engine never substitutes a default, a zero, or a guess.

The page's shared field reader `v(id)` follows the same rule since F1.11.0:
- A missing, empty or non-numeric field returns `NaN` (unknown).
- A typed `0` returns `0`.

## Result object

```js
{ calculator_id, canonical_id, engine_version,
  state,                        // see below
  formula: { registry, version },   // version = fv1-<FNV-1a of the exact formula text>
  inputs:  [{ var, label, value, known, provenance }],
  missing: [ ...vars ],
  outputs: [{ key, label, unit, value, state }],   // value is null unless the output is VALID
  warnings: [ ... ],
  provenance: { kind: 'calculated', source: 'gh-engine@1.0.0', formula_registry, formula_version } }
```

**States** (Master Architecture §8):

| State | Meaning |
|---|---|
| `VALID` | all inputs known, all outputs finite |
| `VALID_WITH_WARNING` | some outputs finite, or input warnings present |
| `INCOMPLETE` | a required input is unknown |
| `OUT_OF_RANGE` | inputs known but the formula has no finite answer (e.g. divide by zero), or the registry's own domain guard returned NaN |
| `NOT_APPLICABLE` | no registry formula for this id (the 29 simulators / multi-output tools) |
| `ESTIMATED`, `NON_CONVERGENT` | reserved for iterative / curve calculators |

**Calculated ≠ certified:** provenance is always `calculated`. The formula version lets a stored result be traced to the exact formula text that produced it.

## Units

- **Storage units are the engine's native US/Imperial units** (owner decision 2).
- Inputs are expected in those units, and outputs carry the registry's declared unit.
- The engine never converts. Conversion belongs to the mapping layer (inputs) and the display layer (outputs).
- LIVE_PARITY confirms every migrated output unit matches what the live page displays.

## How a calculator becomes "migrated"

A calculator is added to `engine-migrated.json` only after it passes **LIVE_PARITY** (`gh-verify-engine.js`). LIVE_PARITY opens the real page and binds each registry variable to its live input field, by field id first and label second, never by position. It then drives the live page and `calculate()` with identical inputs:

1. defaults
2. all inputs × 1.07
3. each input × 1.13 alone (catches swapped variables)
4. each input = 0 alone (validity must agree: live shows no number ⇔ engine not `VALID`)
5. every live input with **no** registry variable is changed. If a result the registry claims moves, the registry is missing an input, and the calculator fails.

Values must agree at the precision the page displays, or within 0.1% (the documented intermediate-rounding bound). Units must match.

**Negative controls (run while building this):**
- A 1% change to one registry formula fails LIVE_PARITY.
- A one-comment change to the embedded engine fails ENGINE_EMBED.

## Status at F1.11.0

| | Count |
|---|---|
| Candidates (static DIFFERENTIAL passes on F1.10.6) | 259 |
| **Migrated: full live parity proven** | **215** (3,176 output comparisons) |
| Pending: see `engine-pending.json` | 44 |

Pending breakdown:

| Reason | Count | What it means |
|---|---|---|
| DOMAIN_RULES_NEEDED | 24 | Live rejects a 0 input the registry evaluates. Fix: add the live guard to the registry expression using the pattern the registry already uses: `[..].every(n=>n>0) ? expr : NaN` |
| REGISTRY_INCOMPLETE | 13 | Live has an input the registry lacks (unit "From" selectors, Application selectors, `hp_from_specs` air density) |
| MODE_DEPENDENT | 3 | Solve-for modes hide registry inputs in the default mode |
| LIVE_DEFECT | 2 | `pinion_angle_change` shows 0° for invalid geometry; `bolt_pattern` mixes measurement conventions and returns a radius labelled diameter |
| REGISTRY_STUB | 1 | `optimal_shift`: the registry is a stand-in for a 7-input search |
| UNIT_DIVERGENCE | 1 | `ev_motor_power`: registry kW vs live HP |

**Lesson:** the static DIFFERENTIAL suite compares at default inputs only. 44 of its 259 "proven" calculators agree only at defaults. LIVE_PARITY is the proof standard from here on.
