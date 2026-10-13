#!/usr/bin/env bash
# Gearhead Labs browser-side regression tests (real Chromium via Playwright; no network, no database).
#   engine-selftest.js         the engine's own ghSelfTest, which must report no failures (separate count; the former baseline of 8 known failures was resolved under GH-DEF-008)
#   browser-smoke.js           the integrated app shell (19 checks)
#   unit-system.test.js        Metric/Imperial toggle + re-entry against independent physics (aero, brake energy, head flow curve)
#   temperature-units.test.js  temperature readings vs temperature differences, the Temperature Converter, catalogue label guard
#   toggle-sweep.test.js       certValue() contract + every calculator: toggle == live re-render == round trip, with the known-open ledger
#   nav-return.test.js         every calculator: result panel matches the box after navigating away and back (known-open ledger, GH-DEF-018)
#   label-consistency.test.js  every calculator: same unit text must mean the same number in both systems (known-open ledger, now empty, GH-DEF-020)
#   native-units.test.js       the 29 calculators that work in a Metric-named unit (kW, mm, cc, kg, J, m, L/100km, °C): typed values and result rows against independent physics in both systems (GH-DEF-020)
#   declared-metric-units.test.js structural guard: no calculator may declare a Metric-named unit without native/raw, so a new one cannot slip past the other tests with a zero default (GH-DEF-020)
#   remembered-values.test.js  remembered boxes across calculators and unit systems: converted once, never relabelled (GH-DEF-004, GH-DEF-021)
#   converters.test.js         the 7 repaired converters and the 27 single-purpose converters against exact SI factors, both systems (GH-DEF-003)
#   dew-point.test.js          Dew Point & Humidity against the rule in degrees Celsius and the Magnus formula, both systems (GH-DEF-005)
#   formula-fingerprints.test.js every registry formula's fingerprint against the production seed, apart from the recorded corrections (GH-ENG-014)
#   mass-force.test.js         every box / result row declared in a pound unit: masses read kg, forces and weights read N, typed kg gives the right physics (GH-DEF-006)
#   unit-factors.test.js       every registered unit conversion factor and alias against the exact SI definitions (GH-ENG-002)
#   unit-census.test.js        the unit text and number of every box / row of all 696 calculators, Imperial against Metric: converted pairs, classified unchanged units (GH-DEF-007)
#   airflow-readers.test.js    the Airflow vs RPM graph and the Airflow -> Power staged curve read their boxes in the unit shown and follow every box typed, against independent physics (GH-DEF-023, GH-DEF-024)
#   legacy-fixes.test.js       HP from CID / RPM / VE / BSFC / AFR and Road Course Brake Bias against independent physics, both systems (GH-DEF-016, GH-DEF-017)
#   negative-zero.test.js      a result that rounds to zero is shown as "0", never "-0"; a real small negative keeps its sign; all 696 calculators swept in both systems (GH-DEF-022)
#   profile-shortcut.test.js   the "use vehicle value" shortcut: offered only in a box of the same quantity and converted to the unit the box shows (hybrid power split, GH-DEF-027); 9 mutants
# Run with the Playwright module on NODE_PATH or installed globally. GH_ENGINE=path tests another copy of the engine.
# Takes about 30 minutes on a 2-core machine. Exit code 0 only when every suite passes. (run-tests.sh is the separate backend/schema suite.)
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
rc=0
for t in engine-selftest.js browser-smoke.js unit-system.test.js temperature-units.test.js toggle-sweep.test.js nav-return.test.js converters.test.js label-consistency.test.js native-units.test.js declared-metric-units.test.js remembered-values.test.js dew-point.test.js formula-fingerprints.test.js mass-force.test.js unit-factors.test.js unit-census.test.js airflow-readers.test.js legacy-fixes.test.js negative-zero.test.js profile-shortcut.test.js; do
  echo "=== $t"
  node "$HERE/$t" || { echo "FAILED: $t"; rc=1; }
done
exit $rc
