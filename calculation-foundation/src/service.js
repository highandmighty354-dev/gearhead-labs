'use strict';
/* CALCULATION-FOUNDATION 1.0.0 - calculation service (SPEC §7-§14, DESIGN §2, §6-§9).
 * One request executes one calculator (D8) through the unmodified frozen engine; the engine result is
 * authoritative and never edited (§10); an accepted, executed request persists one immutable record through the
 * service-role path (D1), with D5 idempotency. No transport, no authentication, no HTTP (D6). Owner identity
 * comes ONLY from the trusted owner context, never from the request (§14).
 *
 * Components are injected (DESIGN §1) so each negative control can replace exactly one of them. */
const { CODES, rejection } = require('./errors');
const { CJ, identity: identityFn } = require('./canonical-json');
const { deepFreeze, EXPECT } = require('./frozen-sources');
const { createAuthority } = require('./authority');
const { createValidator } = require('./validate');
const { toRecord } = require('./repository');

const METADATA_KEYS = Object.freeze(['record_id', 'request_id', 'owner_id', 'machine_id', 'created_at']);
const PERSISTABLE_STATES = new Set(EXPECT.STATES.filter(s => s !== 'NOT_APPLICABLE'));

/* Frozen engine execution + post-execution assertions (DESIGN §6 step 5). Failure -> CF_INTEGRITY, no record. */
function createExecutor(sources) {
  return function execute(requestedId, canonical, inputsForEngine) {
    const res = sources.engine.calculate(requestedId, inputsForEngine);
    const bad = why => ({ ok: false, rejection: rejection(CODES.INTEGRITY, why, { calculator_id: requestedId }) });
    if (!res || res.engine_version !== EXPECT.ENGINE_VERSION) return bad('engine_version_mismatch');
    if (res.canonical_id !== canonical) return bad('canonical_id_mismatch');
    if (!res.formula || res.formula.version !== sources.fingerprint(canonical)) return bad('fingerprint_mismatch');
    if (!PERSISTABLE_STATES.has(res.state)) return bad('unexpected_state');
    if (!Array.isArray(res.outputs) || res.outputs.length !== sources.describe(canonical).outputs.length) return bad('output_count_mismatch');
    return { ok: true, result: deepFreeze(res) };
  };
}

/* Stored projection of the authoritative engine result (SPEC §11): outputs verbatim and in order; element i IS
 * output_index i (D3); result_state = engine state lowercased (1:1 with result_state_enum). */
function project(res, ctx) {
  return {
    owner_id: ctx.owner_id, machine_id: ctx.machine_id, request_id: ctx.request_id,
    calculator_id: res.calculator_id, canonical_id: res.canonical_id, engine_version: res.engine_version,
    formula_registry: res.formula.registry, formula_version: res.formula.version, result_state: res.state.toLowerCase(),
    inputs: ctx.inputs, missing: [...res.missing], warnings: [...res.warnings], outputs: res.outputs,
  };
}

/* D5: an existing (owner, request_id) record is replayed only for an identical canonical request identity. */
function onExisting(row, requestIdentity, identity) {
  const stored = identity({ calculator_id: row.calculator_id, canonical_id: row.canonical_id, machine_id: row.machine_id, inputs: row.inputs });
  return stored === requestIdentity ? { outcome: 'replayed' } : { outcome: 'conflict' };
}

function createCalculationService({ sources, repository, components }) {
  const c = Object.assign({
    validator: createValidator(),
    authority: createAuthority(sources),
    ownerOf: (ownerContext /* , request */) => ownerContext.owner_id,
    identity: identityFn,
    execute: createExecutor(sources),
    project,
    onExisting,
  }, components || {});
  const repo = repository;

  const settle = (row, idStr, requestId) => {
    const d = c.onExisting(row, idStr, c.identity);
    if (d.outcome === 'replayed') return Object.freeze({ outcome: 'replayed', record: toRecord(row) });
    if (d.outcome === 'conflict') return Object.freeze({ outcome: 'conflict', code: CODES.REQUEST_CONFLICT, request_id: requestId });
    return d;                                                             // only a broken (mutant) policy gets here
  };

  async function calculate(ownerContext, request) {
    let v = c.validator.owner(ownerContext); if (!v.ok) return v.rejection;                      // V0
    v = c.validator.shape(request); if (!v.ok) return v.rejection;                               // V1
    const owner = c.ownerOf(ownerContext, request);
    const a = c.authority.resolve(request.calculator_id); if (!a.ok) return a.rejection;         // V2
    v = c.validator.inputs(request.inputs, sources.describe(a.canonical)); if (!v.ok) return v.rejection;   // V3, V4
    const inputs = JSON.parse(CJ(v.inputs));                // exactly the object that is executed AND stored
    const machine_id = request.machine_id === undefined ? null : request.machine_id;
    const idStr = c.identity({ calculator_id: request.calculator_id, canonical_id: a.canonical, machine_id, inputs });
    let requestId = request.request_id;

    try {
      await repo.begin();
      const existing = await repo.findByRequest(owner, requestId);                                   // E1
      if (existing) {
        const s = settle(existing, idStr, requestId);
        if (s.outcome === 'replayed' || s.outcome === 'conflict') { await repo.commit(); return s; }
        requestId = s.request_id;                                          // mutant-only path ('execute_new')
      }
      if (machine_id !== null && !(await repo.activeMachine(owner, machine_id))) {                    // M1
        await repo.rollback();
        return rejection(CODES.MACHINE_NOT_FOUND, 'machine_not_found', { machine_id });
      }
      const x = c.execute(request.calculator_id, a.canonical, inputs);                               // X1
      if (!x.ok) { await repo.rollback(); return x.rejection; }
      const row = await repo.insert(c.project(x.result, { owner_id: owner, machine_id, request_id: requestId, inputs }));   // I1
      if (row) {
        await repo.commit();
        const record = toRecord(row);
        const result = Object.freeze(Object.assign({}, x.result, {
          record_id: record.record_id, request_id: record.request_id, owner_id: record.owner_id,
          machine_id: record.machine_id, created_at: record.created_at }));
        return Object.freeze({ outcome: 'created', result, record });
      }
      const again = await repo.findByRequest(owner, requestId);      // a concurrent request committed first
      await repo.commit();
      if (!again) return rejection(CODES.PERSISTENCE, 'idempotency_record_missing', {});
      return settle(again, idStr, requestId);
    } catch (e) {
      try { await repo.rollback(); } catch (_) { /* connection already aborted */ }
      return rejection(CODES.PERSISTENCE, 'database_error', { sqlstate: e && e.code ? e.code : null });
    }
  }

  return Object.freeze({ calculate });
}

/* The engine part of a created result (everything except the five record-metadata fields). */
function engineResultOf(result) {
  const out = {};
  for (const k of Object.keys(result)) if (!METADATA_KEYS.includes(k)) out[k] = result[k];
  return out;
}

module.exports = { createCalculationService, createExecutor, project, onExisting, engineResultOf, METADATA_KEYS };
