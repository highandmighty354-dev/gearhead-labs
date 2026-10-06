-- Rollback of PREMIUM-FOUNDATION 0405. Destroys saved-calculation metadata (calculation_records are untouched).
BEGIN;
DROP FUNCTION IF EXISTS public.pf_soft_delete_saved_calculation(uuid);
DROP TABLE IF EXISTS public.saved_calculations;
DROP FUNCTION IF EXISTS public.pf_saved_calculation_links();
COMMIT;
