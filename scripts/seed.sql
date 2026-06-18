-- ============================================================
-- GONOW — Seed-data för lokal utveckling och demo
-- Kör efter schema.sql
-- ============================================================

-- ============================================================
-- USERS
-- ============================================================

insert into public.users (id, email, name, phone, bankid_verified, role, rating_avg, rating_count) values
  ('00000000-0000-0000-0000-000000000001', 'erik.lindqvist@example.se',  'Erik Lindqvist',  '+46701234567', true,  'carrier', 4.9, 87),
  ('00000000-0000-0000-0000-000000000002', 'sara.johansson@example.se',  'Sara Johansson',  '+46709876543', true,  'carrier', 4.7, 42),
  ('00000000-0000-0000-0000-000000000003', 'mikael.berg@example.se',     'Mikael Berg',     '+46706543210', true,  'carrier', 5.0, 23),
  ('00000000-0000-0000-0000-000000000004', 'anna.nilsson@example.se',    'Anna Nilsson',    '+46703219876', false, 'carrier', 4.5, 11),
  ('00000000-0000-0000-0000-000000000005', 'demo@gonow.se',              'Demo Användare',  '+46700000001', true,  'user',    5.0,  0)
on conflict (id) do nothing;

-- ============================================================
-- TRIPS
-- ============================================================

insert into public.trips (
  id, carrier_id,
  from_city, from_lat, from_lng,
  to_city, to_lat, to_lng,
  distance_km, departure_at, arrival_est, vehicle_type,
  seats_available, weight_capacity_kg,
  allows_passengers, allows_packages, allows_returns, allows_pets,
  price_per_seat, price_per_kg, status
) values

  ('10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'Stockholm', 59.3293, 18.0686, 'Göteborg', 57.7089, 11.9746,
   470, now() + interval '2 hours', now() + interval '8 hours',
   'car', 2, 30, true, true, true, false, 180, 12, 'active'),

  ('10000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000002',
   'Stockholm', 59.3293, 18.0686, 'Malmö', 55.6050, 13.0038,
   610, now() + interval '4 hours', now() + interval '11 hours',
   'car', 1, 15, true, true, false, false, 220, 14, 'active'),

  ('10000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000003',
   'Göteborg', 57.7089, 11.9746, 'Stockholm', 59.3293, 18.0686,
   470, now() + interval '26 hours', now() + interval '32 hours',
   'car', 3, 50, true, true, true, true, 170, 10, 'active'),

  ('10000000-0000-0000-0000-000000000004',
   '00000000-0000-0000-0000-000000000001',
   'Uppsala', 59.8586, 17.6389, 'Stockholm', 59.3293, 18.0686,
   75, now() + interval '6 hours', now() + interval '7 hours',
   'car', 2, 20, true, true, true, false, 90, 8, 'active'),

  ('10000000-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000004',
   'Malmö', 55.6050, 13.0038, 'Göteborg', 57.7089, 11.9746,
   280, now() + interval '28 hours', now() + interval '31 hours',
   'car', 1, 25, true, true, true, false, 130, 11, 'active'),

  ('10000000-0000-0000-0000-000000000006',
   '00000000-0000-0000-0000-000000000002',
   'Stockholm', 59.3293, 18.0686, 'Sundsvall', 62.3908, 17.3069,
   390, now() + interval '50 hours', now() + interval '56 hours',
   'car', 2, 40, true, true, false, false, 250, 16, 'active'),

  ('10000000-0000-0000-0000-000000000007',
   '00000000-0000-0000-0000-000000000003',
   'Göteborg', 57.7089, 11.9746, 'Malmö', 55.6050, 13.0038,
   290, now() + interval '3 hours', now() + interval '6 hours',
   'car', 2, 20, true, true, true, false, 120, 10, 'active'),

  ('10000000-0000-0000-0000-000000000008',
   '00000000-0000-0000-0000-000000000004',
   'Stockholm', 59.3293, 18.0686, 'Linköping', 58.4109, 15.6218,
   200, now() + interval '5 hours', now() + interval '8 hours',
   'car', 3, 35, true, true, true, false, 150, 12, 'active')

on conflict (id) do nothing;

-- ============================================================
-- BOOKING REQUESTS (demo — avsändare → bärare)
-- ============================================================

insert into public.booking_requests (
  id, trip_id, sender_id,
  service_type, weight_kg, description,
  pickup_address, dropoff_address,
  sender_name, sender_phone, sender_email,
  recipient_name, recipient_phone, recipient_email,
  status, price_est
) values

  -- Väntande förfrågan till Erik (trip 1)
  ('30000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000005',
   'package', 3.5, 'Tre böcker och en liten lampa',
   'Drottninggatan 10, Stockholm', 'Avenyn 5, Göteborg',
   'Demo Användare', '+46700000001', 'demo@gonow.se',
   'Karin Svensson', '+46711223344', 'karin@example.se',
   'pending', 109),

  -- Accepterad förfrågan (trip 3)
  ('30000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000005',
   'package', 12, 'IKEA Kallax hylla',
   'IKEA Kungens Kurva, Stockholm', 'Linnégatan 22, Göteborg',
   'Demo Användare', '+46700000001', 'demo@gonow.se',
   'Jonas Berg', '+46733445566', 'jonas@example.se',
   'accepted', 320)

on conflict (id) do nothing;

-- ============================================================
-- ORDERS (bekräftade + betalda)
-- ============================================================

insert into public.orders (
  id, sender_id, carrier_id, trip_id, booking_request_id,
  type, description, weight_kg,
  pickup_address, dropoff_address,
  price, commission, carrier_payout,
  status, picked_up_at
) values

  ('20000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   null,
   'package', 'Bokpaket, 3 böcker', 2.5,
   'Drottninggatan 10, Stockholm', 'Avenyn 5, Göteborg',
   179, 27, 152,
   'in_transit', now() - interval '1 hour'),

  ('20000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000003',
   '30000000-0000-0000-0000-000000000002',
   'pickup', 'IKEA Kallax hylla', 12,
   'IKEA Kungens Kurva, Stockholm', 'Linnégatan 22, Göteborg',
   320, 48, 272,
   'matched', null)

on conflict (id) do nothing;

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

insert into public.notifications (user_id, type, title, body, data, read) values

  -- Till Erik: ny förfrågan
  ('00000000-0000-0000-0000-000000000001',
   'booking_received',
   'Ny bokningsförfrågan!',
   'Demo Användare vill skicka ett paket med dig från Stockholm till Göteborg',
   '{"booking_request_id": "30000000-0000-0000-0000-000000000001", "trip_id": "10000000-0000-0000-0000-000000000001"}',
   false),

  -- Till demo-user: bokning accepterad
  ('00000000-0000-0000-0000-000000000005',
   'booking_accepted',
   'Förfrågan accepterad!',
   'Din förfrågan har accepterats. Gå vidare till betalning.',
   '{"booking_request_id": "30000000-0000-0000-0000-000000000002", "trip_id": "10000000-0000-0000-0000-000000000003"}',
   false);

-- ============================================================
-- REVIEWS
-- ============================================================

insert into public.reviews (order_id, from_user_id, to_user_id, rating, comment) values
  ('20000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000001',
   5, 'Superproffsig och i tid. Rekommenderas varmt!')
on conflict (order_id, from_user_id) do nothing;

-- ============================================================
-- PAYOUTS
-- ============================================================

insert into public.payouts (carrier_id, order_id, amount, status) values
  ('00000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001',
   152, 'pending')
on conflict (order_id) do nothing;

-- ============================================================
-- WAITLIST
-- ============================================================

insert into public.waitlist (email, role, city) values
  ('test1@example.se', 'sender',  'Stockholm'),
  ('test2@example.se', 'carrier', 'Göteborg'),
  ('test3@example.se', 'both',    'Malmö')
on conflict (email) do nothing;
