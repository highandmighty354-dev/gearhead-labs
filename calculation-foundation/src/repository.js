'use strict';
/* CALCULATION-FOUNDATION 1.0.0 - persistence adapter (SPEC §11-§13, DESIGN §8, §11). D1: the service-role server
 * path is the only write path. The frozen DATA-FOUNDATION contract (constraints, triggers, RLS, grants) stays
 * authoritative and unmodified; this adapter creates no database object.
 * Each service call owns one READ COMMITTED transaction: SET LOCAL ROLE service_role, no user claims. */

const RECORD_COLUMNS = 'id, owner_id, machine_id, request_id, created_at, calculator_id, canonical_id, engine_version, '
  + 'formula_registry, formula_version, result_state, inputs, missing, warnings, outputs';

// DESIGN §11 - explicit because the service role bypasses RLS; FOR SHARE blocks a concurrent Decision-B soft delete
const ACTIVE_MACHINE_SQL = `SELECT m.id FROM public.machines m
  JOIN public.garages g ON g.id = m.garage_id AND g.owner_id = m.owner_id
  WHERE m.id = $1 AND m.owner_id = $2 AND m.deleted_at IS NULL AND g.deleted_at IS NULL
  FOR SHARE OF m, g`;

function toRecord(row) {
  return Object.freeze({
    record_id: row.id, owner_id: row.owner_id, machine_id: row.machine_id, request_id: row.request_id,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    calculator_id: row.calculator_id, canonical_id: row.canonical_id, engine_version: row.engine_version,
    formula_registry: row.formula_registry, formula_version: row.formula_version, result_state: row.result_state,
    inputs: row.inputs, missing: row.missing, warnings: row.warnings, outputs: row.outputs,
  });
}

function createRepository(client, overrides) {
  const repo = {
    async begin() {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE service_role');
      await client.query("SELECT set_config('request.jwt.claims', '', true)");
    },
    async commit() { await client.query('COMMIT'); },
    async rollback() { await client.query('ROLLBACK'); },
    async findByRequest(ownerId, requestId) {
      const r = await client.query(`SELECT ${RECORD_COLUMNS} FROM public.calculation_records WHERE owner_id = $1 AND request_id = $2`, [ownerId, requestId]);
      return r.rows[0] || null;
    },
    async activeMachine(ownerId, machineId) {
      return (await client.query(ACTIVE_MACHINE_SQL, [machineId, ownerId])).rowCount === 1;
    },
    async insert(p) {                                   // input_value_ids omitted (NULL) - D4
      const r = await client.query(
        `INSERT INTO public.calculation_records
           (owner_id, machine_id, calculator_id, canonical_id, engine_version, formula_registry, formula_version,
            result_state, inputs, missing, warnings, outputs, request_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::text[], $11::text[], $12::jsonb, $13)
         ON CONFLICT ON CONSTRAINT calc_request_idempotent DO NOTHING
         RETURNING ${RECORD_COLUMNS}`,
        [p.owner_id, p.machine_id, p.calculator_id, p.canonical_id, p.engine_version, p.formula_registry, p.formula_version,
         p.result_state, JSON.stringify(p.inputs), p.missing, p.warnings, JSON.stringify(p.outputs), p.request_id]);
      return r.rows[0] || null;
    },
  };
  return Object.freeze(Object.assign(repo, overrides || {}));
}

module.exports = { createRepository, toRecord, RECORD_COLUMNS, ACTIVE_MACHINE_SQL };
