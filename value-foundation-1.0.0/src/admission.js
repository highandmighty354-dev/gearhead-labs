'use strict';
/* VALUE-FOUNDATION 1.0.0 - committed admission configuration (approved specification §D, §E, §O; OWN-A/B).
 * The 48 admitted source fields -> 47 canonical quantity keys, loaded from config/admission-config.json, which
 * tools/generate.js derives mechanically from the approved admission artifact (verified byte-identical by the suite).
 * At load, the approved artifacts are re-hashed; any mismatch refuses to start. Nothing here is ever promoted: a key
 * is admitted only if it is in this file. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const HERE = path.resolve(__dirname, '..');
const APPROVED = Object.freeze({
  spec: 'a28cfddb7a5bb43f0767a5dd04ed0ea9acf67616c4b9f264b1ebc0e737560555',
  admission: 'f9b91aa8a653c76fa3cb56b94e5d62e0538ba7e929b09f77fab89e33aa205d9f',
  deferred: 'f2fa130db594e9cb15442041b6e706a11595adbc1b41fc74c022ddd48cc85f04',
});
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const deepFreeze = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };

function loadAdmission(configOverride) {
  const config = configOverride || JSON.parse(fs.readFileSync(path.join(HERE, 'config', 'admission-config.json'), 'utf8'));
  for (const [name, want] of Object.entries(APPROVED)) {
    const a = config.artifacts && config.artifacts[name];
    if (!a || a.sha256 !== want) throw new Error(`VF_CONFIGURATION: ${name} artifact hash not the approved one`);
    const got = sha(fs.readFileSync(path.join(HERE, a.file)));
    if (got !== want) throw new Error(`VF_CONFIGURATION: ${a.file} SHA-256 ${got} is not the approved ${want}`);
  }
  if (config.fields.length !== 48 || config.keys.length !== 47) throw new Error('VF_CONFIGURATION: admission counts');

  const keys = new Map(config.keys.map(k => [k.canonical_key, k]));
  const fieldsByKey = new Map();
  for (const f of config.fields) {
    if (!keys.has(f.canonical_key)) throw new Error('VF_CONFIGURATION: field maps to unknown key ' + f.canonical_key);
    if (!fieldsByKey.has(f.canonical_key)) fieldsByKey.set(f.canonical_key, []);
    fieldsByKey.get(f.canonical_key).push(f);
  }
  // unit labels accepted for a key: its user-facing labels and their tokens (both name the same unit)
  const unitIndex = new Map();
  for (const [k, fs_] of fieldsByKey) {
    const m = new Map();
    for (const u of fs_[0].input_units) { m.set(u.label, u.token); m.set(u.token, u.token); }
    unitIndex.set(k, m);
  }
  // value -> engine feed: canonical calculator id -> [{ var, canonical_key }] (only admitted source fields)
  const feed = new Map();
  for (const f of config.fields) {
    if (!feed.has(f.calculator_id)) feed.set(f.calculator_id, []);
    feed.get(f.calculator_id).push({ var: f.var, canonical_key: f.canonical_key });
  }
  for (const list of feed.values()) list.sort((a, b) => (a.var < b.var ? -1 : a.var > b.var ? 1 : 0));

  return deepFreeze({
    config,
    isAdmitted: k => typeof k === 'string' && keys.has(k),
    key: k => keys.get(k),
    keys: () => [...keys.keys()],
    fieldsFor: k => fieldsByKey.get(k) || [],
    unitsFor: k => (fieldsByKey.get(k) ? fieldsByKey.get(k)[0].input_units : []),
    resolveUnit: (k, label) => { const m = unitIndex.get(k); return m && typeof label === 'string' && m.has(label) ? m.get(label) : null; },
    feedFor: calc => feed.get(calc) || [],
    feedCalculators: () => [...feed.keys()].sort(),
    contracts: () => config.keys.map(k => ({ key: k.canonical_key, storage_unit: k.canonical_unit })),
    deferredIds: () => config.deferred.map(d => d.draft_field_id),
  });
}

module.exports = { loadAdmission, APPROVED };
