-- Rollback of PREMIUM-FOUNDATION 0406. Destroys saved engineering analyses: run only on an empty or disposable project.
BEGIN;
DROP FUNCTION IF EXISTS public.pf_soft_delete_engineering_analysis(uuid);
DROP TABLE IF EXISTS public.engineering_analyses;
DROP FUNCTION IF EXISTS public.pf_engineering_analysis_check();
DROP TABLE IF EXISTS public.engineering_analyzers;
COMMIT;
