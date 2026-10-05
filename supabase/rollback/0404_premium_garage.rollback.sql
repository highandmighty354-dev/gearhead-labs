-- Rollback of PREMIUM-FOUNDATION 0404. Removes the Free machine allowance and machine_details.
BEGIN;
DROP POLICY IF EXISTS pf_machines_free_allowance ON public.machines;
DROP FUNCTION IF EXISTS public.pf_machine_allowance_ok();
DROP TABLE IF EXISTS public.machine_details;
COMMIT;
