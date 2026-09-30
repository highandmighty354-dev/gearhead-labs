--
-- PostgreSQL database dump
--


-- Dumped from (version line removed for determinism)
-- Dumped by (version line removed for determinism)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA auth;


ALTER SCHEMA auth OWNER TO postgres;

--
-- Name: component_kind_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.component_kind_enum AS ENUM (
    'engine',
    'transmission',
    'transfer_case',
    'differential_final_drive',
    'axle',
    'wheel_tire',
    'other_custom'
);


ALTER TYPE public.component_kind_enum OWNER TO postgres;

--
-- Name: machine_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.machine_type_enum AS ENUM (
    'automotive',
    'motorcycle',
    'atv_three_wheeler',
    'side_by_side_utv',
    'snowmobile',
    'marine',
    'go_kart',
    'other_custom'
);


ALTER TYPE public.machine_type_enum OWNER TO postgres;

--
-- Name: marine_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.marine_type_enum AS ENUM (
    'power_boat',
    'pwc',
    'sailboat',
    'auxiliary_sailboat',
    'other'
);


ALTER TYPE public.marine_type_enum OWNER TO postgres;

--
-- Name: power_source_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.power_source_enum AS ENUM (
    'gasoline',
    'diesel',
    'electric',
    'hybrid',
    'other'
);


ALTER TYPE public.power_source_enum OWNER TO postgres;

--
-- Name: propulsion_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.propulsion_enum AS ENUM (
    'outboard',
    'inboard',
    'v_drive',
    'sterndrive_io',
    'forward_drive',
    'pod',
    'jet',
    'surface_drive',
    'saildrive',
    'electric',
    'custom'
);


ALTER TYPE public.propulsion_enum OWNER TO postgres;

--
-- Name: provenance_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.provenance_enum AS ENUM (
    'calculated',
    'measured',
    'manufacturer_specified',
    'user_entered',
    'derived',
    'empirical',
    'estimated',
    'unknown'
);


ALTER TYPE public.provenance_enum OWNER TO postgres;

--
-- Name: result_state_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.result_state_enum AS ENUM (
    'valid',
    'valid_with_warning',
    'estimated',
    'incomplete',
    'out_of_range',
    'non_convergent',
    'not_applicable'
);


ALTER TYPE public.result_state_enum OWNER TO postgres;

--
-- Name: value_context_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.value_context_enum AS ENUM (
    'specification',
    'operating_state'
);


ALTER TYPE public.value_context_enum OWNER TO postgres;

--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: postgres
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')::uuid
$$;


ALTER FUNCTION auth.uid() OWNER TO postgres;

--
-- Name: df_calculation_validate(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.df_calculation_validate() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE canon text; n_found int;
BEGIN
  SELECT canonical_id INTO canon FROM public.calculators WHERE calculator_id = NEW.calculator_id;
  IF canon IS DISTINCT FROM NEW.canonical_id THEN
    RAISE EXCEPTION 'DF_CALC: canonical_id % does not match catalog % for %', NEW.canonical_id, canon, NEW.calculator_id USING ERRCODE = '23514';
  END IF;
  IF NEW.input_value_ids IS NOT NULL THEN
    SELECT count(*) INTO n_found FROM public.value_records v
      WHERE v.id = ANY (NEW.input_value_ids) AND v.owner_id = NEW.owner_id;
    IF n_found <> cardinality(ARRAY(SELECT DISTINCT unnest(NEW.input_value_ids))) THEN
      RAISE EXCEPTION 'DF_CALC: input_value_ids must reference the owner''s own values' USING ERRCODE = '23503';
    END IF;
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION public.df_calculation_validate() OWNER TO postgres;

--
-- Name: df_guard_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.df_guard_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'DF_IMMUTABLE: id cannot change on %', TG_TABLE_NAME USING ERRCODE = 'P0001';
  END IF;
  IF TG_TABLE_NAME <> 'accounts' THEN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      RAISE EXCEPTION 'DF_IMMUTABLE: owner_id cannot change on %', TG_TABLE_NAME USING ERRCODE = 'P0001';
    END IF;
  END IF;
  NEW.created_at := OLD.created_at;
  -- Table-specific columns are only read on the table that has them (PL/pgSQL does not
  -- short-circuit AND, so these checks are nested rather than combined).
  IF TG_TABLE_NAME = 'components' THEN
    IF NEW.machine_id IS DISTINCT FROM OLD.machine_id THEN
      RAISE EXCEPTION 'DF_IMMUTABLE: component machine_id cannot change' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'component_connections' THEN
    IF NEW.machine_id IS DISTINCT FROM OLD.machine_id OR NEW.from_component_id IS DISTINCT FROM OLD.from_component_id OR
       NEW.to_component_id IS DISTINCT FROM OLD.to_component_id OR NEW.relation IS DISTINCT FROM OLD.relation THEN
      RAISE EXCEPTION 'DF_IMMUTABLE: a connection can only be soft-deleted' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF TG_TABLE_NAME IN ('garages','machines','components') THEN NEW.updated_at := now(); END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION public.df_guard_update() OWNER TO postgres;

--
-- Name: df_handle_new_auth_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.df_handle_new_auth_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  INSERT INTO public.accounts (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;


ALTER FUNCTION public.df_handle_new_auth_user() OWNER TO postgres;

--
-- Name: df_refuse(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.df_refuse() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  RAISE EXCEPTION 'DF_IMMUTABLE: % on % is not permitted (%)', TG_OP, TG_TABLE_NAME, TG_ARGV[0] USING ERRCODE = 'P0001';
END $$;


ALTER FUNCTION public.df_refuse() OWNER TO postgres;

--
-- Name: df_soft_delete_component(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.df_soft_delete_component(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE uid uuid := auth.uid(); n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'DF_AUTH: authentication required' USING ERRCODE = '42501'; END IF;
  UPDATE public.components SET deleted_at = now() WHERE id = p_id AND owner_id = uid AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'DF_NOT_FOUND: no active component owned by the caller' USING ERRCODE = 'P0002'; END IF;
END $$;


ALTER FUNCTION public.df_soft_delete_component(p_id uuid) OWNER TO postgres;

--
-- Name: df_soft_delete_connection(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.df_soft_delete_connection(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE uid uuid := auth.uid(); n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'DF_AUTH: authentication required' USING ERRCODE = '42501'; END IF;
  UPDATE public.component_connections SET deleted_at = now() WHERE id = p_id AND owner_id = uid AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'DF_NOT_FOUND: no active connection owned by the caller' USING ERRCODE = 'P0002'; END IF;
END $$;


ALTER FUNCTION public.df_soft_delete_connection(p_id uuid) OWNER TO postgres;

--
-- Name: df_soft_delete_garage(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.df_soft_delete_garage(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE uid uuid := auth.uid(); n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'DF_AUTH: authentication required' USING ERRCODE = '42501'; END IF;
  UPDATE public.garages SET deleted_at = now() WHERE id = p_id AND owner_id = uid AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'DF_NOT_FOUND: no active garage owned by the caller' USING ERRCODE = 'P0002'; END IF;
END $$;


ALTER FUNCTION public.df_soft_delete_garage(p_id uuid) OWNER TO postgres;

--
-- Name: df_soft_delete_machine(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.df_soft_delete_machine(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE uid uuid := auth.uid(); n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'DF_AUTH: authentication required' USING ERRCODE = '42501'; END IF;
  UPDATE public.machines SET deleted_at = now() WHERE id = p_id AND owner_id = uid AND deleted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'DF_NOT_FOUND: no active machine owned by the caller' USING ERRCODE = 'P0002'; END IF;
END $$;


ALTER FUNCTION public.df_soft_delete_machine(p_id uuid) OWNER TO postgres;

--
-- Name: df_stamp_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.df_stamp_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF TG_TABLE_NAME = 'value_records' THEN
    NEW.recorded_at := now();
  ELSE
    NEW.created_at := now();
    IF TG_TABLE_NAME IN ('garages','machines','components') THEN NEW.updated_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION public.df_stamp_insert() OWNER TO postgres;

--
-- Name: df_value_validate(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.df_value_validate() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE f public.canonical_fields; p public.value_records;
BEGIN
  SELECT * INTO f FROM public.canonical_fields WHERE key = NEW.canonical_field;
  IF NOT FOUND THEN RAISE EXCEPTION 'DF_VALUE: unknown canonical field %', NEW.canonical_field USING ERRCODE = '23503'; END IF;
  IF NEW.unit IS DISTINCT FROM f.canonical_unit THEN
    RAISE EXCEPTION 'DF_UNIT: % must be stored in its canonical engine-native unit % (got %)', f.key, f.canonical_unit, NEW.unit USING ERRCODE = '23514';
  END IF;
  IF NEW.provenance <> 'unknown' THEN
    IF f.value_kind = 'numeric' AND NEW.numeric_value IS NULL THEN
      RAISE EXCEPTION 'DF_KIND: % is numeric', f.key USING ERRCODE = '23514'; END IF;
    IF f.value_kind = 'categorical' AND NEW.option_value IS NULL THEN
      RAISE EXCEPTION 'DF_KIND: % is categorical', f.key USING ERRCODE = '23514'; END IF;
  END IF;
  IF NEW.supersedes_id IS NOT NULL THEN
    SELECT * INTO p FROM public.value_records WHERE id = NEW.supersedes_id;
    IF p.machine_id IS DISTINCT FROM NEW.machine_id OR p.component_id IS DISTINCT FROM NEW.component_id
       OR p.canonical_field IS DISTINCT FROM NEW.canonical_field OR p.context IS DISTINCT FROM NEW.context THEN
      RAISE EXCEPTION 'DF_SUPERSEDE: a value can only supersede the same machine/component/field/context' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION public.df_value_validate() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: users; Type: TABLE; Schema: auth; Owner: postgres
--

CREATE TABLE auth.users (
    id uuid NOT NULL,
    email text
);


ALTER TABLE auth.users OWNER TO postgres;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accounts (
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);

ALTER TABLE ONLY public.accounts FORCE ROW LEVEL SECURITY;


ALTER TABLE public.accounts OWNER TO postgres;

--
-- Name: calculation_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calculation_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid DEFAULT auth.uid() NOT NULL,
    machine_id uuid,
    calculator_id text NOT NULL,
    canonical_id text NOT NULL,
    engine_version text NOT NULL,
    formula_registry text NOT NULL,
    formula_version text NOT NULL,
    result_state public.result_state_enum NOT NULL,
    inputs jsonb NOT NULL,
    missing text[] DEFAULT '{}'::text[] NOT NULL,
    warnings text[] DEFAULT '{}'::text[] NOT NULL,
    outputs jsonb NOT NULL,
    input_value_ids uuid[],
    request_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calculation_records_inputs_check CHECK ((jsonb_typeof(inputs) = 'object'::text)),
    CONSTRAINT calculation_records_outputs_check CHECK ((jsonb_typeof(outputs) = 'array'::text))
);

ALTER TABLE ONLY public.calculation_records FORCE ROW LEVEL SECURITY;


ALTER TABLE public.calculation_records OWNER TO postgres;

--
-- Name: calculators; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calculators (
    calculator_id text NOT NULL,
    canonical_id text NOT NULL,
    engine_proven boolean NOT NULL
);

ALTER TABLE ONLY public.calculators FORCE ROW LEVEL SECURITY;


ALTER TABLE public.calculators OWNER TO postgres;

--
-- Name: canonical_fields; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.canonical_fields (
    key text NOT NULL,
    family text NOT NULL,
    dimension text,
    canonical_unit text NOT NULL,
    value_kind text NOT NULL,
    description text,
    CONSTRAINT canonical_fields_family_check CHECK ((length(btrim(family)) > 0)),
    CONSTRAINT canonical_fields_key_check CHECK ((key ~ '^[a-z][a-z0-9_]*$'::text)),
    CONSTRAINT canonical_fields_value_kind_check CHECK ((value_kind = ANY (ARRAY['numeric'::text, 'categorical'::text])))
);

ALTER TABLE ONLY public.canonical_fields FORCE ROW LEVEL SECURITY;


ALTER TABLE public.canonical_fields OWNER TO postgres;

--
-- Name: component_connections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.component_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid DEFAULT auth.uid() NOT NULL,
    machine_id uuid NOT NULL,
    from_component_id uuid NOT NULL,
    to_component_id uuid NOT NULL,
    relation text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT component_connections_relation_check CHECK ((length(btrim(relation)) > 0)),
    CONSTRAINT connections_not_self CHECK ((from_component_id <> to_component_id))
);

ALTER TABLE ONLY public.component_connections FORCE ROW LEVEL SECURITY;


ALTER TABLE public.component_connections OWNER TO postgres;

--
-- Name: components; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid DEFAULT auth.uid() NOT NULL,
    machine_id uuid NOT NULL,
    kind public.component_kind_enum NOT NULL,
    parent_component_id uuid,
    manufacturer text,
    model text,
    part_number text,
    label text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT components_not_own_parent CHECK (((parent_component_id IS NULL) OR (parent_component_id <> id)))
);

ALTER TABLE ONLY public.components FORCE ROW LEVEL SECURITY;


ALTER TABLE public.components OWNER TO postgres;

--
-- Name: formula_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.formula_versions (
    calculator_id text NOT NULL,
    formula_version text NOT NULL,
    engine_version text NOT NULL,
    formula_registry text NOT NULL,
    first_release text NOT NULL,
    CONSTRAINT formula_versions_formula_version_check CHECK ((formula_version ~ '^fv1-[0-9a-f]{8}$'::text))
);

ALTER TABLE ONLY public.formula_versions FORCE ROW LEVEL SECURITY;


ALTER TABLE public.formula_versions OWNER TO postgres;

--
-- Name: garages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.garages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid DEFAULT auth.uid() NOT NULL,
    name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);

ALTER TABLE ONLY public.garages FORCE ROW LEVEL SECURITY;


ALTER TABLE public.garages OWNER TO postgres;

--
-- Name: machines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.machines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid DEFAULT auth.uid() NOT NULL,
    garage_id uuid NOT NULL,
    name text NOT NULL,
    machine_type public.machine_type_enum NOT NULL,
    marine_type public.marine_type_enum,
    propulsion public.propulsion_enum,
    power_source public.power_source_enum,
    is_hypothetical boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT machines_marine_type_only_marine CHECK (((marine_type IS NULL) OR (machine_type = 'marine'::public.machine_type_enum))),
    CONSTRAINT machines_name_check CHECK ((length(btrim(name)) > 0))
);

ALTER TABLE ONLY public.machines FORCE ROW LEVEL SECURITY;


ALTER TABLE public.machines OWNER TO postgres;

--
-- Name: value_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.value_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid DEFAULT auth.uid() NOT NULL,
    machine_id uuid NOT NULL,
    component_id uuid,
    canonical_field text NOT NULL,
    numeric_value double precision,
    option_value text,
    unit text NOT NULL,
    provenance public.provenance_enum NOT NULL,
    context public.value_context_enum NOT NULL,
    source text,
    calculation_id uuid,
    supersedes_id uuid,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT values_calculated_needs_calculation CHECK (((provenance <> ALL (ARRAY['calculated'::public.provenance_enum, 'derived'::public.provenance_enum])) OR (calculation_id IS NOT NULL))),
    CONSTRAINT values_known_has_exactly_one CHECK (((provenance = 'unknown'::public.provenance_enum) OR ((numeric_value IS NULL) <> (option_value IS NULL)))),
    CONSTRAINT values_numeric_finite CHECK (((numeric_value IS NULL) OR ((numeric_value)::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])))),
    CONSTRAINT values_option_nonempty CHECK (((option_value IS NULL) OR (length(option_value) > 0))),
    CONSTRAINT values_unknown_has_no_value CHECK (((provenance <> 'unknown'::public.provenance_enum) OR ((numeric_value IS NULL) AND (option_value IS NULL))))
);

ALTER TABLE ONLY public.value_records FORCE ROW LEVEL SECURITY;


ALTER TABLE public.value_records OWNER TO postgres;

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: postgres
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: calculation_records calc_id_owner_uq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calculation_records
    ADD CONSTRAINT calc_id_owner_uq UNIQUE (id, owner_id);


--
-- Name: calculation_records calc_request_idempotent; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calculation_records
    ADD CONSTRAINT calc_request_idempotent UNIQUE (owner_id, request_id);


--
-- Name: calculation_records calculation_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calculation_records
    ADD CONSTRAINT calculation_records_pkey PRIMARY KEY (id);


--
-- Name: calculators calculators_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calculators
    ADD CONSTRAINT calculators_pkey PRIMARY KEY (calculator_id);


--
-- Name: canonical_fields canonical_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canonical_fields
    ADD CONSTRAINT canonical_fields_pkey PRIMARY KEY (key);


--
-- Name: component_connections component_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.component_connections
    ADD CONSTRAINT component_connections_pkey PRIMARY KEY (id);


--
-- Name: components components_id_machine_uq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_id_machine_uq UNIQUE (id, machine_id);


--
-- Name: components components_id_owner_uq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_id_owner_uq UNIQUE (id, owner_id);


--
-- Name: components components_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_pkey PRIMARY KEY (id);


--
-- Name: component_connections connections_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.component_connections
    ADD CONSTRAINT connections_unique UNIQUE (from_component_id, to_component_id, relation);


--
-- Name: formula_versions formula_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.formula_versions
    ADD CONSTRAINT formula_versions_pkey PRIMARY KEY (calculator_id, formula_version);


--
-- Name: garages garages_id_owner_uq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.garages
    ADD CONSTRAINT garages_id_owner_uq UNIQUE (id, owner_id);


--
-- Name: garages garages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.garages
    ADD CONSTRAINT garages_pkey PRIMARY KEY (id);


--
-- Name: machines machines_id_owner_uq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_id_owner_uq UNIQUE (id, owner_id);


--
-- Name: machines machines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_pkey PRIMARY KEY (id);


--
-- Name: value_records value_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.value_records
    ADD CONSTRAINT value_records_pkey PRIMARY KEY (id);


--
-- Name: value_records values_id_owner_uq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.value_records
    ADD CONSTRAINT values_id_owner_uq UNIQUE (id, owner_id);


--
-- Name: calc_calculator_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX calc_calculator_idx ON public.calculation_records USING btree (calculator_id);


--
-- Name: calc_machine_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX calc_machine_created_idx ON public.calculation_records USING btree (machine_id, created_at DESC);


--
-- Name: calc_owner_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX calc_owner_created_idx ON public.calculation_records USING btree (owner_id, created_at DESC);


--
-- Name: components_machine_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX components_machine_idx ON public.components USING btree (machine_id);


--
-- Name: components_owner_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX components_owner_idx ON public.components USING btree (owner_id);


--
-- Name: connections_machine_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX connections_machine_idx ON public.component_connections USING btree (machine_id);


--
-- Name: garages_one_active_per_owner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX garages_one_active_per_owner ON public.garages USING btree (owner_id) WHERE (deleted_at IS NULL);


--
-- Name: garages_owner_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX garages_owner_idx ON public.garages USING btree (owner_id);


--
-- Name: machines_garage_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX machines_garage_idx ON public.machines USING btree (garage_id);


--
-- Name: machines_owner_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX machines_owner_idx ON public.machines USING btree (owner_id);


--
-- Name: values_machine_field_ctx_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX values_machine_field_ctx_idx ON public.value_records USING btree (machine_id, canonical_field, context);


--
-- Name: values_owner_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX values_owner_idx ON public.value_records USING btree (owner_id);


--
-- Name: values_superseded_once; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX values_superseded_once ON public.value_records USING btree (supersedes_id) WHERE (supersedes_id IS NOT NULL);


--
-- Name: users df_on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: postgres
--

CREATE TRIGGER df_on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.df_handle_new_auth_user();


--
-- Name: calculation_records df_append_only; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_append_only BEFORE DELETE OR UPDATE ON public.calculation_records FOR EACH ROW EXECUTE FUNCTION public.df_refuse('calculation history is immutable');


--
-- Name: value_records df_append_only; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_append_only BEFORE DELETE OR UPDATE ON public.value_records FOR EACH ROW EXECUTE FUNCTION public.df_refuse('values are append-only');


--
-- Name: accounts df_guard; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_guard BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.df_guard_update();


--
-- Name: component_connections df_guard; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_guard BEFORE UPDATE ON public.component_connections FOR EACH ROW EXECUTE FUNCTION public.df_guard_update();


--
-- Name: components df_guard; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_guard BEFORE UPDATE ON public.components FOR EACH ROW EXECUTE FUNCTION public.df_guard_update();


--
-- Name: garages df_guard; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_guard BEFORE UPDATE ON public.garages FOR EACH ROW EXECUTE FUNCTION public.df_guard_update();


--
-- Name: machines df_guard; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_guard BEFORE UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.df_guard_update();


--
-- Name: formula_versions df_never_changed; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_never_changed BEFORE DELETE OR UPDATE ON public.formula_versions FOR EACH ROW EXECUTE FUNCTION public.df_refuse('formula versions are never altered or deleted');


--
-- Name: component_connections df_no_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_no_delete BEFORE DELETE ON public.component_connections FOR EACH ROW EXECUTE FUNCTION public.df_refuse('soft delete only');


--
-- Name: components df_no_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_no_delete BEFORE DELETE ON public.components FOR EACH ROW EXECUTE FUNCTION public.df_refuse('soft delete only');


--
-- Name: garages df_no_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_no_delete BEFORE DELETE ON public.garages FOR EACH ROW EXECUTE FUNCTION public.df_refuse('soft delete only');


--
-- Name: machines df_no_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_no_delete BEFORE DELETE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.df_refuse('soft delete only');


--
-- Name: calculation_records df_no_truncate; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_no_truncate BEFORE TRUNCATE ON public.calculation_records FOR EACH STATEMENT EXECUTE FUNCTION public.df_refuse('calculation history is immutable');


--
-- Name: formula_versions df_no_truncate; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_no_truncate BEFORE TRUNCATE ON public.formula_versions FOR EACH STATEMENT EXECUTE FUNCTION public.df_refuse('formula versions are never altered or deleted');


--
-- Name: value_records df_no_truncate; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_no_truncate BEFORE TRUNCATE ON public.value_records FOR EACH STATEMENT EXECUTE FUNCTION public.df_refuse('values are append-only');


--
-- Name: accounts df_stamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_stamp BEFORE INSERT ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.df_stamp_insert();


--
-- Name: calculation_records df_stamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_stamp BEFORE INSERT ON public.calculation_records FOR EACH ROW EXECUTE FUNCTION public.df_stamp_insert();


--
-- Name: component_connections df_stamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_stamp BEFORE INSERT ON public.component_connections FOR EACH ROW EXECUTE FUNCTION public.df_stamp_insert();


--
-- Name: components df_stamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_stamp BEFORE INSERT ON public.components FOR EACH ROW EXECUTE FUNCTION public.df_stamp_insert();


--
-- Name: garages df_stamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_stamp BEFORE INSERT ON public.garages FOR EACH ROW EXECUTE FUNCTION public.df_stamp_insert();


--
-- Name: machines df_stamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_stamp BEFORE INSERT ON public.machines FOR EACH ROW EXECUTE FUNCTION public.df_stamp_insert();


--
-- Name: value_records df_stamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_stamp BEFORE INSERT ON public.value_records FOR EACH ROW EXECUTE FUNCTION public.df_stamp_insert();


--
-- Name: calculation_records df_validate; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_validate BEFORE INSERT ON public.calculation_records FOR EACH ROW EXECUTE FUNCTION public.df_calculation_validate();


--
-- Name: value_records df_validate; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER df_validate BEFORE INSERT ON public.value_records FOR EACH ROW EXECUTE FUNCTION public.df_value_validate();


--
-- Name: accounts accounts_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: calculation_records calc_formula_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calculation_records
    ADD CONSTRAINT calc_formula_version_fk FOREIGN KEY (canonical_id, formula_version) REFERENCES public.formula_versions(calculator_id, formula_version) ON DELETE RESTRICT;


--
-- Name: calculation_records calc_machine_same_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calculation_records
    ADD CONSTRAINT calc_machine_same_owner_fk FOREIGN KEY (machine_id, owner_id) REFERENCES public.machines(id, owner_id) ON DELETE RESTRICT;


--
-- Name: calculation_records calculation_records_calculator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calculation_records
    ADD CONSTRAINT calculation_records_calculator_id_fkey FOREIGN KEY (calculator_id) REFERENCES public.calculators(calculator_id) ON DELETE RESTRICT;


--
-- Name: calculation_records calculation_records_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calculation_records
    ADD CONSTRAINT calculation_records_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;


--
-- Name: calculators calculators_canonical_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calculators
    ADD CONSTRAINT calculators_canonical_id_fkey FOREIGN KEY (canonical_id) REFERENCES public.calculators(calculator_id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: component_connections component_connections_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.component_connections
    ADD CONSTRAINT component_connections_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;


--
-- Name: components components_machine_same_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_machine_same_owner_fk FOREIGN KEY (machine_id, owner_id) REFERENCES public.machines(id, owner_id) ON DELETE RESTRICT;


--
-- Name: components components_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;


--
-- Name: components components_parent_same_machine_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.components
    ADD CONSTRAINT components_parent_same_machine_fk FOREIGN KEY (parent_component_id, machine_id) REFERENCES public.components(id, machine_id) ON DELETE RESTRICT;


--
-- Name: component_connections connections_from_same_machine_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.component_connections
    ADD CONSTRAINT connections_from_same_machine_fk FOREIGN KEY (from_component_id, machine_id) REFERENCES public.components(id, machine_id) ON DELETE RESTRICT;


--
-- Name: component_connections connections_machine_same_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.component_connections
    ADD CONSTRAINT connections_machine_same_owner_fk FOREIGN KEY (machine_id, owner_id) REFERENCES public.machines(id, owner_id) ON DELETE RESTRICT;


--
-- Name: component_connections connections_to_same_machine_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.component_connections
    ADD CONSTRAINT connections_to_same_machine_fk FOREIGN KEY (to_component_id, machine_id) REFERENCES public.components(id, machine_id) ON DELETE RESTRICT;


--
-- Name: formula_versions formula_versions_calculator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.formula_versions
    ADD CONSTRAINT formula_versions_calculator_id_fkey FOREIGN KEY (calculator_id) REFERENCES public.calculators(calculator_id) ON DELETE RESTRICT;


--
-- Name: garages garages_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.garages
    ADD CONSTRAINT garages_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;


--
-- Name: machines machines_garage_same_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_garage_same_owner_fk FOREIGN KEY (garage_id, owner_id) REFERENCES public.garages(id, owner_id) ON DELETE RESTRICT;


--
-- Name: machines machines_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;


--
-- Name: value_records value_records_canonical_field_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.value_records
    ADD CONSTRAINT value_records_canonical_field_fkey FOREIGN KEY (canonical_field) REFERENCES public.canonical_fields(key) ON DELETE RESTRICT;


--
-- Name: value_records value_records_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.value_records
    ADD CONSTRAINT value_records_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;


--
-- Name: value_records values_calculation_same_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.value_records
    ADD CONSTRAINT values_calculation_same_owner_fk FOREIGN KEY (calculation_id, owner_id) REFERENCES public.calculation_records(id, owner_id) ON DELETE RESTRICT;


--
-- Name: value_records values_component_same_machine_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.value_records
    ADD CONSTRAINT values_component_same_machine_fk FOREIGN KEY (component_id, machine_id) REFERENCES public.components(id, machine_id) ON DELETE RESTRICT;


--
-- Name: value_records values_machine_same_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.value_records
    ADD CONSTRAINT values_machine_same_owner_fk FOREIGN KEY (machine_id, owner_id) REFERENCES public.machines(id, owner_id) ON DELETE RESTRICT;


--
-- Name: value_records values_supersedes_same_owner_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.value_records
    ADD CONSTRAINT values_supersedes_same_owner_fk FOREIGN KEY (supersedes_id, owner_id) REFERENCES public.value_records(id, owner_id) ON DELETE RESTRICT;


--
-- Name: accounts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: calculation_records; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.calculation_records ENABLE ROW LEVEL SECURITY;

--
-- Name: calculators; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.calculators ENABLE ROW LEVEL SECURITY;

--
-- Name: canonical_fields; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.canonical_fields ENABLE ROW LEVEL SECURITY;

--
-- Name: component_connections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.component_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: components; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;

--
-- Name: accounts df_accounts_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY df_accounts_select ON public.accounts FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: calculation_records df_calc_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY df_calc_select ON public.calculation_records FOR SELECT TO authenticated USING ((owner_id = auth.uid()));


--
-- Name: calculators df_calculators_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY df_calculators_read ON public.calculators FOR SELECT TO authenticated USING (true);


--
-- Name: canonical_fields df_canonical_fields_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY df_canonical_fields_read ON public.canonical_fields FOR SELECT TO authenticated USING (true);


--
-- Name: components df_components_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY df_components_insert ON public.components FOR INSERT TO authenticated WITH CHECK ((owner_id = auth.uid()));


--
-- Name: components df_components_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY df_components_select ON public.components FOR SELECT TO authenticated USING (((owner_id = auth.uid()) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM public.machines m
  WHERE (m.id = components.machine_id)))));


--
-- Name: components df_components_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY df_components_update ON public.components FOR UPDATE TO authenticated USING (((owner_id = auth.uid()) AND (deleted_at IS NULL))) WITH CHECK ((owner_id = auth.uid()));


--
-- Name: component_connections df_connections_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY df_connections_insert ON public.component_connections FOR INSERT TO authenticated WITH CHECK ((owner_id = auth.uid()));


--
-- Name: component_connections df_connections_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY df_connections_select ON public.component_connections FOR SELECT TO authenticated USING (((owner_id = auth.uid()) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM public.machines m
  WHERE (m.id = component_connections.machine_id)))));


--
-- Name: component_connections df_connections_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY df_connections_update ON public.component_connections FOR UPDATE TO authenticated USING (((owner_id = auth.uid()) AND (deleted_at IS NULL))) WITH CHECK ((owner_id = auth.uid()));


--
-- Name: formula_versions df_formula_versions_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY df_formula_versions_read ON public.formula_versions FOR SELECT TO authenticated USING (true);


--
-- Name: garages df_garages_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY df_garages_insert ON public.garages FOR INSERT TO authenticated WITH CHECK ((owner_id = auth.uid()));


--
-- Name: garages df_garages_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY df_garages_select ON public.garages FOR SELECT TO authenticated USING (((owner_id = auth.uid()) AND (deleted_at IS NULL)));


--
-- Name: garages df_garages_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY df_garages_update ON public.garages FOR UPDATE TO authenticated USING (((owner_id = auth.uid()) AND (deleted_at IS NULL))) WITH CHECK ((owner_id = auth.uid()));


--
-- Name: machines df_machines_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY df_machines_insert ON public.machines FOR INSERT TO authenticated WITH CHECK ((owner_id = auth.uid()));


--
-- Name: machines df_machines_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY df_machines_select ON public.machines FOR SELECT TO authenticated USING (((owner_id = auth.uid()) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM public.garages g
  WHERE ((g.id = machines.garage_id) AND (g.deleted_at IS NULL))))));


--
-- Name: machines df_machines_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY df_machines_update ON public.machines FOR UPDATE TO authenticated USING (((owner_id = auth.uid()) AND (deleted_at IS NULL))) WITH CHECK ((owner_id = auth.uid()));


--
-- Name: value_records df_values_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY df_values_select ON public.value_records FOR SELECT TO authenticated USING ((owner_id = auth.uid()));


--
-- Name: formula_versions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.formula_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: garages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.garages ENABLE ROW LEVEL SECURITY;

--
-- Name: machines; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

--
-- Name: value_records; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.value_records ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO service_role;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION uid(); Type: ACL; Schema: auth; Owner: postgres
--

GRANT ALL ON FUNCTION auth.uid() TO anon;
GRANT ALL ON FUNCTION auth.uid() TO authenticated;
GRANT ALL ON FUNCTION auth.uid() TO service_role;


--
-- Name: FUNCTION df_soft_delete_component(p_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.df_soft_delete_component(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.df_soft_delete_component(p_id uuid) TO authenticated;


--
-- Name: FUNCTION df_soft_delete_connection(p_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.df_soft_delete_connection(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.df_soft_delete_connection(p_id uuid) TO authenticated;


--
-- Name: FUNCTION df_soft_delete_garage(p_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.df_soft_delete_garage(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.df_soft_delete_garage(p_id uuid) TO authenticated;


--
-- Name: FUNCTION df_soft_delete_machine(p_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.df_soft_delete_machine(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.df_soft_delete_machine(p_id uuid) TO authenticated;


--
-- Name: TABLE accounts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.accounts TO service_role;
GRANT SELECT ON TABLE public.accounts TO authenticated;


--
-- Name: TABLE calculation_records; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.calculation_records TO service_role;
GRANT SELECT ON TABLE public.calculation_records TO authenticated;


--
-- Name: TABLE calculators; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.calculators TO service_role;
GRANT SELECT ON TABLE public.calculators TO authenticated;


--
-- Name: TABLE canonical_fields; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.canonical_fields TO service_role;
GRANT SELECT ON TABLE public.canonical_fields TO authenticated;


--
-- Name: TABLE component_connections; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.component_connections TO service_role;
GRANT SELECT,INSERT ON TABLE public.component_connections TO authenticated;


--
-- Name: COLUMN component_connections.deleted_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(deleted_at) ON TABLE public.component_connections TO authenticated;


--
-- Name: TABLE components; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.components TO service_role;
GRANT SELECT,INSERT ON TABLE public.components TO authenticated;


--
-- Name: COLUMN components.kind; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(kind) ON TABLE public.components TO authenticated;


--
-- Name: COLUMN components.parent_component_id; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(parent_component_id) ON TABLE public.components TO authenticated;


--
-- Name: COLUMN components.manufacturer; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(manufacturer) ON TABLE public.components TO authenticated;


--
-- Name: COLUMN components.model; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(model) ON TABLE public.components TO authenticated;


--
-- Name: COLUMN components.part_number; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(part_number) ON TABLE public.components TO authenticated;


--
-- Name: COLUMN components.label; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(label) ON TABLE public.components TO authenticated;


--
-- Name: COLUMN components.deleted_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(deleted_at) ON TABLE public.components TO authenticated;


--
-- Name: TABLE formula_versions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.formula_versions TO service_role;
GRANT SELECT ON TABLE public.formula_versions TO authenticated;


--
-- Name: TABLE garages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.garages TO service_role;
GRANT SELECT,INSERT ON TABLE public.garages TO authenticated;


--
-- Name: COLUMN garages.name; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(name) ON TABLE public.garages TO authenticated;


--
-- Name: COLUMN garages.deleted_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(deleted_at) ON TABLE public.garages TO authenticated;


--
-- Name: TABLE machines; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.machines TO service_role;
GRANT SELECT,INSERT ON TABLE public.machines TO authenticated;


--
-- Name: COLUMN machines.name; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(name) ON TABLE public.machines TO authenticated;


--
-- Name: COLUMN machines.machine_type; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(machine_type) ON TABLE public.machines TO authenticated;


--
-- Name: COLUMN machines.marine_type; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(marine_type) ON TABLE public.machines TO authenticated;


--
-- Name: COLUMN machines.propulsion; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(propulsion) ON TABLE public.machines TO authenticated;


--
-- Name: COLUMN machines.power_source; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(power_source) ON TABLE public.machines TO authenticated;


--
-- Name: COLUMN machines.is_hypothetical; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(is_hypothetical) ON TABLE public.machines TO authenticated;


--
-- Name: COLUMN machines.deleted_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(deleted_at) ON TABLE public.machines TO authenticated;


--
-- Name: TABLE value_records; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.value_records TO service_role;
GRANT SELECT ON TABLE public.value_records TO authenticated;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--


