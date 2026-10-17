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

  delete from public.private_catalog_products where true;

  insert into public.private_catalog_products (sku, product, updated_at)
  select trim(entry.value ->> 'sku'), entry.value, now()
  from jsonb_array_elements(p_products) as entry(value);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
