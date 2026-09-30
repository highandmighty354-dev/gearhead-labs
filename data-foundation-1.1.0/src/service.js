'use strict';
/* DATA-FOUNDATION 1.1.0 - trusted value-write service (approved amendment design §2, §5a, §6, §7; owner decision
 * reconciliation #2 and #3). After migration 0201 this service-role path is the ONLY writer of value_records.
 *
 *   1 owner = the trusted owner context (verified login), never the request        (CALCULATION-FOUNDATION D6)
 *   2 field in the admitted contract set; context 'specification'; component NULL; V1 provenance allowlist
 *   3 value: unknown -> no value; known -> finite number, supported unit, exact normalization, -0 -> +0
 *   4 active machine: owner's, not soft-deleted, garage not soft-deleted, FOR SHARE (CALCULATION-FOUNDATION rule)
 *   5 contract re-checked against canonical_fields (storage unit = canonical engine-native unit; numeric kind)
 *   6 series lock (machine, field, context) -> current head -> INSERT superseding the head (linear history)
 *   7 frozen triggers / constraints / composite FKs remain the database backstop
 *
 * No transport, no HTTP, no authentication here (as CALCULATION-FOUNDATION D6): the caller passes the verified
 * owner context. Components are injected so each negative control can replace exactly one of them. */
const { CODES, rejection } = require('./errors');
const { createValidator, V1_CONTEXT, UUID } = require('./validate');
const { toValue } = require('./repository');

const MAX_ATTEMPTS = 3;           // a concurrent double-supersede is refused by values_superseded_once; retry
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function createValueWriteService({ repository, contracts, components }) {
  if (!repository || !contracts) throw new Error('repository and contracts are required');
  const c = Object.assign({
    validator: createValidator(),
    ownerOf: (ownerContext /* , request */) => ownerContext.owner_id,
    supersedesOf: head => (head ? head.id : null),
  }, components || {});
  const repo = repository;
  const reject = v => rejection(v.code, v.reason, v.detail);

  async function write(ownerContext, request) {
    let v = c.validator.owner(ownerContext); if (!v.ok) return reject(v);                        // W0
    v = c.validator.shape(request); if (!v.ok) return reject(v);                                  // W1
    const owner = c.ownerOf(ownerContext, request);
    const a = c.validator.admit(request, contracts); if (!a.ok) return reject(a);                 // W2-W6
    const machine_id = request.machine_id;
    try {
      await repo.begin();
      if (!(await repo.activeMachine(owner, machine_id))) {                                        // M1
        await repo.rollback();
        return rejection(CODES.MACHINE_NOT_FOUND, 'machine_not_found', { machine_id });
      }
      const f = await repo.field(a.row.canonical_field);                                           // C1
      if (!f || f.canonical_unit !== a.row.unit || f.value_kind !== 'numeric') {
        await repo.rollback();
        return rejection(CODES.CONTRACT_MISMATCH, 'field_contract_differs_from_database', { canonical_field: a.row.canonical_field });
      }
      await repo.lockSeries(machine_id, a.row.canonical_field, V1_CONTEXT);                          // L1
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const head = await repo.head(owner, machine_id, a.row.canonical_field, V1_CONTEXT);
        await repo.savepoint();
        try {
          const row = await repo.insert(Object.assign({}, a.row, { owner_id: owner, machine_id, supersedes_id: c.supersedesOf(head) }));
          await repo.commit();
          return Object.freeze({ outcome: 'created', value: toValue(row) });
        } catch (e) {
          if (e && e.code === '23505' && attempt < MAX_ATTEMPTS) { await repo.rollbackToSavepoint(); continue; }
          throw e;
        }
      }
      throw Object.assign(new Error('supersede_retries_exhausted'), { code: '23505' });   // defensive; not reachable
    } catch (e) {
      try { await repo.rollback(); } catch (_) { /* connection already aborted */ }
      return rejection(CODES.PERSISTENCE, 'database_error', { sqlstate: e && e.code ? e.code : null });
    }
  }

  /* Current-value read helper (design §7): the newest non-superseded 'specification' value for (machine, field).
   * -> { outcome: 'found', value } | { outcome: 'absent' } (absent = nothing recorded: never zero, never a default) */
  async function current(ownerContext, query) {
    let v = c.validator.owner(ownerContext); if (!v.ok) return reject(v);
    if (query === null || typeof query !== 'object' || Object.keys(query).sort().join(',') !== 'canonical_field,machine_id'
        || typeof query.machine_id !== 'string' || !UUID.test(query.machine_id) || typeof query.canonical_field !== 'string') {
      return rejection(CODES.MALFORMED_REQUEST, 'query_invalid');
    }
    if (!contracts.has(query.canonical_field)) return rejection(CODES.FIELD_NOT_ADMITTED, 'field_not_admitted', { canonical_field: query.canonical_field });
    const owner = c.ownerOf(ownerContext, query);
    try {
      await repo.begin();
      if (!(await repo.activeMachine(owner, query.machine_id))) {
        await repo.rollback();
        return rejection(CODES.MACHINE_NOT_FOUND, 'machine_not_found', { machine_id: query.machine_id });
      }
      const head = await repo.head(owner, query.machine_id, query.canonical_field, V1_CONTEXT);
      await repo.commit();
      return head ? Object.freeze({ outcome: 'found', value: toValue(head) }) : Object.freeze({ outcome: 'absent' });
    } catch (e) {
      try { await repo.rollback(); } catch (_) { /* connection already aborted */ }
      return rejection(CODES.PERSISTENCE, 'database_error', { sqlstate: e && e.code ? e.code : null });
    }
  }

  return Object.freeze({ write, current });
}

module.exports = { createValueWriteService, MAX_ATTEMPTS, own };
