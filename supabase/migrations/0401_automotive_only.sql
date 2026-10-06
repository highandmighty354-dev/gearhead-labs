-- PREMIUM-FOUNDATION 1.0.0 · 0401 automotive-only (owner decision 2, 2026-10-05)
-- Applied ON TOP of the frozen DATA-FOUNDATION migrations; 0001_enums.sql is NOT edited.
--
-- Gearhead Labs is an automotive product. The frozen vocabulary still contains marine values:
--   machine_type_enum 'marine', the whole marine_type_enum, and propulsion_enum (outboard, inboard, v_drive,
--   sterndrive_io, forward_drive, pod, jet, surface_drive, saildrive, electric, custom - marine propulsion, §4).
-- PostgreSQL cannot drop an enum value without rebuilding the type and every dependant, which would alter frozen
-- objects. Instead, marine use is BLOCKED for every role:
--   1. CHECK constraint pf_machines_automotive_only: machine_type <> 'marine', marine_type IS NULL, propulsion IS NULL
--   2. the client column grant UPDATE (marine_type, propulsion) on public.machines is withdrawn (granted at 0004)
-- The enum values remain in the catalog but can never be stored. Client vocabularies must not offer them.
--
-- Idempotent, deterministic, single transaction; post-conditions abort if the resulting state is not exactly the
-- approved one. Rollback: supabase/rollback/0401_automotive_only.rollback.sql
BEGIN;

ALTER TABLE public.machines DROP CONSTRAINT IF EXISTS pf_machines_automotive_only;
ALTER TABLE public.machines ADD CONSTRAINT pf_machines_automotive_only
  CHECK (machine_type <> 'marine'::public.machine_type_enum AND marine_type IS NULL AND propulsion IS NULL);

REVOKE UPDATE (marine_type, propulsion) ON public.machines FROM authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.machines'::regclass
                 AND conname = 'pf_machines_automotive_only' AND contype = 'c' AND convalidated) THEN
    RAISE EXCEPTION 'PF_0401_POSTCONDITION: validated constraint pf_machines_automotive_only missing';
  END IF;
  IF has_column_privilege('authenticated', 'public.machines', 'marine_type', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.machines', 'propulsion', 'UPDATE') THEN
    RAISE EXCEPTION 'PF_0401_POSTCONDITION: authenticated can still UPDATE marine_type/propulsion';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.machines', 'machine_type', 'UPDATE') THEN
    RAISE EXCEPTION 'PF_0401_POSTCONDITION: authenticated lost UPDATE on machine_type';
  END IF;
END $$;

COMMIT;
