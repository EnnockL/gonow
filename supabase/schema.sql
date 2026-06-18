-- ============================================================
-- GONOW — Supabase Schema
-- Kör i Supabase SQL Editor (Settings → SQL Editor → New query)
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_net";     -- för HTTP-anrop från triggers (SMS etc.)

-- ============================================================
-- ENUMS
-- ============================================================

do $$ begin
  create type user_role     as enum ('user', 'carrier', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_type    as enum ('package', 'pickup', 'return', 'lift');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status  as enum (
    'pending', 'matched', 'picked_up', 'in_transit', 'delivered', 'confirmed', 'disputed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type trip_status   as enum ('active', 'full', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payout_status as enum ('pending', 'processing', 'paid', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_status as enum ('pending', 'accepted', 'declined', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type service_type  as enum ('package', 'passenger', 'return');
exception when duplicate_object then null; end $$;

-- ============================================================
-- USERS
-- Länkas till Supabase Auth via auth.users.id
-- ============================================================

create table if not exists public.users (
  id                    uuid primary key default uuid_generate_v4(),
  email                 text unique not null,
  name                  text not null,
  phone                 text,
  avatar_url            text,
  bankid_verified       boolean not null default false,
  bankid_personal_number text,              -- personnummer (krypterat i prod)
  stripe_account_id     text,              -- Stripe Connect express account
  role                  user_role not null default 'user',
  rating_avg            numeric(3,2) not null default 0,
  rating_count          int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ============================================================
-- TRIPS
-- Bärarens resa från A till B
-- ============================================================

create table if not exists public.trips (
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
  waypoints           jsonb,               -- [{city, lat, lng}]
  notes               text,               -- fritext från bäraren
  created_at          timestamptz not null default now()
);

-- ============================================================
-- BOOKING REQUESTS
-- Avsändarens förfrågan till en bärare (innan betalning)
-- Ersätter localStorage gonow_bookings
-- ============================================================

create table if not exists public.booking_requests (
  id              uuid primary key default uuid_generate_v4(),
  trip_id         uuid not null references public.trips(id) on delete cascade,
  sender_id       uuid references public.users(id),   -- null om ej inloggad
  service_type    service_type not null,
  weight_kg       numeric(6,2) not null default 0,
  description     text,
  pickup_address  text not null,
  dropoff_address text not null,
  sender_name     text not null,
  sender_phone    text not null,
  sender_email    text,
  recipient_name  text not null,
  recipient_phone text not null,
  recipient_email text,
  status          booking_status not null default 'pending',
  order_id        uuid,                               -- sätts när bokning accepteras + betalas
  price_est       numeric(8,2),                      -- beräknad pris vid förfrågan
  carrier_note    text,                              -- bärarens svar/notering
  created_at      timestamptz not null default now(),
  responded_at    timestamptz                        -- när bäraren svarade
);

-- ============================================================
-- ORDERS
-- Bekräftad + betald order
-- ============================================================

create table if not exists public.orders (
  id                       uuid primary key default uuid_generate_v4(),
  sender_id                uuid not null references public.users(id) on delete cascade,
  carrier_id               uuid references public.users(id),
  trip_id                  uuid references public.trips(id),
  booking_request_id       uuid references public.booking_requests(id),
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
  stripe_transfer_id       text,
  status                   order_status not null default 'pending',
  pickup_qr_code           text,
  delivery_photo_url       text,
  confirmed_at             timestamptz,
  picked_up_at             timestamptz,
  delivered_at             timestamptz,
  created_at               timestamptz not null default now()
);

-- Backreference: booking_request.order_id → orders.id
alter table public.booking_requests
  add constraint fk_booking_order
  foreign key (order_id) references public.orders(id);

-- ============================================================
-- LOCATIONS
-- GPS-spårning av bärarens position under resa
-- ============================================================

create table if not exists public.locations (
  id          uuid primary key default uuid_generate_v4(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  speed_kmh   int,
  recorded_at timestamptz not null default now()
);

-- ============================================================
-- NOTIFICATIONS
-- In-app + SMS-köhantering
-- ============================================================

create table if not exists public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,
  type        text not null,    -- 'booking_received' | 'booking_accepted' | 'booking_declined'
                                -- | 'order_picked_up' | 'order_delivered' | 'payout_sent'
  title       text not null,
  body        text not null,
  data        jsonb,            -- {trip_id, order_id, booking_request_id, ...}
  read        boolean not null default false,
  sent_sms    boolean not null default false,  -- om SMS skickats
  created_at  timestamptz not null default now()
);

-- ============================================================
-- REVIEWS
-- Betyg mellan avsändare och bärare efter leverans
-- ============================================================

create table if not exists public.reviews (
  id           uuid primary key default uuid_generate_v4(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  from_user_id uuid not null references public.users(id) on delete cascade,
  to_user_id   uuid not null references public.users(id) on delete cascade,
  rating       smallint not null check (rating between 1 and 5),
  comment      text,
  created_at   timestamptz not null default now(),
  unique (order_id, from_user_id)   -- en recension per order per användare
);

-- ============================================================
-- PAYOUTS
-- Utbetalningar till bärare via Stripe
-- ============================================================

create table if not exists public.payouts (
  id                 uuid primary key default uuid_generate_v4(),
  carrier_id         uuid not null references public.users(id) on delete cascade,
  order_id           uuid not null references public.orders(id) on delete cascade,
  amount             numeric(10,2) not null,
  status             payout_status not null default 'pending',
  stripe_transfer_id text,
  paid_at            timestamptz,
  created_at         timestamptz not null default now(),
  unique (order_id)   -- en utbetalning per order
);

-- ============================================================
-- WAITLIST
-- E-post-lista för early access
-- ============================================================

create table if not exists public.waitlist (
  id         uuid primary key default uuid_generate_v4(),
  email      text unique not null,
  role       text default 'sender' check (role in ('sender', 'carrier', 'both')),
  city       text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PRICING
-- Prisconfig — en rad, uppdateras från admin
-- ============================================================

create table if not exists public.pricing (
  id              uuid primary key default uuid_generate_v4(),
  base_fee        numeric(8,2) not null default 49,
  per_km          numeric(8,4) not null default 0.85,
  per_kg          numeric(8,4) not null default 8.00,
  commission_pct  numeric(5,2) not null default 15,
  min_price       numeric(8,2) not null default 79,
  updated_at      timestamptz not null default now()
);

-- Standardvärden
insert into public.pricing (base_fee, per_km, per_kg, commission_pct, min_price)
values (49, 0.85, 8.00, 15, 79)
on conflict do nothing;

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_trips_status_departure    on public.trips (status, departure_at);
create index if not exists idx_trips_carrier             on public.trips (carrier_id);
create index if not exists idx_trips_route               on public.trips (from_city, to_city);

create index if not exists idx_booking_requests_trip     on public.booking_requests (trip_id);
create index if not exists idx_booking_requests_sender   on public.booking_requests (sender_id);
create index if not exists idx_booking_requests_status   on public.booking_requests (status);

create index if not exists idx_orders_sender             on public.orders (sender_id);
create index if not exists idx_orders_carrier            on public.orders (carrier_id);
create index if not exists idx_orders_trip               on public.orders (trip_id);
create index if not exists idx_orders_status             on public.orders (status);

create index if not exists idx_locations_trip            on public.locations (trip_id, recorded_at desc);
create index if not exists idx_notifications_user_unread on public.notifications (user_id, read, created_at desc);
create index if not exists idx_reviews_to_user           on public.reviews (to_user_id);
create index if not exists idx_payouts_carrier           on public.payouts (carrier_id, status);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- 1. Uppdatera users.rating_avg och rating_count automatiskt
create or replace function fn_update_user_rating()
returns trigger language plpgsql as $$
begin
  update public.users
  set
    rating_avg   = (select round(avg(rating)::numeric, 2) from public.reviews where to_user_id = new.to_user_id),
    rating_count = (select count(*) from public.reviews where to_user_id = new.to_user_id),
    updated_at   = now()
  where id = new.to_user_id;
  return new;
end;
$$;

drop trigger if exists tg_update_user_rating on public.reviews;
create trigger tg_update_user_rating
  after insert on public.reviews
  for each row execute function fn_update_user_rating();

-- 2. Skapa utbetalningspost automatiskt när order levereras
create or replace function fn_create_payout_on_delivery()
returns trigger language plpgsql as $$
begin
  if new.status = 'delivered' and old.status != 'delivered' and new.carrier_id is not null then
    insert into public.payouts (carrier_id, order_id, amount, status)
    values (new.carrier_id, new.id, new.carrier_payout, 'pending')
    on conflict (order_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists tg_create_payout_on_delivery on public.orders;
create trigger tg_create_payout_on_delivery
  after update of status on public.orders
  for each row execute function fn_create_payout_on_delivery();

-- 3. Skapa notis till bäraren när ny bokningsförfrågan kommer in
create or replace function fn_notify_carrier_on_booking()
returns trigger language plpgsql as $$
declare
  v_carrier_id uuid;
  v_from_city  text;
  v_to_city    text;
begin
  select carrier_id, from_city, to_city
  into v_carrier_id, v_from_city, v_to_city
  from public.trips where id = new.trip_id;

  if v_carrier_id is not null then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      v_carrier_id,
      'booking_received',
      'Ny bokningsförfrågan!',
      new.sender_name || ' vill skicka ' ||
        case new.service_type
          when 'package'   then 'ett paket'
          when 'passenger' then 'sig själv'
          when 'return'    then 'en retur'
        end ||
        ' med dig från ' || v_from_city || ' till ' || v_to_city,
      jsonb_build_object(
        'booking_request_id', new.id,
        'trip_id', new.trip_id,
        'sender_name', new.sender_name,
        'sender_phone', new.sender_phone
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tg_notify_carrier_on_booking on public.booking_requests;
create trigger tg_notify_carrier_on_booking
  after insert on public.booking_requests
  for each row execute function fn_notify_carrier_on_booking();

-- 4. Notifiera avsändaren när bäraren accepterar/avböjer
create or replace function fn_notify_sender_on_response()
returns trigger language plpgsql as $$
begin
  if new.status != old.status and new.status in ('accepted', 'declined') then
    if new.sender_id is not null then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        new.sender_id,
        case new.status when 'accepted' then 'booking_accepted' else 'booking_declined' end,
        case new.status when 'accepted' then 'Förfrågan accepterad!' else 'Förfrågan avböjd' end,
        case new.status
          when 'accepted' then 'Din förfrågan har accepterats. Gå vidare till betalning.'
          else 'Bäraren kunde tyvärr inte ta ditt uppdrag. Sök efter en annan bärare.'
        end,
        jsonb_build_object(
          'booking_request_id', new.id,
          'trip_id', new.trip_id
        )
      );
    end if;

    -- Sätt responded_at
    update public.booking_requests
    set responded_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists tg_notify_sender_on_response on public.booking_requests;
create trigger tg_notify_sender_on_response
  after update of status on public.booking_requests
  for each row execute function fn_notify_sender_on_response();

-- 5. Uppdatera trips.seats_available när en passagerarbokning accepteras
create or replace function fn_update_trip_capacity()
returns trigger language plpgsql as $$
begin
  if new.status = 'accepted' and old.status = 'pending' then
    if new.service_type = 'passenger' then
      update public.trips
      set seats_available = greatest(0, seats_available - 1)
      where id = new.trip_id;

      -- Sätt till 'full' om inga platser kvar
      update public.trips
      set status = 'full'
      where id = new.trip_id and seats_available = 0 and allows_passengers = true;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tg_update_trip_capacity on public.booking_requests;
create trigger tg_update_trip_capacity
  after update of status on public.booking_requests
  for each row execute function fn_update_trip_capacity();

-- ============================================================
-- ROW LEVEL SECURITY
-- OBS: Öppna policies under develop — lås per user_id när auth är på
-- ============================================================

alter table public.users             enable row level security;
alter table public.trips             enable row level security;
alter table public.booking_requests  enable row level security;
alter table public.orders            enable row level security;
alter table public.locations         enable row level security;
alter table public.notifications     enable row level security;
alter table public.reviews           enable row level security;
alter table public.payouts           enable row level security;
alter table public.waitlist          enable row level security;
alter table public.pricing           enable row level security;

-- Öppna read/write policies (byt ut mot auth-baserade när BankID är klart)
create policy "users_select"              on public.users            for select using (true);
create policy "users_insert"              on public.users            for insert with check (true);
create policy "users_update"              on public.users            for update using (true);

create policy "trips_select"              on public.trips            for select using (true);
create policy "trips_insert"              on public.trips            for insert with check (true);
create policy "trips_update"              on public.trips            for update using (true);

create policy "booking_requests_select"   on public.booking_requests for select using (true);
create policy "booking_requests_insert"   on public.booking_requests for insert with check (true);
create policy "booking_requests_update"   on public.booking_requests for update using (true);

create policy "orders_select"             on public.orders           for select using (true);
create policy "orders_insert"             on public.orders           for insert with check (true);
create policy "orders_update"             on public.orders           for update using (true);

create policy "locations_select"          on public.locations        for select using (true);
create policy "locations_insert"          on public.locations        for insert with check (true);

create policy "notifications_select"      on public.notifications    for select using (true);
create policy "notifications_insert"      on public.notifications    for insert with check (true);
create policy "notifications_update"      on public.notifications    for update using (true);

create policy "reviews_select"            on public.reviews          for select using (true);
create policy "reviews_insert"            on public.reviews          for insert with check (true);

create policy "payouts_select"            on public.payouts          for select using (true);
create policy "payouts_insert"            on public.payouts          for insert with check (true);
create policy "payouts_update"            on public.payouts          for update using (true);

create policy "waitlist_select"           on public.waitlist         for select using (true);
create policy "waitlist_insert"           on public.waitlist         for insert with check (true);

create policy "pricing_select"            on public.pricing          for select using (true);
create policy "pricing_update"            on public.pricing          for update using (true);

-- ============================================================
-- REALTIME
-- Aktivera för tabeller som behöver live-uppdateringar
-- ============================================================

alter publication supabase_realtime add table public.booking_requests;
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.locations;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.trips;
