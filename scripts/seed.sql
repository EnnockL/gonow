-- Seed data for local development
-- Realistic Swedish users, trips and orders

-- Users (carriers)
insert into users (id, email, name, phone, bankid_verified, role, rating_avg, rating_count) values
  ('00000000-0000-0000-0000-000000000001', 'erik.lindqvist@example.se',  'Erik Lindqvist',  '+46701234567', true,  'carrier', 4.9, 87),
  ('00000000-0000-0000-0000-000000000002', 'sara.johansson@example.se',   'Sara Johansson',  '+46709876543', true,  'carrier', 4.7, 42),
  ('00000000-0000-0000-0000-000000000003', 'mikael.berg@example.se',      'Mikael Berg',     '+46706543210', true,  'carrier', 5.0, 23),
  ('00000000-0000-0000-0000-000000000004', 'anna.nilsson@example.se',     'Anna Nilsson',    '+46703219876', false, 'carrier', 4.5, 11),
  ('00000000-0000-0000-0000-000000000005', 'demo@gonow.se',               'Demo Användare',  '+46700000001', true,  'user',    5.0,  0)
on conflict (id) do nothing;

-- Trips — realistic Swedish routes, departing soon
insert into trips (id, carrier_id, from_city, from_lat, from_lng, to_city, to_lat, to_lng,
  departure_at, arrival_est, vehicle_type,
  seats_available, weight_capacity_kg,
  allows_passengers, allows_packages, allows_returns, allows_pets,
  price_per_seat, price_per_kg, status) values

  -- Stockholm → Göteborg today
  ('10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'Stockholm', 59.3293, 18.0686, 'Göteborg', 57.7089, 11.9746,
   now() + interval '2 hours', now() + interval '8 hours',
   'car', 2, 30, true, true, true, false, 180, 12, 'active'),

  -- Stockholm → Malmö today
  ('10000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000002',
   'Stockholm', 59.3293, 18.0686, 'Malmö', 55.6050, 13.0038,
   now() + interval '4 hours', now() + interval '11 hours',
   'car', 1, 15, true, true, false, false, 220, 14, 'active'),

  -- Göteborg → Stockholm tomorrow
  ('10000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000003',
   'Göteborg', 57.7089, 11.9746, 'Stockholm', 59.3293, 18.0686,
   now() + interval '26 hours', now() + interval '32 hours',
   'car', 3, 50, true, true, true, true, 170, 10, 'active'),

  -- Uppsala → Stockholm today
  ('10000000-0000-0000-0000-000000000004',
   '00000000-0000-0000-0000-000000000001',
   'Uppsala', 59.8586, 17.6389, 'Stockholm', 59.3293, 18.0686,
   now() + interval '6 hours', now() + interval '7 hours',
   'car', 2, 20, true, true, true, false, 90, 8, 'active'),

  -- Malmö → Göteborg tomorrow
  ('10000000-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000004',
   'Malmö', 55.6050, 13.0038, 'Göteborg', 57.7089, 11.9746,
   now() + interval '28 hours', now() + interval '31 hours',
   'car', 1, 25, true, true, true, false, 130, 11, 'active'),

  -- Stockholm → Sundsvall in 2 days
  ('10000000-0000-0000-0000-000000000006',
   '00000000-0000-0000-0000-000000000002',
   'Stockholm', 59.3293, 18.0686, 'Sundsvall', 62.3908, 17.3069,
   now() + interval '50 hours', now() + interval '56 hours',
   'car', 2, 40, true, true, false, false, 250, 16, 'active'),

  -- Göteborg → Malmö today
  ('10000000-0000-0000-0000-000000000007',
   '00000000-0000-0000-0000-000000000003',
   'Göteborg', 57.7089, 11.9746, 'Malmö', 55.6050, 13.0038,
   now() + interval '3 hours', now() + interval '6 hours',
   'car', 2, 20, true, true, true, false, 120, 10, 'active'),

  -- Stockholm → Linköping today
  ('10000000-0000-0000-0000-000000000008',
   '00000000-0000-0000-0000-000000000004',
   'Stockholm', 59.3293, 18.0686, 'Linköping', 58.4109, 15.6218,
   now() + interval '5 hours', now() + interval '8 hours',
   'car', 3, 35, true, true, true, false, 150, 12, 'active')

on conflict (id) do nothing;

-- Demo orders for the demo user
insert into orders (id, sender_id, trip_id, type, description, weight_kg,
  pickup_address, dropoff_address, price, commission, carrier_payout, status) values

  ('20000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000005',
   '10000000-0000-0000-0000-000000000001',
   'package', 'Bokpaket, 3 böcker', 2.5,
   'Drottninggatan 10, Stockholm', 'Avenyn 5, Göteborg',
   179, 27, 152, 'in_transit'),

  ('20000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000005',
   '10000000-0000-0000-0000-000000000003',
   'pickup', 'IKEA Kallax hylla', 12,
   'IKEA Kungens Kurva, Stockholm', 'Linnégatan 22, Göteborg',
   320, 48, 272, 'matched')

on conflict (id) do nothing;

-- Sample waitlist entries
insert into waitlist (email, role, city) values
  ('test1@example.se', 'sender',  'Stockholm'),
  ('test2@example.se', 'carrier', 'Göteborg'),
  ('test3@example.se', 'both',    'Malmö')
on conflict (email) do nothing;
