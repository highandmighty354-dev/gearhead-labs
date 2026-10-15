/* Gearhead Labs — the formula_versions rows defined by the migrations, read from the repository (GH-ENG-014, decision D3).
 *
 * formula_versions is history: a row is never updated or deleted (df_never_changed / df_no_truncate), and a corrected formula gets a
 * NEW row in a later migration (0408 for dew_point, distance_converter, bolt_torque_spec, bolt_stretch). So the version a calculator
 * uses today is its LATEST row, in migration file-name order (the order the workflow and the Supabase CLI apply them), and every
 * earlier row stays valid for the calculation_records that reference it.
 *
 * read(repo) parses every `INSERT INTO public.formula_versions ... VALUES (...), ...;` statement of supabase/migrations/*.sql
 * (no database call; the catalogue stays a pure function of repository files) and returns
 *   latest  { calculator_id: { version, engine, registry, first_release, file } }   the row the catalogue and the engine must name
 *   history { calculator_id: [ row, ... ] }                                          every row, oldest first (the seed row first)
 *   rows    every row, in file order
 * It throws when a migration defines the same (calculator_id, formula_version) twice, or one calculator twice in one file, or when a
 * formula_versions insert yields no row (the format changed and this reader would silently miss it). */
'use strict';
const fs = require('fs'), path = require('path');

const ROW = /\(\s*'([a-z0-9_]+)',\s*'(fv1-[0-9a-f]{8})',\s*'([0-9.]+)',\s*'([A-Z0-9_]+)',\s*'([^']+)'\s*\)/g;

function read(repo) {
  const dir = path.join(repo, 'supabase/migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)); // C order, as the workflow sorts
  const rows = [], seen = new Set();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const inFile = new Set();
    for (const stmt of sql.split(/INSERT INTO public\.formula_versions\b/).slice(1)) {
      const body = stmt.slice(0, stmt.indexOf(';') < 0 ? stmt.length : stmt.indexOf(';'));
      const found = [...body.matchAll(ROW)];
      if (!found.length) throw new Error(`${file}: a formula_versions insert with no row this reader understands`);
      for (const m of found) {
        const r = { id: m[1], version: m[2], engine: m[3], registry: m[4], first_release: m[5], file };
        const key = `${r.id}\u0000${r.version}`;
        if (seen.has(key)) throw new Error(`${file}: ${r.id} ${r.version} is defined twice`);
        if (inFile.has(r.id)) throw new Error(`${file}: ${r.id} has two rows in one migration`);
        seen.add(key); inFile.add(r.id); rows.push(r);
      }
    }
  }
  const latest = {}, history = {};
  for (const r of rows) { latest[r.id] = r; (history[r.id] = history[r.id] || []).push(r); }
  return { latest, history, rows };
}

module.exports = { read };
