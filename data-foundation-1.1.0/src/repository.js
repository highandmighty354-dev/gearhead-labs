'use strict';
/* DATA-FOUNDATION 1.1.0 - trusted value-write path: service-role persistence adapter (approved amendment design
 * §2 steps 3, 7, 8 and §7). Same pattern as CALCULATION-FOUNDATION-1.0.0 repository.js: each service call owns one
 * READ COMMITTED transaction under SET LOCAL ROLE service_role with NO user claims. This adapter creates no database
 * object; the frozen triggers, constraints and composite foreign keys remain the backstop for every row. */

const VALUE_COLUMNS = 'id, owner_id, machine_id, component_id, canonical_field, numeric_value, unit, provenance, context, source, supersedes_id, recorded_at';

/* The EXACT active-machine rule of CALCULATION-FOUNDATION-1.0.0 (calculation-foundation/src/repository.js,
 * ACTIVE_MACHINE_SQL): the owner's machine, not soft-deleted, in the owner's garage that is not soft-deleted.
 * FOR SHARE blocks a concurrent Decision-B soft delete until this transaction ends. The 1.1.0 suite asserts this
 * text is byte-identical to the frozen original read from the CALCULATION-FOUNDATION-1.0.0 tag. */
const ACTIVE_MACHINE_SQL = `SELECT m.id FROM public.machines m
  JOIN public.garages g ON g.id = m.garage_id AND g.owner_id = m.owner_id
  WHERE m.id = $1 AND m.owner_id = $2 AND m.deleted_at IS NULL AND g.deleted_at IS NULL
  FOR SHARE OF m, g`;

const FIELD_SQL = 'SELECT canonical_unit, value_kind FROM public.canonical_fields WHERE key = $1';

// One series = (machine, component = NULL, field, context). Transaction-scoped: released at COMMIT / ROLLBACK.
const SERIES_LOCK_SQL = 'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))';

/* Frozen current-value rule (DATA-FOUNDATION.md line 62): the newest non-superseded value per
 * owner / machine / component / field / context. No provenance priority (V1 §L). */
const HEAD_SQL = `SELECT ${VALUE_COLUMNS} FROM public.value_records v
  WHERE v.owner_id = $1 AND v.machine_id = $2 AND v.component_id IS NULL AND v.canonical_field = $3 AND v.context = $4
    AND NOT EXISTS (SELECT 1 FROM public.value_records s WHERE s.supersedes_id = v.id)
  ORDER BY v.recorded_at DESC, v.id DESC
  LIMIT 1`;

// owner_id is always explicit (the service role has no auth.uid()); recorded_at is never supplied (df_stamp).
const INSERT_SQL = `INSERT INTO public.value_records
    (owner_id, machine_id, component_id, canonical_field, numeric_value, option_value, unit, provenance, context, source, supersedes_id)
  VALUES ($1, $2, NULL, $3, $4, NULL, $5, $6, $7, $8, $9)
  RETURNING ${VALUE_COLUMNS}`;

function toValue(row) {
  return Object.freeze({
    value_id: row.id, owner_id: row.owner_id, machine_id: row.machine_id, component_id: row.component_id,
    canonical_field: row.canonical_field, numeric_value: row.numeric_value, unit: row.unit, provenance: row.provenance,
    context: row.context, source: row.source, supersedes_id: row.supersedes_id,
    recorded_at: row.recorded_at instanceof Date ? row.recorded_at.toISOString() : row.recorded_at,
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
    async activeMachine(ownerId, machineId) {
      return (await client.query(ACTIVE_MACHINE_SQL, [machineId, ownerId])).rowCount === 1;
    },
    async field(key) { return (await client.query(FIELD_SQL, [key])).rows[0] || null; },
    async lockSeries(machineId, key, context) {
      await client.query(SERIES_LOCK_SQL, ['df-1.1.0:value:' + machineId, key + '|' + context]);
    },
    async head(ownerId, machineId, key, context) {
      return (await client.query(HEAD_SQL, [ownerId, machineId, key, context])).rows[0] || null;
    },
    async savepoint() { await client.query('SAVEPOINT vw_insert'); },
    async rollbackToSavepoint() { await client.query('ROLLBACK TO SAVEPOINT vw_insert'); },
    async insert(p) {
      const r = await client.query(INSERT_SQL, [p.owner_id, p.machine_id, p.canonical_field, p.numeric_value, p.unit,
        p.provenance, p.context, p.source, p.supersedes_id]);
      return r.rows[0];
    },
  };
  return Object.freeze(Object.assign(repo, overrides || {}));
}

module.exports = { createRepository, toValue, VALUE_COLUMNS, ACTIVE_MACHINE_SQL, FIELD_SQL, SERIES_LOCK_SQL, HEAD_SQL, INSERT_SQL };
