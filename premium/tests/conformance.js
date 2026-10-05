/* Gearhead Labs Premium — adapter conformance scenarios.
   The SAME behavioural checks run against the development adapter (frontend.test.js) and against the foundation
   adapter on the approved schema (schema-contract.test.js), so the local development store can never drift from
   what the real database allows.
   ctx.as(user)            -> the adapter acting as 'free' or 'premium' (signed in)
   ctx.grant(user) / ctx.revoke(user)          server-side entitlement changes
   ctx.seedSavedCalculation(user, machineId)   what the future trusted calculation endpoint will do
   ctx.M                                        GHP.models */
'use strict';

function helpers() {
  const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
  const eq = (a, b, m) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A !== B) throw new Error(`${m}: got ${A}, expected ${B}`); };
  async function rejects(p, check) { try { await p; } catch (e) { if (check) check(e); return e; } throw new Error('expected a rejection'); }
  return { assert, eq, rejects };
}

const scenarios = [
  ['Free: one garage (idempotent), one machine, details + components; a second machine is refused with the allowance error', async (ctx, s, { eq, assert, rejects }) => {
    const A = await ctx.as('free'), M = ctx.M;
    const g = await A.garage.ensure();
    eq((await A.garage.ensure()).id, g.id, 'ensure is idempotent');
    eq((await A.tables.garages.list()).length, 1, 'one active garage');
    const v = M.fromPhase3aVehicle({ year: 2019, make: 'Ford', model: 'F-150', vehicle_type: 'Truck', fuel_type: 'Gasoline', drivetrain: '4WD', engine: '5.0L V8', transmission: 'Automatic' });
    const m = await A.tables.machines.insert(Object.assign({ garage_id: g.id }, v.machine));
    eq([m.machine_type, m.power_source], ['automotive', 'gasoline'], 'machine');
    const d = await A.tables.machine_details.insert(Object.assign({ machine_id: m.id, is_primary: true }, v.details, { is_primary: true }));
    assert(d.is_primary && /Drivetrain: 4WD/.test(d.notes), 'details');
    for (const c of v.components) await A.tables.components.insert(Object.assign({ machine_id: m.id }, c));
    eq((await A.tables.components.list({ machine_id: m.id })).map(c => c.kind).sort(), ['engine', 'transmission'], 'components');
    const second = await rejects(A.tables.machines.insert({ garage_id: g.id, name: 'Second', machine_type: 'motorcycle' }));
    eq([second.kind, second.upgrade], ['free_machine_limit', true], 'allowance');
    const dup = await rejects(A.tables.garages.insert({ name: 'Another' }));
    eq(dup.kind, 'conflict', 'second active garage');
    Object.assign(s, { freeGarage: g.id, freeMachine: m.id });
  }],
  ['Free: unlimited Test Setups with edit, re-pin and permanent soft delete', async (ctx, s, { eq, rejects }) => {
    const A = await ctx.as('free'), M = ctx.M, ids = [];
    for (const b of [{ name: 'Street', goals: '12s', status: 'Street' }, { name: 'Track' }, { name: 'Dyno' }, { name: 'Winter' }, { name: 'Show' }])
      ids.push((await A.tables.test_setups.insert(Object.assign({ machine_id: s.freeMachine }, M.fromPhase3aBuild(b)))).id);
    eq((await A.tables.test_setups.list({ machine_id: s.freeMachine })).length, 5, 'five setups on a Free account');
    eq((await A.tables.test_setups.update(ids[0], { notes: 'edited' })).notes, 'edited', 'edit');
    eq(await A.testSetups.repinBaseline(ids[1]), true, 're-pin');
    await A.tables.test_setups.softDelete(ids[4]);
    eq((await A.tables.test_setups.list()).length, 4, 'hidden after delete');
    eq((await rejects(A.tables.test_setups.softDelete(ids[4]))).kind, 'not_found', 'second delete');
    eq((await rejects(A.tables.test_setups.update(ids[4], { name: 'back' }))).kind, 'not_found', 'deleted row cannot be edited');
    s.freeSetup = ids[0];
  }],
  ['Free: no engineering analyses, no saved-calculation create, entitlement reads Free', async (ctx, s, { eq }) => {
    const A = await ctx.as('free'), M = ctx.M;
    const e = await A.analyses.create({ analyzer_id: 'e01_turbo_compressor_map', title: 'x', inputs: {}, inputs_unit_system: 'imperial' }).then(() => null, x => x);
    eq(e && e.kind, 'forbidden', 'analysis refused');
    eq(A.tables.saved_calculations.insert, undefined, 'no create method');
    eq(A.capabilities.savedCalculationCreate, false, 'capability');
    const ent = await A.entitlement.mine();
    eq([ent.plan, ent.isPremium, M.canAddMachine(ent, 1)], ['free', false, false], 'entitlement');
  }],
  ['Premium: several machines; primary set with one write and moved by the backend, also after deleting the primary', async (ctx, s, { eq }) => {
    await ctx.grant('premium');
    const B = await ctx.as('premium');
    const g = await B.garage.ensure(), ms = [];
    for (const n of ['One', 'Two', 'Three']) ms.push((await B.tables.machines.insert({ garage_id: g.id, name: n, machine_type: 'automotive' })).id);
    await B.machines.setPrimary(ms[0]);
    await B.tables.machine_details.insert({ machine_id: ms[1], make: 'Chevrolet' });
    await B.machines.setPrimary(ms[1]);
    eq((await B.tables.machine_details.list()).filter(d => d.is_primary).map(d => d.machine_id), [ms[1]], 'moved');
    await B.tables.machines.softDelete(ms[1]);
    await B.machines.setPrimary(ms[2]);
    eq((await B.tables.machine_details.list()).filter(d => d.is_primary).map(d => d.machine_id), [ms[2]], 'no lock-in after deleting the primary');
    eq((await B.tables.machines.list()).length, 2, 'deleted machine hidden');
    const ent = await B.entitlement.mine();
    eq([ent.isPremium, ent.source, ctx.M.canAddMachine(ent, 2)], [true, 'manual', true], 'entitlement');
    Object.assign(s, { premGarage: g.id, premMachine: ms[0], premMachine3: ms[2] });
  }],
  ['Premium: analysis version pinned from the catalog, machine filled from the Test Setup, edit, immutable analyzer, soft delete', async (ctx, s, { eq, rejects }) => {
    const B = await ctx.as('premium');
    const ts = await B.tables.test_setups.insert({ machine_id: s.premMachine, name: 'Track' });
    const a = await B.analyses.create({ analyzer_id: 'e12_radiator_heat_rejection', title: 'Radiator', inputs: { schema: 1, fields: {} }, inputs_unit_system: 'imperial', result_snapshot: { results: [] }, test_setup_id: ts.id });
    eq([a.analyzer_version, a.machine_id, a.result_trust], ['E1-AUTO', s.premMachine, 'client_reported'], 'pinned + filled + label');
    const bad = await rejects(B.tables.engineering_analyses.update(a.id, { machine_id: s.premMachine3 }));
    eq(bad.kind, 'invalid', 'link mismatch (setup belongs to another machine)');
    eq((await B.tables.engineering_analyses.update(a.id, { title: 'Radiator v2' })).title, 'Radiator v2', 'edit');
    eq((await rejects(B.tables.engineering_analyses.update(a.id, { analyzer_id: 'e01_turbo_compressor_map' }))).code, 'not_writable', 'analyzer immutable');
    eq((await rejects(B.analyses.create({ analyzer_id: 'e01_turbo_compressor_map', analyzer_version: 'E9-OLD', title: 't', inputs: {}, inputs_unit_system: 'metric' }))).kind, 'invalid', 'stale version');
    s.premAnalysis = a.id; s.premSetup = ts.id;
  }],
  ['Premium: saved calculations are list / edit / pin / delete only', async (ctx, s, { eq }) => {
    await ctx.seedSavedCalculation('premium', s.premMachine);
    await ctx.seedSavedCalculation('premium', s.premMachine);
    const B = await ctx.as('premium');
    const rows = await B.tables.saved_calculations.list();
    eq(rows.length, 2, 'list');
    eq(rows.every(r => r.machine_id === s.premMachine), true, 'machine from the calculation');
    eq((await B.tables.saved_calculations.update(rows[0].id, { title: 'Renamed', pinned: true, test_setup_id: s.premSetup })).pinned, true, 'edit + pin');
    eq((await B.tables.saved_calculations.list({ pinned: true })).length, 1, 'pinned filter');
    eq((await B.tables.calculation_records.get(rows[0].calculation_id)).id, rows[0].calculation_id, 'own calculation readable');
    await B.tables.saved_calculations.softDelete(rows[1].id);
    eq((await B.tables.saved_calculations.list()).length, 1, 'deleted');
    s.premSaved = rows[0].id;
  }],
  ['Lapsed Premium: keeps machines, saved calculations and analyses to read and delete; nothing Premium-only can be created or edited', async (ctx, s, { eq, rejects }) => {
    await ctx.revoke('premium');
    const B = await ctx.as('premium');
    const ent = await B.entitlement.mine();
    eq(ent.isPremium, false, 'lapsed');
    eq((await B.tables.machines.list()).length, 2, 'machines retained');
    eq((await rejects(B.tables.machines.insert({ garage_id: s.premGarage, name: 'Fourth', machine_type: 'automotive' }))).kind, 'free_machine_limit', 'no new machine');
    eq((await B.tables.machine_details.update(s.premMachine, { make: 'Still mine' })).make, 'Still mine', 'existing machines editable');
    eq((await B.tables.test_setups.insert({ machine_id: s.premMachine, name: 'Lapsed setup' })).name, 'Lapsed setup', 'Test Setups stay unlimited');
    eq((await B.tables.engineering_analyses.list()).length, 1, 'analyses readable');
    eq((await rejects(B.tables.engineering_analyses.update(s.premAnalysis, { title: 'x' }))).kind, 'forbidden', 'analysis edit refused');
    eq((await rejects(B.analyses.create({ analyzer_id: 'e01_turbo_compressor_map', title: 't', inputs: {}, inputs_unit_system: 'metric' }))).kind, 'forbidden', 'analysis create refused');
    eq((await rejects(B.tables.saved_calculations.update(s.premSaved, { pinned: false }))).kind, 'forbidden', 'saved edit refused');
    eq((await B.tables.saved_calculations.list()).length, 1, 'saved readable');
    await B.tables.saved_calculations.softDelete(s.premSaved);
    await B.tables.engineering_analyses.softDelete(s.premAnalysis);
    eq([(await B.tables.saved_calculations.list()).length, (await B.tables.engineering_analyses.list()).length], [0, 0], 'deletes allowed');
  }],
  ['Cross-account: another user’s rows are invisible, their updates / deletes are not-found, their primary is untouched', async (ctx, s, { eq, assert, rejects }) => {
    const B = await ctx.as('premium');
    eq((await B.tables.machines.list()).some(m => m.id === s.freeMachine), false, 'invisible');
    eq(await B.tables.machines.get(s.freeMachine), null, 'get');
    eq((await rejects(B.tables.machines.update(s.freeMachine, { name: 'Stolen' }))).kind, 'not_found', 'update');
    eq((await rejects(B.tables.test_setups.update(s.freeSetup, { name: 'Stolen' }))).kind, 'not_found', 'setup update');
    eq((await rejects(B.tables.machines.softDelete(s.freeMachine))).kind, 'not_found', 'soft delete');
    eq((await rejects(B.testSetups.repinBaseline(s.freeSetup))).kind, 'not_found', 're-pin');
    const p = await rejects(B.machines.setPrimary(s.freeMachine));
    assert(['forbidden', 'link_not_found'].includes(p.kind), 'setPrimary on another user’s machine: ' + p.kind);
    const A = await ctx.as('free');
    eq((await A.tables.machine_details.get(s.freeMachine)).is_primary, true, 'owner primary untouched');
    eq((await A.tables.machines.get(s.freeMachine)).name, '2019 Ford F-150', 'owner machine untouched');
  }],
  ['Marine and server-controlled columns never leave the client', async (ctx, s, { eq, rejects }) => {
    const A = await ctx.as('free');
    eq((await rejects(A.tables.machines.update(s.freeMachine, { machine_type: 'marine' }))).code, 'marine_blocked', 'marine type');
    eq((await rejects(A.tables.machines.update(s.freeMachine, { propulsion: 'outboard' }))).code, 'marine_blocked', 'marine column');
    eq((await rejects(A.tables.test_setups.update(s.freeSetup, { baseline_pinned_at: '2000-01-01' }))).code, 'server_controlled', 'server column');
  }]
];

module.exports = { scenarios, helpers };
