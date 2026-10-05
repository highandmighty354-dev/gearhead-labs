-- Rollback of PREMIUM-FOUNDATION 0403. Requires 0404-0406 rolled back first (0406 uses pf_unit_system_enum).
BEGIN;
DROP TRIGGER IF EXISTS pf_on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.pf_handle_new_auth_user();
DROP TABLE IF EXISTS public.profiles;
DROP TYPE IF EXISTS public.pf_unit_system_enum;
DROP TYPE IF EXISTS public.pf_experience_level_enum;
COMMIT;
