alter table public.private_catalog_customer_access
  alter column code_id drop not null;

create table public.private_catalog_active_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, session_id)
);

create index private_catalog_active_sessions_last_seen_idx
  on public.private_catalog_active_sessions (last_seen_at desc);

alter table public.private_catalog_active_sessions enable row level security;
revoke all on public.private_catalog_active_sessions from public, anon, authenticated;
grant all on public.private_catalog_active_sessions to service_role;

create or replace function public.private_catalog_reserve_session(
  p_user_id uuid,
  p_session_id uuid,
  p_max_sessions integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_access public.private_catalog_customer_access%rowtype;
  v_active_count integer;
begin
  if p_max_sessions < 1 or p_max_sessions > 3 then
    raise exception 'Session limit must be between 1 and 3.';
  end if;

  perform pg_advisory_xact_lock(hashtext('private_catalog_active_sessions'));

  select * into v_access
  from public.private_catalog_customer_access
  where user_id = p_user_id;

  if not found or v_access.blocked_at is not null or v_access.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'access_inactive');
  end if;

  delete from public.private_catalog_active_sessions
  where last_seen_at < now() - interval '90 seconds';

  insert into public.private_catalog_active_sessions (user_id, session_id, last_seen_at)
  values (p_user_id, p_session_id, now())
  on conflict (user_id, session_id) do update set last_seen_at = excluded.last_seen_at;

  select count(*) into v_active_count
  from public.private_catalog_active_sessions;

  if v_active_count > p_max_sessions then
    delete from public.private_catalog_active_sessions
    where user_id = p_user_id and session_id = p_session_id;
    return jsonb_build_object('ok', false, 'error', 'session_limit', 'active_sessions', p_max_sessions);
  end if;

  return jsonb_build_object(
    'ok', true,
    'active_sessions', v_active_count,
    'expires_at', v_access.expires_at
  );
end;
$$;

create or replace function public.private_catalog_release_session(
  p_user_id uuid,
  p_session_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.private_catalog_active_sessions
  where user_id = p_user_id and session_id = p_session_id;
$$;

revoke all on function public.private_catalog_reserve_session(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.private_catalog_release_session(uuid, uuid) from public, anon, authenticated;
grant execute on function public.private_catalog_reserve_session(uuid, uuid, integer) to service_role;
grant execute on function public.private_catalog_release_session(uuid, uuid) to service_role;
