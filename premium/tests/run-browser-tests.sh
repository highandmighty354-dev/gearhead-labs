#!/usr/bin/env bash
# Gearhead Labs browser-side regression tests (real Chromium via Playwright; no network, no database).
#   engine-selftest.js         the engine's own ghSelfTest against its recorded baseline of 8 known failures (separate count)
#   browser-smoke.js           the integrated app shell (19 checks)
#   unit-system.test.js        Metric/Imperial toggle + re-entry against independent physics (aero, brake energy, head flow curve)
#   temperature-units.test.js  temperature readings vs temperature differences, the Temperature Converter, catalogue label guard
#   toggle-sweep.test.js       certValue() contract + every calculator: toggle == live re-render == round trip, with the known-open ledger
#   nav-return.test.js         every calculator: result panel matches the box after navigating away and back (known-open ledger, GH-DEF-018)
#   converters.test.js         the 7 repaired converters and the 27 single-purpose converters against exact SI factors, both systems (GH-DEF-003)
# Run with the Playwright module on NODE_PATH or installed globally. GH_ENGINE=path tests another copy of the engine.
# Takes about 25 minutes on a 2-core machine. Exit code 0 only when every suite passes. (run-tests.sh is the separate backend/schema suite.)
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
rc=0
for t in engine-selftest.js browser-smoke.js unit-system.test.js temperature-units.test.js toggle-sweep.test.js nav-return.test.js converters.test.js; do
  echo "=== $t"
  node "$HERE/$t" || { echo "FAILED: $t"; rc=1; }
done
exit $rc
