#!/usr/bin/env node
/* Gearhead Labs — GH-DEF-037: the shared numeric guard of the test harnesses (premium/tests/lib/numeric-guard.js).
   Proves, without a browser:
     1. a blank (or missing, "—", non-numeric) output fails when a number is expected; a legitimate "0" does not;
     2. NaN, +Infinity and -Infinity as the EXPECTED value fail;
     3. non-finite ACTUAL values fail an ordinary numeric assertion;
     4. a legitimate expected and actual zero pass;
     5. finite values at and within the caller's tolerance pass, just beyond it fail (tolerances unchanged), checked against the old formulas
        on 20,000 random finite cases (old and new must agree whenever everything is finite);
     6. the deliberately wrong cases reproduced in GH-DEF-037 (expected 1/0 and 0/0 in unit-system's comparison; expected Infinity in a
        relative-tolerance approx()) passed the OLD comparisons and fail the guarded ones.
   Run: node premium/tests/numeric-guard.test.js      Exit 0 = every check passed. */
'use strict';
const { parseShown, mismatch, within } = require('./lib/numeric-guard');
let checks = 0, failures = 0; const log = [];
const check = (name, ok, detail) => { checks++; if (!ok) { failures++; log.push(`  FAIL ${name}: ${detail}`); } else if (process.env.VERBOSE) log.push(`  ok   ${name}`); };

/* 1. blank output */
for (const t of ['', '   ', null, undefined, '—', '-', 'abc', 'NaN', 'Infinity']) {
  const v = parseShown(t);
  check(`1 parseShown(${JSON.stringify(t)}) is NaN, not a number`, Number.isNaN(v), String(v));
  check(`1 a blank/invalid output ${JSON.stringify(t)} fails when 0 is expected`, !within(v, 0, 0.5), mismatch(v, 0, 0.5));
}
for (const [t, n] of [['0', 0], ['0.0', 0], ['-0', 0], ['1,234.5', 1234.5], ['−3.25', -3.25], ['~ 12.5', 12.5], ['  42 ', 42]]) check(`1 parseShown(${JSON.stringify(t)}) = ${n}`, parseShown(t) === n || (n === 0 && parseShown(t) === 0), String(parseShown(t)));
check('1 the reason names a blank actual value', /blank or not a number/.test(mismatch(parseShown(''), 1, 0.5) || ''), mismatch(parseShown(''), 1, 0.5));

/* 2. non-finite expected values */
for (const w of [NaN, Infinity, -Infinity]) {
  for (const g of [0, 1, w]) check(`2 expected ${w} fails (actual ${g})`, !within(g, w, Number.isFinite(w) ? 1 : Infinity), String(mismatch(g, w, Infinity)));
  check(`2 the reason for expected ${w} says the expected value is not finite`, /expected value is not finite/.test(mismatch(1, w, 1) || ''), mismatch(1, w, 1));
}
check('2 an expected value that is not a number type fails', !within(1, '1', 1), mismatch(1, '1', 1));

/* 3. non-finite actual values */
for (const g of [NaN, Infinity, -Infinity]) check(`3 actual ${g} fails an ordinary assertion (expected 5)`, !within(g, 5, 1e9), mismatch(g, 5, 1e9));
check('3 the reason for an infinite actual value says so', /actual value is not finite/.test(mismatch(Infinity, 5, 1) || ''), mismatch(Infinity, 5, 1));

/* 4. zero */
check('4 expected 0, actual 0, tolerance 0 passes', within(0, 0, 0), mismatch(0, 0, 0));
check('4 expected 0, actual -0 passes', within(-0, 0, 0), mismatch(-0, 0, 0));
check('4 expected 0, actual parseShown("0") passes', within(parseShown('0'), 0, 0.5), mismatch(parseShown('0'), 0, 0.5));
check('4 a non-finite tolerance fails', !within(1, 1, Infinity) && !within(1, 1, NaN) && !within(1, 1, -1), `${mismatch(1, 1, Infinity)}`);

/* 5. tolerances unchanged for finite values */
check('5 exactly at the tolerance passes', within(10.5, 10, 0.5), mismatch(10.5, 10, 0.5));
check('5 within the tolerance passes', within(10.2, 10, 0.5), mismatch(10.2, 10, 0.5));
check('5 just beyond the tolerance fails', !within(10.5000001, 10, 0.5), 'passed');
check('5 negative values: at the tolerance passes, beyond fails', within(-10.5, -10, 0.5) && !within(-10.6, -10, 0.5), 'negative handling');
check('5 the reason for a plain mismatch names the difference and the tolerance', /more than the tolerance/.test(mismatch(12, 10, 0.5) || ''), mismatch(12, 10, 0.5));
{ /* the old formulas of the harnesses, against the guarded ones, on random finite cases: identical decisions */
  let seed = 1; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const oldLE = (g, w, tol) => Math.abs(g - w) <= tol, oldGT = (g, w, tol) => !(Math.abs(g - w) > tol);
  let disagree = 0;
  for (let i = 0; i < 20000; i++) {
    const w = (rnd() - 0.5) * Math.pow(10, Math.floor(rnd() * 8) - 3), rel = rnd() * 1e-3, abs = rnd() < 0.5 ? 0 : rnd() * 1e-2;
    const tol = abs + rel * Math.abs(w), g = w + (rnd() - 0.5) * 4 * tol + (rnd() < 0.1 ? tol : 0);
    if (oldLE(g, w, tol) !== within(g, w, tol) || oldGT(g, w, tol) !== within(g, w, tol)) disagree++;
  }
  check('5 old and guarded comparisons agree on 20,000 random finite cases (tolerances unchanged)', disagree === 0, `${disagree} disagreements`);
}

/* 6. the deliberately wrong cases of the GH-DEF-037 reproduction */
{ /* unit-system verify(), before: fail only when !isFinite(got) || |got - want| > 0.5*10^-d + rel*|want| */
  const oldVerifyPasses = (got, want, d, rel) => !(!Number.isFinite(got) || Math.abs(got - want) > 0.5 * Math.pow(10, -d) + rel * Math.abs(want));
  const newVerifyPasses = (got, want, d, rel) => within(got, want, 0.5 * Math.pow(10, -d) + rel * Math.abs(want));
  for (const [what, want] of [['1/0', 1 / 0], ['0/0', 0 / 0]]) {
    check(`6 unit-system: expected ${what} PASSED the old comparison (the reproduction)`, oldVerifyPasses(899, want, 0, 6e-3), 'the old comparison already failed it');
    check(`6 unit-system: expected ${what} FAILS the guarded comparison`, !newVerifyPasses(899, want, 0, 6e-3), 'still passes');
  }
  /* a relative-tolerance approx() (structural tests), before: |got - want| <= 0.5*10^-d + rel*|want| */
  const oldApprox = (got, want, rel, d) => Math.abs(got - want) <= 0.5 * Math.pow(10, -d) + rel * Math.abs(want);
  check('6 approx(): expected Infinity PASSED the old helper', oldApprox(123, Infinity, 2e-4, 2), 'the old helper already failed it');
  check('6 approx(): expected Infinity FAILS the guarded helper', !within(123, Infinity, 0.5 * Math.pow(10, -2) + 2e-4 * Math.abs(Infinity)), 'still passes');
  /* blank page text, before: Number('') = 0 matched an expected 0 */
  check('6 a blank result PASSED the old comparison when 0 was expected', oldVerifyPasses(Number(''), 0, 0, 1e-4), 'the old comparison already failed it');
  check('6 a blank result FAILS the guarded comparison when 0 is expected', !newVerifyPasses(parseShown(''), 0, 0, 1e-4), 'still passes');
}

console.log(log.join('\n'));
console.log(`\nnumeric-guard tests: ${checks} checks, ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
