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
#   dashboard-summary.test.js  the dashboard vehicle summary in both systems with real clicks: the settled page shows none, the template and every frame it is painted in name the units of their numbers (GH-DEF-026)
#   profile-shortcut.test.js   the "use vehicle value" shortcut: offered only in a box of the same quantity and converted to the unit the box shows (hybrid power split, GH-DEF-027); 9 mutants
#   performance-units.test.js  the independent Power (Auto / hp / kW) and Torque (Auto / lb-ft / N·m) preferences with real clicks: application defaults, explicit override, Metric/Imperial never overwrite them, saved / remembered / profile / simulator paths, 20 mutants (GH-IMP-019)
#   performance-census.test.js every power / torque row of all 696 calculators in every Power x Torque x system state against the classification table: no unclassified row, retained categories unchanged (GH-IMP-019); QUICK=1 for the 128 classified calculators
#   curve-editor-mode.test.js  Curve Editor: Torque vs RPM <-> Power vs RPM converts each point at its own RPM, both systems, five Power x Torque pairs, repeated switching, the simulators' view; 8 mutants (GH-DEF-029)
#   range-warnings.test.js     the soft "Unusual ..." range warnings: the 140 boxes that hold the quantity keep their warning (typed values, Imperial / Metric / kW), the 21 accidental id matches never warn, no warning moves on a unit switch, all 696 calculators (GH-DEF-028)
#   curve-persistence.test.js  a curve typed in the Curve Editor stays the engine curve of the Acceleration, Dragstrip and Top Speed simulators on every draw (an edit, a visit through another page, a Metric / Imperial press, a Power / Torque preference change), torque and power curves, four states; the default curve when nothing was typed (GH-DEF-030); about 1 minute
#   acceleration-target.test.js the Acceleration simulator's Target Time is the time to the Target Speed, also when that speed equals a Dragstrip distance mark (60 / 100 / 132); physical bounds, a cross-view with the Dragstrip's trap speed, Dragstrip / Top Speed tiles unchanged (GH-DEF-033); about 10 seconds
#   simulator-first-draw.test.js the Acceleration, Dragstrip and Top Speed simulators give the same tiles on their first draw as on every later draw of the same inputs; 85 % drivetrain efficiency is applied (closed-form checks), also when typed; render order does not matter (GH-DEF-032); about 15 seconds
#   shell-units.test.js        the app shell's UNITS menu in the integrated index.html with real clicks: visible in the natural and the forced script order, METRIC / IMPERIAL change UNIT.system, the numbers and labels, and match the engine's own setUnit (GH-DEF-031)
#   structural-11a.test.js     Batch 11a (Structure, Stress and Fatigue, 15 calculators): hand-derived closed-form cases in both systems, unit labels (ksi/MPa, Mpsi/GPa, lbf/N, lb-ft/deg), invalid and out-of-domain inputs, regime notes
# Run with the Playwright module on NODE_PATH or installed globally. GH_ENGINE=path tests another copy of the engine.
# Takes about 90 minutes on a 2-core machine (79 minutes measured on 2026-10-13 with the first 23 suites; curve-editor-mode and range-warnings add about 10 more, curve-persistence about 1 more, acceleration-target and simulator-first-draw a few seconds each). Exit code 0 only when every suite passes. (run-tests.sh is the separate backend/schema suite.)
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
rc=0
for t in engine-selftest.js browser-smoke.js unit-system.test.js temperature-units.test.js toggle-sweep.test.js nav-return.test.js converters.test.js label-consistency.test.js native-units.test.js declared-metric-units.test.js remembered-values.test.js dew-point.test.js formula-fingerprints.test.js mass-force.test.js unit-factors.test.js unit-census.test.js airflow-readers.test.js legacy-fixes.test.js negative-zero.test.js profile-shortcut.test.js dashboard-summary.test.js performance-units.test.js performance-census.test.js curve-editor-mode.test.js range-warnings.test.js curve-persistence.test.js acceleration-target.test.js simulator-first-draw.test.js shell-units.test.js structural-11a.test.js; do
  echo "=== $t"
  node "$HERE/$t" || { echo "FAILED: $t"; rc=1; }
done
exit $rc
