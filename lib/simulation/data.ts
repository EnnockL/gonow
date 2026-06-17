import { Trip, Order, User } from '@/lib/types'

export const SIM_USERS: User[] = [
  {
    id: 'usr-1',
    email: 'erik.lindqvist@example.se',
    name: 'Erik Lindqvist',
    phone: '+46701234567',
    bankid_verified: true,
    role: 'carrier',
    rating_avg: 4.9,
    rating_count: 87,
    created_at: '2024-09-01T10:00:00Z',
  },
  {
    id: 'usr-2',
    email: 'sara.johansson@example.se',
    name: 'Sara Johansson',
    phone: '+46709876543',
    bankid_verified: true,
    role: 'carrier',
    rating_avg: 4.7,
    rating_count: 42,
    created_at: '2024-10-15T08:30:00Z',
  },
  {
    id: 'usr-3',
    email: 'mikael.berg@example.se',
    name: 'Mikael Berg',
    phone: '+46706543210',
    bankid_verified: true,
    role: 'carrier',
    rating_avg: 5.0,
    rating_count: 23,
    created_at: '2024-11-20T14:00:00Z',
  },
  {
    id: 'usr-4',
    email: 'anna.nilsson@example.se',
    name: 'Anna Nilsson',
    phone: '+46703219876',
    bankid_verified: false,
    role: 'carrier',
    rating_avg: 4.5,
    rating_count: 11,
    created_at: '2025-01-05T09:00:00Z',
  },
]

function futureDate(daysAhead: number, hour = 9): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

export const SIM_TRIPS: (Trip & { users: { name: string; rating_avg: number; rating_count: number; avatar_url?: string } })[] = [
  {
    id: 'trp-1',
    carrier_id: 'usr-1',
    users: { name: 'Erik Lindqvist', rating_avg: 4.9, rating_count: 87 },
    from_city: 'Stockholm',
    from_lat: 59.3293,
    from_lng: 18.0686,
    to_city: 'Göteborg',
    to_lat: 57.7089,
    to_lng: 11.9746,
    departure_at: futureDate(0, 8),
    arrival_est: futureDate(0, 14),
    vehicle_type: 'car',
    seats_available: 2,
    weight_capacity_kg: 30,
    allows_passengers: true,
    allows_packages: true,
    allows_returns: true,
    allows_pets: false,
    price_per_seat: 180,
    price_per_kg: 12,
    status: 'active',
  },
  {
    id: 'trp-2',
    carrier_id: 'usr-2',
    users: { name: 'Sara Johansson', rating_avg: 4.7, rating_count: 42 },
    from_city: 'Stockholm',
    from_lat: 59.3293,
    from_lng: 18.0686,
    to_city: 'Malmö',
    to_lat: 55.605,
    to_lng: 13.0038,
    departure_at: futureDate(0, 11),
    arrival_est: futureDate(0, 18),
    vehicle_type: 'car',
    seats_available: 1,
    weight_capacity_kg: 15,
    allows_passengers: true,
    allows_packages: true,
    allows_returns: false,
    allows_pets: false,
    price_per_seat: 220,
    price_per_kg: 14,
    status: 'active',
  },
  {
    id: 'trp-3',
    carrier_id: 'usr-3',
    users: { name: 'Mikael Berg', rating_avg: 5.0, rating_count: 23 },
    from_city: 'Göteborg',
    from_lat: 57.7089,
    from_lng: 11.9746,
    to_city: 'Stockholm',
    to_lat: 59.3293,
    to_lng: 18.0686,
    departure_at: futureDate(1, 7),
    arrival_est: futureDate(1, 13),
    vehicle_type: 'car',
    seats_available: 3,
    weight_capacity_kg: 50,
    allows_passengers: true,
    allows_packages: true,
    allows_returns: true,
    allows_pets: true,
    price_per_seat: 170,
    price_per_kg: 10,
    status: 'active',
  },
  {
    id: 'trp-4',
    carrier_id: 'usr-1',
    users: { name: 'Erik Lindqvist', rating_avg: 4.9, rating_count: 87 },
    from_city: 'Uppsala',
    from_lat: 59.8586,
    from_lng: 17.6389,
    to_city: 'Stockholm',
    to_lat: 59.3293,
    to_lng: 18.0686,
    departure_at: futureDate(0, 17),
    arrival_est: futureDate(0, 18),
    vehicle_type: 'car',
    seats_available: 2,
    weight_capacity_kg: 20,
    allows_passengers: true,
    allows_packages: true,
    allows_returns: true,
    allows_pets: false,
    price_per_seat: 90,
    price_per_kg: 8,
    status: 'active',
  },
  {
    id: 'trp-5',
    carrier_id: 'usr-4',
    users: { name: 'Anna Nilsson', rating_avg: 4.5, rating_count: 11 },
    from_city: 'Malmö',
    from_lat: 55.605,
    from_lng: 13.0038,
    to_city: 'Göteborg',
    to_lat: 57.7089,
    to_lng: 11.9746,
    departure_at: futureDate(1, 9),
    arrival_est: futureDate(1, 12),
    vehicle_type: 'car',
    seats_available: 1,
    weight_capacity_kg: 25,
    allows_passengers: true,
    allows_packages: true,
    allows_returns: true,
    allows_pets: false,
    price_per_seat: 130,
    price_per_kg: 11,
    status: 'active',
  },
  {
    id: 'trp-6',
    carrier_id: 'usr-2',
    users: { name: 'Sara Johansson', rating_avg: 4.7, rating_count: 42 },
    from_city: 'Stockholm',
    from_lat: 59.3293,
    from_lng: 18.0686,
    to_city: 'Sundsvall',
    to_lat: 62.3908,
    to_lng: 17.3069,
    departure_at: futureDate(2, 6),
    arrival_est: futureDate(2, 12),
    vehicle_type: 'car',
    seats_available: 2,
    weight_capacity_kg: 40,
    allows_passengers: true,
    allows_packages: true,
    allows_returns: false,
    allows_pets: false,
    price_per_seat: 250,
    price_per_kg: 16,
    status: 'active',
  },
]

export const SIM_ORDERS: Order[] = [
  {
    id: 'ord-1',
    sender_id: 'sim-user',
    trip_id: 'trp-1',
    type: 'package',
    description: 'Bokpaket, 3 böcker',
    weight_kg: 2.5,
    pickup_address: 'Drottninggatan 10, Stockholm',
    dropoff_address: 'Avenyn 5, Göteborg',
    price: 179,
    commission: 27,
    carrier_payout: 152,
    status: 'in_transit',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'ord-2',
    sender_id: 'sim-user',
    trip_id: 'trp-3',
    type: 'pickup',
    description: 'IKEA Kallax hylla',
    store_name: 'IKEA Kungens Kurva',
    weight_kg: 12,
    pickup_address: 'IKEA Kungens Kurva, Stockholm',
    dropoff_address: 'Linnégatan 22, Göteborg',
    price: 320,
    commission: 48,
    carrier_payout: 272,
    status: 'matched',
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
]

export function matchTrips(params: {
  from_city: string
  to_city: string
  weight_kg: number
  type: string
}): typeof SIM_TRIPS {
  const from = params.from_city.toLowerCase()
  const to = params.to_city.toLowerCase()

  return SIM_TRIPS.map((trip) => {
    let score = 0
    if (trip.from_city.toLowerCase().includes(from)) score += 50
    if (trip.to_city.toLowerCase().includes(to)) score += 50
    if (trip.weight_capacity_kg >= (params.weight_kg || 0)) score += 10
    if (params.type === 'lift' && trip.allows_passengers) score += 20
    if (params.type === 'return' && trip.allows_returns) score += 20
    score += trip.users.rating_avg * 3
    return { ...trip, match_score: score }
  })
    .filter((t) => t.match_score >= 50)
    .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
    .slice(0, 5)
}
