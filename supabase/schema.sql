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

alter table public.products replica identity full;
alter table public.stock_movements replica identity full;
alter table public.orders replica identity full;
alter table public.order_lines replica identity full;
alter publication supabase_realtime add table public.products, public.stock_movements, public.orders, public.order_lines;

-- After creating a store, add the first authenticated user as owner:
-- insert into public.store_members(store_id, user_id, role)
-- values ('STORE_UUID', 'AUTH_USER_UUID', 'owner');
