#!/usr/bin/env node
/* Gearhead Labs — M1: one calculation path for the six-calculator Engine Build chain, against independent known answers.

   The six: Engine Displacement (engine_displacement), Engine Airflow Estimation (engine_airflow_estimate), Airflow -> Power Estimate
   (airflow_power_estimate), Fuel Injector Sizing (Quick) (injector_sizing), Fuel Pump Sizing (fuel_pump_sizing) and Port Velocity (port_velocity,
   drawn by the CFM <-> Velocity <-> CSA page, velocity mode). Each page reads its boxes as before and shows the registry's answer
   (GH_ENGINE.calculate); see GH_ENGINE_PAGE_BRIDGE in the engine.

   INDEPENDENT REFERENCES. Nothing below is taken from the engine. Every expected value is written twice: as a literal worked out by hand (checked
   separately with exact unit definitions) and recomputed here from first principles; the two must agree before the engine is compared with either.
     displacement   = (pi/4) bore^2 stroke cylinders                                         [in -> in^3; mm -> cm^3 directly in SI]
     engine flow    = displacement * rpm * (intake strokes per rev: 4-stroke 1/2, 2-stroke 1) * VE   [in^3/min; / 1728 -> ft^3/min]
     ambient equiv. = flow * MAP / barometric;  air mass = flow * density
     power          = air mass / AFR (= fuel mass flow) / BSFC                               [lb/min * 60 / (lb/hp-hr) -> hp]
     torque         = hp * 5252 / rpm  (5252 is the registry's rounded 33000/(2 pi); the exact value differs by 2.1e-5 relative, checked separately)
     injector flow  = hp * BSFC / (injectors * duty) [lb/hr];  cc/min = (lb/hr rounded to 0.1) * 10.5 (the calculator's stated gasoline factor)
     pump delivery  = hp * BSFC / fuel density * margin [lb/hr / (lb/gal) -> gal/hr]
     port velocity  = CFM * 144 / (area in^2 * 60) [ft/s]  — SI: Q [m^3/s] / A [m^2]
   Exact unit definitions: 1 in = 0.0254 m, 1 ft = 0.3048 m, 1 lb = 0.45359237 kg, g = 9.80665 m/s^2, 1 hp = 550 ft*lbf/s, 1 gal = 3.785411784 L,
   1 psi = 6894.757293168 Pa, 1 bar = 1e5 Pa.

   Sections
     R  registry known answers (Imperial, the registry's canonical units) and the hand-literal / first-principles cross-check
     P  the page in Imperial: typed values, shown rows vs the known answers at the page's display precision
     M  the page in Metric: the same physical cases typed in the units the boxes show, shown rows vs SI-derived answers
     V  invalid inputs: an explicit result state from the registry and a "Validation required" box on the page, never a number
     B  boundaries that stay valid (AFR 0.1, BSFC 0.05, 1 cylinder) and give the same numbers as the formula
     K  Airflow -> Power torque at 600 RPM is hp x 5252 / 600 (GH-DEF-040: the former 800 RPM floor is removed)
     S  single path: the page's numbers move when (and only when) the registry's answer is altered in the page
     N  the Formula cards' plain-language notes (four-stroke factor, when a result is shown, torque at every RPM) and that their facts match the registry

   Run: node premium/tests/engine-chain-m1.test.js   (VERBOSE=1 prints passes; GH_ENGINE=path tests another copy of the engine)
   Exit code 0 = every check passed, 1 = at least one failed. */
'use strict';
const { within } = require('./lib/numeric-guard');   // GH-DEF-037: a blank, NaN or infinite value always fails
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const F124 = 'F1_12_4_Gearhead_Labs_Automotive_Math_Encyclopedia_Universal_batch9_1.html';
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); }
const CHROMIUM = process.env.GH_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

/* exact definitions */
const IN = 0.0254, FT = 0.3048, LB = 0.45359237, G0 = 9.80665, GAL_L = 3.785411784, PSI_PA = 6894.757293168;
const HP_W = 550 * FT * LB * G0;                         // 745.69987158227 W
const CI_CC = (IN * 100) ** 3;                           // 16.387064 cm^3 per in^3
const CF_L = FT ** 3 * 1000;                             // 28.316846592 L per ft^3
const KGM3_PER_LBFT3 = LB / FT ** 3;                     // 16.0184634 kg/m^3 per lb/ft^3
const KGKWH_PER_LBHPH = LB / (HP_W / 1000);              // 0.608277 kg/kW-hr per lb/hp-hr
const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

/* first-principles functions (Imperial) */
const dispCi = (b, s, n) => Math.PI / 4 * b * b * s * n;
const flowCfm = (d, rpm, ve, cyc) => d * rpm * (cyc === 2 ? 1 : 0.5) * ve / 1728;
const hpFrom = (massLbMin, afr, bsfc) => massLbMin / afr * 60 / bsfc;

/* the known answers, worked by hand (literals), with the inputs they belong to */
const K = {
  K1: { id: 'engine_displacement', in: { bore: 4.00, stroke: 3.48, cyl: 8 }, out: { displacement: 349.8477579037594 },
        indep: i => ({ displacement: dispCi(i.bore, i.stroke, i.cyl) }) },
  K2: { id: 'engine_airflow_estimate', in: { air_d: 350, air_r: 6000, air_n: 8, air_ve: 1.0, air_cycle: 4, air_rho: 0.0765, air_map: 14.7, air_baro: 14.7 },
        out: { engine_volume_flow: 607.6388888888889, cfm_per_cylinder: 75.95486111111111, ambient_equivalent_cfm: 607.6388888888889, air_mass_flow: 46.484375 },
        indep: i => { const q = flowCfm(i.air_d, i.air_r, i.air_ve, i.air_cycle); return { engine_volume_flow: q, cfm_per_cylinder: q / i.air_n, ambient_equivalent_cfm: q * i.air_map / i.air_baro, air_mass_flow: q * i.air_rho }; } },
  K3: { id: 'engine_airflow_estimate', in: { air_d: 350, air_r: 6000, air_n: 8, air_ve: 1.0, air_cycle: 2, air_rho: 0.0765, air_map: 29.4, air_baro: 14.7 },
        out: { engine_volume_flow: 1215.2777777777778, cfm_per_cylinder: 151.90972222222223, ambient_equivalent_cfm: 2430.5555555555557, air_mass_flow: 92.96875 },
        indep: i => { const q = flowCfm(i.air_d, i.air_r, i.air_ve, i.air_cycle); return { engine_volume_flow: q, cfm_per_cylinder: q / i.air_n, ambient_equivalent_cfm: q * i.air_map / i.air_baro, air_mass_flow: q * i.air_rho }; } },
  K4: { id: 'airflow_power_estimate', in: { ap_d: 350, ap_r: 6000, ap_ve: 1.0, ap_rho: 0.0765, ap_afr: 12.5, ap_bs: 0.5 },
        out: { estimated_airflow: 607.6388888888889, estimated_air_mass: 46.484375, estimated_fuel_flow: 3.71875, estimated_horsepower: 446.25, estimated_torque: 390.6175 },
        indep: i => { const q = flowCfm(i.ap_d, i.ap_r, i.ap_ve, 4), m = q * i.ap_rho, h = hpFrom(m, i.ap_afr, i.ap_bs); return { estimated_airflow: q, estimated_air_mass: m, estimated_fuel_flow: m / i.ap_afr, estimated_horsepower: h, estimated_torque: h * 5252 / i.ap_r }; } },
  K6: { id: 'injector_sizing', in: { hp9: 500, bsfc9: 0.5, inj: 8, duty: 0.8 }, out: { required_flow: 39.0625, flow_cc_min: 410.55 },
        indep: i => { const x = i.hp9 * i.bsfc9 / (i.inj * i.duty); return { required_flow: x, flow_cc_min: round(x, 1) * 10.5 }; } },
  K7: { id: 'fuel_pump_sizing', in: { hp10: 500, bsfc2: 0.5, fuel_density: 6.17, pump_margin: 1.25 }, out: { fuel_mass_flow: 250, required_pump_delivery: 50.6482982171799 },
        indep: i => ({ fuel_mass_flow: i.hp10 * i.bsfc2, required_pump_delivery: i.hp10 * i.bsfc2 / i.fuel_density * i.pump_margin }) },
  K8: { id: 'port_velocity', in: { cfm: 250, A: 2.0 }, out: { port_velocity: 300 },
        indep: i => ({ port_velocity: (i.cfm / 60) / (i.A / 144) }) }        // ft^3/s over ft^2
};

(async () => {
  let checks = 0, failures = 0; const lines = [];
  const check = (label, ok, detail) => { checks++; if (!ok) { failures++; lines.push(`  FAIL ${label}: ${detail}`); } else if (process.env.VERBOSE) lines.push(`  ok   ${label}`); };
  const relClose = (got, want, rel) => within(got, want, rel * Math.abs(want) + 1e-12);

  /* ---- 0: the hand literals against first principles, before the engine is involved ---- */
  for (const [k, c] of Object.entries(K)) {
    const ind = c.indep(c.in);
    for (const [key, want] of Object.entries(c.out)) check(`0 ${k} ${key}: hand literal = first principles`, relClose(ind[key], want, 1e-12), `literal ${want}, first principles ${ind[key]}`);
  }
  /* the torque constant: 5252 against the exact 33000/(2 pi) — documented, not a defect of M1 */
  { const exact = 550 * 60 / (2 * Math.PI); check('0 torque constant 5252 vs 33000/(2 pi)', Math.abs(5252 / exact - 1) < 2.2e-5, `5252 / ${exact} - 1 = ${5252 / exact - 1}`); }
  /* the unit conversions used by section M, against their SI definitions */
  check('0 1 in^3 = 16.387064 cm^3', relClose(CI_CC, 16.387064, 1e-15), String(CI_CC));
  check('0 1 ft^3 = 28.316846592 L', relClose(CF_L, 28.316846592, 1e-15), String(CF_L));
  check('0 1 hp = 745.69987158227 W', relClose(HP_W, 745.69987158227022, 1e-15), String(HP_W));
  check('0 1 lb/ft^3 = 16.01846337 kg/m^3', relClose(KGM3_PER_LBFT3, 16.018463373960138, 1e-14), String(KGM3_PER_LBFT3));
  check('0 1 lb/hp-hr = 0.608277388 kg/kW-hr', relClose(KGKWH_PER_LBHPH, 0.60827738784, 1e-10), String(KGKWH_PER_LBHPH));
  check('0 1 psi = 0.06894757 bar', relClose(PSI_PA / 1e5, 0.06894757293168, 1e-15), String(PSI_PA / 1e5));

  const browser = await playwright.chromium.launch({ executablePath: CHROMIUM });
  const page = await (await browser.newContext()).newPage(); page.setDefaultTimeout(8000);
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e)));
  await page.goto('file://' + (process.env.GH_ENGINE ? path.resolve(process.env.GH_ENGINE) : path.join(REPO, F124)), { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(500);
  const calc = (id, inputs) => page.evaluate(([i, x]) => GH_ENGINE.calculate(i, x), [id, inputs]);
  const outVal = (r, key) => { const o = (r.outputs || []).find(x => x.key === key); return o ? o.value : undefined; };

  /* ---- R: registry known answers ---- */
  for (const [k, c] of Object.entries(K)) {
    const r = await calc(c.id, c.in);
    check(`R ${k} ${c.id} state`, r.state === 'VALID', `state ${r.state} ${JSON.stringify(r.warnings)}`);
    for (const [key, want] of Object.entries(c.out)) {
      const o = r.outputs.find(x => x.key === key);
      check(`R ${k} ${c.id} ${key}`, !!o && relClose(o.value, want, 1e-12), `registry ${o ? o.value : 'no such output'}, known answer ${want}`);
    }
  }

  /* ---- page helpers ---- */
  const open = async (id, sys) => {
    await page.evaluate(s => { if (UNIT.system !== s) setUnit(s); }, sys);
    await page.evaluate(() => { renderCalc('dashboard', false); });
    await page.waitForTimeout(120);
    await page.evaluate(i => { try { delete CALC_PERSISTENT_STATE[i]; delete CALC_PERSISTENT_STATE.cfm_velocity_csa; } catch (e) {} renderCalc(i, false); }, id);
    await page.waitForTimeout(120);
  };
  const type = async (id, v) => { await page.click('#' + id); await page.fill('#' + id, String(v)); await page.waitForTimeout(25); };
  const fill = async values => { for (const [id, v] of Object.entries(values)) { if (id === 'air_cycle') { await page.selectOption('#air_cycle', String(v)); await page.waitForTimeout(25); } else await type(id, v); } };
  /* every result row on screen: label -> { v: number, d: decimals shown, u: unit } ; a "Validation required" box is reported as invalid */
  const shown = () => page.evaluate(() => {
    const rows = {}; let invalid = false;
    document.querySelectorAll('#calc-container .mini-result, #calc-container .result-box').forEach(b => {
      const l = b.querySelector('.label, .result-label'), v = b.querySelector('.value, .result-value'); if (!l || !v) return;
      const label = l.textContent.trim(); if (label === 'Validation required') { invalid = true; return; }
      const u = v.querySelector('.unit, .result-unit'), unit = u ? u.textContent.trim() : '';
      const t = (u ? v.textContent.replace(u.textContent, '') : v.textContent).replace(/[~,\s]/g, '');
      const m = t.match(/^-?\d+(?:\.(\d+))?$/);
      rows[label] = { v: m ? Number(t) : NaN, d: m && m[1] ? m[1].length : 0, u: unit, raw: v.textContent.trim() };
    });
    return { rows, invalid };
  });
  /* a shown row equals the expected value at its display precision (half a unit in the last digit shown, plus slack for rounding inside the page) */
  const rowCheck = (tag, s, label, want, unit, extraRel = 0) => {
    const r = s.rows[label];
    if (!r) return check(`${tag} ${label}`, false, `no "${label}" row (rows: ${Object.keys(s.rows).join(', ') || 'none'}${s.invalid ? '; Validation required shown' : ''})`);
    const tol = 0.5 * 10 ** -r.d + 1e-9 + extraRel * Math.abs(want);
    check(`${tag} ${label}`, within(r.v, want, tol) && r.u === unit, `shows ${r.raw} (${r.v} ${r.u}), expected ${want} ${unit} (±${tol.toPrecision(3)})`);
  };

  /* ---- P: the page in Imperial, typed known answers ---- */
  {
    let s;
    await open('engine_displacement', 'imperial'); await fill({ bore_d: 4.00, str_d: 3.48, cyl_d: 8 }); s = await shown();
    rowCheck('P K1', s, 'Displacement', K.K1.out.displacement, 'ci', 0);
    for (const k of ['K2', 'K3']) {
      await open('engine_airflow_estimate', 'imperial'); await fill(K[k].in); s = await shown(); const o = K[k].out;
      rowCheck(`P ${k}`, s, 'Engine Volume Flow', o.engine_volume_flow, 'CFM'); rowCheck(`P ${k}`, s, 'CFM per Cylinder', o.cfm_per_cylinder, 'CFM/cyl');
      rowCheck(`P ${k}`, s, 'Ambient-Equivalent CFM', o.ambient_equivalent_cfm, 'CFM'); rowCheck(`P ${k}`, s, 'Air Mass Flow', o.air_mass_flow, 'lb/min');
    }
    await open('airflow_power_estimate', 'imperial'); await fill(K.K4.in); s = await shown();
    rowCheck('P K4', s, 'Estimated Airflow', K.K4.out.estimated_airflow, 'CFM'); rowCheck('P K4', s, 'Estimated Air Mass', K.K4.out.estimated_air_mass, 'lb/min');
    rowCheck('P K4', s, 'Estimated Fuel Flow', K.K4.out.estimated_fuel_flow, 'lb/min'); rowCheck('P K4', s, 'Estimated Horsepower', K.K4.out.estimated_horsepower, 'HP');
    rowCheck('P K4', s, 'Estimated Torque', K.K4.out.estimated_torque, 'lb-ft');
    await open('injector_sizing', 'imperial'); await fill(K.K6.in); s = await shown();
    rowCheck('P K6 (display rounded to 0.1 lb/hr)', s, 'Required Flow', 39.1, 'lb/hr'); rowCheck('P K6 (display rounded to whole cc/min)', s, 'Flow (cc/min)', 411, 'cc/min');
    await open('fuel_pump_sizing', 'imperial'); await fill(K.K7.in); s = await shown();
    rowCheck('P K7', s, 'Fuel Mass Flow', 250, 'lb/hr'); rowCheck('P K7', s, 'Required Pump Delivery', K.K7.out.required_pump_delivery, 'GPH');
    await open('port_velocity', 'imperial'); await fill({ cvc_q: 250, cvc_a: 2.0 }); s = await shown();
    rowCheck('P K8', s, 'Solved Average Velocity', 300, 'ft/sec');
  }

  /* ---- M: the page in Metric — the same physical cases typed in the units the boxes show, answers from SI ---- */
  {
    let s;
    await open('engine_displacement', 'metric'); await fill({ bore_d: 101.6, str_d: 88.392, cyl_d: 8 }); s = await shown();
    rowCheck('M K1', s, 'Displacement', Math.PI / 4 * 10.16 ** 2 * 8.8392 * 8, 'cc', 2e-6);           // cm: the page rounds to 0.001 in^3 (= 0.016 cm^3) first
    /* 350 in^3 typed as 5735.4724 cc; density 1.225 kg/m^3; MAP 2 bar over 1 bar */
    const V_L = 350 * CI_CC / 1000, rhoSI = 1.225;
    await open('engine_airflow_estimate', 'metric'); await fill({ air_d: 5735.4724, air_r: 6000, air_n: 8, air_ve: 1, air_cycle: 4, air_rho: rhoSI, air_map: 2, air_baro: 1 }); s = await shown();
    const Ql = V_L * 6000 / 2;                                                                          // L/min
    rowCheck('M K2', s, 'Engine Volume Flow', Ql, 'L/min', 1e-9); rowCheck('M K2', s, 'CFM per Cylinder', Ql / 8, 'L/min/cyl', 1e-9);
    rowCheck('M K2', s, 'Ambient-Equivalent CFM', Ql * 2, 'L/min', 1e-9);
    rowCheck('M K2 (row still labelled lb/min in Metric: label correction deferred, D5)', s, 'Air Mass Flow', Ql / 1000 * rhoSI / LB, 'lb/min', 1e-9);
    await open('airflow_power_estimate', 'metric'); await fill({ ap_d: 5735.4724, ap_r: 6000, ap_ve: 1, ap_rho: rhoSI, ap_afr: 12.5, ap_bs: 0.3 }); s = await shown();
    const massKgMin = Ql / 1000 * rhoSI, fuelKgH = massKgMin * 60 / 12.5, kW = fuelKgH / 0.3, hp = kW * 1000 / HP_W;
    rowCheck('M K4', s, 'Estimated Airflow', Ql, 'L/min', 1e-9);
    rowCheck('M K4 (lb/min, D5)', s, 'Estimated Air Mass', massKgMin / LB, 'lb/min', 1e-9);
    rowCheck('M K4 (lb/min, D5)', s, 'Estimated Fuel Flow', massKgMin / 12.5 / LB, 'lb/min', 1e-9);
    rowCheck('M K4 (power preference: HP)', s, 'Estimated Horsepower', hp, 'HP', 1e-9);
    const torqueExactLbFt = (kW * 1000 / (6000 * 2 * Math.PI / 60)) / (LB * G0 * FT);                    // N*m -> lb-ft
    rowCheck('M K4 (torque, 5252 constant: 2.2e-5 relative slack)', s, 'Estimated Torque', torqueExactLbFt, 'lb-ft', 2.2e-5);
    await open('injector_sizing', 'metric'); await fill({ hp9: 500, bsfc9: 0.3, inj: 8, duty: 0.8 }); s = await shown();
    const lbhr = 500 * (0.3 / KGKWH_PER_LBHPH) / 6.4;                                                    // the page rounds lb/hr to 0.1 before showing / converting
    rowCheck('M K6', s, 'Required Flow', round(lbhr, 1) * LB, 'kg/hr', 1e-9);
    rowCheck('M K6 (cc/min shown as L/min)', s, 'Flow (cc/min)', Math.round(round(lbhr, 1) * 10.5) / 1000, 'L/min', 1e-9);
    await open('fuel_pump_sizing', 'metric'); await fill({ hp10: 500, bsfc2: 0.3, fuel_density: 6.17, pump_margin: 1.25 }); s = await shown();
    const fuelKgHr = 500 * HP_W / 1000 * 0.3;                                                             // kW * kg/kW-hr
    rowCheck('M K7', s, 'Fuel Mass Flow', fuelKgHr, 'kg/hr', 1e-9);
    rowCheck('M K7 (density box stays lb/gal)', s, 'Required Pump Delivery', fuelKgHr / LB / 6.17 * 1.25 * GAL_L, 'L/h', 1e-9);
    await open('port_velocity', 'metric'); await fill({ cvc_q: 7079.211648, cvc_a: 1290.32 }); s = await shown();
    rowCheck('M K8', s, 'Solved Average Velocity', (7079.211648 / 1000 / 60) / (1290.32e-6), 'm/s', 1e-9);   // 91.44 m/s = 300 ft/s
  }

  /* ---- V: invalid inputs — explicit registry state and a validation box on the page ---- */
  {
    const AIR = K.K2.in, AP = K.K4.in, INJ = K.K6.in, DISP = K.K1.in, PV = K.K8.in;
    const CASES = [
      ['engine_airflow_estimate', { air_n: 0 }, 'OUT_OF_RANGE', 'cylinders 0 (was raised to 1)'],
      ['engine_airflow_estimate', { air_n: 7.5 }, 'OUT_OF_RANGE', 'cylinders 7.5 (was rounded to 8)'],
      ['engine_airflow_estimate', { air_n: -8 }, 'OUT_OF_RANGE', 'cylinders -8 (was raised to 1)'],
      ['engine_airflow_estimate', { air_d: 0 }, 'OUT_OF_RANGE', 'displacement 0'],
      ['engine_airflow_estimate', { air_d: -350 }, 'OUT_OF_RANGE', 'negative displacement'],
      ['engine_airflow_estimate', { air_r: 0 }, 'OUT_OF_RANGE', 'RPM 0'],
      ['engine_airflow_estimate', { air_ve: 0 }, 'OUT_OF_RANGE', 'VE 0'],
      ['engine_airflow_estimate', { air_rho: 0 }, 'OUT_OF_RANGE', 'air density 0'],
      ['engine_airflow_estimate', { air_map: 0 }, 'OUT_OF_RANGE', 'MAP 0'],
      ['engine_airflow_estimate', { air_baro: 0 }, 'OUT_OF_RANGE', 'barometric 0 (was a division by zero)'],
      ['engine_airflow_estimate', { air_cycle: 3 }, 'INCOMPLETE', 'cycle 3 is not a declared choice', true],
      ['airflow_power_estimate', { ap_afr: 0 }, 'OUT_OF_RANGE', 'AFR 0 (was raised to 0.1)'],
      ['airflow_power_estimate', { ap_afr: 0.05 }, 'OUT_OF_RANGE', 'AFR 0.05 (was raised to 0.1)'],
      ['airflow_power_estimate', { ap_bs: 0 }, 'OUT_OF_RANGE', 'BSFC 0 (was raised to 0.05)'],
      ['airflow_power_estimate', { ap_bs: 0.04 }, 'OUT_OF_RANGE', 'BSFC 0.04 (was raised to 0.05)'],
      ['airflow_power_estimate', { ap_r: 0 }, 'OUT_OF_RANGE', 'RPM 0'],
      ['airflow_power_estimate', { ap_d: -350 }, 'OUT_OF_RANGE', 'negative displacement'],
      ['airflow_power_estimate', { ap_ve: 0 }, 'OUT_OF_RANGE', 'VE 0'],
      ['airflow_power_estimate', { ap_rho: -0.0765 }, 'OUT_OF_RANGE', 'negative density'],
      ['injector_sizing', { duty: 0 }, 'OUT_OF_RANGE', 'duty cycle 0 (division by zero)'],
      ['injector_sizing', { inj: 0 }, 'OUT_OF_RANGE', 'no injectors (division by zero)'],
      ['port_velocity', { A: 0 }, 'OUT_OF_RANGE', 'port area 0 (division by zero)'],
      /* D1: the Fuel Pump page's rule is the registry's validity condition (the page already refused these; the registry used to return a number) */
      ['fuel_pump_sizing', { pump_margin: 0.5 }, 'OUT_OF_RANGE', 'D1 margin 0.5'],
      ['fuel_pump_sizing', { pump_margin: 0.99 }, 'OUT_OF_RANGE', 'D1 margin 0.99'],
      ['fuel_pump_sizing', { hp10: 0 }, 'OUT_OF_RANGE', 'D1 horsepower 0'],
      ['fuel_pump_sizing', { hp10: -425 }, 'OUT_OF_RANGE', 'D1 negative horsepower'],
      ['fuel_pump_sizing', { bsfc2: 0 }, 'OUT_OF_RANGE', 'D1 BSFC 0'],
      ['fuel_pump_sizing', { fuel_density: 0 }, 'OUT_OF_RANGE', 'D1 fuel density 0'],
      ['fuel_pump_sizing', { fuel_density: -6.17 }, 'OUT_OF_RANGE', 'D1 negative fuel density']
    ];
    const baseOf = { engine_airflow_estimate: AIR, airflow_power_estimate: AP, injector_sizing: INJ, engine_displacement: DISP, port_velocity: PV, fuel_pump_sizing: K.K7.in };
    const BOX = { cfm: 'cvc_q', A: 'cvc_a' };
    for (const [id, change, state, why, registryOnly] of CASES) {
      const inp = Object.assign({}, baseOf[id], change), r = await calc(id, inp);
      check(`V ${id} ${why}: registry state`, r.state === state && r.outputs.every(o => o.value === null), `state ${r.state}, outputs ${JSON.stringify(r.outputs.map(o => o.value))}`);
      if (registryOnly) continue;   // a select offers 4 and 2 only: a third cycle cannot be entered on the page
      await open(id, 'imperial');
      const typed = {}; for (const [k, v] of Object.entries(inp)) typed[BOX[k] || k] = v;
      await fill(typed); const s = await shown();
      check(`V ${id} ${why}: page shows "Validation required" and no result number`, s.invalid && Object.keys(s.rows).length === 0, `invalid=${s.invalid}, rows ${JSON.stringify(s.rows)}`);
    }
    /* documented, NOT changed in M1 (the registry formulas of these three are production-seeded; correcting them is a versioned formula change): */
    const known = [
      ['engine_displacement', Object.assign({}, DISP, { bore: -4 }), 'negative bore gives a positive displacement (bore is squared)'],
      ['injector_sizing', Object.assign({}, INJ, { inj: -8 }), 'negative injector count gives a negative flow'],
      ['port_velocity', Object.assign({}, PV, { A: -2 }), 'negative port area gives a negative velocity']
    ];
    for (const [id, inp, why] of known) { const r = await calc(id, inp); check(`V KNOWN ${id}: ${why} (unchanged, recorded)`, r.state === 'VALID', `state ${r.state}`); }
  }

  /* ---- B: boundaries that stay valid ---- */
  {
    const AP = Object.assign({}, K.K4.in, { ap_afr: 0.1, ap_bs: 0.05 }), r = await calc('airflow_power_estimate', AP);
    const q = flowCfm(350, 6000, 1, 4), h = hpFrom(q * 0.0765, 0.1, 0.05);
    check('B AFR 0.1 and BSFC 0.05 are accepted', r.state === 'VALID' && relClose(outVal(r, 'estimated_horsepower'), h, 1e-12), `state ${r.state}, hp ${JSON.stringify(r.outputs.map(o => o.value))}, expected ${h}`);
    const one = await calc('engine_airflow_estimate', Object.assign({}, K.K2.in, { air_n: 1 }));
    check('B one cylinder is accepted', one.state === 'VALID' && relClose(outVal(one, 'cfm_per_cylinder'), flowCfm(350, 6000, 1, 4), 1e-12), `state ${one.state}`);
    const m1 = await calc('fuel_pump_sizing', Object.assign({}, K.K7.in, { pump_margin: 1 }));
    check('B D1 a margin of exactly 1.0 is accepted', m1.state === 'VALID' && relClose(outVal(m1, 'required_pump_delivery'), 500 * 0.5 / 6.17, 1e-12), `state ${m1.state}`);
    const nn = await calc('fuel_pump_sizing', Object.assign({}, K.K7.in, { hp10: null }));
    check('B D1 a box that is not a number is INCOMPLETE (no value)', nn.state === 'INCOMPLETE' && nn.outputs.every(o => o.value === null), `state ${nn.state}`);
    const ve = await calc('engine_airflow_estimate', Object.assign({}, K.K2.in, { air_ve: 1.4, air_map: 29.4 }));
    check('B VE above 1 (boosted) is accepted', ve.state === 'VALID' && relClose(outVal(ve, 'engine_volume_flow'), flowCfm(350, 6000, 1.4, 4), 1e-12), `state ${ve.state}`);
  }

  /* ---- K: torque at every RPM (GH-DEF-040, option A: no 800 RPM floor) — detailed checks in premium/tests/torque-def040.test.js ---- */
  {
    const inp = Object.assign({}, K.K4.in, { ap_r: 600 }), r = await calc('airflow_power_estimate', inp);
    const h = hpFrom(flowCfm(350, 600, 1, 4) * 0.0765, 12.5, 0.5);                                       // 44.625 hp
    const tq = outVal(r, 'estimated_torque');
    check('K at 600 RPM torque is hp x 5252 / 600 = 390.6175 lb-ft (the former floor gave 292.963125)',
      relClose(tq, h * 5252 / 600, 1e-12) && relClose(h * 5252 / 600, 390.6175, 1e-12), `registry torque ${tq}`);
  }

  /* ---- S: single path — alter the registry's answer inside the page and the page follows ---- */
  {
    const SIX = [['engine_displacement', 'Displacement'], ['engine_airflow_estimate', 'Engine Volume Flow'], ['airflow_power_estimate', 'Estimated Horsepower'],
                 ['injector_sizing', 'Required Flow'], ['fuel_pump_sizing', 'Required Pump Delivery'], ['port_velocity', 'Solved Average Velocity']];
    for (const [id, label] of SIX) {
      await open(id, 'imperial'); const before = (await shown()).rows[label];
      await page.evaluate(target => { window.__ghCalc = GH_ENGINE.calculate; GH_ENGINE.calculate = function (i, x) { const r = window.__ghCalc(i, x); if (i === target) r.outputs.forEach(o => { if (o.value !== null) o.value *= 2; }); return r; }; }, id);
      await open(id, 'imperial'); const after = (await shown()).rows[label];
      await page.evaluate(() => { GH_ENGINE.calculate = window.__ghCalc; });
      await open(id, 'imperial'); const restored = (await shown()).rows[label];
      check(`S ${id}: the page shows the registry's answer`, !!before && !!after && within(after.v, 2 * before.v, 0.5 * 10 ** -after.d + 0.5 * 10 ** -before.d * 2 + 1e-9) && restored && restored.v === before.v,
        `before ${before && before.raw}, registry doubled ${after && after.raw}, restored ${restored && restored.raw}`);
    }
  }

  /* ---- N: the Formula cards' plain-language notes (documentation only) ---- */
  {
    const NOTES = {
      engine_airflow_estimate: [/four-stroke engine fills each cylinder once every two turns/, /factor of 0\.5/, /two-stroke engine fills each cylinder on every turn, a factor of 1/,
        /greater than zero, and the number of cylinders must be a whole number of at least 1/, /Validation required/],
      airflow_power_estimate: [/four-stroke factor of 0\.5/, /no two-stroke option/, /AFR at least 0\.1 and the BSFC at least 0\.05/, /cannot be staged for the Simulator/,
        /Torque is horsepower × 5252 ÷ the RPM entered, at every engine speed/, /there is no minimum RPM and no other RPM is substituted/, /Any RPM greater than zero is accepted/],
      fuel_pump_sizing: [/Target HP, BSFC and fuel density must be greater than zero and the capacity margin at least 1\.0/, /Validation required/]
    };
    for (const [id, pats] of Object.entries(NOTES)) {
      const r = await page.evaluate(async i => { renderCalc(i); await new Promise(z => setTimeout(z, 400));
        const b = [...document.querySelectorAll('.gh-formula-block')]; return { cards: b.length, notes: b.map(x => (x.querySelector('.gh-formula-notes') || {}).textContent || '') }; }, id);
      check(`N ${id}: every Formula card (${r.cards}) carries the plain-language notes`, r.cards === 3 && r.notes.every(n => n.length > 0), JSON.stringify(r).slice(0, 200));
      for (const re of pats) check(`N ${id}: notes say ${re}`, r.notes.every(n => re.test(n)), (r.notes[0] || '').slice(0, 300));
    }
    /* the documented facts are the implementation's: torque = hp x 5252 / RPM at 600 RPM, and the same torque at every RPM for the same engine */
    const r6 = await calc('airflow_power_estimate', Object.assign({}, K.K4.in, { ap_r: 600 })), r60 = await calc('airflow_power_estimate', K.K4.in);
    check('N the note holds: torque is hp x 5252 / RPM at 600 RPM and equals the torque at 6000 RPM', relClose(outVal(r6, 'estimated_torque'), outVal(r6, 'estimated_horsepower') * 5252 / 600, 1e-12) && relClose(outVal(r6, 'estimated_torque'), outVal(r60, 'estimated_torque'), 1e-12), JSON.stringify([r6.outputs.map(o => o.value), outVal(r60, 'estimated_torque')]));
    const n0 = await page.evaluate(async () => { renderCalc('injector_sizing'); await new Promise(z => setTimeout(z, 400)); return { cards: document.querySelectorAll('.gh-formula-block').length, notes: document.querySelectorAll('.gh-formula-notes').length }; });
    check('N calculators without notes are unchanged (Injector Sizing: Formula cards, no notes)', n0.cards === 3 && n0.notes === 0, JSON.stringify(n0));
  }

  await browser.close();
  if (pageErrors.length) { failures++; lines.push('PAGE ERRORS:\n' + pageErrors.slice(0, 5).join('\n')); }
  if (lines.length) console.log(lines.join('\n'));
  console.log(`\nengine-chain M1 tests: ${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
})();
