'use client'

import { loadTrips, type SavedTrip } from '@/components/driver/MyTrips'
import { type Trip } from '@/lib/types'

export type ActiveTripRecord = Trip & {
  users?: {
    name: string
    rating_avg: number
    rating_count: number
    avatar_url?: string
  }
}

function isUpcoming(iso?: string | null) {
  if (!iso) return false
  const time = new Date(iso).getTime()
  return Number.isFinite(time) && time >= Date.now()
}

export function localTripToActiveTrip(trip: SavedTrip): ActiveTripRecord {
  return {
    id: trip.id,
    carrier_id: trip.carrier_id || trip.id,
    from_city: trip.from_city,
    to_city: trip.to_city,
    departure_at: trip.departure_at,
    vehicle_type: trip.vehicle_type,
    vehicle_make: trip.vehicle_make,
    vehicle_model: trip.vehicle_model,
    vehicle_color: trip.vehicle_color,
    vehicle_plate: trip.vehicle_plate,
    vehicle_seats_total: trip.vehicle_seats_total,
    seats_available: trip.seats_available,
    weight_capacity_kg: trip.weight_capacity_kg,
    allows_passengers: trip.allows_passengers,
    allows_packages: trip.allows_packages,
    allows_returns: trip.allows_returns,
    allows_pets: trip.allows_pets,
    price_per_seat: trip.price_per_seat,
    price_per_kg: trip.price_per_kg,
    status: 'active',
    users: {
      name: trip.carrier_name || 'Bärare',
      rating_avg: 5,
      rating_count: 0,
    },
  }
}

export function mergeActiveTrips(serverTrips: ActiveTripRecord[], localTrips: SavedTrip[]) {
  const localMapped = localTrips.map(localTripToActiveTrip)
  const merged = [
    ...localMapped,
    ...serverTrips.filter((trip) => !localMapped.some((localTrip) => localTrip.id === trip.id)),
  ]

  return merged.sort((a, b) => {
    const aTime = new Date(a.departure_at).getTime()
    const bTime = new Date(b.departure_at).getTime()
    return aTime - bTime
  })
}

export async function loadSharedActiveTrips(options?: {
  packagesOnly?: boolean
  limit?: number
}) {
  const packagesOnly = options?.packagesOnly ?? false
  const limit = options?.limit

  const localTrips = loadTrips().filter((trip) => {
    if (!isUpcoming(trip.departure_at)) return false
    if (packagesOnly && !trip.allows_packages) return false
    return true
  })

  try {
    const res = await fetch('/api/trips', { cache: 'no-store' })
    const data = await res.json()
    const serverTrips = ((data.trips || []) as ActiveTripRecord[]).filter((trip) => {
      if (!isUpcoming(trip.departure_at)) return false
      if (trip.status !== 'active') return false
      if (packagesOnly && !trip.allows_packages) return false
      return true
    })

    const merged = mergeActiveTrips(serverTrips, localTrips)
    return typeof limit === 'number' ? merged.slice(0, limit) : merged
  } catch {
    const merged = mergeActiveTrips([], localTrips)
    return typeof limit === 'number' ? merged.slice(0, limit) : merged
  }
}
