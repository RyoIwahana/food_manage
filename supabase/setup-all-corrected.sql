-- KITCHEN STOCK shared workspace schema
-- Run this once in Supabase SQL Editor. Do not put keys in this file.
create extension if not exists pgcrypto;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.store_members (
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner','staff')),
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  category text not null default 'その他',
  unit text not null default '個',
  stock numeric,
  target_stock numeric,
  price numeric,
  supplier text not null default '',
  notes text not null default '',
  archived boolean not null default false,
  source text,
  icon text,
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  movement_type text not null,
  quantity numeric,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  supplier text not null,
  status text not null default '発注済み' check (status in ('発注済み','入荷済み','キャンセル')),
  ordered_at timestamptz not null default now(),
  received_at timestamptz
);

create table if not exists public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric not null check (quantity > 0),
  unit_price numeric
);

create table if not exists public.store_state (
  store_id uuid primary key references public.stores(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create index if not exists products_store_id_idx on public.products(store_id);
create index if not exists stock_movements_store_id_idx on public.stock_movements(store_id, created_at desc);
create index if not exists orders_store_id_idx on public.orders(store_id, ordered_at desc);

create or replace function public.is_store_member(target_store uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.store_members
  where store_id = target_store and user_id = auth.uid()
) $$;

alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.store_state enable row level security;

drop policy if exists stores_member_read on public.stores;
create policy stores_member_read on public.stores for select using (public.is_store_member(id));
drop policy if exists members_self_read on public.store_members;
create policy members_self_read on public.store_members for select using (user_id = auth.uid());
drop policy if exists products_member_all on public.products;
create policy products_member_all on public.products for all using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
drop policy if exists movements_member_all on public.stock_movements;
create policy movements_member_all on public.stock_movements for all using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
drop policy if exists orders_member_all on public.orders;
create policy orders_member_all on public.orders for all using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));
drop policy if exists order_lines_member_all on public.order_lines;
create policy order_lines_member_all on public.order_lines for all using (
  exists (select 1 from public.orders o where o.id = order_id and public.is_store_member(o.store_id))
) with check (
  exists (select 1 from public.orders o where o.id = order_id and public.is_store_member(o.store_id))
);

drop policy if exists store_state_member_all on public.store_state;
create policy store_state_member_all on public.store_state for all
using (public.is_store_member(store_id))
with check (public.is_store_member(store_id));

alter table public.products replica identity full;
alter table public.stock_movements replica identity full;
alter table public.orders replica identity full;
alter table public.order_lines replica identity full;
alter table public.store_state replica identity full;

-- Make the script safe to run again after a partial success.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products') then
    alter publication supabase_realtime add table public.products;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stock_movements') then
    alter publication supabase_realtime add table public.stock_movements;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_lines') then
    alter publication supabase_realtime add table public.order_lines;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'store_state') then
    alter publication supabase_realtime add table public.store_state;
  end if;
end $$;

-- After creating a store, add the first authenticated user as owner:
-- insert into public.store_members(store_id, user_id, role)
-- values ('STORE_UUID', 'AUTH_USER_UUID', 'owner');


-- KITCHEN STOCK: corrected setup script
-- Run this file in Supabase SQL Editor after reviewing the email placeholders.
-- This version does not add wakame8735 and does not delete or merge stores.

-- 2) Create the two stores only when they do not already exist.
do $$
declare
  v_store_name text;
begin
  foreach v_store_name in array array['新宿西口', '歌舞伎']
  loop
    if not exists (
      select 1 from public.stores where name = v_store_name
    ) then
      insert into public.stores (name) values (v_store_name);
    end if;
  end loop;
end $$;

-- 3) Add the existing owner and staff accounts.
-- Replace the example addresses before running this statement.
insert into public.store_members (store_id, user_id, role)
select
  s.id,
  u.id,
  case
    when u.email = 'OWNER_EMAIL@example.com' then 'owner'
    else 'staff'
  end
from public.stores s
cross join auth.users u
where s.name in ('新宿西口', '歌舞伎')
  and u.email in (
    'OWNER_EMAIL@example.com',
    'STAFF_1@example.com',
    'STAFF_2@example.com',
    'STAFF_3@example.com'
  )
on conflict (store_id, user_id) do update
set role = excluded.role;

-- 4) Check stores and memberships before using the app.
select id, name, created_at
from public.stores
order by name, created_at;

select
  s.name as store_name,
  u.email,
  sm.role
from public.store_members sm
join public.stores s on s.id = sm.store_id
join auth.users u on u.id = sm.user_id
order by s.name, u.email;

-- If a duplicate store name remains, stop here and review the rows above.
-- Do not run DELETE or merge statements until the data to keep is confirmed.
