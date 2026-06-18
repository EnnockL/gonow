'use client'

import type { BookingRequest } from '@/lib/bookings'
import type { SavedTrip } from '@/components/driver/MyTrips'

const TRIPS_KEY = 'gonow_my_trips'
const BOOKINGS_KEY = 'gonow_bookings'
const DEMO_PREFIX = 'demo-'

function futureIso(daysFromNow: number, hour: number, minute = 0) {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

function loadJson<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]')
  } catch {
    return []
  }
}

function saveJson<T>(key: string, value: T[]) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function seedDemoLocalData() {
  const demoTrips: SavedTrip[] = [
    {
      id: `${DEMO_PREFIX}trip-kiruna-lulea`,
      carrier_id: `${DEMO_PREFIX}carrier-ennock`,
      from_city: 'Kiruna',
      to_city: 'Lulea',
      departure_at: futureIso(1, 8, 30),
      vehicle_type: 'car',
      seats_available: 2,
      weight_capacity_kg: 35,
      price_per_seat: 149,
      price_per_kg: 18,
      allows_passengers: true,
      allows_packages: true,
      allows_returns: true,
      allows_pets: false,
      carrier_name: 'Ennock',
      carrier_phone: '0701234567',
      distance_km: 340,
      duration_min: 270,
      registered_at: new Date().toISOString(),
    },
    {
      id: `${DEMO_PREFIX}trip-stockholm-goteborg`,
      carrier_id: `${DEMO_PREFIX}carrier-sara`,
      from_city: 'Stockholm',
      to_city: 'Goteborg',
      departure_at: futureIso(2, 9, 0),
      vehicle_type: 'car',
      seats_available: 1,
      weight_capacity_kg: 25,
      price_per_seat: 189,
      price_per_kg: 16,
      allows_passengers: true,
      allows_packages: true,
      allows_returns: false,
      allows_pets: true,
      carrier_name: 'Sara J.',
      carrier_phone: '0707654321',
      distance_km: 471,
      duration_min: 320,
      registered_at: new Date().toISOString(),
    },
  ]

  const demoBookings: BookingRequest[] = [
    {
      id: `${DEMO_PREFIX}booking-pending-1`,
      trip_id: `${DEMO_PREFIX}trip-kiruna-lulea`,
      sender_id: `${DEMO_PREFIX}sender-1`,
      service_type: 'package',
      weight_kg: 2,
      description: 'Liten kartong med klader',
      pickup_address: 'Campingvagen 5, Kiruna',
      dropoff_address: 'Smedjegatan 12, Lulea',
      sender_name: 'Maja Andersson',
      sender_phone: '0705551122',
      sender_email: 'maja@example.com',
      recipient_name: 'Oskar Lind',
      recipient_phone: '0705552233',
      recipient_email: 'oskar@example.com',
      status: 'pending',
      price_est: 165,
      created_at: new Date().toISOString(),
    },
    {
      id: `${DEMO_PREFIX}booking-pending-2`,
      trip_id: `${DEMO_PREFIX}trip-kiruna-lulea`,
      sender_id: `${DEMO_PREFIX}sender-2`,
      service_type: 'return',
      weight_kg: 1,
      description: 'Retur till butik, skokartong',
      pickup_address: 'Lombolo 14, Kiruna',
      dropoff_address: 'Centrum, Lulea',
      sender_name: 'Ali Hassan',
      sender_phone: '0703338899',
      sender_email: 'ali@example.com',
      recipient_name: 'H&M Retur',
      recipient_phone: '0101231231',
      recipient_email: 'retur@example.com',
      status: 'pending',
      price_est: 149,
      created_at: new Date().toISOString(),
    },
    {
      id: `${DEMO_PREFIX}booking-accepted-1`,
      trip_id: `${DEMO_PREFIX}trip-stockholm-goteborg`,
      sender_id: `${DEMO_PREFIX}sender-3`,
      service_type: 'package',
      weight_kg: 4,
      description: 'Presentpaket',
      pickup_address: 'Sodermalm, Stockholm',
      dropoff_address: 'Linnestaden, Goteborg',
      sender_name: 'Emma Nilsson',
      sender_phone: '0701116677',
      sender_email: 'emma@example.com',
      recipient_name: 'Jonas Berg',
      recipient_phone: '0701117788',
      recipient_email: 'jonas@example.com',
      status: 'accepted',
      price_est: 219,
      created_at: new Date().toISOString(),
      responded_at: new Date().toISOString(),
    },
  ]

  const existingTrips = loadJson<SavedTrip>(TRIPS_KEY).filter((trip) => !trip.id.startsWith(DEMO_PREFIX))
  const existingBookings = loadJson<BookingRequest>(BOOKINGS_KEY).filter((booking) => !booking.id.startsWith(DEMO_PREFIX))

  saveJson(TRIPS_KEY, [...demoTrips, ...existingTrips])
  saveJson(BOOKINGS_KEY, [...demoBookings, ...existingBookings])

  window.dispatchEvent(new Event('gonow_trips_updated'))
  window.dispatchEvent(new Event('gonow_booking_received'))
}

export function clearDemoLocalData() {
  const trips = loadJson<SavedTrip>(TRIPS_KEY).filter((trip) => !trip.id.startsWith(DEMO_PREFIX))
  const bookings = loadJson<BookingRequest>(BOOKINGS_KEY).filter((booking) => !booking.id.startsWith(DEMO_PREFIX))

  saveJson(TRIPS_KEY, trips)
  saveJson(BOOKINGS_KEY, bookings)

  window.dispatchEvent(new Event('gonow_trips_updated'))
  window.dispatchEvent(new Event('gonow_booking_received'))
}
