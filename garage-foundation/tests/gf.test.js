#!/usr/bin/env node
/* GARAGE-FOUNDATION 1.0.0 - deterministic database suite + negative controls.
 * Fresh database -> test-only shim + DATA-FOUNDATION 0001-0005 (read from the DATA-FOUNDATION-1.0.0 tag)
 * -> Garage 0101-0103 -> idempotency -> fixtures -> checks. Every check runs in its own transaction and is
 * ROLLED BACK. Fixed UUIDs; timestamps are compared inside the database with the transaction's own now(),
 * never with the wall clock, and no id or timestamp is printed, so the output is byte-reproducible.
 * Negative controls: each mutation is applied to a FRESH database after the Garage migrations; the full
 * check set must then report at least one failure, proving the checks detect that defect. */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { Client } = require('pg');
const HERE = path.resolve(__dirname, '..'), REPO = path.resolve(HERE, '..');
const DF_TAG = 'DATA-FOUNDATION-1.0.0';
const DF_FILES = ['tests/sql/000_supabase_shim.sql', 'supabase/migrations/0001_enums.sql', 'supabase/migrations/0002_tables.sql',
  'supabase/migrations/0003_constraints_triggers.sql', 'supabase/migrations/0004_rls.sql', 'supabase/migrations/0005_reference_seed.sql']
  .map(f => 'data-foundation/' + f);
const atTag = f => execFileSync('git', ['-C', REPO, 'show', `${DF_TAG}:${f}`], { maxBuffer: 64 << 20 }).toString();
const GF_MIG = ['0101_test_setups.sql', '0102_test_setups_triggers.sql', '0103_test_setups_rls.sql'].map(f => path.join(HERE, 'supabase', 'migrations', f));
const cfg = { host: process.env.GF_PGHOST, port: +process.env.GF_PGPORT, user: 'postgres' };

const U = { A: 'aaaaaaaa-0000-4000-8000-000000000001', B: 'bbbbbbbb-0000-4000-8000-000000000002', C: 'cccccccc-0000-4000-8000-000000000003' };
const ID = { GA: '10000000-0000-4000-8000-00000000000a', GB: '10000000-0000-4000-8000-00000000000b',
  MA: '20000000-0000-4000-8000-0000000000a1', MA2: '20000000-0000-4000-8000-0000000000a2', MB: '20000000-0000-4000-8000-0000000000b1',
  CA1: '30000000-0000-4000-8000-0000000000a1',
  TA: 'e0000000-0000-4000-8000-0000000000a1', TA2: 'e0000000-0000-4000-8000-0000000000a2', TD: 'e0000000-0000-4000-8000-0000000000ad',
  TB: 'e0000000-0000-4000-8000-0000000000b1', N1: '90000000-0000-4000-8000-000000000001' };
const DENIED = '42501', GF_ERR = 'P0001', NOT_FOUND = 'P0002', FK = '23503';
const APPROVED_COLUMNS = [['id', 'uuid', 0], ['owner_id', 'uuid', 0], ['machine_id', 'uuid', 0], ['name', 'text', 0], ['description', 'text', 1], ['notes', 'text', 1],
  ['baseline_pinned_at', 'timestamptz', 0], ['created_at', 'timestamptz', 0], ['updated_at', 'timestamptz', 0], ['deleted_at', 'timestamptz', 1]];
const DF_TABLES = ['accounts', 'calculation_records', 'calculators', 'canonical_fields', 'component_connections', 'components', 'formula_versions', 'garages', 'machines', 'value_records'];

/* Catalog fingerprint of every user-defined object in public + auth EXCEPT the Garage objects (test_setups*
 * relations, gf_* functions). PostgreSQL's internal RI triggers (tgisinternal), which any foreign key adds to
 * its referenced table, are excluded: they are inherent to "new objects may reference frozen objects" (#26). */
const FP_SQL = `SELECT x FROM (
  SELECT 'col '||table_schema||'.'||table_name||'.'||column_name||' '||udt_name||' '||is_nullable||' '||coalesce(column_default,'') x
    FROM information_schema.columns WHERE table_schema IN ('public','auth') AND table_name NOT LIKE 'test\\_setups%'
  UNION ALL SELECT 'con '||conrelid::regclass::text||' '||conname||' '||pg_get_constraintdef(oid) FROM pg_constraint
    WHERE connamespace IN ('public'::regnamespace,'auth'::regnamespace) AND conrelid::regclass::text NOT LIKE '%test\\_setups%'
  UNION ALL SELECT 'idx '||indexdef FROM pg_indexes WHERE schemaname IN ('public','auth') AND tablename NOT LIKE 'test\\_setups%'
  UNION ALL SELECT 'pol '||tablename||' '||policyname||' '||cmd||' '||array_to_string(roles,',')||' '||coalesce(qual,'')||' '||coalesce(with_check,'')
    FROM pg_policies WHERE schemaname IN ('public','auth') AND tablename NOT LIKE 'test\\_setups%'
  UNION ALL SELECT 'trg '||pg_get_triggerdef(t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    WHERE NOT t.tgisinternal AND c.relnamespace IN ('public'::regnamespace,'auth'::regnamespace) AND c.relname NOT LIKE 'test\\_setups%'
  UNION ALL SELECT 'fn '||n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||') '||md5(pg_get_functiondef(p.oid))||' '||p.prosecdef||' '||coalesce(array_to_string(p.proconfig,','),'')||' '||coalesce(array_to_string(p.proacl,','),'')
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','auth') AND p.prokind='f' AND p.proname NOT LIKE 'gf\\_%'
  UNION ALL SELECT 'enum '||t.typname||' '||string_agg(e.enumlabel,',' ORDER BY e.enumsortorder) FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid GROUP BY t.typname
  UNION ALL SELECT 'rel '||n.nspname||'.'||c.relname||' '||c.relkind::text||' '||c.relrowsecurity||' '||c.relforcerowsecurity||' '||coalesce(array_to_string(c.relacl,','),'')
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth') AND c.relname NOT LIKE 'test\\_setups%'
  UNION ALL SELECT 'colacl '||c.relname||'.'||a.attname||' '||array_to_string(a.attacl,',') FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    WHERE a.attacl IS NOT NULL AND c.relnamespace IN ('public'::regnamespace,'auth'::regnamespace) AND c.relname NOT LIKE 'test\\_setups%'
  UNION ALL SELECT 'rows calculators='||(SELECT count(*) FROM public.calculators)||' formula_versions='||(SELECT count(*) FROM public.formula_versions)||' canonical_fields='||(SELECT count(*) FROM public.canonical_fields)
) s ORDER BY x`;

/* ---------------- negative controls: one deliberate defect each ---------------- */
const fnSoftDelete = (where) => `CREATE OR REPLACE FUNCTION public.gf_soft_delete_test_setup(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
  DECLARE uid uuid := auth.uid(); n int; BEGIN IF uid IS NULL THEN RAISE EXCEPTION 'GF_AUTH' USING ERRCODE='42501'; END IF;
  UPDATE public.test_setups SET deleted_at = now() WHERE ${where}; GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'GF_NOT_FOUND' USING ERRCODE='P0002'; END IF; END $$;`;
const fnRepin = (where) => `CREATE OR REPLACE FUNCTION public.gf_repin_test_setup_baseline(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
  DECLARE uid uuid := auth.uid(); n int; BEGIN IF uid IS NULL THEN RAISE EXCEPTION 'GF_AUTH' USING ERRCODE='42501'; END IF;
  UPDATE public.test_setups SET baseline_pinned_at = now() WHERE ${where}; GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'GF_NOT_FOUND' USING ERRCODE='P0002'; END IF; END $$;`;
const guardWith = (baselineRule) => `CREATE OR REPLACE FUNCTION public.gf_test_setup_guard_update() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.machine_id IS DISTINCT FROM OLD.machine_id THEN
    RAISE EXCEPTION 'GF_IMMUTABLE' USING ERRCODE='P0001'; END IF;
  NEW.created_at := OLD.created_at; ${baselineRule} NEW.updated_at := now(); RETURN NEW; END $$;`;
const MUTANTS = [
  ['update guard trigger dropped', `DROP TRIGGER gf_guard ON public.test_setups`],
  ['insert stamp trigger dropped', `DROP TRIGGER gf_stamp ON public.test_setups`],
  ['hard-delete refusal dropped and client DELETE granted', `DROP TRIGGER gf_no_delete ON public.test_setups; GRANT DELETE ON public.test_setups TO authenticated`],
  ['client granted UPDATE of baseline_pinned_at', `GRANT UPDATE (baseline_pinned_at) ON public.test_setups TO authenticated`],
  ['client granted UPDATE of deleted_at', `GRANT UPDATE (deleted_at) ON public.test_setups TO authenticated`],
  ['client granted INSERT of owner_id', `GRANT INSERT (owner_id) ON public.test_setups TO authenticated`],
  ['client granted UPDATE of machine_id', `GRANT UPDATE (machine_id) ON public.test_setups TO authenticated`],
  ['anon granted SELECT', `GRANT SELECT ON public.test_setups TO anon`],
  ['RLS disabled', `ALTER TABLE public.test_setups NO FORCE ROW LEVEL SECURITY; ALTER TABLE public.test_setups DISABLE ROW LEVEL SECURITY`],
  ['SELECT policy without owner check', `DROP POLICY gf_test_setups_select ON public.test_setups;
     CREATE POLICY gf_test_setups_select ON public.test_setups FOR SELECT TO authenticated USING (deleted_at IS NULL)`],
  ['SELECT policy without machine-visibility clause', `DROP POLICY gf_test_setups_select ON public.test_setups;
     CREATE POLICY gf_test_setups_select ON public.test_setups FOR SELECT TO authenticated USING (owner_id = auth.uid() AND deleted_at IS NULL)`],
  ['UPDATE policy allows deleted rows', `DROP POLICY gf_test_setups_update ON public.test_setups;
     CREATE POLICY gf_test_setups_update ON public.test_setups FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())`],
  ['composite same-owner machine FK replaced by a single-column FK', `ALTER TABLE public.test_setups DROP CONSTRAINT test_setups_machine_same_owner_fk;
     ALTER TABLE public.test_setups ADD CONSTRAINT test_setups_machine_fk FOREIGN KEY (machine_id) REFERENCES public.machines (id)`],
  ['blank-name check dropped', `ALTER TABLE public.test_setups DROP CONSTRAINT test_setups_name_not_blank`],
  ['insert trigger does not stamp the baseline pin', `CREATE OR REPLACE FUNCTION public.gf_test_setup_stamp_insert() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN
     IF NEW.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'GF_IMMUTABLE' USING ERRCODE='P0001'; END IF; NEW.created_at := now(); NEW.updated_at := now(); RETURN NEW; END $$`],
  ['guard allows a back-dated or arbitrary baseline pin', guardWith('')],
  ['guard moves the baseline on every update (implicit movement)', guardWith('NEW.baseline_pinned_at := now();')],
  ['soft delete ignores the owner', fnSoftDelete('id = p_id AND deleted_at IS NULL')],
  ['soft delete re-stamps already-deleted rows', fnSoftDelete('id = p_id AND owner_id = uid')],
  ['re-pin ignores the owner', fnRepin('id = p_id AND deleted_at IS NULL')],
  ['re-pin moves the baseline of deleted rows', fnRepin('id = p_id AND owner_id = uid') + ` CREATE OR REPLACE FUNCTION public.gf_test_setup_guard_update() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN
     IF NEW.id IS DISTINCT FROM OLD.id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.machine_id IS DISTINCT FROM OLD.machine_id THEN RAISE EXCEPTION 'GF_IMMUTABLE' USING ERRCODE='P0001'; END IF;
     NEW.created_at := OLD.created_at; IF NEW.baseline_pinned_at IS DISTINCT FROM OLD.baseline_pinned_at AND NEW.baseline_pinned_at <> now() THEN RAISE EXCEPTION 'GF_BASELINE' USING ERRCODE='P0001'; END IF;
     NEW.updated_at := now(); RETURN NEW; END $$`],
  ['soft-delete function made SECURITY INVOKER', `ALTER FUNCTION public.gf_soft_delete_test_setup(uuid) SECURITY INVOKER`],
  ['EXECUTE on re-pin granted to anon', `GRANT EXECUTE ON FUNCTION public.gf_repin_test_setup_baseline(uuid) TO anon`],
  ['frozen DATA-FOUNDATION table altered', `ALTER TABLE public.machines ADD COLUMN gf_mutant integer`],
  ['frozen DATA-FOUNDATION policy altered', `DROP POLICY df_machines_update ON public.machines;
     CREATE POLICY df_machines_update ON public.machines FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())`],
  ['engineering-value reference added to test_setups', `ALTER TABLE public.test_setups ADD COLUMN value_id uuid REFERENCES public.value_records (id)`],
  ['Lab table added', `CREATE TABLE public.labs (id uuid PRIMARY KEY)`],
  ['canonical taxonomy seeded', `INSERT INTO public.canonical_fields (key, family, canonical_unit, value_kind) VALUES ('mutant_field','mutant','lb','numeric')`],
];

async function suite(dbName, mutantSql) {
  const results = [];
  const rec = (group, name, ok, detail) => results.push({ group, name, ok: !!ok, detail: detail || '' });
  const admin = new Client({ ...cfg, database: 'postgres' }); await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${dbName}`); await admin.query(`CREATE DATABASE ${dbName}`); await admin.end();
  const db = new Client({ ...cfg, database: dbName }); await db.connect();
  const q0 = async (sql, p) => (await db.query(sql, p));

  /* run in a rolled-back transaction as a given identity: 'owner:A' | 'user:B' | 'owner' (no user id) | 'anon' | 'service' | 'super' */
  const setWho = async (who) => {
    const [kind, u] = who.split(':');
    const role = { owner: 'authenticated', user: 'authenticated', anon: 'anon', service: 'service_role', super: null }[kind];
    await db.query('RESET ROLE');
    if (role) await db.query(`SET LOCAL ROLE ${role}`);
    await db.query("SELECT set_config('request.jwt.claims', $1, true)", [u ? JSON.stringify({ sub: U[u], role }) : '']);
  };
  async function tx(who, fn) {
    await db.query('BEGIN');
    try { await setWho(who); return await fn(async (sql, p) => (await db.query(sql, p)), setWho); }
    finally { await db.query('ROLLBACK'); }
  }
  /* one statement inside the current transaction, isolated by a savepoint */
  async function step(q, sql, p) {
    await q('SAVEPOINT s');
    try { const r = await q(sql, p); await q('RELEASE SAVEPOINT s'); return { ok: true, rows: r.rows, n: r.rowCount }; }
    catch (e) { await q('ROLLBACK TO SAVEPOINT s'); return { ok: false, code: e.code, msg: e.message.split('\n')[0] }; }
  }
  async function attempt(who, sql, p) { try { return await tx(who, async q => { const r = await q(sql, p); return { ok: true, rows: r.rows, n: r.rowCount }; }); }
    catch (e) { return { ok: false, code: e.code, msg: e.message.split('\n')[0] }; } }
  const fmt = r => r.ok ? `ok (rows ${r.n})` : `${r.code} ${r.msg}`;
  async function expectOk(g, name, who, sql, p, check) { const r = await attempt(who, sql, p); const ok = r.ok && (!check || check(r));
    rec(g, name, ok, r.ok ? (ok ? `rows ${r.n}` : `unexpected result ${JSON.stringify(r.rows).slice(0, 120)}`) : `${r.code} ${r.msg}`); }
  async function expectErr(g, name, who, sql, p, codes, re) { const r = await attempt(who, sql, p); const cs = [].concat(codes);
    const ok = !r.ok && cs.includes(r.code) && (!re || re.test(r.msg)); rec(g, name, ok, r.ok ? `UNEXPECTEDLY SUCCEEDED (rows ${r.n})` : `${r.code} ${r.msg}`); }
  async function expectRows(g, name, who, sql, p, n) { const r = await attempt(who, sql, p); rec(g, name, r.ok && r.rows.length === n, r.ok ? `got ${r.rows.length} row(s), expected ${n}` : `${r.code} ${r.msg}`); }
  /* multi-step check: fn returns {ok, detail}; any unexpected exception is a failure */
  async function multi(g, name, who, fn) { let out; try { out = await tx(who, fn); } catch (e) { out = { ok: false, detail: `${e.code} ${e.message.split('\n')[0]}` }; }
    rec(g, name, out.ok, out.detail); }
  const row = async (q, sql, p) => (await q(sql, p)).rows[0];

  // ---------------- FROZEN DEPENDENCY ----------------
  const FZ = 'frozen';
  const frozen = DF_FILES.map(f => ({ f, tag: atTag(f), wt: fs.readFileSync(path.join(REPO, f), 'utf8') }));
  rec(FZ, 'shim + DATA-FOUNDATION 0001-0005 read from the DATA-FOUNDATION-1.0.0 tag, byte-identical to the working tree',
    frozen.every(x => x.tag === x.wt), `${frozen.filter(x => x.tag === x.wt).length}/${frozen.length} files identical`);
  for (const x of frozen) await q0(x.tag);
  const fpBefore = (await q0(FP_SQL)).rows.map(r => r.x);

  // ---------------- SCHEMA ----------------
  const S = 'schema';
  const dump = () => execFileSync(path.join(process.env.GF_PG_BIN, 'pg_dump'), ['-h', cfg.host, '-p', String(cfg.port), '-U', 'postgres', '-s', dbName]).toString()
    .split('\n').filter(l => !/^\\(un)?restrict /.test(l)).join('\n');
  let applied = true, applyErr = '';
  try { for (const f of GF_MIG) await q0(fs.readFileSync(f, 'utf8')); } catch (e) { applied = false; applyErr = e.message.split('\n')[0]; }
  rec(S, 'Garage migrations 0101-0103 apply cleanly after DATA-FOUNDATION 0001-0005', applied, applied ? '0101-0103' : applyErr);
  const d1 = dump(); for (const f of GF_MIG) await q0(fs.readFileSync(f, 'utf8')); const d2 = dump();
  rec(S, 're-applying the Garage migrations is a no-op (schema dump byte-identical)', d1 === d2, `dump ${d1.length} bytes`);
  if (!mutantSql) fs.writeFileSync(path.join(HERE, 'evidence', 'schema-dump.sql'), d1.replace(/^-- Dumped (from|by) .*$/gm, '-- Dumped $1 (version line removed for determinism)'));
  if (mutantSql) await q0(mutantSql);

  const fpAfter = (await q0(FP_SQL)).rows.map(r => r.x);
  const same = JSON.stringify(fpBefore) === JSON.stringify(fpAfter);
  rec(FZ, 'frozen DATA-FOUNDATION catalog (tables, columns, constraints, indexes, policies, triggers, functions, grants, enums, reference rows) unchanged by Garage',
    same, same ? `${fpAfter.length} catalog entries identical` : `changed: ${fpAfter.filter(x => !fpBefore.includes(x)).concat(fpBefore.filter(x => !fpAfter.includes(x))).join(' | ').slice(0, 200)}`);
  {
    const r = await row(q0, `SELECT (SELECT count(*) FROM calculators)::int c, (SELECT count(*) FROM formula_versions)::int f, (SELECT count(*) FROM calculators WHERE engine_proven)::int p`);
    rec(FZ, 'frozen reference data intact: 583 calculators, 577 formula versions, 252 engine-proven', r.c === 583 && r.f === 577 && r.p === 252, `${r.c}/${r.f}/${r.p}`);
  }

  const tables = (await q0(`SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' ORDER BY relname`)).rows.map(r => r.relname);
  rec(S, 'exactly one new table (test_setups) beside the 10 frozen tables', JSON.stringify(tables) === JSON.stringify([...DF_TABLES, 'test_setups'].sort()), tables.join(','));
  {
    const got = (await q0(`SELECT column_name, udt_name, (is_nullable='YES')::int nul FROM information_schema.columns WHERE table_schema='public' AND table_name='test_setups' ORDER BY ordinal_position`)).rows.map(r => [r.column_name, r.udt_name, r.nul]);
    rec(S, 'test_setups columns, types and nullability are exactly the approved set', JSON.stringify(got) === JSON.stringify(APPROVED_COLUMNS), JSON.stringify(got) === JSON.stringify(APPROVED_COLUMNS) ? `${got.length} columns` : 'got ' + JSON.stringify(got).slice(0, 200));
  }
  {
    const r = await row(q0, `SELECT relrowsecurity r, relforcerowsecurity f FROM pg_class WHERE oid='public.test_setups'::regclass`);
    rec(S, 'RLS enabled AND forced on test_setups', r.r && r.f, `enabled ${r.r}, forced ${r.f}`);
  }
  {
    const cons = (await q0(`SELECT conname, contype, pg_get_constraintdef(oid) def, confdeltype FROM pg_constraint WHERE conrelid='public.test_setups'::regclass ORDER BY conname`)).rows;
    const has = (n, re) => cons.find(c => c.conname === n && re.test(c.def));
    const ok = has('test_setups_pkey', /^PRIMARY KEY \(id\)$/) && has('test_setups_id_owner_uq', /^UNIQUE \(id, owner_id\)$/)
      && has('test_setups_machine_same_owner_fk', /^FOREIGN KEY \(machine_id, owner_id\) REFERENCES machines\(id, owner_id\) ON DELETE RESTRICT$/)
      && has('test_setups_owner_id_fkey', /^FOREIGN KEY \(owner_id\) REFERENCES accounts\(id\) ON DELETE RESTRICT$/)
      && has('test_setups_name_not_blank', /length\(btrim\(name\)\) > 0/) && cons.length === 5;
    rec(S, 'constraints: PK(id), UNIQUE(id, owner_id), composite same-owner FK to machines, owner FK to accounts (RESTRICT), non-blank name', ok, cons.map(c => c.conname).join(','));
  }
  {
    const idx = (await q0(`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='test_setups' ORDER BY 1`)).rows.map(r => r.indexname);
    const want = ['test_setups_id_owner_uq', 'test_setups_machine_idx', 'test_setups_owner_idx', 'test_setups_pkey'];
    rec(S, 'indexes: pkey, (id, owner_id), owner, machine', JSON.stringify(idx) === JSON.stringify(want), idx.join(','));
  }
  {
    const t = (await q0(`SELECT tgname, pg_get_triggerdef(oid) d FROM pg_trigger WHERE tgrelid='public.test_setups'::regclass AND NOT tgisinternal ORDER BY tgname`)).rows;
    const ok = t.length === 3
      && t.find(x => x.tgname === 'gf_stamp' && /BEFORE INSERT .*FOR EACH ROW EXECUTE FUNCTION gf_test_setup_stamp_insert\(\)/.test(x.d))
      && t.find(x => x.tgname === 'gf_guard' && /BEFORE UPDATE .*FOR EACH ROW EXECUTE FUNCTION gf_test_setup_guard_update\(\)/.test(x.d))
      && t.find(x => x.tgname === 'gf_no_delete' && /BEFORE DELETE .*FOR EACH ROW EXECUTE FUNCTION gf_test_setup_refuse_delete\(\)/.test(x.d));
    rec(S, 'triggers: BEFORE INSERT stamp, BEFORE UPDATE guard, BEFORE DELETE refusal (row level)', !!ok, t.map(x => x.tgname).join(','));
  }
  {
    const r = await row(q0, `SELECT
       (SELECT array_agg(p ORDER BY p) FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p WHERE has_table_privilege('anon','public.test_setups',p)) anon_t,
       (SELECT array_agg(p ORDER BY p) FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p WHERE has_table_privilege('authenticated','public.test_setups',p)) auth_t,
       (SELECT array_agg(attname::text ORDER BY attname) FROM pg_attribute WHERE attrelid='public.test_setups'::regclass AND attnum>0 AND NOT attisdropped AND has_column_privilege('authenticated','public.test_setups',attname,'INSERT')) ins,
       (SELECT array_agg(attname::text ORDER BY attname) FROM pg_attribute WHERE attrelid='public.test_setups'::regclass AND attnum>0 AND NOT attisdropped AND has_column_privilege('authenticated','public.test_setups',attname,'UPDATE')) upd,
       (SELECT array_agg(attname::text ORDER BY attname) FROM pg_attribute WHERE attrelid='public.test_setups'::regclass AND attnum>0 AND NOT attisdropped AND has_column_privilege('anon','public.test_setups',attname,'SELECT')) anon_c`);
    rec(S, 'grants: anon none; authenticated table-level SELECT only', r.anon_t === null && r.anon_c === null && JSON.stringify(r.auth_t) === '["SELECT"]', `anon ${JSON.stringify(r.anon_t)}/${JSON.stringify(r.anon_c)}; authenticated ${JSON.stringify(r.auth_t)}`);
    rec(S, 'client INSERT columns exactly machine_id, name, description, notes (no id, owner, pin, timestamps, deletion)', JSON.stringify(r.ins) === '["description","machine_id","name","notes"]', JSON.stringify(r.ins));
    rec(S, 'client UPDATE columns exactly name, description, notes', JSON.stringify(r.upd) === '["description","name","notes"]', JSON.stringify(r.upd));
  }
  {
    const f = (await q0(`SELECT p.proname, p.prosecdef, p.proconfig, has_function_privilege('anon', p.oid, 'EXECUTE') anon_x,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') auth_x, coalesce(array_to_string(p.proacl, ','), '') acl, pg_get_function_identity_arguments(p.oid) args,
         p.prorettype::regtype::text ret
       FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'gf\\_%' ORDER BY 1`)).rows;
    const callable = f.filter(x => x.ret === 'void'), trig = f.filter(x => x.ret === 'trigger');
    rec(S, 'exactly two fixed-table callable functions: gf_repin_test_setup_baseline(p_id uuid), gf_soft_delete_test_setup(p_id uuid)',
      JSON.stringify(callable.map(x => `${x.proname}(${x.args})`)) === JSON.stringify(['gf_repin_test_setup_baseline(p_id uuid)', 'gf_soft_delete_test_setup(p_id uuid)']), callable.map(x => `${x.proname}(${x.args})`).join(', '));
    rec(S, 'both are SECURITY DEFINER with a fixed empty search_path', callable.length === 2 && callable.every(x => x.prosecdef && JSON.stringify(x.proconfig) === JSON.stringify(['search_path=""'])), JSON.stringify(callable.map(x => [x.prosecdef, x.proconfig])));
    rec(S, 'EXECUTE: authenticated only; not anon, not PUBLIC', callable.length === 2 && callable.every(x => x.auth_x && !x.anon_x && !/(^|,)=X/.test(x.acl)), callable.map(x => x.acl).join(' | '));
    rec(S, 'three trigger functions, none SECURITY DEFINER, each with a fixed empty search_path',
      trig.length === 3 && trig.every(x => !x.prosecdef && JSON.stringify(x.proconfig) === JSON.stringify(['search_path=""'])), trig.map(x => x.proname).join(','));
  }

  // ---------------- BOUNDARY: no engineering values, no calculations, no Labs ----------------
  const BD = 'boundary';
  {
    const refs = (await q0(`SELECT conname FROM pg_constraint WHERE conrelid='public.test_setups'::regclass AND contype='f'
       AND confrelid IN ('public.canonical_fields'::regclass,'public.value_records'::regclass,'public.calculation_records'::regclass,'public.formula_versions'::regclass,'public.calculators'::regclass)`)).rows;
    const fnRefs = (await q0(`SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'gf\\_%'
       AND pg_get_functiondef(oid) ~ '(canonical_fields|value_records|calculation_records|formula_versions|calculators)'`)).rows;
    rec(BD, 'no Garage object references canonical_fields, value_records, calculation_records, formula_versions or calculators', refs.length === 0 && fnRefs.length === 0,
      `${refs.length} foreign keys, ${fnRefs.length} functions`);
  }
  {
    const n = (await row(q0, `SELECT count(*)::int n FROM pg_type WHERE typtype='e' AND typnamespace='public'::regnamespace`)).n;
    rec(BD, 'no new enum type (8 frozen enums only)', n === 8, `${n} enums`);
  }
  {
    const lab = (await q0(`SELECT 'rel '||relname x FROM pg_class WHERE relnamespace='public'::regnamespace AND relname ~ '(^|_)labs?($|_)'
       UNION ALL SELECT 'col '||table_name||'.'||column_name FROM information_schema.columns WHERE table_schema='public' AND column_name ~ '(^|_)labs?($|_)'
       UNION ALL SELECT 'fn '||proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname ~ '(^|_)labs?($|_)'`)).rows;
    rec(BD, 'no Lab table, column or function exists (Labs deferred, #27)', lab.length === 0, lab.map(r => r.x).join(',') || 'none');
  }

  // ---------------- fixtures (superuser, committed) ----------------
  await q0(`INSERT INTO auth.users (id) VALUES ('${U.A}'), ('${U.B}'), ('${U.C}')`);
  await q0('BEGIN');
  await q0(`INSERT INTO garages (id, owner_id, name) VALUES ('${ID.GA}','${U.A}','A garage'), ('${ID.GB}','${U.B}','B garage')`);
  await q0(`INSERT INTO machines (id, owner_id, garage_id, name, machine_type) VALUES ('${ID.MA}','${U.A}','${ID.GA}','A machine','automotive'),
    ('${ID.MA2}','${U.A}','${ID.GA}','A second machine','marine'), ('${ID.MB}','${U.B}','${ID.GB}','B machine','automotive')`);
  await q0(`INSERT INTO components (id, owner_id, machine_id, kind) VALUES ('${ID.CA1}','${U.A}','${ID.MA}','engine')`);
  await q0(`INSERT INTO test_setups (id, owner_id, machine_id, name) VALUES ('${ID.TA}','${U.A}','${ID.MA}','A setup'),
    ('${ID.TA2}','${U.A}','${ID.MA2}','A second setup'), ('${ID.TD}','${U.A}','${ID.MA}','A deleted setup'), ('${ID.TB}','${U.B}','${ID.MB}','B setup')`);
  await q0(`UPDATE test_setups SET deleted_at = now() WHERE id = '${ID.TD}'`);   // fixture: already deleted at fixture time
  await q0('COMMIT');
  /* In every later (check) transaction now() is strictly after the fixture transaction, so for TA / TA2 / TB:
   *   "baseline unchanged"  <=> baseline_pinned_at = created_at   (both were stamped by the fixture transaction)
   *   "baseline re-pinned"  <=> baseline_pinned_at = now() > created_at
   * and for TD: "deletion time unchanged" <=> deleted_at = created_at < now(). */
  const TS = id => `SELECT baseline_pinned_at = created_at AS pin_unchanged, baseline_pinned_at = now() AS pin_now, now() > created_at AS later,
      updated_at = now() AS upd_now, deleted_at, deleted_at = now() AS del_now, deleted_at = created_at AS del_fixture, owner_id, machine_id, name, description, notes
    FROM test_setups WHERE id = '${id}'`;

  // ---------------- OWNERSHIP ----------------
  const O = 'ownership';
  await expectOk(O, 'owner can create a test setup on an own machine; owner, pin and timestamps set server-side', 'owner:A',
    `INSERT INTO test_setups (machine_id, name, description, notes) VALUES ('${ID.MA}', 'Created', 'd', 'n')
     RETURNING owner_id = '${U.A}' AS own, baseline_pinned_at = now() AS pin, created_at = now() AS c, updated_at = now() AS u, deleted_at IS NULL AS live`, [],
    r => r.n === 1 && r.rows[0].own && r.rows[0].pin && r.rows[0].c && r.rows[0].u && r.rows[0].live);
  await expectRows(O, 'owner reads exactly own active test setups (2; the deleted one hidden)', 'owner:A', `SELECT id FROM test_setups`, [], 2);
  await multi(O, 'owner can update the descriptive fields name, description, notes', 'owner:A', async q => {
    const u = await step(q, `UPDATE test_setups SET name = 'Renamed', description = 'desc', notes = 'notes' WHERE id = '${ID.TA}'`);
    const r = await row(q, TS(ID.TA));
    return { ok: u.ok && u.n === 1 && r.name === 'Renamed' && r.description === 'desc' && r.notes === 'notes', detail: `${fmt(u)}; ${r.name}/${r.description}/${r.notes}` };
  });
  await expectRows(O, 'another user cannot read A\u2019s test setup', 'user:B', `SELECT id FROM test_setups WHERE id = '${ID.TA}'`, [], 0);
  await expectRows(O, 'another user sees only own test setups', 'user:B', `SELECT id FROM test_setups`, [], 1);
  await multi(O, 'another user cannot update A\u2019s test setup (0 rows; row unchanged)', 'user:B', async (q, as) => {
    const u = await step(q, `UPDATE test_setups SET name = 'Hijack' WHERE id = '${ID.TA}'`);
    await as('super'); const r = await row(q, TS(ID.TA));
    return { ok: u.ok && u.n === 0 && r.name === 'A setup', detail: `${fmt(u)}; name ${r.name}` };
  });
  await multi(O, 'another user cannot soft-delete A\u2019s test setup (same error as not found; row untouched)', 'user:B', async (q, as) => {
    const d = await step(q, `SELECT public.gf_soft_delete_test_setup('${ID.TA}')`);
    await as('super'); const r = await row(q, TS(ID.TA));
    return { ok: !d.ok && d.code === NOT_FOUND && /GF_NOT_FOUND/.test(d.msg) && r.deleted_at === null, detail: `${fmt(d)}; deleted_at ${r.deleted_at}` };
  });
  await expectErr(O, 'owner cannot attach a test setup to another owner\u2019s machine (composite FK)', 'owner:A',
    `INSERT INTO test_setups (machine_id, name) VALUES ('${ID.MB}', 'Cross')`, [], FK, /test_setups_machine_same_owner_fk/);
  await expectErr(O, 'client cannot spoof the owner (owner_id is not client-insertable)', 'owner:A',
    `INSERT INTO test_setups (owner_id, machine_id, name) VALUES ('${U.B}', '${ID.MB}', 'Spoof')`, [], DENIED);
  await expectErr(O, 'client cannot supply the owner at all, even its own (server-derived only)', 'owner:A',
    `INSERT INTO test_setups (owner_id, machine_id, name) VALUES ('${U.A}', '${ID.MA}', 'Own')`, [], DENIED);
  await expectErr(O, 'client cannot choose the id', 'owner:A', `INSERT INTO test_setups (id, machine_id, name) VALUES ('${ID.N1}', '${ID.MA}', 'Id')`, [], DENIED);
  await expectErr(O, 'client cannot choose the baseline pin on insert', 'owner:A',
    `INSERT INTO test_setups (machine_id, name, baseline_pinned_at) VALUES ('${ID.MA}', 'Pin', now() - interval '1 day')`, [], DENIED);
  await expectErr(O, 'client cannot create a row already deleted (no deletion time on insert)', 'owner:A',
    `INSERT INTO test_setups (machine_id, name, deleted_at) VALUES ('${ID.MA}', 'Del', now())`, [], DENIED);
  await expectErr(O, 'anon cannot read', 'anon', `SELECT id FROM test_setups`, [], DENIED);
  await expectErr(O, 'anon cannot insert', 'anon', `INSERT INTO test_setups (machine_id, name) VALUES ('${ID.MA}', 'Anon')`, [], DENIED);
  await expectErr(O, 'signed-in session without a user id cannot insert (no owner)', 'owner',
    `INSERT INTO test_setups (machine_id, name) VALUES ('${ID.MA}', 'NoUser')`, [], ['23502', DENIED]);
  await expectErr(O, 'non-existent machine rejected', 'owner:A', `INSERT INTO test_setups (machine_id, name) VALUES ('${ID.N1}', 'Ghost')`, [], FK);
  await expectErr(O, 'blank name rejected', 'owner:A', `INSERT INTO test_setups (machine_id, name) VALUES ('${ID.MA}', '   ')`, [], '23514', /test_setups_name_not_blank/);

  // ---------------- IMMUTABILITY ----------------
  const I = 'immutability';
  await expectErr(I, 'owner cannot change the id', 'owner:A', `UPDATE test_setups SET id = '${ID.N1}' WHERE id = '${ID.TA}'`, [], DENIED);
  await expectErr(I, 'owner cannot change the owner', 'owner:A', `UPDATE test_setups SET owner_id = '${U.B}' WHERE id = '${ID.TA}'`, [], DENIED);
  await expectErr(I, 'owner cannot change the machine, even to another own machine', 'owner:A', `UPDATE test_setups SET machine_id = '${ID.MA2}' WHERE id = '${ID.TA}'`, [], DENIED);
  await expectErr(I, 'every role: id cannot change (superuser -> GF_IMMUTABLE)', 'super', `UPDATE test_setups SET id = '${ID.N1}' WHERE id = '${ID.TA}'`, [], GF_ERR, /GF_IMMUTABLE/);
  await expectErr(I, 'every role: owner cannot change (superuser -> GF_IMMUTABLE)', 'super', `UPDATE test_setups SET owner_id = '${U.B}' WHERE id = '${ID.TA}'`, [], GF_ERR, /GF_IMMUTABLE/);
  await expectErr(I, 'every role: machine cannot change (superuser -> GF_IMMUTABLE)', 'super', `UPDATE test_setups SET machine_id = '${ID.MA2}' WHERE id = '${ID.TA}'`, [], GF_ERR, /GF_IMMUTABLE/);
  await expectErr(I, 'every role: machine cannot change (service role -> GF_IMMUTABLE)', 'service', `UPDATE test_setups SET machine_id = '${ID.MA2}' WHERE id = '${ID.TA}'`, [], GF_ERR, /GF_IMMUTABLE/);
  await multi(I, 'every role: created_at is restored on update (server-forced)', 'super', async q => {
    await q(`UPDATE test_setups SET created_at = '2000-01-01' WHERE id = '${ID.TA}'`);
    const r = await row(q, `SELECT created_at > '2000-01-02' ok FROM test_setups WHERE id = '${ID.TA}'`);
    return { ok: r.ok, detail: r.ok ? 'restored' : 'overwritten' };
  });
  await expectErr(I, 'owner cannot move the baseline directly (no column grant)', 'owner:A', `UPDATE test_setups SET baseline_pinned_at = now() WHERE id = '${ID.TA}'`, [], DENIED);
  await expectErr(I, 'every role: baseline cannot be back-dated (superuser -> GF_BASELINE)', 'super',
    `UPDATE test_setups SET baseline_pinned_at = now() - interval '1 day' WHERE id = '${ID.TA}'`, [], GF_ERR, /GF_BASELINE/);
  await expectErr(I, 'every role: baseline cannot be set to an arbitrary future time (superuser -> GF_BASELINE)', 'super',
    `UPDATE test_setups SET baseline_pinned_at = now() + interval '1 day' WHERE id = '${ID.TA}'`, [], GF_ERR, /GF_BASELINE/);
  await multi(I, 'a descriptive edit never moves the baseline; updated_at refreshed', 'owner:A', async (q, as) => {
    const u = await step(q, `UPDATE test_setups SET notes = 'edited' WHERE id = '${ID.TA}'`);
    await as('super'); const r = await row(q, TS(ID.TA));
    return { ok: u.ok && u.n === 1 && r.pin_unchanged && r.later && r.upd_now, detail: `${fmt(u)}; pin unchanged ${r.pin_unchanged}; updated_at now ${r.upd_now}` };
  });
  await multi(I, 'machine and component changes never move an existing test setup\u2019s baseline', 'owner:A', async (q, as) => {
    const s1 = await step(q, `UPDATE machines SET name = 'Changed', machine_type = 'motorcycle', propulsion = 'custom', power_source = 'diesel', is_hypothetical = true WHERE id = '${ID.MA}'`);
    const s2 = await step(q, `INSERT INTO components (machine_id, kind) VALUES ('${ID.MA}', 'transmission')`);
    const s3 = await step(q, `UPDATE components SET manufacturer = 'X', model = 'Y' WHERE id = '${ID.CA1}'`);
    const s4 = await step(q, `SELECT public.df_soft_delete_component('${ID.CA1}')`);
    await as('super'); const r = await row(q, TS(ID.TA));
    return { ok: s1.ok && s1.n === 1 && s2.ok && s3.ok && s3.n === 1 && s4.ok && r.pin_unchanged && r.later,
      detail: `machine ${fmt(s1)}; component insert ${fmt(s2)}; component update ${fmt(s3)}; component delete ${fmt(s4)}; pin unchanged ${r.pin_unchanged}` };
  });
  await multi(I, 'explicit re-pin moves the baseline to the server time of the call; identity, created_at and descriptive fields unchanged', 'owner:A', async (q, as) => {
    const p = await step(q, `SELECT public.gf_repin_test_setup_baseline('${ID.TA}')`);
    await as('super'); const r = await row(q, TS(ID.TA)); const c = await row(q, `SELECT created_at < now() c FROM test_setups WHERE id = '${ID.TA}'`);
    return { ok: p.ok && r.pin_now && r.later && c.c && r.upd_now && r.owner_id === U.A && r.machine_id === ID.MA && r.name === 'A setup',
      detail: `${fmt(p)}; pin now ${r.pin_now}; created_at kept ${c.c}; updated_at now ${r.upd_now}` };
  });
  await multi(I, 'another user cannot re-pin A\u2019s baseline (same error as not found; pin unchanged)', 'user:B', async (q, as) => {
    const p = await step(q, `SELECT public.gf_repin_test_setup_baseline('${ID.TA}')`);
    await as('super'); const r = await row(q, TS(ID.TA));
    return { ok: !p.ok && p.code === NOT_FOUND && /GF_NOT_FOUND/.test(p.msg) && r.pin_unchanged, detail: `${fmt(p)}; pin unchanged ${r.pin_unchanged}` };
  });
  await multi(I, 'a deleted test setup cannot be re-pinned (GF_NOT_FOUND; pin unchanged)', 'owner:A', async (q, as) => {
    const p = await step(q, `SELECT public.gf_repin_test_setup_baseline('${ID.TD}')`);
    await as('super'); const r = await row(q, `SELECT baseline_pinned_at = created_at u FROM test_setups WHERE id = '${ID.TD}'`);
    return { ok: !p.ok && p.code === NOT_FOUND && r.u, detail: `${fmt(p)}; pin unchanged ${r.u}` };
  });
  await expectErr(I, 'every role: a deleted test setup\u2019s pin cannot move (superuser -> GF_BASELINE)', 'super',
    `UPDATE test_setups SET baseline_pinned_at = now() WHERE id = '${ID.TD}'`, [], GF_ERR, /GF_BASELINE/);
  await expectErr(I, 're-pin: non-existent id -> GF_NOT_FOUND', 'owner:A', `SELECT public.gf_repin_test_setup_baseline('${ID.N1}')`, [], NOT_FOUND, /GF_NOT_FOUND/);
  await expectErr(I, 're-pin: anon cannot execute', 'anon', `SELECT public.gf_repin_test_setup_baseline('${ID.TA}')`, [], DENIED);
  await expectErr(I, 're-pin: signed-in session without a user id rejected (GF_AUTH)', 'owner', `SELECT public.gf_repin_test_setup_baseline('${ID.TA}')`, [], DENIED, /GF_AUTH/);
  await multi(I, 'privileged server path (service role) can move the pin only to server time', 'service', async q => {
    const ok1 = await step(q, `UPDATE test_setups SET baseline_pinned_at = now() WHERE id = '${ID.TB}'`);
    const bad = await step(q, `UPDATE test_setups SET baseline_pinned_at = now() - interval '1 hour' WHERE id = '${ID.TB}'`);
    return { ok: ok1.ok && ok1.n === 1 && !bad.ok && bad.code === GF_ERR && /GF_BASELINE/.test(bad.msg), detail: `server time ${fmt(ok1)}; back-dated ${fmt(bad)}` };
  });
  await multi(I, 'every role: insert stamps the pin and timestamps server-side (supplied values ignored)', 'super', async q => {
    await q(`INSERT INTO test_setups (id, owner_id, machine_id, name, baseline_pinned_at, created_at, updated_at)
             VALUES ('${ID.N1}', '${U.A}', '${ID.MA}', 'Stamped', '2000-01-01', '2000-01-01', '2000-01-01')`);
    const r = await row(q, `SELECT baseline_pinned_at = now() p, created_at = now() c, updated_at = now() u FROM test_setups WHERE id = '${ID.N1}'`);
    return { ok: r.p && r.c && r.u, detail: `pin ${r.p}, created ${r.c}, updated ${r.u}` };
  });
  await expectErr(I, 'every role: a row cannot be created already deleted (superuser -> GF_IMMUTABLE)', 'super',
    `INSERT INTO test_setups (owner_id, machine_id, name, deleted_at) VALUES ('${U.A}', '${ID.MA}', 'Pre-deleted', now())`, [], GF_ERR, /GF_IMMUTABLE/);
  await multi(I, 're-pin in the creating transaction leaves the pin at the creation time (transaction server time)', 'owner:A', async q => {
    const ins = await q(`INSERT INTO test_setups (machine_id, name) VALUES ('${ID.MA}', 'Same tx') RETURNING id`);
    const p = await step(q, `SELECT public.gf_repin_test_setup_baseline('${ins.rows[0].id}')`);
    const r = await row(q, `SELECT baseline_pinned_at = created_at AND created_at = now() ok FROM test_setups WHERE id = $1`, [ins.rows[0].id]);
    return { ok: p.ok && r.ok, detail: `${fmt(p)}; pin = creation time ${r.ok}` };
  });
  await expectErr(I, 'owner cannot hard-delete (no DELETE grant)', 'owner:A', `DELETE FROM test_setups WHERE id = '${ID.TA}'`, [], DENIED);
  await expectErr(I, 'every role: hard DELETE refused (superuser -> GF_IMMUTABLE)', 'super', `DELETE FROM test_setups WHERE id = '${ID.TA}'`, [], GF_ERR, /GF_IMMUTABLE/);
  await expectErr(I, 'every role: hard DELETE refused (service role -> GF_IMMUTABLE)', 'service', `DELETE FROM test_setups WHERE id = '${ID.TB}'`, [], GF_ERR, /GF_IMMUTABLE/);

  // ---------------- SOFT DELETE ----------------
  const SD = 'soft_delete';
  await multi(SD, 'owner soft-deletes own test setup: hidden from owner SELECT; deleted_at = server time; owner, created_at and pin unchanged', 'owner:A', async (q, as) => {
    const d = await step(q, `SELECT public.gf_soft_delete_test_setup('${ID.TA}')`);
    const vis = await q(`SELECT id FROM test_setups WHERE id = '${ID.TA}'`);
    await as('super'); const r = await row(q, TS(ID.TA)); const c = await row(q, `SELECT created_at < now() c FROM test_setups WHERE id = '${ID.TA}'`);
    return { ok: d.ok && vis.rowCount === 0 && r.del_now && r.owner_id === U.A && c.c && r.pin_unchanged,
      detail: `${fmt(d)}; visible ${vis.rowCount}; deleted_at server time ${r.del_now}; pin unchanged ${r.pin_unchanged}` };
  });
  await multi(SD, 'already-deleted row -> GF_NOT_FOUND; deleted_at not re-stamped', 'owner:A', async (q, as) => {
    const d = await step(q, `SELECT public.gf_soft_delete_test_setup('${ID.TD}')`);
    await as('super'); const r = await row(q, TS(ID.TD));
    return { ok: !d.ok && d.code === NOT_FOUND && /GF_NOT_FOUND/.test(d.msg) && r.del_fixture && !r.del_now, detail: `${fmt(d)}; original deletion time kept ${r.del_fixture}` };
  });
  await multi(SD, 'repeat soft delete in the same session -> GF_NOT_FOUND', 'owner:A', async q => {
    const d1 = await step(q, `SELECT public.gf_soft_delete_test_setup('${ID.TA}')`);
    const d2 = await step(q, `SELECT public.gf_soft_delete_test_setup('${ID.TA}')`);
    return { ok: d1.ok && !d2.ok && d2.code === NOT_FOUND, detail: `first ${fmt(d1)}; second ${fmt(d2)}` };
  });
  await expectErr(SD, 'soft delete: non-existent id -> GF_NOT_FOUND', 'owner:A', `SELECT public.gf_soft_delete_test_setup('${ID.N1}')`, [], NOT_FOUND, /GF_NOT_FOUND/);
  await expectErr(SD, 'soft delete: anon cannot execute', 'anon', `SELECT public.gf_soft_delete_test_setup('${ID.TA}')`, [], DENIED);
  await expectErr(SD, 'soft delete: signed-in session without a user id rejected (GF_AUTH)', 'owner', `SELECT public.gf_soft_delete_test_setup('${ID.TA}')`, [], DENIED, /GF_AUTH/);
  await expectErr(SD, 'no client-controlled deletion time: direct UPDATE of deleted_at with a WHERE clause refused', 'owner:A',
    `UPDATE test_setups SET deleted_at = now() WHERE id = '${ID.TA}'`, [], DENIED);
  await expectErr(SD, 'no client-controlled deletion time: WHERE-less UPDATE of deleted_at refused', 'owner:A', `UPDATE test_setups SET deleted_at = now()`, [], DENIED);
  await expectRows(SD, 'a deleted test setup is hidden from its owner', 'owner:A', `SELECT id FROM test_setups WHERE id = '${ID.TD}'`, [], 0);
  await multi(SD, 'a deleted test setup cannot be edited by its owner (0 rows)', 'owner:A', async (q, as) => {
    const u = await step(q, `UPDATE test_setups SET name = 'Revived' WHERE id = '${ID.TD}'`);
    await as('super'); const r = await row(q, TS(ID.TD));
    return { ok: u.ok && u.n === 0 && r.name === 'A deleted setup', detail: `${fmt(u)}; name ${r.name}` };
  });
  /* A WHERE-less UPDATE skips the SELECT-policy check (recorded DATA-FOUNDATION behaviour), so only the UPDATE
   * policy's own USING clause keeps deleted rows and other users' rows out of reach on that path. */
  await multi(SD, 'WHERE-less owner UPDATE of descriptive fields changes only the caller\u2019s ACTIVE rows (deleted and other users\u2019 rows untouched)', 'owner:A', async (q, as) => {
    const u = await step(q, `UPDATE test_setups SET notes = 'bulk'`);
    await as('super'); const r = await row(q, `SELECT (SELECT notes FROM test_setups WHERE id = '${ID.TD}') d, (SELECT notes FROM test_setups WHERE id = '${ID.TB}') b,
      (SELECT count(*)::int FROM test_setups WHERE owner_id = '${U.A}' AND deleted_at IS NULL AND notes = 'bulk') a`);
    return { ok: u.ok && u.n === 2 && r.a === 2 && r.d === null && r.b === null, detail: `${fmt(u)}; A active updated ${r.a}; deleted row notes ${r.d}; B row notes ${r.b}` };
  });
  await multi(SD, 'no cascade: soft-deleting a test setup leaves its machine and the other setups untouched', 'owner:A', async (q, as) => {
    await q(`SELECT public.gf_soft_delete_test_setup('${ID.TA}')`);
    const m = await q(`SELECT id FROM machines WHERE id = '${ID.MA}'`);
    await as('super'); const r = await row(q, `SELECT (SELECT deleted_at IS NULL FROM machines WHERE id = '${ID.MA}') m, (SELECT deleted_at IS NULL FROM test_setups WHERE id = '${ID.TA2}') t`);
    return { ok: m.rowCount === 1 && r.m && r.t, detail: `machine visible ${m.rowCount}; machine active ${r.m}; sibling active ${r.t}` };
  });
  await multi(SD, 'no cascade: soft-deleting the machine hides its test setups without stamping them', 'owner:A', async (q, as) => {
    await q(`SELECT public.df_soft_delete_machine('${ID.MA}')`);
    const vis = await q(`SELECT id FROM test_setups WHERE machine_id = '${ID.MA}'`);
    const other = await q(`SELECT id FROM test_setups WHERE id = '${ID.TA2}'`);
    await as('super'); const r = await row(q, TS(ID.TA));
    return { ok: vis.rowCount === 0 && other.rowCount === 1 && r.deleted_at === null, detail: `visible on deleted machine ${vis.rowCount}; other machine\u2019s setup visible ${other.rowCount}; TA deleted_at ${r.deleted_at}` };
  });
  await multi(SD, 'no cascade: soft-deleting the garage hides its test setups without stamping them', 'owner:A', async (q, as) => {
    await q(`SELECT public.df_soft_delete_garage('${ID.GA}')`);
    const vis = await q(`SELECT id FROM test_setups`);
    await as('super'); const r = await row(q, `SELECT count(*)::int n FROM test_setups WHERE owner_id = '${U.A}' AND deleted_at IS NULL`);
    return { ok: vis.rowCount === 0 && r.n === 2, detail: `visible ${vis.rowCount}; still active (unstamped) ${r.n}` };
  });

  // ---------------- NO VALUE PERSISTENCE (Unknown / Zero boundary) ----------------
  {
    const r = await row(q0, `SELECT (SELECT count(*) FROM canonical_fields)::int f, (SELECT count(*) FROM value_records)::int v, (SELECT count(*) FROM calculation_records)::int c`);
    rec(BD, 'no value persistence introduced: canonical_fields, value_records and calculation_records all empty after the whole suite', r.f === 0 && r.v === 0 && r.c === 0, `${r.f}/${r.v}/${r.c}`);
  }
  await db.end();
  return results;
}

(async () => {
  const main = await suite('gf_test', null);
  const groups = [...new Set(main.map(r => r.group))];
  console.log('='.repeat(72)); console.log('GEARHEAD LABS - GARAGE-FOUNDATION 1.0.0 - DATABASE SUITE'); console.log('='.repeat(72));
  let fails = 0;
  for (const g of groups) { const rs = main.filter(r => r.group === g), f = rs.filter(r => !r.ok); fails += f.length;
    console.log(`[${f.length ? 'FAIL' : 'PASS'}] ${g.toUpperCase().padEnd(16)} ${rs.length - f.length} passed, ${f.length} failed`);
    f.forEach(x => console.log(`    x ${x.name}\n        ${x.detail}`)); }
  console.log(`\nTOTAL ${main.length} checks, ${main.length - fails} passed, ${fails} failed`);

  const neg = [];
  for (let i = 0; i < MUTANTS.length; i++) {
    const [name, sql] = MUTANTS[i];
    let r, err = '';
    try { r = await suite(`gf_mutant_${i}`, sql); } catch (e) { err = e.message.split('\n')[0]; }
    const failed = r ? r.filter(x => !x.ok) : [];
    neg.push({ mutation: name, detected: !!err || failed.length > 0, failed_checks: failed.map(x => x.name), error: err });
  }
  const undetected = neg.filter(n => !n.detected);
  console.log(`\n[${undetected.length ? 'FAIL' : 'PASS'}] NEGATIVE_CONTROLS ${neg.length - undetected.length}/${neg.length} mutations detected`);
  neg.forEach(n => console.log(`    ${n.detected ? '+' : 'x'} ${n.mutation}: ${n.error ? 'suite error' : n.failed_checks.length + ' check(s) failed'}`));
  fs.writeFileSync(path.join(HERE, 'evidence', 'test-results.json'), JSON.stringify({ checks: main, negative_controls: neg }, null, 1) + '\n');
  const pass = fails === 0 && undetected.length === 0;
  console.log(pass ? '\nGARAGE-FOUNDATION SUITE: PASS' : '\nGARAGE-FOUNDATION SUITE: FAIL'); process.exit(pass ? 0 : 1);
})().catch(e => { console.error('SUITE ERROR:', e.stack || e); process.exit(2); });
