-- DATA-FOUNDATION 1.0.0 · 0003 constraints & triggers
-- Database-level rules that hold for EVERY role (incl. service role), not only under RLS:
--   * server-forced timestamps; owner_id / identity columns immutable
--   * value_records and calculation_records append-only (no UPDATE / DELETE / TRUNCATE)
--   * formula_versions never altered or deleted
--   * hard DELETE refused on garages / machines / components / connections (soft delete only)
--   * value unit = canonical engine-native unit; value kind matches field; consistent supersession
--   * calculation canonical_id matches the calculator catalog; referenced values same owner
-- Idempotent: CREATE OR REPLACE FUNCTION / CREATE OR REPLACE TRIGGER.

-- Sign-up: an Account row is created by the server, never by the client.
CREATE OR REPLACE FUNCTION public.df_handle_new_auth_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.accounts (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER df_on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.df_handle_new_auth_user();

-- Generic: server-forced timestamps on insert.
CREATE OR REPLACE FUNCTION public.df_stamp_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_TABLE_NAME = 'value_records' THEN
    NEW.recorded_at := now();
  ELSE
    NEW.created_at := now();
    IF TG_TABLE_NAME IN ('garages','machines','components') THEN NEW.updated_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;

-- Generic: on update keep id / owner_id / created_at; refresh updated_at.
CREATE OR REPLACE FUNCTION public.df_guard_update() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
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

-- Generic: refuse an operation outright (append-only / soft-delete-only tables).
CREATE OR REPLACE FUNCTION public.df_refuse() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'DF_IMMUTABLE: % on % is not permitted (%)', TG_OP, TG_TABLE_NAME, TG_ARGV[0] USING ERRCODE = 'P0001';
END $$;

-- Value: unit and kind must match the canonical field; supersession must stay on the same series.
CREATE OR REPLACE FUNCTION public.df_value_validate() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
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

-- Calculation: canonical_id must be the catalog's canonical id; referenced values must be the owner's.
CREATE OR REPLACE FUNCTION public.df_calculation_validate() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
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

-- Wire the triggers.
CREATE OR REPLACE TRIGGER df_stamp BEFORE INSERT ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.df_stamp_insert();
CREATE OR REPLACE TRIGGER df_guard BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.df_guard_update();

CREATE OR REPLACE TRIGGER df_stamp BEFORE INSERT ON public.garages FOR EACH ROW EXECUTE FUNCTION public.df_stamp_insert();
CREATE OR REPLACE TRIGGER df_guard BEFORE UPDATE ON public.garages FOR EACH ROW EXECUTE FUNCTION public.df_guard_update();
CREATE OR REPLACE TRIGGER df_no_delete BEFORE DELETE ON public.garages FOR EACH ROW EXECUTE FUNCTION public.df_refuse('soft delete only');

CREATE OR REPLACE TRIGGER df_stamp BEFORE INSERT ON public.machines FOR EACH ROW EXECUTE FUNCTION public.df_stamp_insert();
CREATE OR REPLACE TRIGGER df_guard BEFORE UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.df_guard_update();
CREATE OR REPLACE TRIGGER df_no_delete BEFORE DELETE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.df_refuse('soft delete only');

CREATE OR REPLACE TRIGGER df_stamp BEFORE INSERT ON public.components FOR EACH ROW EXECUTE FUNCTION public.df_stamp_insert();
CREATE OR REPLACE TRIGGER df_guard BEFORE UPDATE ON public.components FOR EACH ROW EXECUTE FUNCTION public.df_guard_update();
CREATE OR REPLACE TRIGGER df_no_delete BEFORE DELETE ON public.components FOR EACH ROW EXECUTE FUNCTION public.df_refuse('soft delete only');

CREATE OR REPLACE TRIGGER df_stamp BEFORE INSERT ON public.component_connections FOR EACH ROW EXECUTE FUNCTION public.df_stamp_insert();
CREATE OR REPLACE TRIGGER df_guard BEFORE UPDATE ON public.component_connections FOR EACH ROW EXECUTE FUNCTION public.df_guard_update();
CREATE OR REPLACE TRIGGER df_no_delete BEFORE DELETE ON public.component_connections FOR EACH ROW EXECUTE FUNCTION public.df_refuse('soft delete only');

CREATE OR REPLACE TRIGGER df_stamp BEFORE INSERT ON public.value_records FOR EACH ROW EXECUTE FUNCTION public.df_stamp_insert();
CREATE OR REPLACE TRIGGER df_validate BEFORE INSERT ON public.value_records FOR EACH ROW EXECUTE FUNCTION public.df_value_validate();
CREATE OR REPLACE TRIGGER df_append_only BEFORE UPDATE OR DELETE ON public.value_records FOR EACH ROW EXECUTE FUNCTION public.df_refuse('values are append-only');
CREATE OR REPLACE TRIGGER df_no_truncate BEFORE TRUNCATE ON public.value_records FOR EACH STATEMENT EXECUTE FUNCTION public.df_refuse('values are append-only');

CREATE OR REPLACE TRIGGER df_stamp BEFORE INSERT ON public.calculation_records FOR EACH ROW EXECUTE FUNCTION public.df_stamp_insert();
CREATE OR REPLACE TRIGGER df_validate BEFORE INSERT ON public.calculation_records FOR EACH ROW EXECUTE FUNCTION public.df_calculation_validate();
CREATE OR REPLACE TRIGGER df_append_only BEFORE UPDATE OR DELETE ON public.calculation_records FOR EACH ROW EXECUTE FUNCTION public.df_refuse('calculation history is immutable');
CREATE OR REPLACE TRIGGER df_no_truncate BEFORE TRUNCATE ON public.calculation_records FOR EACH STATEMENT EXECUTE FUNCTION public.df_refuse('calculation history is immutable');

CREATE OR REPLACE TRIGGER df_never_changed BEFORE UPDATE OR DELETE ON public.formula_versions FOR EACH ROW EXECUTE FUNCTION public.df_refuse('formula versions are never altered or deleted');
CREATE OR REPLACE TRIGGER df_no_truncate BEFORE TRUNCATE ON public.formula_versions FOR EACH STATEMENT EXECUTE FUNCTION public.df_refuse('formula versions are never altered or deleted');
