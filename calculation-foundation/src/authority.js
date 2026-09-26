'use strict';
/* CALCULATION-FOUNDATION 1.0.0 - authority gate (SPEC §6, DESIGN §4). D2: only the 252 LIVE_PARITY-proven
 * calculators execute. Aliases are permitted only per the D2 alias rule, which frozen-sources re-derives and
 * verifies at load (resolves to a proven canonical; catalog canonical_id = frozen alias registry; canonical
 * fingerprint valid). Alias rows are never proven in their own right. */
const { CODES, rejection } = require('./errors');

function createAuthority(sources) {
  return Object.freeze({
    resolve(c) {
      if (sources.isProven(c)) return { ok: true, canonical: c, alias: false };                         // 1
      const k = sources.aliasTarget(c);
      if (k !== undefined) {                                                                             // 2
        if (sources.isPermittedAlias(c) && sources.isProven(k)) return { ok: true, canonical: k, alias: true };
        return { ok: false, rejection: rejection(CODES.ALIAS_NOT_PERMITTED, 'alias_not_permitted', { calculator_id: c }) };
      }
      if (sources.isPending(c)) return { ok: false, rejection: rejection(CODES.NOT_PROVEN, 'pending', { calculator_id: c }) };      // 3
      if (sources.inRegistry(c)) return { ok: false, rejection: rejection(CODES.NOT_PROVEN, 'not_proven', { calculator_id: c }) }; // 4
      return { ok: false, rejection: rejection(CODES.UNKNOWN_CALCULATOR, 'unknown_calculator', { calculator_id: c }) };           // 5
    },
  });
}

module.exports = { createAuthority };
