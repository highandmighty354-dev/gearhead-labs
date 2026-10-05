-- Rollback of PREMIUM-FOUNDATION 0403. Requires 0404-0406 rolled back first (0406 uses pf_unit_system_enum).
-- DROP TRIGGER needs OWNERSHIP of auth.users. On hosted Supabase that table belongs to supabase_auth_admin and the
-- migration role `postgres` holds only the TRIGGER privilege (verified read-only on the live project), so the drop is
-- refused there. In that case the trigger is left in place with its function replaced by a no-op (sign-up then
-- behaves exactly as before 0403); removing the inert trigger itself needs the auth table owner.
BEGIN;
DO $$
BEGIN
  BEGIN
    DROP TRIGGER IF EXISTS pf_on_auth_user_created ON auth.users;
    DROP FUNCTION IF EXISTS public.pf_handle_new_auth_user();
  EXCEPTION WHEN insufficient_privilege THEN
    CREATE OR REPLACE FUNCTION public.pf_handle_new_auth_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$ BEGIN RETURN NEW; END $f$;
    REVOKE ALL ON FUNCTION public.pf_handle_new_auth_user() FROM PUBLIC, anon, authenticated, service_role;
    RAISE WARNING 'PF_0403_ROLLBACK: not owner of auth.users; pf_on_auth_user_created left in place as a no-op';
  END;
END $$;
DROP TABLE IF EXISTS public.profiles;
DROP TYPE IF EXISTS public.pf_unit_system_enum;
DROP TYPE IF EXISTS public.pf_experience_level_enum;
COMMIT;
