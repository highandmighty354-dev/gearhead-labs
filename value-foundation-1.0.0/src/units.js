'use strict';
/* VALUE-FOUNDATION 1.0.0 - user-facing unit labels and display (approved specification §G, §H, §I).
 *
 * Conversion factors are NOT defined here. The single source of the §H factors is the closed trusted write path,
 * DATA-FOUNDATION-1.1.0 src/units.js (TABLE). Writes are normalized there (storage direction); display uses the same
 * table in the opposite direction. This module introduces no numeric constant and no F1 code.
 *
 * Label -> token: the admission artifact's `valid_input_display_units` column is the authority for which units a
 * field accepts. Its entries are user-facing labels, some annotated. Each label is mapped EXPLICITLY below; an entry
 * that is not in this table makes the configuration generator fail (no label is ever guessed). Notably:
 *   'gal (US)' -> token 'gal'  (the §H storage unit `gal` IS the US gallon: 1 gal = 3.785411784 L)
 */
const DF = require('../../data-foundation-1.1.0/src/units');

const LABELS = Object.freeze({
  'in': { token: 'in', label: 'in' },
  'mm': { token: 'mm', label: 'mm' },
  'lbf': { token: 'lbf', label: 'lbf' },
  'N': { token: 'N', label: 'N' },
  'gal (US)': { token: 'gal', label: 'gal (US)' },
  'L': { token: 'L', label: 'L' },
  'cc': { token: 'cc', label: 'cc' },
  'cu in': { token: 'cu in', label: 'cu in' },
  'sq in': { token: 'sq in', label: 'sq in' },
  'mm²': { token: 'mm²', label: 'mm²' },
  'cm²': { token: 'cm²', label: 'cm²' },
  'sq ft': { token: 'sq ft', label: 'sq ft' },
  'm²': { token: 'm²', label: 'm²' },
  'kWh': { token: 'kWh', label: 'kWh' },
  // annotated identity-only entries (§H "no conversion in V1"): the storage unit is the only unit
  'TPI (display only; thread-pitch-in-mm is a reciprocal, not a factor — not in V1)': { token: 'TPI', label: 'TPI' },
  '° (no alternate in V1)': { token: '°', label: '°' },
  '(dimensionless — no conversion)': { token: ':1', label: ':1' },
});

/* Split the artifact's unit list on TOP-LEVEL commas only (annotations contain commas inside parentheses). */
function splitUnitList(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth < 0) throw new Error('unit list: unbalanced parentheses: ' + s);
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (depth !== 0) throw new Error('unit list: unbalanced parentheses: ' + s);
  out.push(cur.trim());
  if (out.some(x => x === '')) throw new Error('unit list: empty entry: ' + s);
  return out;
}

function unitsForArtifactEntry(entry) {
  return splitUnitList(entry).map(item => {
    const m = LABELS[item];
    if (!m) throw new Error('unit list: unmapped unit label: ' + item);
    return { label: m.label, token: m.token };
  });
}

/* §I: 6 significant digits; half away from zero on the exact stored binary value (ECMAScript toPrecision semantics,
 * which rounds the magnitude and so is symmetric about zero); trailing zeros dropped; -0 shown as 0.
 * Display is pure: it never alters a stored value. */
const DISPLAY_DIGITS = 6;
function formatDisplay(x, digits) {
  const p = digits === undefined ? DISPLAY_DIGITS : digits;
  if (typeof x !== 'number' || !Number.isFinite(x)) throw new Error('display: finite number required');
  if (x === 0) return '0';
  return String(Number(x.toPrecision(p)));
}

/* Storage -> display conversion: the inverse direction of the §H table (to display: in x 25.4 = mm, cc / 16.387064 =
 * cu in, ...), using the identical exact factor. Display only; nothing is written back. */
function toDisplayUnit(storageUnit, token, storedValue) {
  const row = DF.TABLE[storageUnit];
  if (!row || !row[token]) throw new Error('display: unsupported unit ' + token + ' for ' + storageUnit);
  const [op, factor] = row[token];
  if (op === 'id') return storedValue;
  return op === 'div' ? storedValue * factor : storedValue / factor;
}

function display(storageUnit, unitEntry, storedValue) {
  if (storedValue === null) return { text: null, label: unitEntry.label, known: false };   // unknown is never shown as 0
  return { text: formatDisplay(toDisplayUnit(storageUnit, unitEntry.token, storedValue)), label: unitEntry.label, known: true };
}

module.exports = { LABELS, splitUnitList, unitsForArtifactEntry, formatDisplay, toDisplayUnit, display, DISPLAY_DIGITS };
