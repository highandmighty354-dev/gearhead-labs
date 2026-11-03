/* Gearhead Labs — tests of the vehicle-profile machinery (GH-IMP-022).

   The published engine has no active vehicle for any visitor, Free or Premium: `const GH_VEHICLE_CONTEXT = false;` (owner decisions 2026-10-17 and
   2026-10-19, Stage 2, Task 3). Premium vehicle-to-calculator integration is NOT implemented (no production code connects My Garage vehicles to the
   calculators). The profile machinery (PROFILES, getActiveProfile, the "↓ use ..." chips, PROFILE_LINK_RULES, the dashboard's vehicle line) is kept as
   infrastructure for that future work, and the suites that test it (profile-shortcut, performance-units, dashboard-summary) keep testing that SAME code
   — not the published behaviour: they load a temporary
   copy of the engine in which only that one constant is switched on. Nothing else in the copy differs; the copy is refused if the constant is not
   found exactly once, so a renamed switch fails loudly instead of silently testing the Free behaviour.

   withVehicleContext(enginePath) -> path of the temporary copy (in the OS temp directory; remove it with cleanup()). */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const OFF = 'const GH_VEHICLE_CONTEXT = false;', ON = 'const GH_VEHICLE_CONTEXT = true;';
const made = [];
function enable(src) {
  const n = src.split(OFF).length - 1;
  if (n !== 1) throw new Error(`vehicle-context: expected "${OFF}" exactly once in the engine, found ${n}`);
  return src.replace(OFF, ON);
}
function withVehicleContext(enginePath, transform) {
  let src = enable(fs.readFileSync(enginePath, 'utf8'));
  if (transform) src = transform(src);
  const out = path.join(os.tmpdir(), `gh-vehicle-context-${process.pid}-${made.length}-${path.basename(enginePath)}`);
  fs.writeFileSync(out, src); made.push(out);
  return out;
}
function cleanup() { while (made.length) { try { fs.unlinkSync(made.pop()); } catch (e) { /* already gone */ } } }
process.on('exit', cleanup);
module.exports = { withVehicleContext, enable, cleanup, OFF, ON };
