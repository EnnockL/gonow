import type { BookingRequest } from './bookings'

type TripLike = {
  id: string
  seats_available?: number
  weight_capacity_kg?: number
}

export interface TripCapacitySnapshot {
  acceptedPassengers: number
  pendingPassengers: number
  acceptedPackages: number
  pendingPackages: number
  acceptedWeightKg: number
  pendingWeightKg: number
  seatsLeft: number | null
  weightLeftKg: number | null
}

export interface TripAcceptanceCheck {
  ok: boolean
  reason?: string
}

export function getPassengerSeats(booking: BookingRequest) {
  return Math.max(1, booking.seats_requested ?? 1)
}

export function getTripCapacitySnapshot(trip: TripLike, bookings: BookingRequest[]): TripCapacitySnapshot {
  const acceptedPassengers = bookings
    .filter((booking) => booking.service_type === 'passenger' && booking.status === 'accepted')
    .reduce((sum, booking) => sum + getPassengerSeats(booking), 0)

  const pendingPassengers = bookings
    .filter((booking) => booking.service_type === 'passenger' && booking.status === 'pending')
    .reduce((sum, booking) => sum + getPassengerSeats(booking), 0)

  const acceptedPackageBookings = bookings.filter((booking) => booking.service_type !== 'passenger' && booking.status === 'accepted')
  const pendingPackageBookings = bookings.filter((booking) => booking.service_type !== 'passenger' && booking.status === 'pending')

  const acceptedWeightKg = acceptedPackageBookings.reduce((sum, booking) => sum + Number(booking.weight_kg || 0), 0)
  const pendingWeightKg = pendingPackageBookings.reduce((sum, booking) => sum + Number(booking.weight_kg || 0), 0)

  const seatsLeft = typeof trip.seats_available === 'number'
    ? Math.max(0, trip.seats_available - acceptedPassengers)
    : null

  const weightLeftKg = typeof trip.weight_capacity_kg === 'number'
    ? Math.max(0, Number(trip.weight_capacity_kg) - acceptedWeightKg)
    : null

  return {
    acceptedPassengers,
    pendingPassengers,
    acceptedPackages: acceptedPackageBookings.length,
    pendingPackages: pendingPackageBookings.length,
    acceptedWeightKg,
    pendingWeightKg,
    seatsLeft,
    weightLeftKg,
  }
}

export function getMyTripBooking(bookings: BookingRequest[], userId?: string | null) {
  if (!userId) return null
  return bookings.find((booking) => booking.sender_id === userId) ?? null
}

export function canAcceptBooking(trip: TripLike, bookings: BookingRequest[], booking: BookingRequest): TripAcceptanceCheck {
  const snapshot = getTripCapacitySnapshot(
    trip,
    bookings.filter((item) => item.id !== booking.id)
  )

  if (booking.service_type === 'passenger') {
    const seatsNeeded = getPassengerSeats(booking)
    if (snapshot.seatsLeft !== null && seatsNeeded > snapshot.seatsLeft) {
      return {
        ok: false,
        reason: `Inte tillräckligt många lediga säten. Begärt: ${seatsNeeded}, kvar: ${snapshot.seatsLeft}.`,
      }
    }
    return { ok: true }
  }

  const requestedWeight = Number(booking.weight_kg || 0)
  if (snapshot.weightLeftKg !== null && requestedWeight > snapshot.weightLeftKg) {
    return {
      ok: false,
      reason: `Inte tillräcklig paketkapacitet. Begärt: ${requestedWeight} kg, kvar: ${snapshot.weightLeftKg} kg.`,
    }
  }

  return { ok: true }
}
