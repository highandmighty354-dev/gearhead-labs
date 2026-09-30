'use strict';
/* DATA-FOUNDATION 1.1.0 - exact write-side normalization (Value Foundation V1 approved specification §G, §H;
 * frozen decision D-002: canonical storage unit = engine-native unit; the engine never converts).
 *
 * Written from the approved §H exact definitions. The F1 page conversion layer is NOT used or consulted (known
 * defects D-1 mm mis-scaling, kW mis-scaling, lb shown as kg, trap-speed -3.0, blank -> default, profile overwrite).
 *
 * Rules (§H):
 *   - convert ONLY by multiplying or dividing by the exact defining factor; never by a rounded reciprocal
 *   - no rounding on write: the stored value is the IEEE-754 binary64 result of that one operation
 *   - rejected, nothing stored: an unsupported unit, a non-finite input, a non-finite or out-of-range result
 *   - zero stays zero; sign is preserved; -0 is normalized to +0 (owner decision 2, DATA-FOUNDATION-1.1.0)
 *
 * "Out of range" (engineering definition used here): a nonzero input whose normalized result is zero or subnormal
 * cannot be stored exactly at binary64 precision, so it is rejected rather than silently flushed toward zero.
 *
 * Display conversion and display rounding (§I: 6 significant digits, half away from zero) are presentation-only
 * and are deliberately NOT part of the write path. */
const MIN_NORMAL = 2.2250738585072014e-308;

// Exact defining factors (§H "Exact definition" column). Each is the unit's size in the storage unit's terms.
const FACTOR = Object.freeze({
  MM_PER_IN: 25.4,                     // 1 in = 25.4 mm (exact by definition)
  N_PER_LBF: 4.4482216152605,          // 1 lbf = 0.45359237 kg x 9.80665 m/s^2 (exact)
  L_PER_GAL: 3.785411784,              // 1 US gal = 231 in^3 x 16.387064 cm^3/in^3 (exact)
  CC_PER_CU_IN: 16.387064,             // 1 in^3 = 2.54^3 cm^3 (exact)
  MM2_PER_SQ_IN: 645.16,               // 1 in^2 = 25.4^2 mm^2 (exact)
  CM2_PER_SQ_IN: 6.4516,               // 1 in^2 = 2.54^2 cm^2 (exact)
  M2_PER_SQ_FT: 0.09290304,            // 1 ft^2 = 0.3048^2 m^2 (exact)
});

/* storage unit -> accepted input unit -> operation. 'id' = identity (the storage unit itself, or a §H
 * "no conversion in V1" kind). 'div' = input / factor. 'mul' = input x factor. Unit tokens are matched exactly. */
const TABLE = Object.freeze({
  'in':    Object.freeze({ 'in': ['id'], 'mm': ['div', FACTOR.MM_PER_IN] }),
  'lbf':   Object.freeze({ 'lbf': ['id'], 'N': ['div', FACTOR.N_PER_LBF] }),
  'gal':   Object.freeze({ 'gal': ['id'], 'L': ['div', FACTOR.L_PER_GAL] }),
  'cc':    Object.freeze({ 'cc': ['id'], 'cu in': ['mul', FACTOR.CC_PER_CU_IN] }),
  'sq in': Object.freeze({ 'sq in': ['id'], 'mm²': ['div', FACTOR.MM2_PER_SQ_IN], 'cm²': ['div', FACTOR.CM2_PER_SQ_IN] }),
  'sq ft': Object.freeze({ 'sq ft': ['id'], 'm²': ['div', FACTOR.M2_PER_SQ_FT] }),
  ':1':    Object.freeze({ ':1': ['id'] }),
  '°':     Object.freeze({ '°': ['id'] }),
  'kWh':   Object.freeze({ 'kWh': ['id'] }),
  'TPI':   Object.freeze({ 'TPI': ['id'] }),   // TPI <-> thread pitch in mm is a reciprocal relation: not in V1
});

const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const STORAGE_UNITS = Object.freeze(Object.keys(TABLE));
const inputUnitsFor = storageUnit => (own(TABLE, storageUnit) ? Object.keys(TABLE[storageUnit]) : []);

/* Normalize a finite number supplied in `inputUnit` to `storageUnit`.
 * -> { ok: true, value } | { ok: false, why: 'unsupported_unit' | 'non_finite_input' | 'non_finite_result' | 'out_of_range_result' } */
function normalize(storageUnit, inputUnit, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return { ok: false, why: 'non_finite_input' };
  if (typeof inputUnit !== 'string' || !own(TABLE, storageUnit) || !own(TABLE[storageUnit], inputUnit)) {
    return { ok: false, why: 'unsupported_unit' };
  }
  const [op, factor] = TABLE[storageUnit][inputUnit];
  let out;
  if (op === 'id') out = value;
  else if (op === 'div') out = value / factor;
  else out = value * factor;
  if (!Number.isFinite(out)) return { ok: false, why: 'non_finite_result' };
  if (value !== 0 && Math.abs(out) < MIN_NORMAL) return { ok: false, why: 'out_of_range_result' };
  if (out === 0) out = 0;                           // -0 -> +0; an explicit zero stays a known zero
  return { ok: true, value: out };
}

module.exports = { FACTOR, TABLE, STORAGE_UNITS, MIN_NORMAL, inputUnitsFor, normalize };
