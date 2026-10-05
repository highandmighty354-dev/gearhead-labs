-- PREMIUM-FOUNDATION 1.0.0 · 0403 profiles (1:1 with accounts; display data only)
-- Created by the server on sign-up (trigger pf_on_auth_user_created; fires after df_on_auth_user_created because
-- PostgreSQL fires same-event triggers in name order, so the account row already exists). Clients read and edit
-- their own display fields only; no client INSERT or DELETE. Email is not copied (it lives in auth.users).
-- preferred_unit_system is a DISPLAY preference only: stored values stay engine-native (D-002).
-- Idempotent, single transaction, post-conditions. Rollback: supabase/rollback/0403_premium_profiles.rollback.sql
BEGIN;

DO $$ BEGIN
  IF to_regtype('public.pf_experience_level_enum') IS NULL THEN
    CREATE TYPE public.pf_experience_level_enum AS ENUM ('beginner','enthusiast','experienced','professional');
  END IF;
  IF to_regtype('public.pf_unit_system_enum') IS NULL THEN
    CREATE TYPE public.pf_unit_system_enum AS ENUM ('imperial','metric');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  account_id             uuid        PRIMARY KEY REFERENCES public.accounts (id) ON DELETE RESTRICT,
  display_name           text        NULL CHECK (display_name IS NULL OR length(display_name) BETWEEN 1 AND 80),
  avatar_url             text        NULL CHECK (avatar_url IS NULL OR (avatar_url ~ '^https://[^[:space:]<>"'']+$' AND length(avatar_url) <= 500)),
  location               text        NULL CHECK (location IS NULL OR length(location) <= 80),
  experience_level       public.pf_experience_level_enum NULL,
  preferred_unit_system  public.pf_unit_system_enum NOT NULL DEFAULT 'imperial',
  favorite_machine_id    uuid        NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  -- the favourite can only be one of the caller's own machines (composite FK; independent of RLS)
  CONSTRAINT profiles_favorite_machine_same_owner_fk FOREIGN KEY (favorite_machine_id, account_id)
    REFERENCES public.machines (id, owner_id) ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION public.pf_handle_new_auth_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (account_id) VALUES (NEW.id) ON CONFLICT (account_id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER pf_on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.pf_handle_new_auth_user();

-- Backfill: every existing account gets a profile (no-op on an empty project).
INSERT INTO public.profiles (account_id) SELECT id FROM public.accounts ON CONFLICT (account_id) DO NOTHING;

CREATE OR REPLACE TRIGGER pf_stamp       BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.pf_stamp_insert();
CREATE OR REPLACE TRIGGER pf_guard       BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.pf_guard_update('account_id');
CREATE OR REPLACE TRIGGER pf_no_delete   BEFORE DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.pf_refuse('profiles live as long as the account (account deletion is OPEN #10)');
CREATE OR REPLACE TRIGGER pf_no_truncate BEFORE TRUNCATE ON public.profiles FOR EACH STATEMENT EXECUTE FUNCTION public.pf_refuse('profiles live as long as the account');

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.profiles TO authenticated, service_role;
GRANT UPDATE (display_name, avatar_url, location, experience_level, preferred_unit_system, favorite_machine_id)
  ON public.profiles TO authenticated;

DROP POLICY IF EXISTS pf_profiles_select ON public.profiles;
DROP POLICY IF EXISTS pf_profiles_update ON public.profiles;
CREATE POLICY pf_profiles_select ON public.profiles FOR SELECT TO authenticated USING (account_id = auth.uid());
CREATE POLICY pf_profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

REVOKE ALL ON FUNCTION public.pf_handle_new_auth_user() FROM PUBLIC, anon, authenticated, service_role;

DO $$ DECLARE p text;
BEGIN
  IF NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.profiles'::regclass) THEN
    RAISE EXCEPTION 'PF_0403_POSTCONDITION: RLS not enabled and forced on profiles'; END IF;
  FOREACH p IN ARRAY ARRAY['INSERT','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
    IF has_table_privilege('authenticated', 'public.profiles', p) THEN
      RAISE EXCEPTION 'PF_0403_POSTCONDITION: authenticated holds % on profiles', p; END IF;
  END LOOP;
  IF has_table_privilege('anon', 'public.profiles', 'SELECT') THEN RAISE EXCEPTION 'PF_0403_POSTCONDITION: anon can read profiles'; END IF;
  IF has_column_privilege('authenticated', 'public.profiles', 'account_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.profiles', 'created_at', 'UPDATE') THEN
    RAISE EXCEPTION 'PF_0403_POSTCONDITION: identity/timestamp columns client-updatable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND tgname = 'pf_on_auth_user_created' AND NOT tgisinternal)
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND tgname = 'df_on_auth_user_created' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'PF_0403_POSTCONDITION: sign-up triggers missing'; END IF;
  IF EXISTS (SELECT 1 FROM public.accounts a WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.account_id = a.id)) THEN
    RAISE EXCEPTION 'PF_0403_POSTCONDITION: an account has no profile'; END IF;
END $$;

COMMIT;
