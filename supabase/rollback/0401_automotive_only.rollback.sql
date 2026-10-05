-- Rollback of PREMIUM-FOUNDATION 0401 automotive-only. Restores the exact post-0004 state.
BEGIN;
ALTER TABLE public.machines DROP CONSTRAINT IF EXISTS pf_machines_automotive_only;
GRANT UPDATE (marine_type, propulsion) ON public.machines TO authenticated;
COMMIT;
