-- GARAGE-FOUNDATION 1.0.0 · 0101 test_setups
-- Additive only (earlier decision #26): a new table that REFERENCES the frozen DATA-FOUNDATION-1.0.0
-- accounts and machines; no frozen object is altered. Applied after DATA-FOUNDATION 0001-0005.
-- Minimum pinned Test Setup (earlier decision #28): Machine -> Test Setup; no Labs (#27), no engineering
-- values, no calculations (#25). Idempotent (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS public.test_setups (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            uuid        NOT NULL DEFAULT auth.uid() REFERENCES public.accounts(id) ON DELETE RESTRICT,
  machine_id          uuid        NOT NULL,
  name                text        NOT NULL,
  description         text        NULL,
  notes               text        NULL,
  -- Pinned baseline reference: the server time (same clock as every frozen DATA-FOUNDATION timestamp)
  -- at which the baseline was pinned. Structural only - no values, no snapshot. Moves only by an explicit
  -- re-pin (0103); never implicitly (0102).
  baseline_pinned_at  timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz NULL,
  CONSTRAINT test_setups_id_owner_uq UNIQUE (id, owner_id),
  -- a Test Setup can only attach to a machine of the SAME owner (composite FK; independent of RLS)
  CONSTRAINT test_setups_machine_same_owner_fk FOREIGN KEY (machine_id, owner_id)
    REFERENCES public.machines (id, owner_id) ON DELETE RESTRICT,
  CONSTRAINT test_setups_name_not_blank CHECK (length(btrim(name)) > 0)
);
CREATE INDEX IF NOT EXISTS test_setups_owner_idx   ON public.test_setups (owner_id);
CREATE INDEX IF NOT EXISTS test_setups_machine_idx ON public.test_setups (machine_id);
