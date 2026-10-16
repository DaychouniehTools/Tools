create table public.private_catalog_products (
  sku text primary key,
  product jsonb not null,
  updated_at timestamptz not null default now(),
  constraint products_sku_not_empty check (length(trim(sku)) between 1 and 128)
);

create table public.private_catalog_access_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null unique,
  duration_seconds integer not null check (duration_seconds between 3600 and 31536000),
  created_at timestamptz not null default now(),
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  constraint access_codes_email_not_empty check (length(trim(email)) > 3)
);

create table public.private_catalog_customer_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code_id uuid not null references public.private_catalog_access_codes(id),
  email text not null,
  full_name text not null default '',
  expires_at timestamptz not null,
  blocked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.private_catalog_access_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  ip_address text not null default '',
  accessed_at timestamptz not null default now()
);

create index private_catalog_access_logs_accessed_at_idx on public.private_catalog_access_logs (accessed_at desc);
create index private_catalog_access_logs_user_id_idx on public.private_catalog_access_logs (user_id, accessed_at desc);

create extension if not exists pg_cron with schema pg_catalog;

alter table public.private_catalog_products enable row level security;
alter table public.private_catalog_access_codes enable row level security;
alter table public.private_catalog_customer_access enable row level security;
alter table public.private_catalog_access_logs enable row level security;

revoke all on public.private_catalog_products, public.private_catalog_access_codes,
  public.private_catalog_customer_access, public.private_catalog_access_logs
  from public, anon, authenticated;
grant all on public.private_catalog_products, public.private_catalog_access_codes,
  public.private_catalog_customer_access, public.private_catalog_access_logs to service_role;
grant usage, select on sequence public.private_catalog_access_logs_id_seq to service_role;

insert into storage.buckets (id, name, public)
values ('catalog-images', 'catalog-images', false)
on conflict (id) do update set public = false;

create or replace function public.private_catalog_redeem_code(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code public.private_catalog_access_codes%rowtype;
  v_access public.private_catalog_customer_access%rowtype;
  v_now timestamptz := now();
begin
  select * into v_code
  from public.private_catalog_access_codes
  where code_hash = p_code_hash
  for update;

  if not found or v_code.revoked_at is not null
     or lower(v_code.email) <> lower(trim(p_email)) then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select * into v_access
  from public.private_catalog_customer_access
  where user_id = p_user_id
  for update;

  if v_code.redeemed_by is not null then
    if v_code.redeemed_by <> p_user_id then
      return jsonb_build_object('ok', false, 'error', 'invalid_code');
    end if;
    if not found or v_access.blocked_at is not null then
      return jsonb_build_object('ok', false, 'error', 'access_blocked');
    end if;
    if v_access.expires_at <= v_now then
      return jsonb_build_object('ok', false, 'error', 'access_expired');
    end if;
    return jsonb_build_object('ok', true, 'expires_at', v_access.expires_at);
  end if;

  if found and v_access.blocked_at is not null then
    return jsonb_build_object('ok', false, 'error', 'access_blocked');
  end if;

  update public.private_catalog_access_codes
  set redeemed_by = p_user_id, redeemed_at = v_now
  where id = v_code.id;

  insert into public.private_catalog_customer_access (
    user_id, code_id, email, full_name, expires_at, blocked_at, updated_at
  )
  values (
    p_user_id, v_code.id, lower(trim(p_email)), coalesce(p_full_name, ''),
    v_now + make_interval(secs => v_code.duration_seconds), null, v_now
  )
  on conflict (user_id) do update
  set code_id = excluded.code_id,
      email = excluded.email,
      full_name = excluded.full_name,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at;

  return jsonb_build_object(
    'ok', true,
    'expires_at', v_now + make_interval(secs => v_code.duration_seconds)
  );
end;
$$;

create or replace function public.private_catalog_replace_products(p_products jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if jsonb_typeof(p_products) <> 'array' then
    raise exception 'Products must be a JSON array.';
  end if;

  delete from public.private_catalog_products;

  insert into public.private_catalog_products (sku, product, updated_at)
  select trim(entry.value ->> 'sku'), entry.value, now()
  from jsonb_array_elements(p_products) as entry(value);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.private_catalog_redeem_code(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.private_catalog_replace_products(jsonb) from public, anon, authenticated;
grant execute on function public.private_catalog_redeem_code(uuid, text, text, text) to service_role;
grant execute on function public.private_catalog_replace_products(jsonb) to service_role;

select cron.schedule(
  'purge-private-catalog-access-logs',
  '*/15 * * * *',
  $job$delete from public.private_catalog_access_logs where accessed_at < now() - interval '24 hours';$job$
);
