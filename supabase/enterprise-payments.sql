-- ============================================================
-- GONOW — Enterprise Payments / Escrow / Driver Wallet
-- Lägg ovanpå befintlig schema.sql i Supabase SQL Editor
-- Syfte:
-- 1. Göra orders redo för riktig escrow-logik
-- 2. Stödja flera payment providers (Stripe / Swish)
-- 3. Bygga ledger för förarsaldo på enterprise-nivå
-- 4. Lägga grund för disputes och payouts
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

do $$ begin
  create type payment_provider as enum ('stripe', 'swish');
exception when duplicate_object then null; end $$;

do $$ begin
  create type service_type as enum ('package', 'passenger', 'return');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum (
    'pending',
    'authorized',
    'paid',
    'failed',
    'cancelled',
    'refunded',
    'partially_refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type escrow_entry_type as enum (
    'customer_payment_received',
    'platform_fee_reserved',
    'carrier_payout_reserved',
    'carrier_available',
    'carrier_payout_processing',
    'carrier_payout_paid',
    'refund_reserved',
    'refund_completed',
    'dispute_hold',
    'dispute_release'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type ledger_direction as enum ('credit', 'debit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ledger_bucket as enum (
    'customer_funds',
    'escrow_hold',
    'platform_revenue',
    'carrier_pending',
    'carrier_available',
    'carrier_in_payout',
    'carrier_paid',
    'refund_pool',
    'dispute_hold'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type dispute_status as enum ('open', 'reviewing', 'resolved_sender', 'resolved_carrier', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type dispute_reason as enum (
    'not_picked_up',
    'damaged',
    'not_delivered',
    'wrong_item',
    'pricing_issue',
    'other'
  );
exception when duplicate_object then null; end $$;

-- ============================================================
-- ORDER STATUS EXTENSION
-- Nuvarande app använder redan pending/matched/picked_up/in_transit/delivered/confirmed.
-- För enterprise-flöde lägger vi till order_phase ovanpå, så vi slipper bryta UI:t direkt.
-- ============================================================

do $$ begin
  create type order_phase as enum (
    'draft',
    'requested',
    'accepted',
    'payment_pending',
    'paid_held',
    'picked_up',
    'in_transit',
    'delivered',
    'receiver_confirmed',
    'payout_ready',
    'paid_out',
    'cancelled',
    'disputed',
    'refunded'
  );
exception when duplicate_object then null; end $$;

-- ============================================================
-- TRIPS: kapacitet för paket + passagerare
-- ============================================================

alter table public.trips
  add column if not exists vehicle_make text,
  add column if not exists vehicle_model text,
  add column if not exists vehicle_color text,
  add column if not exists vehicle_plate text,
  add column if not exists vehicle_seats_total int not null default 1,
  add column if not exists seats_reserved int not null default 0,
  add column if not exists weight_reserved_kg numeric(10,2) not null default 0;

-- ============================================================
-- ORDERS: håll gamla kolumner, lägg till tydligare enterprise-fält
-- receiver_id används redan i live-miljön som förare på vissa ställen.
-- carrier_id och receiver_id får därför leva parallellt tills data är migrerad fullt ut.
-- ============================================================

alter table public.orders
  add column if not exists receiver_id uuid references public.users(id),
  add column if not exists payment_provider payment_provider,
  add column if not exists payment_status payment_status not null default 'pending',
  add column if not exists order_phase order_phase not null default 'payment_pending',
  add column if not exists currency text not null default 'sek',
  add column if not exists seats_booked int not null default 0,
  add column if not exists service_type service_type,
  add column if not exists accepted_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists receiver_confirmed_at timestamptz,
  add column if not exists payout_ready_at timestamptz,
  add column if not exists paid_out_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists disputed_at timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists payout_batch_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_orders_order_phase on public.orders (order_phase);
create index if not exists idx_orders_payment_status on public.orders (payment_status);
create index if not exists idx_orders_receiver on public.orders (receiver_id);

-- ============================================================
-- PAYMENTS
-- En rad per kundbetalning / betalningsförsök
-- ============================================================

create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_id uuid references public.users(id) on delete set null,
  carrier_id uuid references public.users(id) on delete set null,
  provider payment_provider not null,
  provider_payment_id text,
  provider_checkout_id text,
  provider_reference text,
  amount numeric(10,2) not null,
  currency text not null default 'sek',
  status payment_status not null default 'pending',
  authorized_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  refunded_at timestamptz,
  idempotency_key text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_payments_provider_payment_id
  on public.payments (provider, provider_payment_id)
  where provider_payment_id is not null;

create index if not exists idx_payments_order on public.payments (order_id);
create index if not exists idx_payments_sender on public.payments (sender_id);
create index if not exists idx_payments_carrier on public.payments (carrier_id);
create index if not exists idx_payments_status on public.payments (status, provider);

-- ============================================================
-- ESCROW LEDGER
-- Den här tabellen är sanningen för saldo, inte bara order-status.
-- ============================================================

create table if not exists public.escrow_ledger (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  payout_id uuid references public.payouts(id) on delete set null,
  sender_id uuid references public.users(id) on delete set null,
  carrier_id uuid references public.users(id) on delete set null,
  entry_type escrow_entry_type not null,
  direction ledger_direction not null,
  bucket ledger_bucket not null,
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'sek',
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_escrow_ledger_order on public.escrow_ledger (order_id, created_at desc);
create index if not exists idx_escrow_ledger_carrier on public.escrow_ledger (carrier_id, bucket, created_at desc);
create index if not exists idx_escrow_ledger_sender on public.escrow_ledger (sender_id, bucket, created_at desc);
create index if not exists idx_escrow_ledger_entry_type on public.escrow_ledger (entry_type, created_at desc);

-- ============================================================
-- DISPUTES
-- Fryser orderns payout tills ärendet stängs.
-- ============================================================

create table if not exists public.disputes (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  booking_request_id uuid,
  opened_by uuid references public.users(id) on delete set null,
  assigned_to uuid references public.users(id) on delete set null,
  reason dispute_reason not null,
  description text,
  status dispute_status not null default 'open',
  resolution_note text,
  resolved_for text check (resolved_for in ('sender', 'carrier', 'split', 'none')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  resolved_at timestamptz
);

create index if not exists idx_disputes_order on public.disputes (order_id);
create index if not exists idx_disputes_status on public.disputes (status, created_at desc);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'booking_requests'
  ) then
    begin
      alter table public.disputes
        add constraint disputes_booking_request_id_fkey
        foreign key (booking_request_id)
        references public.booking_requests(id)
        on delete set null;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

-- ============================================================
-- PAYOUTS: bygg ut så driver wallet kan bete sig som Shopify
-- ============================================================

alter table public.payouts
  add column if not exists provider text not null default 'stripe_connect',
  add column if not exists scheduled_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists failure_reason text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- ============================================================
-- HJÄLPFUNKTION: bestäm carrier_id robust även i blandad data
-- ============================================================

create or replace function public.fn_resolve_order_carrier_id(p_order public.orders)
returns uuid
language sql
immutable
as $$
  select coalesce(
    nullif(to_jsonb($1)->>'carrier_id', '')::uuid,
    nullif(to_jsonb($1)->>'receiver_id', '')::uuid
  )
$$;

-- ============================================================
-- LEDGER-FUNKTION
-- ============================================================

create or replace function public.fn_append_ledger_entry(
  p_order_id uuid,
  p_payment_id uuid,
  p_payout_id uuid,
  p_sender_id uuid,
  p_carrier_id uuid,
  p_entry_type escrow_entry_type,
  p_direction ledger_direction,
  p_bucket ledger_bucket,
  p_amount numeric,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.escrow_ledger (
    order_id,
    payment_id,
    payout_id,
    sender_id,
    carrier_id,
    entry_type,
    direction,
    bucket,
    amount,
    note,
    metadata
  )
  values (
    p_order_id,
    p_payment_id,
    p_payout_id,
    p_sender_id,
    p_carrier_id,
    p_entry_type,
    p_direction,
    p_bucket,
    p_amount,
    p_note,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ============================================================
-- PAYMENT → ESCROW
-- När betalning går till paid:
-- 1. kundpengar tas emot
-- 2. plattformsavgift reserveras
-- 3. förarandel reserveras i escrow
-- ============================================================

create or replace function public.fn_ledger_on_payment_paid()
returns trigger
language plpgsql
as $$
declare
  v_order public.orders;
  v_carrier_id uuid;
begin
  if new.status = 'paid' and coalesce(old.status, 'pending') <> 'paid' then
    select * into v_order from public.orders where id = new.order_id;
    v_carrier_id := public.fn_resolve_order_carrier_id(v_order);

    perform public.fn_append_ledger_entry(
      v_order.id,
      new.id,
      null,
      v_order.sender_id,
      v_carrier_id,
      'customer_payment_received',
      'credit',
      'customer_funds',
      v_order.price,
      'Kundbetalning mottagen',
      jsonb_build_object('provider', new.provider)
    );

    perform public.fn_append_ledger_entry(
      v_order.id,
      new.id,
      null,
      v_order.sender_id,
      v_carrier_id,
      'platform_fee_reserved',
      'credit',
      'platform_revenue',
      v_order.commission,
      'Plattformsavgift reserverad',
      jsonb_build_object('provider', new.provider)
    );

    perform public.fn_append_ledger_entry(
      v_order.id,
      new.id,
      null,
      v_order.sender_id,
      v_carrier_id,
      'carrier_payout_reserved',
      'credit',
      'escrow_hold',
      v_order.carrier_payout,
      'Förarandel låst i escrow',
      jsonb_build_object('provider', new.provider)
    );

    update public.orders
    set
      payment_status = 'paid',
      order_phase = 'paid_held',
      paid_at = coalesce(new.paid_at, now())
    where id = v_order.id;
  end if;

  return new;
end;
$$;

drop trigger if exists tg_ledger_on_payment_paid on public.payments;
create trigger tg_ledger_on_payment_paid
  after update of status on public.payments
  for each row
  execute function public.fn_ledger_on_payment_paid();

-- ============================================================
-- DELIVERED / CONFIRMED → payout ready
-- När mottagaren bekräftar ska förarandelen bli available
-- ============================================================

create or replace function public.fn_order_to_payout_ready()
returns trigger
language plpgsql
as $$
declare
  v_carrier_id uuid;
begin
  v_carrier_id := public.fn_resolve_order_carrier_id(new);

  if new.status = 'confirmed' and old.status is distinct from 'confirmed'::order_status and v_carrier_id is not null then
    perform public.fn_append_ledger_entry(
      new.id,
      null,
      null,
      new.sender_id,
      v_carrier_id,
      'carrier_available',
      'credit',
      'carrier_available',
      new.carrier_payout,
      'Förarandel släppt efter mottagarbekräftelse',
      jsonb_build_object('from_status', old.status, 'to_status', new.status)
    );

    update public.orders
    set
      order_phase = 'payout_ready',
      receiver_confirmed_at = coalesce(new.confirmed_at, now()),
      payout_ready_at = now()
    where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists tg_order_to_payout_ready on public.orders;
create trigger tg_order_to_payout_ready
  after update of status on public.orders
  for each row
  execute function public.fn_order_to_payout_ready();

-- ============================================================
-- PAYOUT STATUS → ledger
-- ============================================================

create or replace function public.fn_ledger_on_payout_update()
returns trigger
language plpgsql
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = new.order_id;

  if new.status in ('pending', 'processing')
     and old.status is distinct from 'pending'::payout_status
     and old.status is distinct from 'processing'::payout_status then
    perform public.fn_append_ledger_entry(
      v_order.id,
      null,
      new.id,
      v_order.sender_id,
      new.carrier_id,
      'carrier_payout_processing',
      'debit',
      'carrier_in_payout',
      new.amount,
      'Utbetalning initierad',
      jsonb_build_object('provider', new.provider)
    );
  end if;

  if new.status = 'paid' and old.status is distinct from 'paid'::payout_status then
    perform public.fn_append_ledger_entry(
      v_order.id,
      null,
      new.id,
      v_order.sender_id,
      new.carrier_id,
      'carrier_payout_paid',
      'debit',
      'carrier_paid',
      new.amount,
      'Utbetalning skickad till förare',
      jsonb_build_object('provider', new.provider)
    );

    update public.orders
    set
      order_phase = 'paid_out',
      paid_out_at = coalesce(new.paid_at, now())
    where id = v_order.id;
  end if;

  return new;
end;
$$;

drop trigger if exists tg_ledger_on_payout_update on public.payouts;
create trigger tg_ledger_on_payout_update
  after update of status on public.payouts
  for each row
  execute function public.fn_ledger_on_payout_update();

-- ============================================================
-- DISPUTE → håll payout
-- ============================================================

create or replace function public.fn_hold_funds_on_dispute()
returns trigger
language plpgsql
as $$
declare
  v_order public.orders;
  v_carrier_id uuid;
begin
  if new.status = 'open' then
    select * into v_order from public.orders where id = new.order_id;
    v_carrier_id := public.fn_resolve_order_carrier_id(v_order);

    perform public.fn_append_ledger_entry(
      v_order.id,
      null,
      null,
      v_order.sender_id,
      v_carrier_id,
      'dispute_hold',
      'credit',
      'dispute_hold',
      v_order.carrier_payout,
      'Payout fryst pga tvist',
      jsonb_build_object('dispute_id', new.id, 'reason', new.reason)
    );

    update public.orders
    set
      status = 'disputed',
      order_phase = 'disputed',
      disputed_at = now()
    where id = v_order.id;
  end if;

  return new;
end;
$$;

drop trigger if exists tg_hold_funds_on_dispute on public.disputes;
create trigger tg_hold_funds_on_dispute
  after insert on public.disputes
  for each row
  execute function public.fn_hold_funds_on_dispute();

-- ============================================================
-- RLS
-- Fortsatt öppna demo-policies som i nuvarande schema.
-- Lås ner per auth.uid() när auth-flödet är helt färdigt.
-- ============================================================

alter table public.payments enable row level security;
alter table public.escrow_ledger enable row level security;
alter table public.disputes enable row level security;

drop policy if exists "payments_select" on public.payments;
drop policy if exists "payments_insert" on public.payments;
drop policy if exists "payments_update" on public.payments;
create policy "payments_select" on public.payments for select using (true);
create policy "payments_insert" on public.payments for insert with check (true);
create policy "payments_update" on public.payments for update using (true);

drop policy if exists "escrow_ledger_select" on public.escrow_ledger;
drop policy if exists "escrow_ledger_insert" on public.escrow_ledger;
create policy "escrow_ledger_select" on public.escrow_ledger for select using (true);
create policy "escrow_ledger_insert" on public.escrow_ledger for insert with check (true);

drop policy if exists "disputes_select" on public.disputes;
drop policy if exists "disputes_insert" on public.disputes;
drop policy if exists "disputes_update" on public.disputes;
create policy "disputes_select" on public.disputes for select using (true);
create policy "disputes_insert" on public.disputes for insert with check (true);
create policy "disputes_update" on public.disputes for update using (true);

-- ============================================================
-- REALTIME
-- ============================================================

alter publication supabase_realtime add table public.payments;
alter publication supabase_realtime add table public.escrow_ledger;
alter publication supabase_realtime add table public.disputes;
