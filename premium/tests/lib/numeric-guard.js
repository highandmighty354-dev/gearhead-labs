/* Gearhead Labs — shared numeric guard for the browser test harnesses (docs/DEFERRED-WORK-REGISTER.md, GH-DEF-037).

   THE WEAKNESS IT CLOSES. A check written as |got - want| > tol fails nothing when got or want is NaN (every comparison with NaN is false), and a check
   whose tolerance grows with |want| (tol = ... + rel * |want|) passes when want is Infinity (Infinity <= Infinity). A blank page text read with Number('')
   becomes 0, a plausible number. So a wrong test case (an expected value that is NaN or infinite) or a blank result could pass silently.

   THE RULE (every tolerance helper of the harnesses delegates to it, so a caller cannot bypass it):
     - the expected value must be a finite number, or the check fails ("expected value is not finite");
     - the actual value must be a finite number, or the check fails ("actual value is not finite" / "is blank or not a number");
     - the tolerance must be finite and not negative;
     - then the check passes when |got - want| <= tol, exactly as the caller's own formula says (tolerances are not changed).
   A legitimate zero is a finite number and passes like any other. A test that intentionally expects a non-finite result must say so explicitly (compare
   with Number.isNaN / === Infinity itself); this guard is for ordinary numeric assertions.
   parseShown() reads a page or box text as a number: blank, missing, "—" or anything that is not a number gives NaN, never 0. */
'use strict';

/* a page / box text as a number: thousands separators, a typographic minus and a leading "~" are tolerated; blank or non-numeric -> NaN */
function parseShown(text) {
  if (text === null || text === undefined) return NaN;
  const t = String(text).replace(/,/g, '').replace(/[−–]/g, '-').replace(/^~\s*/, '').trim();
  if (t === '') return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/* null when |got - want| <= tol with finite got, want and tol; otherwise the reason, for the failure message */
function mismatch(got, want, tol) {
  if (typeof want !== 'number' || !Number.isFinite(want)) return `the expected value is not finite (${want}): the test case or its inputs are wrong`;
  if (typeof got !== 'number' || Number.isNaN(got)) return `the actual value is blank or not a number (${got})`;
  if (!Number.isFinite(got)) return `the actual value is not finite (${got})`;
  if (typeof tol !== 'number' || !Number.isFinite(tol) || tol < 0) return `the tolerance is not a finite, non-negative number (${tol})`;
  const d = Math.abs(got - want);
  return d <= tol ? null : `|actual - expected| = ${+d.toPrecision(6)} is more than the tolerance ${+tol.toPrecision(6)}`;
}

/* true when mismatch() is null */
function within(got, want, tol) { return mismatch(got, want, tol) === null; }

module.exports = { parseShown, mismatch, within };
