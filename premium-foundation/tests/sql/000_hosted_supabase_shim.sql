-- TEST-ONLY shim. NEVER applied to a real Supabase project (which already provides all of this).
-- Emulates the hosted role model observed on project jmztpjudwzjvrcdtjynd (read-only catalog check, 2026-10-05):
--   supabase_admin  superuser (cluster owner; runs this shim and creates the auth schema)
--   postgres        NOSUPERUSER, BYPASSRLS, CREATEROLE - runs the migrations and owns every function/table they create
--   service_role    BYPASSRLS (trusted server path)       anon / authenticated: plain client roles
-- plus Supabase's default privileges, under which every new public table/function/sequence created by postgres is
-- granted to anon, authenticated and service_role unless a migration revokes it. Testing under these defaults proves
-- the migrations' REVOKEs are real. Run as supabase_admin.
-- Roles are cluster-wide; the database part below runs once per fresh test database.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres')      THEN CREATE ROLE postgres LOGIN NOSUPERUSER BYPASSRLS CREATEROLE INHERIT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')          THEN CREATE ROLE anon NOLOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN NOINHERIT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')  THEN CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS; END IF;
END $$;
GRANT anon, authenticated, service_role TO postgres;

ALTER SCHEMA public OWNER TO postgres;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text NULL);
-- Supabase's auth.uid(): the JWT "sub" claim of the current request (NULL when absent).
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO postgres, anon, authenticated, service_role;
GRANT SELECT, REFERENCES, TRIGGER ON auth.users TO postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
