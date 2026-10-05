-- DATA-FOUNDATION 1.0.0 · 0002 tables
-- Canonical engineering data model (spec A/B/C). Idempotent (IF NOT EXISTS).
-- Every child carries its parent's owner_id through a COMPOSITE foreign key
-- (parent_id, owner_id) -> parent(id, owner_id): a row can never attach to another
-- user's parent, independently of RLS. owner_id defaults to auth.uid() (server side).

-- Account (User -> Account, §66). Row created by the server-side sign-up trigger (0003).
CREATE TABLE IF NOT EXISTS public.accounts (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,  -- account deletion is OPEN
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz NULL
);

-- Garage (User -> Garage, D-003). One active personal garage per account (spec B; OPEN #9).
CREATE TABLE IF NOT EXISTS public.garages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid        NOT NULL DEFAULT auth.uid() REFERENCES public.accounts(id) ON DELETE RESTRICT,
  name        text        NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz NULL,
  CONSTRAINT garages_id_owner_uq UNIQUE (id, owner_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS garages_one_active_per_owner ON public.garages (owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS garages_owner_idx ON public.garages (owner_id);

-- Machine (§4, §20): real or hypothetical; type, propulsion and power source kept separate.
CREATE TABLE IF NOT EXISTS public.machines (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         uuid        NOT NULL DEFAULT auth.uid() REFERENCES public.accounts(id) ON DELETE RESTRICT,
  garage_id        uuid        NOT NULL,
  name             text        NOT NULL CHECK (length(btrim(name)) > 0),
  machine_type     public.machine_type_enum  NOT NULL,
  marine_type      public.marine_type_enum   NULL,
  propulsion       public.propulsion_enum    NULL,
  power_source     public.power_source_enum  NULL,          -- NULL = unknown
  is_hypothetical  boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz NULL,
  CONSTRAINT machines_id_owner_uq UNIQUE (id, owner_id),
  CONSTRAINT machines_garage_same_owner_fk FOREIGN KEY (garage_id, owner_id)
    REFERENCES public.garages (id, owner_id) ON DELETE RESTRICT,
  CONSTRAINT machines_marine_type_only_marine CHECK (marine_type IS NULL OR machine_type = 'marine')
);
CREATE INDEX IF NOT EXISTS machines_owner_idx  ON public.machines (owner_id);
CREATE INDEX IF NOT EXISTS machines_garage_idx ON public.machines (garage_id);

-- Component (Directive §10): engineering object on one machine.
CREATE TABLE IF NOT EXISTS public.components (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             uuid        NOT NULL DEFAULT auth.uid() REFERENCES public.accounts(id) ON DELETE RESTRICT,
  machine_id           uuid        NOT NULL,
  kind                 public.component_kind_enum NOT NULL,
  parent_component_id  uuid        NULL,
  manufacturer         text        NULL,
  model                text        NULL,
  part_number          text        NULL,
  label                text        NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz NULL,
  CONSTRAINT components_id_owner_uq   UNIQUE (id, owner_id),
  CONSTRAINT components_id_machine_uq UNIQUE (id, machine_id),
  CONSTRAINT components_machine_same_owner_fk FOREIGN KEY (machine_id, owner_id)
    REFERENCES public.machines (id, owner_id) ON DELETE RESTRICT,
  -- parent must be on the SAME machine (composite FK; NULL parent allowed)
  CONSTRAINT components_parent_same_machine_fk FOREIGN KEY (parent_component_id, machine_id)
    REFERENCES public.components (id, machine_id) ON DELETE RESTRICT,
  CONSTRAINT components_not_own_parent CHECK (parent_component_id IS NULL OR parent_component_id <> id)
);
CREATE INDEX IF NOT EXISTS components_owner_idx   ON public.components (owner_id);
CREATE INDEX IF NOT EXISTS components_machine_idx ON public.components (machine_id);

-- Component Connection: the component graph (§9, §66). Both ends on the same machine.
CREATE TABLE IF NOT EXISTS public.component_connections (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           uuid        NOT NULL DEFAULT auth.uid() REFERENCES public.accounts(id) ON DELETE RESTRICT,
  machine_id         uuid        NOT NULL,
  from_component_id  uuid        NOT NULL,
  to_component_id    uuid        NOT NULL,
  relation           text        NOT NULL CHECK (length(btrim(relation)) > 0),
  created_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz NULL,
  CONSTRAINT connections_machine_same_owner_fk FOREIGN KEY (machine_id, owner_id)
    REFERENCES public.machines (id, owner_id) ON DELETE RESTRICT,
  CONSTRAINT connections_from_same_machine_fk FOREIGN KEY (from_component_id, machine_id)
    REFERENCES public.components (id, machine_id) ON DELETE RESTRICT,
  CONSTRAINT connections_to_same_machine_fk FOREIGN KEY (to_component_id, machine_id)
    REFERENCES public.components (id, machine_id) ON DELETE RESTRICT,
  CONSTRAINT connections_not_self CHECK (from_component_id <> to_component_id),
  CONSTRAINT connections_unique UNIQUE (from_component_id, to_component_id, relation)
);
CREATE INDEX IF NOT EXISTS connections_machine_idx ON public.component_connections (machine_id);

-- Canonical Field: a value's meaning + canonical (engine-native, D-002) unit. Reference data.
CREATE TABLE IF NOT EXISTS public.canonical_fields (
  key             text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  family          text NOT NULL CHECK (length(btrim(family)) > 0),
  dimension       text NULL,
  canonical_unit  text NOT NULL,
  value_kind      text NOT NULL CHECK (value_kind IN ('numeric','categorical')),
  description     text NULL
);

-- Calculator catalog (reference data, generated from the tagged F1 engine).
CREATE TABLE IF NOT EXISTS public.calculators (
  calculator_id  text    PRIMARY KEY,
  canonical_id   text    NOT NULL REFERENCES public.calculators (calculator_id) DEFERRABLE INITIALLY DEFERRED,
  engine_proven  boolean NOT NULL
);

-- Formula Version (§8, §57): engine version + calculator + fv1 fingerprint. Never deleted.
CREATE TABLE IF NOT EXISTS public.formula_versions (
  calculator_id     text NOT NULL REFERENCES public.calculators (calculator_id) ON DELETE RESTRICT,
  formula_version   text NOT NULL CHECK (formula_version ~ '^fv1-[0-9a-f]{8}$'),
  engine_version    text NOT NULL,
  formula_registry  text NOT NULL,
  first_release     text NOT NULL,
  PRIMARY KEY (calculator_id, formula_version)
);

-- Calculation (History): the §57 engineering contract. Immutable (0003).
CREATE TABLE IF NOT EXISTS public.calculation_records (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid        NOT NULL DEFAULT auth.uid() REFERENCES public.accounts(id) ON DELETE RESTRICT,
  machine_id        uuid        NULL,                        -- NULL = standalone (§10)
  calculator_id     text        NOT NULL REFERENCES public.calculators (calculator_id) ON DELETE RESTRICT,
  canonical_id      text        NOT NULL,
  engine_version    text        NOT NULL,
  formula_registry  text        NOT NULL,
  formula_version   text        NOT NULL,
  result_state      public.result_state_enum NOT NULL,
  inputs            jsonb       NOT NULL CHECK (jsonb_typeof(inputs) = 'object'),
  missing           text[]      NOT NULL DEFAULT '{}',
  warnings          text[]      NOT NULL DEFAULT '{}',
  outputs           jsonb       NOT NULL CHECK (jsonb_typeof(outputs) = 'array'),
  input_value_ids   uuid[]      NULL,
  request_id        uuid        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calc_id_owner_uq UNIQUE (id, owner_id),
  CONSTRAINT calc_request_idempotent UNIQUE (owner_id, request_id),
  CONSTRAINT calc_formula_version_fk FOREIGN KEY (canonical_id, formula_version)
    REFERENCES public.formula_versions (calculator_id, formula_version) ON DELETE RESTRICT,
  CONSTRAINT calc_machine_same_owner_fk FOREIGN KEY (machine_id, owner_id)
    REFERENCES public.machines (id, owner_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS calc_owner_created_idx   ON public.calculation_records (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS calc_machine_created_idx ON public.calculation_records (machine_id, created_at DESC);
CREATE INDEX IF NOT EXISTS calc_calculator_idx      ON public.calculation_records (calculator_id);

-- Value: one canonical engineering value (§5). Immutable, append-only (0003).
CREATE TABLE IF NOT EXISTS public.value_records (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         uuid        NOT NULL DEFAULT auth.uid() REFERENCES public.accounts(id) ON DELETE RESTRICT,
  machine_id       uuid        NOT NULL,
  component_id     uuid        NULL,
  canonical_field  text        NOT NULL REFERENCES public.canonical_fields (key) ON DELETE RESTRICT,
  numeric_value    double precision NULL,
  option_value     text        NULL,
  unit             text        NOT NULL,
  provenance       public.provenance_enum     NOT NULL,
  context          public.value_context_enum  NOT NULL,
  source           text        NULL,
  calculation_id   uuid        NULL,
  supersedes_id    uuid        NULL,
  recorded_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT values_id_owner_uq UNIQUE (id, owner_id),
  CONSTRAINT values_machine_same_owner_fk FOREIGN KEY (machine_id, owner_id)
    REFERENCES public.machines (id, owner_id) ON DELETE RESTRICT,
  CONSTRAINT values_component_same_machine_fk FOREIGN KEY (component_id, machine_id)
    REFERENCES public.components (id, machine_id) ON DELETE RESTRICT,
  CONSTRAINT values_calculation_same_owner_fk FOREIGN KEY (calculation_id, owner_id)
    REFERENCES public.calculation_records (id, owner_id) ON DELETE RESTRICT,
  CONSTRAINT values_supersedes_same_owner_fk FOREIGN KEY (supersedes_id, owner_id)
    REFERENCES public.value_records (id, owner_id) ON DELETE RESTRICT,
  -- UNKNOWN != ZERO (spec D): unknown <=> no value and provenance 'unknown'
  CONSTRAINT values_unknown_has_no_value CHECK (
    provenance <> 'unknown' OR (numeric_value IS NULL AND option_value IS NULL)),
  -- known => exactly one representation
  CONSTRAINT values_known_has_exactly_one CHECK (
    provenance = 'unknown' OR ((numeric_value IS NULL) <> (option_value IS NULL))),
  -- a known number must be finite (engine contract: non-finite is never a known value)
  CONSTRAINT values_numeric_finite CHECK (
    numeric_value IS NULL OR numeric_value::text NOT IN ('NaN','Infinity','-Infinity')),
  CONSTRAINT values_option_nonempty CHECK (option_value IS NULL OR length(option_value) > 0),
  -- calculated / derived values must link to the Calculation that produced them
  CONSTRAINT values_calculated_needs_calculation CHECK (
    provenance NOT IN ('calculated','derived') OR calculation_id IS NOT NULL)
);
-- one linear supersession chain: a value is superseded at most once
CREATE UNIQUE INDEX IF NOT EXISTS values_superseded_once ON public.value_records (supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS values_machine_field_ctx_idx ON public.value_records (machine_id, canonical_field, context);
CREATE INDEX IF NOT EXISTS values_owner_idx ON public.value_records (owner_id);
