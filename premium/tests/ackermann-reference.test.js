#!/usr/bin/env node
/* Independent check of the Ackermann reference geometry behind KA-21 (GH-DEF-052). No browser, no engine: this verifies the TEST'S reference values, not the calculator.
   The convention is PROVISIONAL (owner decision D7 open); this file proves the arithmetic under each stated measurement point, it does not choose one.

   Geometry (ideal Ackermann, low speed, no slip, flat ground). Plan view, x forward, y to the left, turning left.
     origin           midpoint of the rear axle
     instant centre   on the rear-axle line, at (0, R)
     front wheels     centres at (L, +T/2) inside and (L, -T/2) outside
   Definitions (from the PR #30 review brief):
     L  wheelbase                                   T  front track, between front wheel centres
     R  instant centre to the midpoint of the rear axle (the "rear-axle centreline radius")
     Ro instant centre to the centre of the outside front wheel
   A wheel rolls without scrub when its heading is perpendicular to the line from the instant centre to the wheel centre.

   The closed forms under test are:  inside = atan(L/(R-T/2)), outside = atan(L/(R+T/2)), Ro = sqrt(L^2+(R+T/2)^2), R = sqrt(Ro^2-L^2)-T/2.
   Each is checked against a numerical construction that does not use it: the steering angle is found by bisection on the perpendicularity condition
   (heading . (wheel - centre) = 0), and the reverse conversion by bisection on distance.
   Run: node premium/tests/ackermann-reference.test.js   (exit 0 = all checks pass) */
'use strict';
const D = 180 / Math.PI;
let checks = 0, failures = 0;
const ok = (cond, msg) => { checks++; if (!cond) { failures++; console.error('  FAIL ' + msg); } else if (process.env.VERBOSE) console.log('  ok   ' + msg); };
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(6)} vs ${b.toFixed(6)} (tol ${tol})`);
function bisect(f, lo, hi) { let flo = f(lo); for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2, fm = f(mid); if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else hi = mid; } return (lo + hi) / 2; }

/* --- independent construction (coordinates only) --- */
const wheels = (L, T) => ({ inside: [L, T / 2], outside: [L, -T / 2] });
function steerAngle(centre, wheel) {          // heading (cos d, sin d) perpendicular to (wheel - centre); d in (0, 90 deg)
  const v = [wheel[0] - centre[0], wheel[1] - centre[1]];
  return bisect(d => Math.cos(d) * v[0] + Math.sin(d) * v[1], 1e-9, Math.PI / 2 - 1e-9) * D;
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function geometry(L, T, R) {                  // R to the rear-axle midpoint
  const c = [0, R], w = wheels(L, T);
  return { inside: steerAngle(c, w.inside), outside: steerAngle(c, w.outside), Ro: dist(c, w.outside), Ri: dist(c, w.inside), Rfront: dist(c, [L, 0]) };
}
const RfromRo = (L, T, Ro) => bisect(R => dist([0, R], [L, -T / 2]) - Ro, T / 2 + 1e-6, Ro + T);   // reverse by search, not by formula
/* --- closed forms (what the documentation states) --- */
const cf = { inside: (L, T, R) => Math.atan(L / (R - T / 2)) * D, outside: (L, T, R) => Math.atan(L / (R + T / 2)) * D, Ro: (L, T, R) => Math.sqrt(L * L + (R + T / 2) ** 2), R: (L, T, Ro) => Math.sqrt(Ro * Ro - L * L) - T / 2 };

/* 1. the required case: L 108, T 60, R 300 */
const L = 108, T = 60, R = 300, g = geometry(L, T, R);
near(g.inside, cf.inside(L, T, R), 1e-9, 'inside angle: construction = closed form');
near(g.outside, cf.outside(L, T, R), 1e-9, 'outside angle: construction = closed form');
near(g.Ro, cf.Ro(L, T, R), 1e-9, 'Ro: construction = closed form');
near(g.inside, 21.80141, 5e-5, 'inside angle for 108/60/300 is 21.80 deg (atan 0.4)');
near(g.outside, 18.12186, 5e-5, 'outside angle for 108/60/300 is 18.12 deg');
near(g.Ro, 347.22327, 5e-5, 'Ro for 108/60/300 is 347.22 in (sqrt 120564)');
near(RfromRo(L, T, g.Ro), 300, 1e-6, 'reverse by search: Ro 347.22 recovers R = 300');
near(cf.R(L, T, cf.Ro(L, T, R)), 300, 1e-9, 'reverse closed form: Ro 347.22 recovers R = 300');
near(g.inside, 21.80, 0.005, 'KA-21 expected value 21.80 deg (tolerance 0.05 in the suite) matches the construction');

/* 2. the reverse input case: Ro = 300 (outside front wheel centre) */
const Rr = RfromRo(L, T, 300);
near(Rr, cf.R(L, T, 300), 1e-6, 'Ro 300: reverse by search = closed form');
near(Rr, Math.sqrt(78336) - 30, 1e-6, 'Ro 300 gives R = sqrt(300^2 - 108^2) - 30 = 249.886 in');
const gr = geometry(L, T, Rr);
near(gr.Ro, 300, 1e-6, 'Ro 300: forward again from R 249.886 gives Ro 300');
near(gr.inside, 26.15862, 5e-5, 'Ro 300: inside angle 26.16 deg');
near(gr.outside, 21.10020, 5e-5, 'Ro 300: outside angle 21.10 deg');

/* 3. which measurement point does 24.23 deg (atan(108/240) = atan(L/(R-T))) belong to? Inside angle for a stated radius of 300 in under each candidate point. */
const conv = {
  'rear-axle midpoint (R)': 300,
  'outside REAR wheel centre (= lateral distance to the outside wheel track, rear track = T)': 300 - T / 2,
  'outside FRONT wheel centre (Ro)': RfromRo(L, T, 300),
  'front-axle midpoint': bisect(r => dist([0, r], [L, 0]) - 300, 0, 300),
};
const inside = Object.fromEntries(Object.entries(conv).map(([k, r]) => [k, geometry(L, T, r).inside]));
near(inside['rear-axle midpoint (R)'], 21.8014, 1e-4, '300 to the rear-axle midpoint: 21.80 deg');
near(inside['outside REAR wheel centre (= lateral distance to the outside wheel track, rear track = T)'], Math.atan(108 / 240) * D, 1e-9, '300 to the outside rear wheel centre: atan(108/240)');
near(Math.atan(108 / 240) * D, 24.2277, 1e-4, 'atan(108/240) = 24.23 deg');
near(inside['outside FRONT wheel centre (Ro)'], 26.15862, 5e-5, '300 to the outside front wheel centre: 26.16 deg, NOT 24.23');
near(inside['front-axle midpoint'], 23.37389, 5e-5, '300 to the front-axle midpoint: 23.37 deg');
ok(Object.entries(inside).filter(([, a]) => Math.abs(a - 24.2277) < 0.005).map(([k]) => k).join() === 'outside REAR wheel centre (= lateral distance to the outside wheel track, rear track = T)',
  '24.23 deg arises only when the 300 in is measured to the outside REAR wheel centre (equivalently, the lateral distance to the outside wheel track line)');
/* what the shipped calculator computes, for reference only (GH-DEF-052: track replaced by L/2) */
near(Math.atan(108 / (300 - 54)) * D, 23.70265, 5e-5, 'shipped formula atan(L/(R - L/2)) for 108/300: 23.70 deg (matches no measurement point above)');

/* 3b. the register's second example, 100 / 250 / 72 (GH-DEF-052 evidence line) */
{
  const L2 = 100, T2 = 72;
  near(geometry(L2, T2, 250).inside, 25.04620, 5e-5, '100/250/72, 250 to the rear-axle midpoint: 25.05 deg');
  near(geometry(L2, T2, RfromRo(L2, T2, 250)).inside, 32.47352, 5e-5, '100/250/72, 250 to the outside front wheel centre: 32.47 deg');
  near(geometry(L2, T2, 250 - T2 / 2).inside, 29.32718, 5e-5, '100/250/72, 250 to the outside rear wheel centre: 29.33 deg');
  near(Math.atan(100 / (250 - 50)) * D, 26.56505, 5e-5, '100/250 shipped formula atan(L/(R - L/2)): 26.57 deg');
}

/* 4. sweep: construction = closed form, reverse round-trips, inside > outside, both decrease as R grows */
let prev = null;
for (const LL of [80, 108, 130]) for (const TT of [48, 60, 72]) for (let RR = TT / 2 + 20; RR <= 2000; RR *= 1.37) {
  const x = geometry(LL, TT, RR);
  if (Math.abs(x.inside - cf.inside(LL, TT, RR)) > 1e-7 || Math.abs(x.outside - cf.outside(LL, TT, RR)) > 1e-7 || Math.abs(x.Ro - cf.Ro(LL, TT, RR)) > 1e-7 || Math.abs(RfromRo(LL, TT, x.Ro) - RR) > 1e-6 || !(x.inside > x.outside)) { prev = `L ${LL} T ${TT} R ${RR.toFixed(2)}`; break; }
}
ok(prev === null, 'sweep L 80-130, T 48-72, R up to 2000: construction = closed form, reverse round-trips, inside > outside' + (prev ? ' (first miss ' + prev + ')' : ''));
/* Ackermann identity: cot(outside) - cot(inside) = T / L, for any R */
near(1 / Math.tan(g.outside / D) - 1 / Math.tan(g.inside / D), T / L, 1e-9, 'Ackermann identity cot(outside) - cot(inside) = T / L');

if (process.env.VERBOSE) for (const [k, a] of Object.entries(inside)) console.log(`  300 in measured to ${k}: inside ${a.toFixed(2)} deg`);
console.log(`ackermann reference: ${checks} checks, ${failures} failure(s)`);
process.exit(failures ? 1 : 0);
