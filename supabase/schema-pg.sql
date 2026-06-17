-- Pure PostgreSQL schema (no Supabase extensions required)
-- Used by Docker for local development

create extension if not exists "uuid-ossp";

create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  name text not null,
  phone text,
  avatar_url text,
  bankid_verified boolean default false,
  bankid_personal_number text,
  stripe_account_id text,
  role text default 'user',
  rating_avg numeric(3,2) default 5.0,
  rating_count integer default 0,
  created_at timestamptz default now()
);

create table if not exists trips (
  id uuid primary key default uuid_generate_v4(),
  carrier_id uuid references users(id) on delete cascade,
  from_city text not null,
  from_lat numeric,
  from_lng numeric,
  to_city text not null,
  to_lat numeric,
  to_lng numeric,
  departure_at timestamptz not null,
  arrival_est timestamptz,
  vehicle_type text,
  seats_available integer default 0,
  weight_capacity_kg numeric default 0,
  allows_passengers boolean default true,
  allows_packages boolean default true,
  allows_returns boolean default true,
  allows_pets boolean default false,
  price_per_seat numeric,
  price_per_kg numeric,
  status text default 'active',
  waypoints jsonb,
  created_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid references users(id),
  receiver_id uuid references users(id),
  trip_id uuid references trips(id),
  type text not null,
  description text,
  weight_kg numeric,
  photo_url text,
  pickup_address text,
  pickup_lat numeric,
  pickup_lng numeric,
  dropoff_address text,
  dropoff_lat numeric,
  dropoff_lng numeric,
  store_name text,
  store_address text,
  order_reference text,
  price numeric not null,
  commission numeric not null,
  carrier_payout numeric not null,
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  status text default 'pending',
  pickup_qr_code text,
  delivery_photo_url text,
  confirmed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists locations (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references trips(id) on delete cascade,
  lat numeric not null,
  lng numeric not null,
  recorded_at timestamptz default now()
);

create table if not exists reviews (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id),
  from_user_id uuid references users(id),
  to_user_id uuid references users(id),
  rating integer check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

create table if not exists payouts (
  id uuid primary key default uuid_generate_v4(),
  carrier_id uuid references users(id),
  order_id uuid references orders(id),
  amount numeric not null,
  status text default 'pending',
  stripe_transfer_id text,
  paid_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists waitlist (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  role text,
  city text,
  created_at timestamptz default now()
);
