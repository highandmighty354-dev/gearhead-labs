-- DATA-FOUNDATION 1.0.0 · 0001 enums
-- Vocabulary only from the approved specification (Master Architecture §4, §8; Directive §6, §10, §11).
-- Idempotent: each type is created only if absent.

DO $$ BEGIN
  -- Machine type (§4)
  IF to_regtype('public.machine_type_enum') IS NULL THEN
    CREATE TYPE public.machine_type_enum AS ENUM
      ('automotive','motorcycle','atv_three_wheeler','side_by_side_utv','snowmobile','marine','go_kart','other_custom');
  END IF;
  -- Marine type (§4)
  IF to_regtype('public.marine_type_enum') IS NULL THEN
    CREATE TYPE public.marine_type_enum AS ENUM ('power_boat','pwc','sailboat','auxiliary_sailboat','other');
  END IF;
  -- Propulsion (§4) - kept separate from power source
  IF to_regtype('public.propulsion_enum') IS NULL THEN
    CREATE TYPE public.propulsion_enum AS ENUM
      ('outboard','inboard','v_drive','sterndrive_io','forward_drive','pod','jet','surface_drive','saildrive','electric','custom');
  END IF;
  -- Power source (§4)
  IF to_regtype('public.power_source_enum') IS NULL THEN
    CREATE TYPE public.power_source_enum AS ENUM ('gasoline','diesel','electric','hybrid','other');
  END IF;
  -- Component kind: Directive §10 minimum chain + other/custom
  IF to_regtype('public.component_kind_enum') IS NULL THEN
    CREATE TYPE public.component_kind_enum AS ENUM
      ('engine','transmission','transfer_case','differential_final_drive','axle','wheel_tire','other_custom');
  END IF;
  -- Provenance (§5 + Directive §6/§11 'estimated'); no 'imported' category (spec D)
  IF to_regtype('public.provenance_enum') IS NULL THEN
    CREATE TYPE public.provenance_enum AS ENUM
      ('calculated','measured','manufacturer_specified','user_entered','derived','empirical','estimated','unknown');
  END IF;
  -- Value context: specification vs operating state (§6, §9, §20)
  IF to_regtype('public.value_context_enum') IS NULL THEN
    CREATE TYPE public.value_context_enum AS ENUM ('specification','operating_state');
  END IF;
  -- Result state (§8)
  IF to_regtype('public.result_state_enum') IS NULL THEN
    CREATE TYPE public.result_state_enum AS ENUM
      ('valid','valid_with_warning','estimated','incomplete','out_of_range','non_convergent','not_applicable');
  END IF;
END $$;
