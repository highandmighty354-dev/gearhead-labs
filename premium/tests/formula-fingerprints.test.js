#!/usr/bin/env node
/* Gearhead Labs — formula fingerprints of the engine against the production reference data (docs/DEFERRED-WORK-REGISTER.md, GH-ENG-014).

   Every registry formula has a fingerprint, "fv1-" plus an FNV-1a hash of its expressions, units and options (GH_ENGINE.describe(id).formula_version). The production
   database holds one `formula_versions` row per calculator with the fingerprint that was exported from the engine (supabase/migrations/0005_reference_seed.sql, frozen
   and byte-identical to the provisioned database), and a saved calculation points at that row with a foreign key. A formula that is corrected therefore gets a NEW
   fingerprint, and the new row has to be added by a new, reviewed migration (rows are never altered or deleted) before a calculation made with the corrected formula
   can be stored.

   This test makes that visible instead of silent. For every one of the 577 calculators of the seed:
     - the engine must know the calculator and name the same registry;
     - the fingerprint must equal the seed's, EXCEPT for the calculators listed in VERSIONED below, each tied to a register entry. A listed calculator must carry
       exactly the recorded new fingerprint (a further edit to its formula is noticed) and must differ from the seed (so the list cannot go stale).
   Run: node premium/tests/formula-fingerprints.test.js   (GH_ENGINE=path tests another copy of the engine)
   Exit code 0 = engine and seed agree apart from the recorded corrections, 1 otherwise. */
'use strict';
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* calculators whose formula was corrected after the seed was exported: the fingerprint the engine now computes, and the register entry that explains it */
const VERSIONED = {
  dew_point: { version: 'fv1-73ddeaf4', seed: 'fv1-260e7f34', register: 'GH-DEF-005 / GH-ENG-014' }
};

(async () => {
  const seed = fs.readFileSync(path.join(REPO, 'supabase/migrations/0005_reference_seed.sql'), 'utf8');
  const rows = [...seed.matchAll(/^\s*\('([a-z0-9_]+)', '(fv1-[0-9a-f]{8})', '[0-9.]+', '([A-Z0-9_]+)'/gm)].map(m => ({ id: m[1], version: m[2], registry: m[3] }));
  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124)), { waitUntil: 'load', timeout: 60000 });
  const got = await page.evaluate(ids => Object.fromEntries(ids.map(id => { try { const d = GH_ENGINE.describe(id); return [id, d ? { version: d.formula_version, registry: d.registry } : null]; } catch (e) { return [id, { error: String(e.message || e) }]; } })), rows.map(r => r.id));
  await browser.close();

  let failures = 0; const lines = [], fail = m => { failures++; lines.push('  FAIL ' + m); };
  if (rows.length !== 577) fail(`the seed lists ${rows.length} formula versions, expected 577`);
  for (const r of rows) {
    const g = got[r.id], v = VERSIONED[r.id];
    if (!g || g.error) { fail(`${r.id}: the engine does not describe it${g && g.error ? ' (' + g.error + ')' : ''}`); continue; }
    if (g.registry !== r.registry) fail(`${r.id}: registry ${g.registry}, the seed says ${r.registry}`);
    if (v) {
      if (v.seed !== r.version) fail(`${r.id}: the ledger records seed fingerprint ${v.seed}, the seed has ${r.version}`);
      if (g.version === r.version) fail(`${r.id}: the engine fingerprint equals the seed's again — remove it from VERSIONED (the list is stale)`);
      else if (g.version !== v.version) fail(`${r.id}: engine fingerprint ${g.version}, recorded ${v.version} (${v.register}) — the corrected formula was edited again; record the new fingerprint and its migration`);
    } else if (g.version !== r.version) fail(`${r.id}: engine fingerprint ${g.version} differs from the production seed's ${r.version} and is not recorded in VERSIONED — a changed formula needs a new formula_versions row (GH-ENG-014)`);
  }
  for (const id of Object.keys(VERSIONED)) if (!rows.some(r => r.id === id)) fail(`${id}: listed in VERSIONED but not in the seed`);
  if (pageErrors.length) { failures++; lines.push('PAGE ERRORS:\n' + pageErrors.slice(0, 5).join('\n')); }
  if (lines.length) console.log(lines.join('\n'));
  const same = rows.filter(r => got[r.id] && got[r.id].version === r.version).length;
  console.log(`\nformula-fingerprint tests: ${rows.length} seed formulas checked: ${same} identical to the production seed, ${Object.keys(VERSIONED).length} recorded as corrected; ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
