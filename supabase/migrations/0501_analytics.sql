-- 0501_analytics.sql — Gearhead Labs first-party analytics (docs/ANALYTICS-BLUEPRINT.md), owner-only reporting.
--
-- Tables (all server-only: RLS enabled and forced, no policies, no client privileges):
--   analytics_owners        the owner allow-list (rows only by an explicit, reviewed SQL statement; none here)
--   analytics_events        raw events, append-only, 90-day retention; written only by analytics_ingest()
--   analytics_ingest_stats  per-day ingestion counters (accepted / duplicate / rejected+reason / capped / bot / client errors)
--   analytics_sessions      one row per session (sessionised server-side), 13-month retention
--   analytics_daily         daily rollup (day, env, metric, dim) -> value, kept indefinitely
--   analytics_rollup_runs   when each day was last rolled up
-- Functions:
--   analytics_ingest(batch, meta)      service_role only (the analytics-ingest Edge Function); validates every event
--   analytics_rollup(day) / analytics_purge()   postgres only (pg_cron); idempotent
--   analytics_refresh()                owner only; rolls up today and yesterday on demand
--   analytics_dashboard(from, to, env) owner only; aggregates only, never raw rows
--   analytics_billing_metrics(from, to) owner only; reads the 0402 billing tables, LIVE-mode Stripe data only
-- Nothing here collects calculator inputs, IP addresses, full user agents, emails or payment data: the event catalogue
-- and per-event property allow-lists below reject anything else. Days are counted in America/New_York.
BEGIN;

-- ---------------------------------------------------------------- tables
CREATE TABLE IF NOT EXISTS public.analytics_owners (
  user_id  uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  note     text CHECK (note IS NULL OR char_length(note) <= 200)
);

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id   uuid NOT NULL UNIQUE,
  env        text NOT NULL CHECK (env IN ('live', 'test', 'dev')),
  name       text NOT NULL CHECK (name IN ('page_view', 'page_leave', 'page_ping', 'nav_click', 'search', 'calc_view', 'calc_start',
               'calc_complete', 'calc_unit_toggle', 'calc_help_open', 'premium_gate_view', 'premium_offer_view', 'signin_request',
               'signin_complete', 'trial_click', 'checkout_redirect', 'checkout_return', 'portal_open')),
  ts_server  timestamptz NOT NULL DEFAULT now(),
  ts_client  timestamptz,
  vid        uuid NOT NULL,
  sid        uuid NOT NULL,
  pv_id      uuid,
  seq        integer NOT NULL CHECK (seq BETWEEN 0 AND 100000),
  page       text NOT NULL CHECK (char_length(page) BETWEEN 1 AND 120 AND page ~ '^[a-z0-9:_./-]+$'),
  props      jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(props) = 'object' AND pg_column_size(props) <= 1024),
  ua_family  text CHECK (ua_family IS NULL OR (char_length(ua_family) <= 40 AND ua_family ~ '^[A-Za-z0-9 ._-]+$')),
  viewport   char(1) CHECK (viewport IS NULL OR viewport IN ('s', 'm', 'l')),
  bot        boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS analytics_events_ts_brin ON public.analytics_events USING brin (ts_server);
CREATE INDEX IF NOT EXISTS analytics_events_sid_ts  ON public.analytics_events (sid, ts_server);
CREATE INDEX IF NOT EXISTS analytics_events_env_ts  ON public.analytics_events (env, ts_server);

CREATE TABLE IF NOT EXISTS public.analytics_ingest_stats (
  day     date NOT NULL,
  env     text NOT NULL CHECK (env IN ('live', 'test', 'dev', 'unknown')),
  outcome text NOT NULL CHECK (outcome IN ('accepted', 'duplicate', 'rejected', 'capped', 'bot', 'client_error', 'client_dropped')),
  reason  text NOT NULL DEFAULT '' CHECK (char_length(reason) <= 60),
  n       bigint NOT NULL DEFAULT 0,
  last_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, env, outcome, reason)
);

CREATE TABLE IF NOT EXISTS public.analytics_sessions (
  skey         text PRIMARY KEY,                   -- sid:day:segment (a new segment after 30 minutes without events)
  sid          uuid NOT NULL,
  vid          uuid NOT NULL,
  env          text NOT NULL,
  day          date NOT NULL,
  started_at   timestamptz NOT NULL,
  ended_at     timestamptz NOT NULL,
  landing_page text,
  exit_page    text,
  page_views   integer NOT NULL,
  engaged_ms   bigint NOT NULL,
  key_events   integer NOT NULL,
  engaged      boolean NOT NULL,
  channel      text NOT NULL,
  ref_host     text,
  utm_source   text, utm_medium text, utm_campaign text,
  is_new       boolean,
  bot          boolean NOT NULL
);
CREATE INDEX IF NOT EXISTS analytics_sessions_env_day ON public.analytics_sessions (env, day);
CREATE INDEX IF NOT EXISTS analytics_sessions_vid     ON public.analytics_sessions (vid);

CREATE TABLE IF NOT EXISTS public.analytics_daily (
  day    date NOT NULL,
  env    text NOT NULL,
  metric text NOT NULL,
  dim    text NOT NULL DEFAULT '',
  value  numeric NOT NULL,
  PRIMARY KEY (day, env, metric, dim)
);

CREATE TABLE IF NOT EXISTS public.analytics_rollup_runs (
  day    date NOT NULL,
  env    text NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, env)
);

-- ---------------------------------------------------------------- lock-down
DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['analytics_owners','analytics_events','analytics_ingest_stats','analytics_sessions','analytics_daily','analytics_rollup_runs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', t);
  END LOOP;
END $$;
REVOKE ALL ON SEQUENCE public.analytics_events_id_seq FROM PUBLIC, anon, authenticated, service_role;

-- raw events are append-only: no UPDATE ever; DELETE only through analytics_purge(); no TRUNCATE
CREATE OR REPLACE FUNCTION public.analytics_events_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('analytics.purge', true) = 'on' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'ANALYTICS_APPEND_ONLY: % is not allowed on analytics_events', TG_OP USING ERRCODE = '42501';
END $$;
DROP TRIGGER IF EXISTS analytics_events_no_update ON public.analytics_events;
CREATE TRIGGER analytics_events_no_update BEFORE UPDATE OR DELETE ON public.analytics_events FOR EACH ROW EXECUTE FUNCTION public.analytics_events_guard();
DROP TRIGGER IF EXISTS analytics_events_no_truncate ON public.analytics_events;
CREATE TRIGGER analytics_events_no_truncate BEFORE TRUNCATE ON public.analytics_events FOR EACH STATEMENT EXECUTE FUNCTION public.analytics_events_guard();

-- ---------------------------------------------------------------- helpers
CREATE OR REPLACE FUNCTION public.analytics_tz() RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$ SELECT 'America/New_York'::text $$;

CREATE OR REPLACE FUNCTION public.analytics_is_owner() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.analytics_owners o WHERE o.user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.analytics_require_owner() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.analytics_is_owner() THEN RAISE EXCEPTION 'ANALYTICS_NOT_AUTHORISED' USING ERRCODE = '42501'; END IF;
END $$;

-- Per-event property allow-list. Spec codes: b = boolean; i:min:max = integer; h = host name; u = UTM token; c = calculator id;
-- p = page key; e:a|b = one of; a leading ! marks a required property. Anything not listed is rejected.
CREATE OR REPLACE FUNCTION public.analytics_prop_spec(p_name text) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_name
    WHEN 'page_view'          THEN '{"is_new_visitor":"b","is_session_start":"b","ref_host":"h","utm_source":"u","utm_medium":"u","utm_campaign":"u","utm_content":"u","utm_term":"u"}'
    WHEN 'page_leave'         THEN '{"engaged_ms":"!i:0:1800000","max_scroll_pct":"e:0|25|50|75|100"}'
    WHEN 'page_ping'          THEN '{"engaged_ms_delta":"!i:0:330000"}'
    WHEN 'nav_click'          THEN '{"to_page":"!p","element":"!e:lab_tile|related|nav|encyclopedia|premium_cta|search_result|footer|other"}'
    WHEN 'search'             THEN '{"result_count":"!i:0:10000","clicked_rank":"i:1:10000"}'
    WHEN 'calc_view'          THEN '{"calc_id":"!c","premium_locked":"b"}'
    WHEN 'calc_start'         THEN '{"calc_id":"!c"}'
    WHEN 'calc_complete'      THEN '{"calc_id":"!c","fields_touched":"!i:0:100","ms_to_complete":"!i:0:86400000"}'
    WHEN 'calc_unit_toggle'   THEN '{"calc_id":"!c","to":"!e:us|metric"}'
    WHEN 'calc_help_open'     THEN '{"calc_id":"!c"}'
    WHEN 'premium_gate_view'  THEN '{"calc_id":"!c"}'
    WHEN 'premium_offer_view' THEN '{"signed_in":"!b"}'
    WHEN 'signin_request'     THEN '{}'
    WHEN 'signin_complete'    THEN '{"first_sign_in":"b"}'
    WHEN 'trial_click'        THEN '{"interval":"!e:month|year","trial":"b"}'
    WHEN 'checkout_redirect'  THEN '{"interval":"!e:month|year"}'
    WHEN 'checkout_return'    THEN '{"outcome":"!e:success|cancelled"}'
    WHEN 'portal_open'        THEN '{}'
  END::jsonb
$$;

-- Returns NULL when the event is valid, otherwise a short rejection reason.
CREATE OR REPLACE FUNCTION public.analytics_event_problem(e jsonb) RETURNS text
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  spec jsonb; props jsonb; k text; v jsonb; code text; req boolean; parts text[];
BEGIN
  IF jsonb_typeof(e) <> 'object' THEN RETURN 'not_object'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(e) x WHERE x NOT IN ('event_id','name','ts_client','vid','sid','seq','page','pv_id','viewport','props')) THEN RETURN 'unknown_field'; END IF;
  spec := public.analytics_prop_spec(e->>'name');
  IF spec IS NULL THEN RETURN 'unknown_event'; END IF;
  IF coalesce(e->>'event_id','') !~ uuid_re OR coalesce(e->>'vid','') !~ uuid_re OR coalesce(e->>'sid','') !~ uuid_re THEN RETURN 'bad_id'; END IF;
  IF e ? 'pv_id' AND jsonb_typeof(e->'pv_id') <> 'null' AND coalesce(e->>'pv_id','') !~ uuid_re THEN RETURN 'bad_id'; END IF;
  IF jsonb_typeof(e->'seq') IS DISTINCT FROM 'number' OR (e->>'seq') !~ '^[0-9]{1,6}$' OR (e->>'seq')::int > 100000 THEN RETURN 'bad_seq'; END IF;
  IF jsonb_typeof(e->'page') IS DISTINCT FROM 'string' OR char_length(e->>'page') NOT BETWEEN 1 AND 120 OR (e->>'page') !~ '^[a-z0-9:_./-]+$' THEN RETURN 'bad_page'; END IF;
  IF e ? 'viewport' AND jsonb_typeof(e->'viewport') <> 'null' AND (e->>'viewport') NOT IN ('s','m','l') THEN RETURN 'bad_viewport'; END IF;
  IF e ? 'ts_client' AND jsonb_typeof(e->'ts_client') <> 'null' AND (e->>'ts_client') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$' THEN RETURN 'bad_ts'; END IF;
  IF e ? 'ts_client' AND jsonb_typeof(e->'ts_client') = 'string' THEN
    BEGIN PERFORM (e->>'ts_client')::timestamptz; EXCEPTION WHEN others THEN RETURN 'bad_ts'; END;
  END IF;
  props := coalesce(e->'props', '{}'::jsonb);
  IF jsonb_typeof(props) <> 'object' THEN RETURN 'bad_props'; END IF;
  IF pg_column_size(props) > 1024 THEN RETURN 'props_too_large'; END IF;
  FOR k IN SELECT jsonb_object_keys(props) LOOP
    IF NOT spec ? k THEN RETURN 'unknown_prop:' || left(k, 30); END IF;
  END LOOP;
  FOR k, code IN SELECT key, value FROM jsonb_each_text(spec) LOOP
    req := left(code, 1) = '!'; IF req THEN code := substr(code, 2); END IF;
    v := props->k;
    IF v IS NULL OR jsonb_typeof(v) = 'null' THEN
      IF req THEN RETURN 'missing_prop:' || k; END IF; CONTINUE;
    END IF;
    parts := string_to_array(code, ':');
    IF parts[1] = 'b' AND jsonb_typeof(v) <> 'boolean' THEN RETURN 'bad_prop:' || k;
    ELSIF parts[1] = 'i' AND (jsonb_typeof(v) <> 'number' OR (v#>>'{}') !~ '^[0-9]{1,9}$'
          OR (v#>>'{}')::bigint < parts[2]::bigint OR (v#>>'{}')::bigint > parts[3]::bigint) THEN RETURN 'bad_prop:' || k;
    ELSIF parts[1] = 'h' AND (jsonb_typeof(v) <> 'string' OR char_length(v#>>'{}') > 100 OR (v#>>'{}') !~ '^[a-z0-9.-]+$') THEN RETURN 'bad_prop:' || k;
    ELSIF parts[1] = 'u' AND (jsonb_typeof(v) <> 'string' OR char_length(v#>>'{}') NOT BETWEEN 1 AND 100 OR (v#>>'{}') !~ '^[a-z0-9._-]+$') THEN RETURN 'bad_prop:' || k;
    ELSIF parts[1] = 'c' AND (jsonb_typeof(v) <> 'string' OR (v#>>'{}') !~ '^[a-z0-9_]{1,64}$') THEN RETURN 'bad_prop:' || k;
    ELSIF parts[1] = 'p' AND (jsonb_typeof(v) <> 'string' OR char_length(v#>>'{}') > 120 OR (v#>>'{}') !~ '^[a-z0-9:_./-]+$') THEN RETURN 'bad_prop:' || k;
    ELSIF parts[1] = 'e' AND NOT ((v#>>'{}') = ANY (string_to_array(parts[2], '|'))) THEN RETURN 'bad_prop:' || k;
    END IF;
  END LOOP;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.analytics_count(p_env text, p_outcome text, p_reason text, p_n bigint) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.analytics_ingest_stats (day, env, outcome, reason, n, last_at)
  SELECT (now() AT TIME ZONE public.analytics_tz())::date, p_env, p_outcome, coalesce(p_reason, ''), p_n, now() WHERE p_n > 0
  ON CONFLICT (day, env, outcome, reason) DO UPDATE SET n = public.analytics_ingest_stats.n + EXCLUDED.n, last_at = now()
$$;

-- ---------------------------------------------------------------- ingestion (service_role only)
-- p_meta: {"env": "live|test|dev", "ua_family": text, "bot": bool, "client_errors": int, "client_dropped": int}
CREATE OR REPLACE FUNCTION public.analytics_ingest(p_batch jsonb, p_meta jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_env text := coalesce(p_meta->>'env', '');
  v_ua text := left(nullif(regexp_replace(coalesce(p_meta->>'ua_family', ''), '[^A-Za-z0-9 ._-]', '', 'g'), ''), 40);
  v_bot boolean := coalesce(p_meta->>'bot', '') = 'true';
  v_cerr int := CASE WHEN coalesce(p_meta->>'client_errors', '') ~ '^[0-9]{1,6}$' THEN (p_meta->>'client_errors')::int ELSE 0 END;
  v_cdrop int := CASE WHEN coalesce(p_meta->>'client_dropped', '') ~ '^[0-9]{1,6}$' THEN (p_meta->>'client_dropped')::int ELSE 0 END;
  e jsonb; why text; n_acc int := 0; n_dup int := 0; n_rej int := 0; n_cap int := 0; n_bot int := 0;
  v_ts timestamptz; v_sid uuid; v_count int; v_rows int;
  reasons jsonb := '{}'::jsonb; r text;
BEGIN
  IF v_env NOT IN ('live', 'test', 'dev') THEN
    PERFORM public.analytics_count('unknown', 'rejected', 'bad_env', greatest(1, coalesce(jsonb_array_length(CASE WHEN jsonb_typeof(p_batch) = 'array' THEN p_batch END), 1)));
    RETURN jsonb_build_object('accepted', 0, 'rejected', 1, 'reason', 'bad_env');
  END IF;
  PERFORM public.analytics_count(v_env, 'client_error', '', least(v_cerr, 1000));
  PERFORM public.analytics_count(v_env, 'client_dropped', '', least(v_cdrop, 1000));
  IF jsonb_typeof(p_batch) IS DISTINCT FROM 'array' OR jsonb_array_length(p_batch) = 0 OR jsonb_array_length(p_batch) > 20 THEN
    PERFORM public.analytics_count(v_env, 'rejected', 'bad_batch', greatest(1, coalesce(jsonb_array_length(CASE WHEN jsonb_typeof(p_batch) = 'array' THEN p_batch END), 1)));
    RETURN jsonb_build_object('accepted', 0, 'rejected', 1, 'reason', 'bad_batch');
  END IF;
  FOR e IN SELECT value FROM jsonb_array_elements(p_batch) LOOP
    why := public.analytics_event_problem(e);
    IF why IS NOT NULL THEN
      n_rej := n_rej + 1; r := split_part(why, ':', 1) || CASE WHEN why LIKE '%:%' THEN ':' || split_part(why, ':', 2) ELSE '' END;
      reasons := jsonb_set(reasons, ARRAY[r], to_jsonb(coalesce((reasons->>r)::int, 0) + 1)); CONTINUE;
    END IF;
    v_sid := (e->>'sid')::uuid;
    SELECT count(*) INTO v_count FROM public.analytics_events WHERE sid = v_sid AND ts_server > now() - interval '24 hours';
    IF v_count >= 500 THEN n_cap := n_cap + 1; CONTINUE; END IF;      -- per-session cap (abuse / runaway client)
    v_ts := CASE WHEN e->>'ts_client' IS NULL THEN NULL ELSE (e->>'ts_client')::timestamptz END;
    IF v_ts IS NOT NULL AND abs(extract(epoch FROM (v_ts - now()))) > 86400 THEN v_ts := NULL; END IF;   -- skewed clock: dropped, event kept
    INSERT INTO public.analytics_events (event_id, env, name, ts_client, vid, sid, pv_id, seq, page, props, ua_family, viewport, bot)
    VALUES ((e->>'event_id')::uuid, v_env, e->>'name', v_ts, (e->>'vid')::uuid, v_sid, nullif(e->>'pv_id', '')::uuid,
            (e->>'seq')::int, e->>'page', coalesce(e->'props', '{}'::jsonb), v_ua, e->>'viewport', v_bot)
    ON CONFLICT (event_id) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 1 THEN n_acc := n_acc + 1; IF v_bot THEN n_bot := n_bot + 1; END IF; ELSE n_dup := n_dup + 1; END IF;
  END LOOP;
  PERFORM public.analytics_count(v_env, 'accepted', '', n_acc);
  PERFORM public.analytics_count(v_env, 'bot', '', n_bot);
  PERFORM public.analytics_count(v_env, 'duplicate', '', n_dup);
  PERFORM public.analytics_count(v_env, 'capped', '', n_cap);
  FOR r IN SELECT jsonb_object_keys(reasons) LOOP PERFORM public.analytics_count(v_env, 'rejected', left(r, 60), (reasons->>r)::bigint); END LOOP;
  RETURN jsonb_build_object('accepted', n_acc, 'duplicate', n_dup, 'rejected', n_rej, 'capped', n_cap);
END $$;

-- ---------------------------------------------------------------- rollup (idempotent per day and environment)
CREATE OR REPLACE FUNCTION public.analytics_channel(p_ref text, p_utm_source text, p_utm_medium text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN p_utm_source IS NOT NULL OR p_utm_medium IS NOT NULL THEN 'campaign'
    WHEN p_ref IS NULL OR p_ref = '' THEN 'direct'
    WHEN p_ref ~ '(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com|yandex\.[a-z]+|ecosia\.org|search\.brave\.com|baidu\.com)$' THEN 'organic'
    WHEN p_ref ~ '(^|\.)(chatgpt\.com|chat\.openai\.com|perplexity\.ai|claude\.ai|copilot\.microsoft\.com|gemini\.google\.com)$' THEN 'ai_assistant'
    WHEN p_ref ~ '(^|\.)(facebook\.com|fb\.com|instagram\.com|reddit\.com|youtube\.com|youtu\.be|x\.com|twitter\.com|t\.co|tiktok\.com|pinterest\.com|linkedin\.com|threads\.net)$' THEN 'social'
    ELSE 'referral' END
$$;

CREATE OR REPLACE FUNCTION public.analytics_rollup(p_day date) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE tz text := public.analytics_tz(); d0 timestamptz; d1 timestamptz;
BEGIN
  d0 := (p_day::timestamp AT TIME ZONE tz); d1 := ((p_day + 1)::timestamp AT TIME ZONE tz);
  DELETE FROM public.analytics_sessions WHERE day = p_day;
  DELETE FROM public.analytics_daily WHERE day = p_day;

  -- sessions: the client's sid, split again on the server at gaps of more than 30 minutes (and at local midnight)
  WITH ev AS (
    SELECT e.*, CASE WHEN lag(e.ts_server) OVER w IS NULL OR e.ts_server - lag(e.ts_server) OVER w > interval '30 minutes' THEN 1 ELSE 0 END AS brk
    FROM public.analytics_events e WHERE e.ts_server >= d0 AND e.ts_server < d1
    WINDOW w AS (PARTITION BY e.env, e.sid ORDER BY e.ts_server, e.seq, e.id)),
  seg AS (SELECT ev.*, sum(brk) OVER (PARTITION BY env, sid ORDER BY ts_server, seq, id ROWS UNBOUNDED PRECEDING) AS segno FROM ev),
  pv AS (SELECT DISTINCT ON (env, sid, segno) env, sid, segno, page, props FROM seg WHERE name = 'page_view' ORDER BY env, sid, segno, ts_server, seq, id),
  pvl AS (SELECT DISTINCT ON (env, sid, segno) env, sid, segno, page FROM seg WHERE name = 'page_view' ORDER BY env, sid, segno, ts_server DESC, seq DESC, id DESC),
  eng AS (SELECT env, sid, segno, pv_id, least(sum(coalesce((props->>'engaged_ms')::bigint, 0) + coalesce((props->>'engaged_ms_delta')::bigint, 0)), 1800000) AS ms
          FROM seg WHERE name IN ('page_leave', 'page_ping') GROUP BY env, sid, segno, pv_id),
  agg AS (
    SELECT s.env, s.sid, s.segno, min(s.vid::text)::uuid AS vid, min(s.ts_server) AS started_at, max(s.ts_server) AS ended_at,
           count(*) FILTER (WHERE s.name = 'page_view') AS page_views,
           count(*) FILTER (WHERE s.name IN ('calc_complete', 'trial_click', 'checkout_redirect', 'signin_request', 'premium_offer_view')
                             OR (s.name = 'search' AND s.props ? 'clicked_rank')) AS key_events,
           bool_or(s.bot) AS bot_flag, count(*) AS n_events,
           count(*) FILTER (WHERE s.name = 'page_view') / greatest(extract(epoch FROM max(s.ts_server) - min(s.ts_server)) / 60.0, 1) AS pv_per_min
    FROM seg s GROUP BY s.env, s.sid, s.segno)
  INSERT INTO public.analytics_sessions (skey, sid, vid, env, day, started_at, ended_at, landing_page, exit_page, page_views, engaged_ms,
                                         key_events, engaged, channel, ref_host, utm_source, utm_medium, utm_campaign, is_new, bot)
  SELECT a.sid::text || ':' || p_day::text || ':' || a.segno, a.sid, a.vid, a.env, p_day, a.started_at, a.ended_at, pv.page, pvl.page,
         a.page_views, coalesce(x.ms, 0), a.key_events,
         (coalesce(x.ms, 0) >= 10000 OR a.page_views >= 2 OR a.key_events > 0),
         public.analytics_channel(pv.props->>'ref_host', pv.props->>'utm_source', pv.props->>'utm_medium'),
         pv.props->>'ref_host', pv.props->>'utm_source', pv.props->>'utm_medium', pv.props->>'utm_campaign',
         (pv.props->>'is_new_visitor')::boolean,
         (a.bot_flag OR a.n_events > 300 OR (a.page_views > 30 AND a.pv_per_min > 30))
  FROM agg a
  LEFT JOIN pv  ON pv.env = a.env AND pv.sid = a.sid AND pv.segno = a.segno
  LEFT JOIN pvl ON pvl.env = a.env AND pvl.sid = a.sid AND pvl.segno = a.segno
  LEFT JOIN (SELECT env, sid, segno, sum(ms) AS ms FROM eng GROUP BY env, sid, segno) x ON x.env = a.env AND x.sid = a.sid AND x.segno = a.segno;

  -- daily metrics (bot sessions excluded; their volume is kept as its own metric)
  WITH good AS (
    SELECT e.* FROM public.analytics_events e
    WHERE e.ts_server >= d0 AND e.ts_server < d1 AND NOT e.bot
      AND NOT EXISTS (SELECT 1 FROM public.analytics_sessions s WHERE s.day = p_day AND s.sid = e.sid AND s.env = e.env AND s.bot)),
  m AS (
    SELECT env, 'pv' AS metric, page AS dim, count(*)::numeric AS value FROM good WHERE name = 'page_view' GROUP BY env, page
    UNION ALL SELECT env, 'pv_engaged_ms', page, sum(ms) FROM (SELECT env, page, pv_id, least(sum(coalesce((props->>'engaged_ms')::bigint, 0) + coalesce((props->>'engaged_ms_delta')::bigint, 0)), 1800000) AS ms
              FROM good WHERE name IN ('page_leave', 'page_ping') GROUP BY env, page, pv_id) pe GROUP BY env, page
    UNION ALL SELECT env, 'pv_leaves', page, count(*) FROM good WHERE name = 'page_leave' GROUP BY env, page
    UNION ALL SELECT env, 'calc_' || substr(name, 6), props->>'calc_id', count(*) FROM good WHERE name IN ('calc_view', 'calc_start', 'calc_complete') GROUP BY env, name, props->>'calc_id'
    UNION ALL SELECT env, 'calc_ms_to_complete', props->>'calc_id', sum((props->>'ms_to_complete')::bigint) FROM good WHERE name = 'calc_complete' GROUP BY env, props->>'calc_id'
    UNION ALL SELECT st.env, 'calc_abandon', st.props->>'calc_id', count(*) FROM good st
              WHERE st.name = 'calc_start' AND NOT EXISTS (SELECT 1 FROM good c WHERE c.name = 'calc_complete' AND c.pv_id = st.pv_id AND c.props->>'calc_id' = st.props->>'calc_id')
              GROUP BY st.env, st.props->>'calc_id'
    UNION ALL SELECT env, 'premium_gate_view', props->>'calc_id', count(*) FROM good WHERE name = 'premium_gate_view' GROUP BY env, props->>'calc_id'
    UNION ALL SELECT env, 'nav', props->>'element', count(*) FROM good WHERE name = 'nav_click' GROUP BY env, props->>'element'
    UNION ALL SELECT env, 'nav_path', left(page || '>' || (props->>'to_page'), 250), count(*) FROM good WHERE name = 'nav_click' GROUP BY env, page, props->>'to_page'
    UNION ALL SELECT env, 'search', '', count(*) FROM good WHERE name = 'search' GROUP BY env
    UNION ALL SELECT env, 'search_zero', '', count(*) FROM good WHERE name = 'search' AND (props->>'result_count')::int = 0 GROUP BY env
    UNION ALL SELECT env, 'search_click', '', count(*) FROM good WHERE name = 'search' AND props ? 'clicked_rank' GROUP BY env
    UNION ALL SELECT env, 'funnel_events', name || CASE WHEN name = 'checkout_return' THEN ':' || (props->>'outcome') ELSE '' END, count(*)
              FROM good WHERE name IN ('premium_gate_view', 'premium_offer_view', 'signin_request', 'signin_complete', 'trial_click', 'checkout_redirect', 'checkout_return', 'portal_open')
              GROUP BY env, name, props->>'outcome'
    UNION ALL SELECT env, 'funnel_sessions', name || CASE WHEN name = 'checkout_return' THEN ':' || (props->>'outcome') ELSE '' END, count(DISTINCT sid)
              FROM good WHERE name IN ('premium_gate_view', 'premium_offer_view', 'signin_request', 'signin_complete', 'trial_click', 'checkout_redirect', 'checkout_return', 'portal_open')
              GROUP BY env, name, props->>'outcome'
    UNION ALL SELECT env, 'unit_toggle', props->>'to', count(*) FROM good WHERE name = 'calc_unit_toggle' GROUP BY env, props->>'to'
    UNION ALL SELECT env, 'help_open', props->>'calc_id', count(*) FROM good WHERE name = 'calc_help_open' GROUP BY env, props->>'calc_id'
    UNION ALL SELECT env, 'entrances', landing_page, count(*) FROM public.analytics_sessions WHERE day = p_day AND NOT bot AND landing_page IS NOT NULL GROUP BY env, landing_page
    UNION ALL SELECT env, 'exits', exit_page, count(*) FROM public.analytics_sessions WHERE day = p_day AND NOT bot AND exit_page IS NOT NULL GROUP BY env, exit_page
    UNION ALL SELECT env, 'bot_sessions', '', count(*) FROM public.analytics_sessions WHERE day = p_day AND bot GROUP BY env)
  INSERT INTO public.analytics_daily (day, env, metric, dim, value)
  SELECT p_day, env, metric, coalesce(dim, ''), sum(value) FROM m WHERE value IS NOT NULL GROUP BY env, metric, coalesce(dim, '');

  INSERT INTO public.analytics_rollup_runs (day, env, ran_at)
  SELECT p_day, x.env, now() FROM (VALUES ('live'), ('test'), ('dev')) x(env)
  ON CONFLICT (day, env) DO UPDATE SET ran_at = now();
END $$;

-- Retention: raw events 90 days, sessions and ingestion counters 13 months, daily rollups kept.
-- Each day is rolled up once more before its raw events are deleted.
CREATE OR REPLACE FUNCTION public.analytics_purge() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cutoff date := (now() AT TIME ZONE public.analytics_tz())::date - 90; d date; n_ev bigint; n_s bigint; n_st bigint;
BEGIN
  FOR d IN SELECT DISTINCT (ts_server AT TIME ZONE public.analytics_tz())::date FROM public.analytics_events
           WHERE ts_server < (cutoff::timestamp AT TIME ZONE public.analytics_tz()) LOOP
    PERFORM public.analytics_rollup(d);
  END LOOP;
  PERFORM set_config('analytics.purge', 'on', true);
  DELETE FROM public.analytics_events WHERE ts_server < (cutoff::timestamp AT TIME ZONE public.analytics_tz());
  GET DIAGNOSTICS n_ev = ROW_COUNT;
  PERFORM set_config('analytics.purge', 'off', true);
  DELETE FROM public.analytics_sessions WHERE day < (now() AT TIME ZONE public.analytics_tz())::date - 396;
  GET DIAGNOSTICS n_s = ROW_COUNT;
  DELETE FROM public.analytics_ingest_stats WHERE day < (now() AT TIME ZONE public.analytics_tz())::date - 396;
  GET DIAGNOSTICS n_st = ROW_COUNT;
  RETURN jsonb_build_object('events', n_ev, 'sessions', n_s, 'stats', n_st);
END $$;

CREATE OR REPLACE FUNCTION public.analytics_refresh() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE today date := (now() AT TIME ZONE public.analytics_tz())::date;
BEGIN
  PERFORM public.analytics_require_owner();
  PERFORM public.analytics_rollup(today - 1);
  PERFORM public.analytics_rollup(today);
END $$;

-- ---------------------------------------------------------------- billing metrics (0402 tables, LIVE-mode Stripe data only)
-- A subscription counts only if a Stripe event with livemode = true refers to it. Until any live event exists the result
-- is {"status":"pending"}; test-mode rows (Stripe test mode, PR #28) are never counted.
CREATE OR REPLACE FUNCTION public.analytics_billing_metrics(p_from date, p_to date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE tz text := public.analytics_tz(); t0 timestamptz; t1 timestamptz; r jsonb;
BEGIN
  PERFORM public.analytics_require_owner();
  t0 := (p_from::timestamp AT TIME ZONE tz); t1 := ((p_to + 1)::timestamp AT TIME ZONE tz);
  IF NOT EXISTS (SELECT 1 FROM public.stripe_events WHERE payload->>'livemode' = 'true') THEN
    RETURN jsonb_build_object('status', 'pending', 'reason', 'No live-mode Stripe data yet (test-mode data is never counted).');
  END IF;
  WITH live_ev AS (
    SELECT e.event_type, e.stripe_created_at, e.payload,
           coalesce(e.payload #>> '{data,object,subscription}', e.payload #>> '{data,object,parent,subscription_details,subscription}',
                    CASE WHEN e.payload #>> '{data,object,object}' = 'subscription' THEN e.payload #>> '{data,object,id}' END) AS sub_id
    FROM public.stripe_events e WHERE e.payload->>'livemode' = 'true'),
  live_subs AS (SELECT s.*, p.unit_amount, p.billing_interval FROM public.subscriptions s
                LEFT JOIN public.plan_prices p ON p.stripe_price_id = s.stripe_price_id
                WHERE s.stripe_subscription_id IN (SELECT sub_id FROM live_ev WHERE sub_id IS NOT NULL)),
  paying AS (SELECT * FROM live_subs WHERE status IN ('active', 'past_due') AND current_period_end > now()),
  first_paid AS (SELECT sub_id, min(stripe_created_at) AS at FROM live_ev
                 WHERE event_type = 'invoice.paid' AND coalesce((payload #>> '{data,object,amount_paid}')::bigint, 0) > 0 GROUP BY sub_id),
  start_paying AS (SELECT count(*) AS n FROM live_subs WHERE status IN ('active', 'past_due', 'canceled', 'unpaid')
                   AND created_at < t0 AND (canceled_at IS NULL OR canceled_at >= t0)
                   AND stripe_subscription_id IN (SELECT sub_id FROM first_paid WHERE at < t0))
  SELECT jsonb_build_object(
    'status', 'live',
    'trials_started', (SELECT count(DISTINCT sub_id) FROM live_ev WHERE event_type = 'customer.subscription.created'
                        AND payload #>> '{data,object,status}' = 'trialing' AND stripe_created_at >= t0 AND stripe_created_at < t1),
    'trialing_now', (SELECT count(*) FROM live_subs WHERE status = 'trialing'),
    'paid_conversions', (SELECT count(*) FROM first_paid WHERE at >= t0 AND at < t1),
    'active_paying', (SELECT count(*) FROM paying),
    'mrr_cents', (SELECT coalesce(sum(CASE billing_interval WHEN 'year' THEN unit_amount / 12.0 ELSE unit_amount END), 0)::bigint FROM paying),
    'arr_cents', (SELECT coalesce(sum(CASE billing_interval WHEN 'year' THEN unit_amount ELSE unit_amount * 12 END), 0)::bigint FROM paying),
    'renewals', (SELECT count(*) FROM live_ev WHERE event_type = 'invoice.paid' AND payload #>> '{data,object,billing_reason}' = 'subscription_cycle'
                  AND stripe_created_at >= t0 AND stripe_created_at < t1),
    'failed_payments', (SELECT count(DISTINCT payload #>> '{data,object,id}') FROM live_ev WHERE event_type = 'invoice.payment_failed'
                         AND stripe_created_at >= t0 AND stripe_created_at < t1),
    'cancellations', (SELECT count(*) FROM live_subs WHERE canceled_at >= t0 AND canceled_at < t1),
    'scheduled_cancellations', (SELECT count(*) FROM live_subs WHERE cancel_at_period_end AND status IN ('active', 'trialing', 'past_due')),
    'churn_rate', (SELECT CASE WHEN sp.n = 0 THEN NULL ELSE round((SELECT count(*) FROM live_subs WHERE canceled_at >= t0 AND canceled_at < t1
                     AND stripe_subscription_id IN (SELECT sub_id FROM first_paid WHERE at < t0))::numeric / sp.n, 4) END FROM start_paying sp)
  ) INTO r;
  RETURN r;
END $$;

-- ---------------------------------------------------------------- the owner dashboard report (aggregates only)
CREATE OR REPLACE FUNCTION public.analytics_dashboard(p_from date, p_to date, p_env text DEFAULT 'live') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE len int; pf date; pt date; r jsonb;
BEGIN
  PERFORM public.analytics_require_owner();
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to OR p_to - p_from > 400 THEN RAISE EXCEPTION 'ANALYTICS_BAD_RANGE' USING ERRCODE = '22023'; END IF;
  IF p_env NOT IN ('live', 'test', 'dev') THEN RAISE EXCEPTION 'ANALYTICS_BAD_ENV' USING ERRCODE = '22023'; END IF;
  len := p_to - p_from + 1; pt := p_from - 1; pf := pt - len + 1;
  WITH s AS (SELECT * FROM public.analytics_sessions WHERE env = p_env AND NOT bot AND day BETWEEN p_from AND p_to),
       sp AS (SELECT * FROM public.analytics_sessions WHERE env = p_env AND NOT bot AND day BETWEEN pf AND pt),
       d AS (SELECT metric, dim, sum(value) AS v FROM public.analytics_daily WHERE env = p_env AND day BETWEEN p_from AND p_to GROUP BY metric, dim)
  SELECT jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to, 'previous_from', pf, 'previous_to', pt, 'env', p_env, 'timezone', public.analytics_tz()),
    'kpis', (SELECT jsonb_build_object('visitors', count(DISTINCT vid), 'sessions', count(*), 'page_views', coalesce(sum(page_views), 0),
              'engaged_sessions', count(*) FILTER (WHERE engaged), 'avg_engaged_ms', coalesce(round(avg(engaged_ms)), 0),
              'pages_per_session', coalesce(round(avg(page_views)::numeric, 2), 0),
              'new_visitors', count(DISTINCT vid) FILTER (WHERE is_new), 'returning_visitors', count(DISTINCT vid) FILTER (WHERE is_new = false)) FROM s),
    'kpis_previous', (SELECT jsonb_build_object('visitors', count(DISTINCT vid), 'sessions', count(*), 'page_views', coalesce(sum(page_views), 0),
              'engaged_sessions', count(*) FILTER (WHERE engaged), 'avg_engaged_ms', coalesce(round(avg(engaged_ms)), 0),
              'pages_per_session', coalesce(round(avg(page_views)::numeric, 2), 0),
              'new_visitors', count(DISTINCT vid) FILTER (WHERE is_new), 'returning_visitors', count(DISTINCT vid) FILTER (WHERE is_new = false)) FROM sp),
    'trend', (SELECT coalesce(jsonb_agg(jsonb_build_object('day', g.day::date, 'visitors', coalesce(x.visitors, 0), 'sessions', coalesce(x.sessions, 0),
               'page_views', coalesce(x.pv, 0)) ORDER BY g.day), '[]'::jsonb)
              FROM generate_series(p_from, p_to, interval '1 day') g(day)
              LEFT JOIN (SELECT day, count(DISTINCT vid) AS visitors, count(*) AS sessions, sum(page_views) AS pv FROM s GROUP BY day) x ON x.day = g.day::date),
    'pages', (SELECT coalesce(jsonb_agg(jsonb_build_object('page', p.dim, 'views', p.v,
               'entrances', coalesce((SELECT v FROM d WHERE metric = 'entrances' AND dim = p.dim), 0),
               'exits', coalesce((SELECT v FROM d WHERE metric = 'exits' AND dim = p.dim), 0),
               'engaged_ms', coalesce((SELECT v FROM d WHERE metric = 'pv_engaged_ms' AND dim = p.dim), 0),
               'leaves', coalesce((SELECT v FROM d WHERE metric = 'pv_leaves' AND dim = p.dim), 0)) ORDER BY p.v DESC), '[]'::jsonb)
              FROM (SELECT dim, v FROM d WHERE metric = 'pv' ORDER BY v DESC LIMIT 1000) p),
    'channels', (SELECT coalesce(jsonb_agg(jsonb_build_object('channel', channel, 'sessions', n, 'engaged', e) ORDER BY n DESC), '[]'::jsonb)
                 FROM (SELECT channel, count(*) n, count(*) FILTER (WHERE engaged) e FROM s GROUP BY channel) x),
    'referrers', (SELECT coalesce(jsonb_agg(jsonb_build_object('host', ref_host, 'sessions', n) ORDER BY n DESC), '[]'::jsonb)
                  FROM (SELECT ref_host, count(*) n FROM s WHERE ref_host IS NOT NULL GROUP BY ref_host ORDER BY count(*) DESC LIMIT 50) x),
    'campaigns', (SELECT coalesce(jsonb_agg(jsonb_build_object('source', utm_source, 'medium', utm_medium, 'campaign', utm_campaign, 'sessions', n, 'engaged', e) ORDER BY n DESC), '[]'::jsonb)
                  FROM (SELECT utm_source, utm_medium, utm_campaign, count(*) n, count(*) FILTER (WHERE engaged) e FROM s
                        WHERE channel = 'campaign' GROUP BY 1, 2, 3 ORDER BY count(*) DESC LIMIT 50) x),
    'calculators', (SELECT coalesce(jsonb_agg(jsonb_build_object('calc_id', c.dim, 'views', c.views, 'starts', c.starts, 'completes', c.completes,
                      'abandons', c.abandons, 'ms_to_complete', c.ms, 'premium_gate_views', c.gates) ORDER BY c.views DESC, c.dim), '[]'::jsonb)
                    FROM (SELECT dim, coalesce(sum(v) FILTER (WHERE metric = 'calc_view'), 0) AS views, coalesce(sum(v) FILTER (WHERE metric = 'calc_start'), 0) AS starts,
                                 coalesce(sum(v) FILTER (WHERE metric = 'calc_complete'), 0) AS completes, coalesce(sum(v) FILTER (WHERE metric = 'calc_abandon'), 0) AS abandons,
                                 coalesce(sum(v) FILTER (WHERE metric = 'calc_ms_to_complete'), 0) AS ms, coalesce(sum(v) FILTER (WHERE metric = 'premium_gate_view'), 0) AS gates
                          FROM d WHERE metric IN ('calc_view', 'calc_start', 'calc_complete', 'calc_abandon', 'calc_ms_to_complete', 'premium_gate_view') GROUP BY dim) c),
    'navigation', jsonb_build_object(
        'by_element', (SELECT coalesce(jsonb_object_agg(dim, v), '{}'::jsonb) FROM d WHERE metric = 'nav'),
        'top_paths', (SELECT coalesce(jsonb_agg(jsonb_build_object('path', dim, 'n', v) ORDER BY v DESC), '[]'::jsonb) FROM (SELECT dim, v FROM d WHERE metric = 'nav_path' ORDER BY v DESC LIMIT 30) x)),
    'search', jsonb_build_object('searches', coalesce((SELECT v FROM d WHERE metric = 'search'), 0), 'zero_results', coalesce((SELECT v FROM d WHERE metric = 'search_zero'), 0),
                                 'result_clicks', coalesce((SELECT v FROM d WHERE metric = 'search_click'), 0)),
    'funnel', (SELECT coalesce(jsonb_agg(jsonb_build_object('step', st.step, 'sessions', coalesce((SELECT v FROM d WHERE metric = 'funnel_sessions' AND dim = st.step), 0),
                 'events', coalesce((SELECT v FROM d WHERE metric = 'funnel_events' AND dim = st.step), 0)) ORDER BY st.ord), '[]'::jsonb)
               FROM unnest(ARRAY['premium_gate_view', 'premium_offer_view', 'signin_request', 'signin_complete', 'trial_click', 'checkout_redirect',
                                 'checkout_return:success', 'checkout_return:cancelled', 'portal_open']) WITH ORDINALITY st(step, ord)),
    'health', jsonb_build_object(
        'by_day', (SELECT coalesce(jsonb_agg(jsonb_build_object('day', day, 'outcome', outcome, 'reason', reason, 'n', n) ORDER BY day, outcome, reason), '[]'::jsonb)
                   FROM public.analytics_ingest_stats WHERE env = p_env AND day BETWEEN p_from AND p_to),
        'totals', (SELECT coalesce(jsonb_object_agg(outcome, n), '{}'::jsonb) FROM (SELECT outcome, sum(n) n FROM public.analytics_ingest_stats
                   WHERE env = p_env AND day BETWEEN p_from AND p_to GROUP BY outcome) x),
        'last_event_at', (SELECT max(ts_server) FROM public.analytics_events WHERE env = p_env),
        'last_rollup_at', (SELECT max(ran_at) FROM public.analytics_rollup_runs WHERE env = p_env),
        'bot_sessions', coalesce((SELECT v FROM d WHERE metric = 'bot_sessions'), 0),
        'raw_retention_days', 90),
    'billing', public.analytics_billing_metrics(p_from, p_to)
  ) INTO r;
  RETURN r;
END $$;

-- ---------------------------------------------------------------- function privileges
DO $$ DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['analytics_events_guard()', 'analytics_is_owner()', 'analytics_require_owner()', 'analytics_prop_spec(text)',
      'analytics_event_problem(jsonb)', 'analytics_count(text, text, text, bigint)', 'analytics_ingest(jsonb, jsonb)', 'analytics_channel(text, text, text)',
      'analytics_rollup(date)', 'analytics_purge()', 'analytics_refresh()', 'analytics_billing_metrics(date, date)', 'analytics_dashboard(date, date, text)', 'analytics_tz()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated, service_role', f);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.analytics_ingest(jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.analytics_dashboard(date, date, text), public.analytics_refresh(), public.analytics_billing_metrics(date, date),
                          public.analytics_is_owner() TO authenticated;

-- ---------------------------------------------------------------- scheduled jobs (pg_cron, when available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.schedule('analytics-rollup-recent', '*/15 * * * *',
      $job$SELECT public.analytics_rollup(((now() AT TIME ZONE 'America/New_York')::date)); SELECT public.analytics_rollup(((now() AT TIME ZONE 'America/New_York')::date - 1));$job$);
    PERFORM cron.schedule('analytics-purge', '17 4 * * *', $job$SELECT public.analytics_purge();$job$);
  ELSE
    RAISE NOTICE 'pg_cron is not available: analytics rollups run only through analytics_refresh() (owner) until it is.';
  END IF;
END $$;

-- ---------------------------------------------------------------- post-conditions
DO $$ DECLARE t text; p text;
BEGIN
  FOREACH t IN ARRAY ARRAY['analytics_owners','analytics_events','analytics_ingest_stats','analytics_sessions','analytics_daily','analytics_rollup_runs'] LOOP
    IF NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'ANALYTICS_0501_POSTCONDITION: RLS not enabled and forced on %', t; END IF;
    FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF has_table_privilege('authenticated', 'public.' || t, p) OR has_table_privilege('anon', 'public.' || t, p)
         OR has_table_privilege('service_role', 'public.' || t, p) THEN
        RAISE EXCEPTION 'ANALYTICS_0501_POSTCONDITION: a client role holds % on %', p, t; END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t) THEN
      RAISE EXCEPTION 'ANALYTICS_0501_POSTCONDITION: a policy exists on %', t; END IF;
  END LOOP;
  IF has_function_privilege('anon', 'public.analytics_ingest(jsonb, jsonb)', 'EXECUTE') OR has_function_privilege('authenticated', 'public.analytics_ingest(jsonb, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.analytics_dashboard(date, date, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.analytics_rollup(date)', 'EXECUTE') OR has_function_privilege('authenticated', 'public.analytics_purge()', 'EXECUTE') THEN
    RAISE EXCEPTION 'ANALYTICS_0501_POSTCONDITION: function privileges too broad'; END IF;
  IF has_sequence_privilege('anon', 'public.analytics_events_id_seq', 'USAGE') OR has_sequence_privilege('authenticated', 'public.analytics_events_id_seq', 'USAGE') THEN
    RAISE EXCEPTION 'ANALYTICS_0501_POSTCONDITION: a client role can use the events sequence'; END IF;
END $$;

COMMIT;
