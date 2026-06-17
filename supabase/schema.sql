-- GONOW Databasschema — kör i Supabase SQL Editor

create extension if not exists "uuid-ossp";

create type user_role     as enum ('user', 'carrier', 'admin');
create type order_type    as enum ('package', 'pickup', 'return', 'lift');
create type order_status  as enum ('pending','matched','picked_up','in_transit','delivered','confirmed','disputed');
create type trip_status   as enum ('active','full','completed','cancelled');
create type payout_status as enum ('pending','processing','paid','failed');

create table public.users (
  id                uuid primary key default uuid_generate_v4(),
  email             text unique not null,
  name              text not null,
  phone             text,
  avatar_url        text,
  bankid_verified   boolean not null default false,
  stripe_account_id text,
  role              user_role not null default 'user',
  rating_avg        numeric(3,2) not null default 0,
  rating_count      int not null default 0,
  created_at        timestamptz not null default now()
);

create table public.trips (
  id                  uuid primary key default uuid_generate_v4(),
  carrier_id          uuid not null references public.users(id) on delete cascade,
  from_city           text not null,
  from_lat            double precision,
  from_lng            double precision,
  to_city             text not null,
  to_lat              double precision,
  to_lng              double precision,
  distance_km         int,
  departure_at        timestamptz not null,
  arrival_est         timestamptz,
  vehicle_type        text,
  seats_available     int not null default 0,
  weight_capacity_kg  numeric(6,2) not null default 50,
  allows_passengers   boolean not null default false,
  allows_packages     boolean not null default true,
  allows_returns      boolean not null default false,
  allows_pets         boolean not null default false,
  price_per_seat      numeric(8,2),
  price_per_kg        numeric(8,2),
  status              trip_status not null default 'active',
  created_at          timestamptz not null default now()
);

create table public.orders (
  id                       uuid primary key default uuid_generate_v4(),
  sender_id                uuid not null references public.users(id) on delete cascade,
  receiver_id              uuid references public.users(id),
  trip_id                  uuid references public.trips(id),
  type                     order_type not null,
  description              text,
  weight_kg                numeric(6,2),
  photo_url                text,
  pickup_address           text,
  pickup_lat               double precision,
  pickup_lng               double precision,
  dropoff_address          text,
  dropoff_lat              double precision,
  dropoff_lng              double precision,
  distance_km              int,
  store_name               text,
  store_address            text,
  order_reference          text,
  price                    numeric(10,2) not null default 0,
  commission               numeric(10,2) not null default 0,
  carrier_payout           numeric(10,2) not null default 0,
  stripe_payment_intent_id text,
  status                   order_status not null default 'pending',
  pickup_qr_code           text,
  delivery_photo_url       text,
  confirmed_at             timestamptz,
  created_at               timestamptz not null default now()
);

create table public.reviews (
  id           uuid primary key default uuid_generate_v4(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  from_user_id uuid not null references public.users(id) on delete cascade,
  to_user_id   uuid not null references public.users(id) on delete cascade,
  rating       smallint not null check (rating between 1 and 5),
  comment      text,
  created_at   timestamptz not null default now()
);

create table public.payouts (
  id                 uuid primary key default uuid_generate_v4(),
  carrier_id         uuid not null references public.users(id) on delete cascade,
  order_id           uuid not null references public.orders(id) on delete cascade,
  amount             numeric(10,2) not null,
  status             payout_status not null default 'pending',
  stripe_transfer_id text,
  paid_at            timestamptz,
  created_at         timestamptz not null default now()
);

create table public.waitlist (
  id         uuid primary key default uuid_generate_v4(),
  email      text unique not null,
  role       text default 'sender',
  city       text,
  created_at timestamptz not null default now()
);

create table public.pricing (
  id              uuid primary key default uuid_generate_v4(),
  base_fee        numeric(8,2) not null default 49,
  per_km          numeric(8,4) not null default 0.85,
  per_kg          numeric(8,4) not null default 8.00,
  commission_pct  numeric(5,2) not null default 15,
  updated_at      timestamptz not null default now()
);

insert into public.pricing (base_fee, per_km, per_kg, commission_pct) values (49, 0.85, 8.00, 15);

create index on public.trips (status, departure_at);
create index on public.orders (sender_id);
create index on public.orders (status);
create index on public.payouts (carrier_id);
create index on public.reviews (to_user_id);

alter table public.users    enable row level security;
alter table public.trips    enable row level security;
alter table public.orders   enable row level security;
alter table public.reviews  enable row level security;
alter table public.payouts  enable row level security;
alter table public.waitlist enable row level security;
alter table public.pricing  enable row level security;

create policy "waitlist_insert" on public.waitlist for insert with check (true);
create policy "waitlist_select" on public.waitlist for select using (true);
create policy "pricing_read"    on public.pricing  for select using (true);
create policy "trips_read"      on public.trips    for select using (true);
create policy "trips_insert"    on public.trips    for insert with check (true);
create policy "trips_update"    on public.trips    for update using (true);
create policy "orders_insert"   on public.orders   for insert with check (true);
create policy "orders_select"   on public.orders   for select using (true);
create policy "orders_update"   on public.orders   for update using (true);
create policy "reviews_read"    on public.reviews  for select using (true);
create policy "reviews_insert"  on public.reviews  for insert with check (true);
create policy "users_read"      on public.users    for select using (true);
create policy "users_insert"    on public.users    for insert with check (true);
create policy "users_update"    on public.users    for update using (true);
create policy "payouts_read"    on public.payouts  for select using (true);
create policy "payouts_insert"  on public.payouts  for insert with check (true);
