#!/usr/bin/env node
/* VALUE-FOUNDATION 1.0.0 - deterministic generator.
 *   node tools/generate.js          write config/admission-config.json, the 0301 seed and its rollback
 *   node tools/generate.js --check  regenerate in memory and require byte-identity with the committed files
 *
 * Inputs (never modified): the approved specification and the two approved companion CSVs (each SHA-256 verified),
 * and the frozen calculator input labels read from the CALCULATION-FOUNDATION-1.0.0 tag (git object store).
 * Every derivation is asserted; any surprise aborts instead of being guessed. */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const { readRecords } = require('../src/csv');
const { unitsForArtifactEntry } = require('../src/units');
const DFU = require('../../data-foundation-1.1.0/src/units');

const HERE = path.resolve(__dirname, '..'), REPO = path.resolve(HERE, '..');
const ART = {
  spec: { file: 'design/VALUE-FOUNDATION-V1-FINAL-SPECIFICATION.md', sha256: 'a28cfddb7a5bb43f0767a5dd04ed0ea9acf67616c4b9f264b1ebc0e737560555' },
  admission: { file: 'config/VALUE-FOUNDATION-V1-FINAL-ADMISSION-48.csv', sha256: 'f9b91aa8a653c76fa3cb56b94e5d62e0538ba7e929b09f77fab89e33aa205d9f' },
  deferred: { file: 'config/VALUE-FOUNDATION-V1-DEFERRED-REGISTER.csv', sha256: 'f2fa130db594e9cb15442041b6e706a11595adbc1b41fc74c022ddd48cc85f04' },
};
const OUT = {
  config: 'config/admission-config.json',
  seed: 'supabase/migrations/0301_value_foundation_v1_seed.sql',
  rollback: 'supabase/rollback/0301_value_foundation_v1_seed.rollback.sql',
};
const RENAMED_FROM = Object.freeze({ supercharger_drive_ratio: 'supercharger_to_crank_speed_ratio', clutch_required_release_force: 'clutch_release_force' });
// The one approved presentation override (owner / engineering sign-off, J-pipe = inside diameter). Every other
// display label is the frozen calculator input label, verbatim.
const LABEL_OVERRIDES = Object.freeze({ pipe_diameter__in: 'Pipe Inside Diameter' });
const CF_TAG = 'CALCULATION-FOUNDATION-1.0.0';

const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const must = (c, m) => { if (!c) throw new Error('generate: ' + m); };

function readArtifact(a) {
  const bytes = fs.readFileSync(path.join(HERE, a.file));
  must(sha(bytes) === a.sha256, `${a.file} SHA-256 ${sha(bytes)} != approved ${a.sha256}`);
  return bytes.toString('utf8');
}

function frozenSources() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-gen-'));
  try {
    const files = execFileSync('git', ['-C', REPO, 'ls-tree', '--name-only', `${CF_TAG}:calculation-foundation/src`]).toString().trim().split('\n');
    for (const f of files) fs.writeFileSync(path.join(dir, f), execFileSync('git', ['-C', REPO, 'show', `${CF_TAG}:calculation-foundation/src/${f}`]));
    const F = require(path.join(dir, 'frozen-sources.js'));
    return F.loadFrozenSources(F.readFrozenBytesFromTags(REPO));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function build(sources) {
  readArtifact(ART.spec);
  const adm = readRecords(readArtifact(ART.admission));
  const dfr = readRecords(readArtifact(ART.deferred));
  must(adm.length === 48, 'admission rows ' + adm.length);
  must(dfr.length === 52, 'deferred rows ' + dfr.length);

  const fields = adm.map(r => {
    const [calculator_id, v, extra] = r.engine_key.split('.');
    must(v && extra === undefined, 'engine key shape ' + r.engine_key);
    must(r.source_calculator === calculator_id, 'source_calculator mismatch ' + r.draft_field_id);
    must(r.value_role === 'SPECIFICATION', 'value role ' + r.draft_field_id);
    must(r.storage_unit_D002 === r.engine_native_unit, 'storage != engine-native ' + r.draft_field_id);
    must(sources.isProven(calculator_id), 'calculator not proven ' + calculator_id);
    const d = sources.describe(calculator_id);
    must(d && d.canonical_id === calculator_id, 'calculator not canonical ' + calculator_id);
    const inp = d.inputs.find(i => i.var === v);
    must(inp, 'engine var missing ' + r.engine_key);
    const units = unitsForArtifactEntry(r.valid_input_display_units);
    const tokens = units.map(u => u.token);
    must(new Set(tokens).size === tokens.length, 'duplicate unit token ' + r.draft_field_id);
    must(tokens[0] === r.storage_unit_D002, 'first unit is not the storage unit ' + r.draft_field_id);
    must([...tokens].sort().join('|') === [...DFU.inputUnitsFor(r.storage_unit_D002)].sort().join('|'),
      `unit set ${tokens} != trusted-path set ${DFU.inputUnitsFor(r.storage_unit_D002)} for ${r.draft_field_id}`);
    return {
      draft_field_id: r.draft_field_id, canonical_key: r.canonical_key, engine_key: r.engine_key, calculator_id, var: v,
      storage_unit: r.storage_unit_D002, input_units: units, frozen_label: inp.label,
      display_label: LABEL_OVERRIDES[r.draft_field_id] || inp.label, value_role: r.value_role,
    };
  });
  for (const id of Object.keys(LABEL_OVERRIDES)) must(fields.some(f => f.draft_field_id === id), 'override for unknown field ' + id);

  const byKey = new Map();
  for (const r of adm) { if (!byKey.has(r.canonical_key)) byKey.set(r.canonical_key, []); byKey.get(r.canonical_key).push(r); }
  must(byKey.size === 47, 'distinct keys ' + byKey.size);
  const shared = [...byKey].filter(([, rs]) => rs.length > 1).map(([k]) => k);
  must(JSON.stringify(shared) === '["vehicle_cg_height"]', 'shared keys ' + shared);
  const keys = [...byKey.keys()].sort().map(k => {
    const rs = byKey.get(k);
    for (const col of ['definition', 'storage_unit_D002', 'valid_input_display_units', 'mapping_foundation_family', 'quantity_kind', 'subject', 'basis', 'characteristic']) {
      must(rs.every(x => x[col] === rs[0][col]), `key ${k}: ${col} differs between its source fields`);
    }
    must(/^[a-z][a-z0-9_]*$/.test(k), 'key regex ' + k);
    must(rs[0].mapping_foundation_family.trim() !== '' && !rs[0].mapping_foundation_family.includes(';'), 'family ' + k);
    return { canonical_key: k, family: rs[0].mapping_foundation_family, canonical_unit: rs[0].storage_unit_D002, value_kind: 'numeric',
      description: rs[0].definition, quantity_kind: rs[0].quantity_kind, source_fields: rs.map(x => x.draft_field_id) };
  });
  for (const [o, n] of Object.entries(RENAMED_FROM)) { must(byKey.has(n), 'renamed key absent ' + n); must(!byKey.has(o), 'old key present ' + o); }

  const admitted = new Set(adm.map(r => r.draft_field_id));
  const deferred = dfr.map(r => ({ draft_field_id: r.draft_field_id, engine_key: r.engine_key, category: r.category }));
  must(deferred.every(d => !admitted.has(d.draft_field_id)), 'deferred/admitted overlap');
  must(new Set(deferred.map(d => d.draft_field_id)).size === 52, 'deferred duplicates');

  const config = {
    milestone: 'VALUE-FOUNDATION-1.0.0',
    generated_by: 'value-foundation-1.0.0/tools/generate.js',
    artifacts: ART,
    renamed_from: RENAMED_FROM,
    label_overrides: LABEL_OVERRIDES,
    counts: { source_fields: fields.length, canonical_keys: keys.length, deferred: deferred.length },
    keys, fields, deferred,
  };
  return { config, configText: JSON.stringify(config, null, 1) + '\n', seed: seedSql(keys, fields, deferred), rollback: rollbackSql(keys) };
}

const q = s => "'" + String(s).replace(/'/g, "''") + "'";

function seedSql(keys, fields, deferred) {
  const rows = keys.map(k => `  (${q(k.canonical_key)}, ${q(k.family)}, ${q(k.canonical_unit)}, ${q(k.description)})`).join(',\n');
  const forbidden = [...Object.keys(RENAMED_FROM), ...fields.map(f => f.draft_field_id), ...deferred.map(d => d.draft_field_id)];
  const forbiddenSql = [...new Set(forbidden)].sort().map(q).join(', ');
  return `-- VALUE-FOUNDATION 1.0.0 · 0301 canonical_fields seed (approved specification §D, §E, §V; owner seed clarification)
-- GENERATED by value-foundation-1.0.0/tools/generate.js from the approved admission artifact
--   ${ART.admission.file} (SHA-256 ${ART.admission.sha256}). Do not edit by hand.
--
-- Seeds EXACTLY the 47 canonical quantity keys (one row per key; DATA-FOUNDATION holds no source-field rows).
-- The 48 admitted source fields -> 47 keys mapping (vehicle_cg_height <- 2 source fields) is committed Value Foundation
-- configuration (config/admission-config.json), not database rows. No table, column, trigger, function or index is
-- created; the temporary table below exists only inside this transaction (ON COMMIT DROP).
--
-- Additive and idempotent: ON CONFLICT DO NOTHING, then post-conditions that require every one of the 47 rows to
-- match the approved artifact EXACTLY (family, dimension NULL (G-3), canonical_unit = engine-native storage unit,
-- value_kind numeric, description = the approved definition). A pre-existing differing row aborts the migration.
-- Keys are permanent once referenced (frozen value_records FK ON DELETE RESTRICT). Rollback:
--   value-foundation-1.0.0/${OUT.rollback}

BEGIN;

CREATE TEMP TABLE vf_0301_expected (
  key text PRIMARY KEY, family text NOT NULL, canonical_unit text NOT NULL, description text NOT NULL
) ON COMMIT DROP;

INSERT INTO vf_0301_expected (key, family, canonical_unit, description) VALUES
${rows};

INSERT INTO public.canonical_fields (key, family, dimension, canonical_unit, value_kind, description)
SELECT key, family, NULL, canonical_unit, 'numeric', description FROM vf_0301_expected ORDER BY key
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE n int; bad text;
BEGIN
  SELECT count(*) INTO n FROM vf_0301_expected;
  IF n <> 47 THEN RAISE EXCEPTION 'VF_0301_POSTCONDITION: expected 47 approved keys, found %', n; END IF;
  SELECT string_agg(e.key, ',' ORDER BY e.key) INTO bad
    FROM vf_0301_expected e
    LEFT JOIN public.canonical_fields c
      ON c.key = e.key AND c.family = e.family AND c.dimension IS NULL AND c.canonical_unit = e.canonical_unit
     AND c.value_kind = 'numeric' AND c.description IS NOT DISTINCT FROM e.description
   WHERE c.key IS NULL;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'VF_0301_POSTCONDITION: canonical_fields rows differ from the approved artifact: %', bad; END IF;
  SELECT string_agg(key, ',' ORDER BY key) INTO bad FROM public.canonical_fields WHERE key IN (${forbiddenSql});
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'VF_0301_POSTCONDITION: non-approved key present (old name, draft or deferred field id): %', bad; END IF;
END $$;

COMMIT;
`;
}

function rollbackSql(keys) {
  const list = keys.map(k => q(k.canonical_key)).join(', ');
  return `-- VALUE-FOUNDATION 1.0.0 · ROLLBACK of 0301 canonical_fields seed
-- GENERATED by value-foundation-1.0.0/tools/generate.js. Do not edit by hand. NOT a forward migration (kept outside
-- supabase/migrations/, as DATA-FOUNDATION-1.1.0's rollback is).
-- Removes exactly the 47 seeded keys. Keys are PERMANENT once referenced: if any value_records row references one of
-- them, the rollback refuses (and the frozen ON DELETE RESTRICT foreign key would refuse regardless). Idempotent.

BEGIN;

DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT canonical_field, ',' ORDER BY canonical_field) INTO bad FROM public.value_records
   WHERE canonical_field IN (${list});
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'VF_0301_ROLLBACK_REFUSED: values exist for permanent keys: %', bad;
  END IF;
END $$;

DELETE FROM public.canonical_fields WHERE key IN (${list});

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.canonical_fields WHERE key IN (${list})) THEN
    RAISE EXCEPTION 'VF_0301_ROLLBACK_POSTCONDITION: seeded keys remain';
  END IF;
END $$;

COMMIT;
`;
}

module.exports = { build, frozenSources, ART, OUT, RENAMED_FROM, LABEL_OVERRIDES };

if (require.main === module) {
  const out = build(frozenSources());
  const files = { [OUT.config]: out.configText, [OUT.seed]: out.seed, [OUT.rollback]: out.rollback };
  if (process.argv.includes('--check')) {
    let ok = true;
    for (const [f, text] of Object.entries(files)) {
      const p = path.join(HERE, f), same = fs.existsSync(p) && fs.readFileSync(p, 'utf8') === text;
      console.log(`${same ? 'OK  ' : 'DIFF'} ${f}`); ok = ok && same;
    }
    console.log(ok ? 'GENERATION CHECK PASS' : 'GENERATION CHECK FAIL'); process.exit(ok ? 0 : 1);
  }
  for (const [f, text] of Object.entries(files)) fs.writeFileSync(path.join(HERE, f), text);
  console.log(`generated: ${out.config.counts.source_fields} source fields -> ${out.config.counts.canonical_keys} keys; ${out.config.counts.deferred} deferred`);
}
