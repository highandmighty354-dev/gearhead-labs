/* Gearhead Labs Premium — models for the approved Foundation/Premium schema.
   Pure data and functions: no storage, no network, no DOM. Shared by the adapters and the UI.

   Authority: supabase/migrations 0001-0406 (frozen DATA/GARAGE/VALUE-FOUNDATION + PREMIUM-FOUNDATION).
   Every list below mirrors a database enum, CHECK constraint or column grant; the database remains
   the enforcing authority (RLS, grants, triggers). These rules only stop bad requests early and give
   readable messages. premium/tests verifies them against the real catalog. */
(function(){
  'use strict';
  const GHP = window.GHP = window.GHP || {};

  const deepFreeze = o => { Object.values(o).forEach(v => { if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v); }); return Object.freeze(o); };

  /* ---------------------------------------------------------------- vocabulary (database enums) */
  /* Values are the exact enum labels; labels are what the UI shows. Marine is deliberately absent
     (owner decision 2, migration 0401): it can never be stored. */
  const ENUMS = {
    machine_type: [
      ['automotive', 'Car / truck / SUV / van'], ['motorcycle', 'Motorcycle'], ['atv_three_wheeler', 'ATV / three-wheeler'],
      ['side_by_side_utv', 'Side-by-side (UTV)'], ['snowmobile', 'Snowmobile'], ['go_kart', 'Go-kart'], ['other_custom', 'Other / custom']
    ],
    power_source: [['gasoline', 'Gasoline'], ['diesel', 'Diesel'], ['electric', 'Electric'], ['hybrid', 'Hybrid'], ['other', 'Other']],
    experience_level: [['beginner', 'Beginner'], ['enthusiast', 'Enthusiast'], ['experienced', 'Experienced'], ['professional', 'Professional']],
    unit_system: [['imperial', 'Imperial'], ['metric', 'Metric']],
    component_kind: [
      ['engine', 'Engine'], ['transmission', 'Transmission'], ['transfer_case', 'Transfer case'],
      ['differential_final_drive', 'Differential / final drive'], ['axle', 'Axle'], ['wheel_tire', 'Wheel / tire'], ['other_custom', 'Other / custom']
    ]
  };
  Object.keys(ENUMS).forEach(k => { ENUMS[k] = ENUMS[k].map(([value, label]) => ({ value, label })); });
  const enumValues = name => ENUMS[name].map(e => e.value);
  const labelFor = (name, value) => { const e = (ENUMS[name] || []).find(x => x.value === value); return e ? e.label : ''; };

  /* Values that exist in the frozen enums but are blocked (0401), and columns clients may never send. */
  const BLOCKED_VALUES = { machine_type: ['marine'] };
  const MARINE_COLUMNS = ['marine_type', 'propulsion'];
  const SERVER_CONTROLLED = ['id', 'owner_id', 'account_id', 'created_at', 'updated_at', 'deleted_at', 'baseline_pinned_at', 'result_trust'];

  /* ---------------------------------------------------------------- plans and features */
  const FEATURES = ['engineering_lab', 'saved_calculations', 'garage_unlimited'];
  const GRANT_SOURCES = ['stripe', 'manual', 'trial', 'promo'];
  const FREE_MACHINE_LIMIT = 1;   // owner decision 1 (0404 restrictive policy)

  /* ---------------------------------------------------------------- Engineering Lab catalog (0406) */
  const ENGINEERING_CATEGORIES = ['Turbo', 'Two-Stroke', 'Valvetrain', 'Chassis', 'Driveline', 'Thermal'];
  const ENGINEERING_CATALOG = [
    ['e01_turbo_compressor_map', 'E01', 'Turbo Compressor Map Builder', 'Turbo'],
    ['e02_turbo_surge_choke_margin', 'E02', 'Turbo Surge / Choke Margin Analyzer', 'Turbo'],
    ['e03_turbo_turbine_matching', 'E03', 'Turbo Turbine Matching Analyzer', 'Turbo'],
    ['e04_turbo_pressure_ratio_stack', 'E04', 'Turbo Pressure-Ratio Stack Analyzer', 'Turbo'],
    ['e05_two_stroke_time_area', 'E05', '2-Stroke Port Time-Area Analyzer', 'Two-Stroke'],
    ['e06_two_stroke_blowdown', 'E06', '2-Stroke Blowdown Analyzer', 'Two-Stroke'],
    ['e07_expansion_chamber_reverse', 'E07', '2-Stroke Expansion-Chamber Reverse Analyzer', 'Two-Stroke'],
    ['e08_valvetrain_dynamic_control', 'E08', 'Valvetrain Dynamic Control Analyzer', 'Valvetrain'],
    ['e09_valve_spring_surge', 'E09', 'Valve Spring Natural-Frequency / Surge Analyzer', 'Valvetrain'],
    ['e10_suspension_kinematics', 'E10', 'Suspension Kinematics Lab', 'Chassis'],
    ['e11_driveline_dynamics', 'E11', 'Driveline Dynamics Lab', 'Driveline'],
    ['e12_radiator_heat_rejection', 'E12', 'Radiator Heat-Rejection Analyzer', 'Thermal'],
    ['e13_intercooler_thermal', 'E13', 'Intercooler Thermal / Pressure-Drop Analyzer', 'Thermal'],
    ['e14_heat_exchanger_matching', 'E14', 'Heat-Exchanger Matching Workbench', 'Thermal']
  ].map(([id, code, name, category]) => ({ id, code, name, category }));
  const ANALYZER_SET = new Set(ENGINEERING_CATALOG.map(a => a.id));
  /* read-only view: a Set itself cannot be frozen */
  const ANALYZER_IDS = Object.freeze({ has: id => ANALYZER_SET.has(id), get size() { return ANALYZER_SET.size; }, values: () => [...ANALYZER_SET] });

  /* ---------------------------------------------------------------- client RPCs (the complete approved set) */
  const RPC = {
    myEntitlement: 'pf_my_entitlement',
    repinTestSetupBaseline: 'gf_repin_test_setup_baseline',
    softDelete: {
      garages: 'df_soft_delete_garage',
      machines: 'df_soft_delete_machine',
      components: 'df_soft_delete_component',
      test_setups: 'gf_soft_delete_test_setup',
      saved_calculations: 'pf_soft_delete_saved_calculation',
      engineering_analyses: 'pf_soft_delete_engineering_analysis'
    }
  };

  /* ---------------------------------------------------------------- table contracts
     key:     the column a single row is addressed by
     select:  the explicit columns read (never '*'; never a column the client cannot see)
     insert / update: the ONLY columns a client may send (subsets of the database column grants)
     filters: the only columns list() may filter on
     order:   default ordering column
     Tables with empty insert and update are read-only here. Tables that are not listed
     (billing_customers, stripe_events, accounts, ...) are not reachable through the adapter at all. */
  const TABLES = {
    profiles: {
      key: 'account_id',
      select: ['account_id', 'display_name', 'avatar_url', 'location', 'experience_level', 'preferred_unit_system', 'created_at', 'updated_at'],
      insert: [],   // created by the sign-up trigger
      // favorite_machine_id is deliberately excluded: machine_details.is_primary is the single source of truth.
      update: ['display_name', 'avatar_url', 'location', 'experience_level', 'preferred_unit_system'],
      filters: [], order: null
    },
    garages: {
      key: 'id', select: ['id', 'name', 'created_at', 'updated_at'],
      insert: ['name'], update: ['name'], filters: [], order: 'created_at'
    },
    machines: {
      key: 'id', select: ['id', 'garage_id', 'name', 'machine_type', 'power_source', 'is_hypothetical', 'created_at', 'updated_at'],
      insert: ['garage_id', 'name', 'machine_type', 'power_source', 'is_hypothetical'],
      update: ['name', 'machine_type', 'power_source', 'is_hypothetical'],
      filters: ['garage_id'], order: 'created_at'
    },
    machine_details: {
      key: 'machine_id', select: ['machine_id', 'model_year', 'make', 'model', 'trim_level', 'nickname', 'notes', 'is_primary', 'created_at', 'updated_at'],
      insert: ['machine_id', 'model_year', 'make', 'model', 'trim_level', 'nickname', 'notes', 'is_primary'],
      update: ['model_year', 'make', 'model', 'trim_level', 'nickname', 'notes', 'is_primary'],
      filters: ['machine_id'], order: null
    },
    components: {
      key: 'id', select: ['id', 'machine_id', 'kind', 'parent_component_id', 'manufacturer', 'model', 'part_number', 'label', 'created_at', 'updated_at'],
      insert: ['machine_id', 'kind', 'parent_component_id', 'manufacturer', 'model', 'part_number', 'label'],
      update: ['kind', 'parent_component_id', 'manufacturer', 'model', 'part_number', 'label'],
      filters: ['machine_id', 'kind'], order: 'created_at'
    },
    test_setups: {
      key: 'id', select: ['id', 'machine_id', 'name', 'description', 'notes', 'baseline_pinned_at', 'created_at', 'updated_at'],
      insert: ['machine_id', 'name', 'description', 'notes'],
      update: ['name', 'description', 'notes'],
      filters: ['machine_id'], order: 'created_at'
    },
    saved_calculations: {
      key: 'id', select: ['id', 'calculation_id', 'machine_id', 'test_setup_id', 'title', 'notes', 'pinned', 'created_at', 'updated_at'],
      // No create: a saved calculation needs a calculation_records row, which only the trusted server path may
      // write (CALCULATION-FOUNDATION D1). There is no approved browser write path yet.
      insert: [],
      update: ['title', 'notes', 'pinned', 'machine_id', 'test_setup_id'],
      filters: ['machine_id', 'test_setup_id', 'pinned'], order: 'created_at'
    },
    engineering_analyses: {
      key: 'id',
      select: ['id', 'analyzer_id', 'analyzer_version', 'machine_id', 'test_setup_id', 'title', 'notes', 'inputs', 'inputs_unit_system',
        'result_snapshot', 'result_trust', 'created_at', 'updated_at'],
      insert: ['analyzer_id', 'analyzer_version', 'machine_id', 'test_setup_id', 'title', 'notes', 'inputs', 'inputs_unit_system', 'result_snapshot'],
      update: ['machine_id', 'test_setup_id', 'title', 'notes', 'inputs', 'inputs_unit_system', 'result_snapshot'],
      filters: ['machine_id', 'test_setup_id', 'analyzer_id'], order: 'created_at'
    },
    /* read-only */
    engineering_analyzers: {
      key: 'analyzer_id', select: ['analyzer_id', 'code', 'name', 'category', 'analyzer_version'], insert: [], update: [], filters: [], order: 'code'
    },
    calculation_records: {
      key: 'id', select: ['id', 'machine_id', 'calculator_id', 'canonical_id', 'engine_version', 'formula_version', 'result_state', 'inputs',
        'missing', 'warnings', 'outputs', 'created_at'],
      insert: [], update: [], filters: ['machine_id'], order: 'created_at'
    },
    value_records: {
      key: 'id', select: ['id', 'machine_id', 'component_id', 'canonical_field', 'numeric_value', 'option_value', 'unit', 'provenance', 'context',
        'source', 'calculation_id', 'supersedes_id', 'recorded_at'],
      insert: [], update: [], filters: ['machine_id', 'canonical_field'], order: 'recorded_at'
    },
    subscriptions: {
      key: 'stripe_subscription_id', select: ['stripe_subscription_id', 'status', 'current_period_start', 'current_period_end',
        'cancel_at_period_end', 'trial_end', 'canceled_at'],
      insert: [], update: [], filters: [], order: 'current_period_end'
    },
    entitlement_grants: {
      // every client-readable column except the operator note (0402 hides it) and internal references
      key: 'id', select: ['id', 'plan_key', 'source', 'starts_at', 'ends_at', 'revoked_at', 'created_at'],
      insert: [], update: [], filters: [], order: 'created_at'
    },
    plans: { key: 'plan_key', select: ['plan_key', 'name', 'is_paid', 'features', 'active'], insert: [], update: [], filters: [], order: 'plan_key' },
    plan_prices: {
      key: 'stripe_price_id', select: ['stripe_price_id', 'plan_key', 'billing_interval', 'currency', 'unit_amount', 'active'],
      insert: [], update: [], filters: [], order: 'unit_amount'
    }
  };
  Object.entries(RPC.softDelete).forEach(([t, fn]) => { TABLES[t].softDelete = fn; });
  Object.values(TABLES).forEach(t => { if (!t.softDelete) t.softDelete = null; });
  /* Never writable from the browser, whatever the contracts above say (checked at load). */
  const PROTECTED_TABLES = ['value_records', 'calculation_records', 'plans', 'plan_prices', 'billing_customers', 'subscriptions',
    'entitlement_grants', 'stripe_events'];
  PROTECTED_TABLES.forEach(t => { if (TABLES[t] && (TABLES[t].insert.length || TABLES[t].update.length)) throw new Error('GHP models: ' + t + ' must be read-only'); });
  Object.values(TABLES).forEach(t => { if ([...t.insert, ...t.update].some(c => SERVER_CONTROLLED.includes(c) || MARINE_COLUMNS.includes(c))) throw new Error('GHP models: server-controlled column in a whitelist'); });

  /* ---------------------------------------------------------------- validation rules (mirror the CHECK constraints) */
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const HTTPS_URL = /^https:\/\/[^\s<>"']+$/;
  const JSON_MAX_BYTES = 65536;
  const T = (opts = {}) => ({ type: 'text', ...opts });
  const R = {
    text: (min, max, extra) => T({ min, max, ...extra }),
    req: (min, max) => T({ min, max, required: true, notNull: true }),
    enumOf: (name, extra) => ({ type: 'enum', name, ...extra }),
    bool: { type: 'bool', notNull: true },
    uuid: (extra) => ({ type: 'uuid', ...extra }),
    json: (extra) => ({ type: 'json', ...extra })
  };
  const RULES = {
    profiles: {
      display_name: R.text(1, 80), avatar_url: { type: 'url', max: 500 }, location: R.text(1, 80),
      experience_level: R.enumOf('experience_level'), preferred_unit_system: R.enumOf('unit_system', { notNull: true })
    },
    garages: { name: R.text(1, null) },
    machines: {
      garage_id: R.uuid({ required: true, notNull: true }), name: R.req(1, null),
      machine_type: R.enumOf('machine_type', { required: true, notNull: true }), power_source: R.enumOf('power_source'), is_hypothetical: R.bool
    },
    machine_details: {
      machine_id: R.uuid({ required: true, notNull: true }), model_year: { type: 'int', min: 1886, max: 2100 },
      make: R.text(1, 60), model: R.text(1, 60), trim_level: R.text(1, 60), nickname: R.text(1, 60), notes: R.text(1, 2000, { multiline: true }),
      is_primary: R.bool
    },
    components: {
      machine_id: R.uuid({ required: true, notNull: true }), kind: R.enumOf('component_kind', { required: true, notNull: true }),
      parent_component_id: R.uuid(), manufacturer: R.text(1, null), model: R.text(1, null), part_number: R.text(1, null), label: R.text(1, null)
    },
    test_setups: {
      machine_id: R.uuid({ required: true, notNull: true }), name: R.req(1, null),
      description: R.text(1, null, { multiline: true }), notes: R.text(1, null, { multiline: true })
    },
    saved_calculations: {
      title: R.req(1, 120), notes: R.text(1, 2000, { multiline: true }), pinned: R.bool, machine_id: R.uuid(), test_setup_id: R.uuid()
    },
    engineering_analyses: {
      analyzer_id: { type: 'analyzer', required: true, notNull: true }, analyzer_version: R.req(1, null),
      machine_id: R.uuid(), test_setup_id: R.uuid(), title: R.req(1, 120), notes: R.text(1, 2000, { multiline: true }),
      inputs: R.json({ required: true, notNull: true }), inputs_unit_system: R.enumOf('unit_system', { required: true, notNull: true }),
      result_snapshot: R.json()
    }
  };

  Object.entries(TABLES).forEach(([t, c]) => { [...c.insert, ...c.update].forEach(col => { if (!(RULES[t] && RULES[t][col])) throw new Error('GHP models: no rule for ' + t + '.' + col); }); });

  /* ---------------------------------------------------------------- errors */
  class ValidationError extends Error {
    constructor(errors, code) {
      super(Object.values(errors || {})[0] || 'Invalid data');
      this.name = 'ValidationError'; this.errors = errors || {}; this.code = code || 'invalid'; this.kind = 'invalid';
    }
  }
  class GHPError extends Error {
    constructor(kind, message, extra = {}) {
      super(message);
      this.name = 'GHPError'; this.kind = kind;
      Object.assign(this, { code: null, status: null, retry: false, upgrade: false, noBackend: false, sessionExpired: false }, extra);
    }
  }
  const MESSAGES = {
    free_machine_limit: 'Free includes 1 vehicle. Upgrade to Gearhead Labs Premium to add more.',
    forbidden: 'That isn’t allowed for your account, or it requires Gearhead Labs Premium.',
    conflict: 'That already exists. Refresh and try again.',
    link_not_found: 'A linked item was not found. It may have been deleted.',
    invalid: 'One of the values isn’t valid.',
    immutable: 'That can’t be changed.',
    not_found: 'Not found. It may have been deleted, or it isn’t yours.',
    no_rows: 'No matching record.',
    not_provisioned: 'Accounts are not available yet.',
    session_expired: 'Your session has expired. Please sign in again.',
    network: 'Couldn’t reach Gearhead Labs. Check your connection and try again.',
    unknown: 'Something went wrong. Please try again.'
  };
  const NETWORK_TEXT = /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_network|timed? ?out/i;

  /* Map a Supabase/PostgREST/Auth error (or a thrown fetch error) to a GHPError the UI can act on.
     ctx.status: the HTTP status of the response, when known. */
  function mapError(err, ctx = {}) {
    if (err instanceof GHPError || err instanceof ValidationError) return err;
    const e = err || {}, code = e.code != null ? String(e.code) : '', status = ctx.status != null ? ctx.status : (e.status != null ? e.status : null);
    const text = [e.message, e.details, e.hint].filter(Boolean).join(' ');
    const make = (kind, extra) => new GHPError(kind, MESSAGES[kind], { code: code || null, status, cause: err, ...extra });
    // Code-specific mappings come first: PostgREST also answers 401 for permission errors of signed-out users.
    if (code === '42501') return /pf_machines_free_allowance/.test(text) ? make('free_machine_limit', { upgrade: true }) : make('forbidden');
    if (code === '23505') return make('conflict', { retry: true });
    if (code === '23503') return make('link_not_found');
    if (code === '23514' || code === '23502' || code === '22P02' || code === '22001' || code === '22004') return make('invalid');
    if (code === 'P0001') return make('immutable');
    if (code === 'P0002') return make('not_found');
    if (code === 'PGRST116') return make('no_rows');
    if (code === 'PGRST205' || code === '42P01' || code === 'PGRST202' || code === '42883') return make('not_provisioned', { noBackend: true });
    if (code === 'PGRST301' || status === 401) return make('session_expired', { sessionExpired: true });
    if (status === 0 || (e.name === 'TypeError' && !code) || (!code && NETWORK_TEXT.test(text)) || e.name === 'AuthRetryableFetchError')
      return make('network', { retry: true });
    return make('unknown');
  }
  const notFound = () => new GHPError('not_found', MESSAGES.not_found, { code: 'zero_rows' });

  /* ---------------------------------------------------------------- write preparation (no passthrough) */
  const chars = s => [...s].length;   // PostgreSQL length() counts characters, not UTF-16 units
  const utf8Bytes = s => { let n = 0; for (const ch of s) { const c = ch.codePointAt(0); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; } return n; };
  /* realm-safe: values may come from the calculator iframe, whose Object.prototype differs */
  const isPlainObject = v => v !== null && typeof v === 'object' && Object.prototype.toString.call(v) === '[object Object]'
    && (Object.getPrototypeOf(v) === null || Object.getPrototypeOf(Object.getPrototypeOf(v)) === null);
  const human = c => c.replace(/_id$/, '').replace(/_/g, ' ').replace(/^./, x => x.toUpperCase());

  function cleanValue(table, col, rule, raw, errors) {
    let v = raw;
    if (typeof v === 'string' && rule.type !== 'json') v = rule.multiline ? v.replace(/^\s+|\s+$/g, '') : v.trim();
    const empty = v === undefined || v === null || v === '';
    if (empty) {
      if (rule.notNull) { errors[col] = human(col) + ' is required.'; return undefined; }
      return null;
    }
    switch (rule.type) {
      case 'text':
        if (typeof v !== 'string') { errors[col] = human(col) + ' must be text.'; return undefined; }
        if (rule.min && chars(v) < rule.min) { errors[col] = human(col) + ' is required.'; return undefined; }
        if (rule.max && chars(v) > rule.max) { errors[col] = human(col) + ' must be at most ' + rule.max + ' characters.'; return undefined; }
        return v;
      case 'url':
        if (typeof v !== 'string' || !HTTPS_URL.test(v) || chars(v) > rule.max) { errors[col] = 'Avatar must be an https:// image URL.'; return undefined; }
        return v;
      case 'enum': {
        if (BLOCKED_VALUES[rule.name] && BLOCKED_VALUES[rule.name].includes(v)) { errors[col] = 'Marine machines are not supported. Gearhead Labs is automotive-only.'; errors.__code = 'marine_blocked'; return undefined; }
        if (!enumValues(rule.name).includes(v)) { errors[col] = human(col) + ' must be one of: ' + ENUMS[rule.name].map(e => e.label).join(', ') + '.'; return undefined; }
        return v;
      }
      case 'bool':
        if (typeof v !== 'boolean') { errors[col] = human(col) + ' must be true or false.'; return undefined; }
        return v;
      case 'int': {
        const n = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v;
        if (!Number.isInteger(n) || n < rule.min || n > rule.max) { errors[col] = human(col) + ' must be a whole number from ' + rule.min + ' to ' + rule.max + '.'; return undefined; }
        return n;
      }
      case 'uuid':
        if (typeof v !== 'string' || !UUID.test(v)) { errors[col] = human(col) + ' is not a valid reference.'; return undefined; }
        return v.toLowerCase();
      case 'analyzer':
        if (!ANALYZER_IDS.has(v)) { errors[col] = 'Unknown engineering analyzer.'; return undefined; }
        return v;
      case 'json': {
        if (!isPlainObject(v)) { errors[col] = human(col) + ' must be a structured object.'; return undefined; }
        let s; try { s = JSON.stringify(v); } catch (x) { errors[col] = human(col) + ' cannot be serialised.'; return undefined; }
        if (utf8Bytes(s) > JSON_MAX_BYTES) { errors[col] = human(col) + ' is too large (64 KB maximum).'; return undefined; }
        return JSON.parse(s);
      }
    }
    errors[col] = human(col) + ' is not accepted.'; return undefined;
  }

  function prepare(table, values, mode) {
    const c = TABLES[table];
    if (!c) throw new ValidationError({ table: 'Unknown table.' }, 'unknown_table');
    const allowed = mode === 'insert' ? c.insert : c.update;
    if (!allowed.length) {
      throw new ValidationError({ table: mode === 'insert' && table === 'saved_calculations'
        ? 'Saved calculations cannot be created from the browser yet: there is no approved calculation write path.'
        : human(table) + ' cannot be ' + (mode === 'insert' ? 'created' : 'changed') + ' from the browser.' }, 'forbidden_write');
    }
    if (!isPlainObject(values)) throw new ValidationError({ values: 'Expected an object of field values.' }, 'invalid');
    const keys = Object.keys(values), errors = {};
    const server = keys.filter(k => SERVER_CONTROLLED.includes(k));
    if (server.length) throw new ValidationError(Object.fromEntries(server.map(k => [k, human(k) + ' is set by the server.'])), 'server_controlled');
    const marine = keys.filter(k => MARINE_COLUMNS.includes(k));
    if (marine.length) throw new ValidationError(Object.fromEntries(marine.map(k => [k, 'Marine fields are not supported.'])), 'marine_blocked');
    const unknown = keys.filter(k => !allowed.includes(k));
    if (unknown.length) throw new ValidationError(Object.fromEntries(unknown.map(k => [k, human(k) + ' cannot be ' + (mode === 'insert' ? 'set' : 'changed') + ' here.'])), 'not_writable');
    const row = {}, rules = RULES[table] || {};
    for (const col of allowed) {
      const rule = rules[col];
      if (!(col in values)) { if (mode === 'insert' && rule && rule.required) errors[col] = human(col) + ' is required.'; continue; }
      const v = cleanValue(table, col, rule, values[col], errors);
      if (v !== undefined) row[col] = v;
    }
    const code = errors.__code; delete errors.__code;
    if (Object.keys(errors).length) throw new ValidationError(errors, code || 'invalid');
    if (mode === 'update' && !Object.keys(row).length) throw new ValidationError({ values: 'Nothing to change.' }, 'invalid');
    return row;
  }
  const prepareInsert = (table, values) => prepare(table, values, 'insert');
  const prepareUpdate = (table, patch) => prepare(table, patch, 'update');

  /* list() filters: only declared columns, only well-formed values */
  function prepareFilters(table, filters) {
    const c = TABLES[table];
    if (!c) throw new ValidationError({ table: 'Unknown table.' }, 'unknown_table');
    if (filters == null) return [];
    if (!isPlainObject(filters)) throw new ValidationError({ filters: 'Expected an object of filters.' }, 'invalid');
    return Object.entries(filters).map(([k, v]) => {
      if (!c.filters.includes(k)) throw new ValidationError({ [k]: human(k) + ' cannot be filtered on.' }, 'not_filterable');
      if (k.endsWith('_id') && k !== 'analyzer_id' && !(typeof v === 'string' && UUID.test(v))) throw new ValidationError({ [k]: human(k) + ' is not a valid reference.' }, 'invalid');
      if (k === 'analyzer_id' && !ANALYZER_IDS.has(v)) throw new ValidationError({ [k]: 'Unknown engineering analyzer.' }, 'invalid');
      if (k === 'kind' && !enumValues('component_kind').includes(v)) throw new ValidationError({ [k]: 'Unknown component kind.' }, 'invalid');
      if (k === 'pinned' && typeof v !== 'boolean') throw new ValidationError({ [k]: 'Pinned must be true or false.' }, 'invalid');
      if (k === 'canonical_field' && !(typeof v === 'string' && /^[a-z][a-z0-9_]*$/.test(v))) throw new ValidationError({ [k]: 'Unknown field.' }, 'invalid');
      return [k, typeof v === 'string' && k.endsWith('_id') && k !== 'analyzer_id' ? v.toLowerCase() : v];
    });
  }
  const isUuid = v => typeof v === 'string' && UUID.test(v);

  /* ---------------------------------------------------------------- entitlement view model (pf_my_entitlement) */
  const ANONYMOUS_ENTITLEMENT = deepFreeze({ signedIn: false, plan: 'free', isPremium: false, features: [], source: null, endsAt: null, isTrial: false });
  /* rows: the pf_my_entitlement() response (an array of at most one row, or a single row). Fails closed:
     anything unexpected reads as Free. Display only; the database enforces access. */
  function entitlementFromRpc(rows) {
    const r = Array.isArray(rows) ? rows[0] : rows;
    const free = { signedIn: true, plan: 'free', isPremium: false, features: [], source: null, endsAt: null, isTrial: false };
    if (!r || typeof r !== 'object' || r.is_premium !== true || typeof r.plan_key !== 'string' || r.plan_key === 'free') return deepFreeze(free);
    const features = Array.isArray(r.features) ? [...new Set(r.features.filter(f => FEATURES.includes(f)))].sort() : [];
    const endsAt = r.ends_at == null ? null : (isNaN(Date.parse(r.ends_at)) ? null : new Date(r.ends_at).toISOString());
    // endsAt is informational (refresh scheduling). The server already applied the time window; the browser clock is not trusted.
    const source = GRANT_SOURCES.includes(r.source) ? r.source : null;
    return deepFreeze({ signedIn: true, plan: r.plan_key, isPremium: true, features, source, endsAt, isTrial: source === 'trial' });
  }
  const hasFeature = (ent, feature) => !!ent && Array.isArray(ent.features) && ent.features.includes(feature);
  const canAddMachine = (ent, activeMachines) => hasFeature(ent, 'garage_unlimited') || activeMachines < FREE_MACHINE_LIMIT;
  /* A Stripe trial arrives as a 'stripe' grant whose subscription status is 'trialing'. */
  function subscriptionView(row) {
    if (!row) return null;
    return deepFreeze({ id: row.stripe_subscription_id, status: row.status, periodEnd: row.current_period_end || null,
      cancelAtPeriodEnd: !!row.cancel_at_period_end, trialEnd: row.trial_end || null, isTrialing: row.status === 'trialing' });
  }
  function planLabel(ent, sub) {
    if (!ent || !ent.isPremium) return 'Free';
    return (ent.isTrial || (sub && sub.isTrialing)) ? 'Premium (trial)' : 'Premium';
  }

  /* ---------------------------------------------------------------- Phase 3A -> Foundation mapping (owner decisions 2-4)
     Accurate enum mappings only; anything that would lose meaning is kept as text in notes / description. */
  const VEHICLE_TYPE_MAP = {
    'Car': { value: 'automotive' }, 'Truck': { value: 'automotive', note: 'Body style: Truck' }, 'SUV': { value: 'automotive', note: 'Body style: SUV' },
    'Van': { value: 'automotive', note: 'Body style: Van' }, 'Race Car': { value: 'automotive', note: 'Body style: Race car' },
    'Motorcycle': { value: 'motorcycle' }, 'Off-Road': { value: 'other_custom', note: 'Vehicle type: Off-Road' }
  };
  const FUEL_MAP = {
    'Gasoline': { value: 'gasoline' }, 'Diesel': { value: 'diesel' }, 'Electric': { value: 'electric' }, 'Hybrid': { value: 'hybrid' },
    'Plug-in Hybrid': { value: 'hybrid', note: 'Fuel: Plug-in hybrid' }, 'E85 / Flex Fuel': { value: 'other', note: 'Fuel: E85 / flex fuel' },
    'Methanol': { value: 'other', note: 'Fuel: Methanol' }, 'Other': { value: 'other' }
  };
  const joinText = parts => { const s = parts.filter(p => typeof p === 'string' && p.trim()).map(p => p.trim()).join('\n'); return s || null; };
  /* Returns plain values for prepareInsert('machines' | 'machine_details' | 'components'); garage_id / machine_id are
     added by the caller once the rows exist. Unknown legacy values become Other / custom, with the original kept in notes. */
  function fromPhase3aVehicle(v) {
    v = v || {};
    const notes = [];
    const type = VEHICLE_TYPE_MAP[v.vehicle_type] || { value: 'other_custom', note: v.vehicle_type ? 'Vehicle type: ' + v.vehicle_type : null };
    const fuel = v.fuel_type ? (FUEL_MAP[v.fuel_type] || { value: 'other', note: 'Fuel: ' + v.fuel_type }) : { value: null };
    if (type.note) notes.push(type.note);
    if (fuel.note) notes.push(fuel.note);
    if (v.drivetrain) notes.push('Drivetrain: ' + v.drivetrain);   // no approved column (owner decision 2)
    const name = [v.year, v.make, v.model, v.trim].filter(x => x != null && String(x).trim()).join(' ') || 'My vehicle';
    const components = [];
    if (v.engine && String(v.engine).trim()) components.push({ kind: 'engine', label: String(v.engine).trim() });
    if (v.transmission && String(v.transmission).trim()) components.push({ kind: 'transmission', label: String(v.transmission).trim() });
    return {
      machine: { name, machine_type: type.value, power_source: fuel.value, is_hypothetical: false },
      details: { model_year: v.year == null || v.year === '' ? null : v.year, make: v.make || null, model: v.model || null, trim_level: v.trim || null,
        notes: joinText([v.notes, notes.length ? notes.join('\n') : null]), is_primary: !!v.is_primary },
      components
    };
  }
  /* Builds become Test Setups (owner decision 4): goals are kept in description; the old status is kept in notes. */
  function fromPhase3aBuild(b) {
    b = b || {};
    return {
      name: b.name || 'Test setup',
      description: joinText([b.description, b.goals ? 'Goals: ' + b.goals : null]),
      notes: joinText([b.notes, b.status ? 'Build status: ' + b.status : null])
    };
  }

  /* Drivetrain has no approved column (owner decision 2): it is kept as ONE managed line in machine_details.notes.
     splitDrivetrain() lifts it out for editing as a field; withDrivetrain() puts it back (or removes it). */
  const DRIVETRAIN_OPTIONS = ['RWD', 'FWD', 'AWD', '4WD'];
  const DRIVETRAIN_LINE = /^Drivetrain: (.+)$/m;
  function splitDrivetrain(notes) {
    if (typeof notes !== 'string' || !notes) return { drivetrain: null, notes: notes || null };
    const m = notes.match(DRIVETRAIN_LINE);
    if (!m) return { drivetrain: null, notes };
    const rest = notes.replace(DRIVETRAIN_LINE, '').replace(/\n{2,}/g, '\n').replace(/^\n+|\n+$/g, '');
    return { drivetrain: m[1].trim(), notes: rest || null };
  }
  function withDrivetrain(notes, drivetrain) {
    const base = splitDrivetrain(notes).notes;
    const d = typeof drivetrain === 'string' ? drivetrain.trim() : '';
    return joinText([base, d ? 'Drivetrain: ' + d : null]);
  }
  /* Engineering-bridge snapshot -> engineering_analyses columns (0406 names). */
  function analysisFromCapture(snap) {
    snap = snap || {};
    const inputs = snap.input_data || {};
    return { analyzer_id: snap.analyzer_id, inputs, inputs_unit_system: inputs.unit_system === 'metric' ? 'metric' : 'imperial',
      result_snapshot: snap.result_data || null };
  }

  const api = deepFreeze({
    ENUMS, BLOCKED_VALUES, MARINE_COLUMNS, SERVER_CONTROLLED, FEATURES, GRANT_SOURCES, FREE_MACHINE_LIMIT, RPC, TABLES, PROTECTED_TABLES,
    RULES, JSON_MAX_BYTES, ENGINEERING_CATEGORIES, ENGINEERING_CATALOG, ANONYMOUS_ENTITLEMENT, MESSAGES,
    VEHICLE_TYPE_MAP, FUEL_MAP, DRIVETRAIN_OPTIONS
  });

  GHP.models = Object.freeze(Object.assign({}, api, {
    enumValues, labelFor, ValidationError, GHPError, mapError, notFound, prepareInsert, prepareUpdate, prepareFilters, isUuid,
    entitlementFromRpc, hasFeature, canAddMachine, subscriptionView, planLabel, fromPhase3aVehicle, fromPhase3aBuild,
    splitDrivetrain, withDrivetrain, analysisFromCapture,
    ANALYZER_IDS
  }));
})();
