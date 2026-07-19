import { createClient } from './supabase'
import { authedFetch } from './auth/authed-fetch'

export type BookingServiceType = 'package' | 'passenger' | 'return'
export type BookingStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'

export interface BookingRequest {
  id: string
  trip_id: string
  sender_id?: string
  service_type: BookingServiceType
  seats_requested?: number
  weight_kg: number
  description: string
  pickup_address: string
  dropoff_address: string
  sender_name: string
  sender_phone: string
  sender_email: string
  recipient_name: string
  recipient_phone: string
  recipient_email: string
  status: BookingStatus
  order_id?: string
  price_est?: number
  carrier_note?: string
  created_at: string
  responded_at?: string
}

const LS_KEY = 'gonow_bookings'

function canUseStorage() {
  return typeof window !== 'undefined'
}

function lsLoad(): BookingRequest[] {
  if (!canUseStorage()) return []
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function lsSave(all: BookingRequest[]) {
  if (!canUseStorage()) return
  localStorage.setItem(LS_KEY, JSON.stringify(all))
}

function mergeBookingData(existing: BookingRequest | undefined, incoming: BookingRequest): BookingRequest {
  return {
    ...existing,
    ...incoming,
    seats_requested: incoming.seats_requested ?? existing?.seats_requested,
  }
}

function cacheBookings(next: BookingRequest[]) {
  lsSave(next)
  return next
}

function mergeRemoteWithCache(remote: BookingRequest[]) {
  const local = lsLoad()
  const merged = remote.map((booking) =>
    mergeBookingData(local.find((item) => item.id === booking.id), booking)
  )
  return cacheBookings(merged)
}

function upsertCachedBooking(entry: BookingRequest) {
  const all = lsLoad()
  const idx = all.findIndex((booking) => booking.id === entry.id)
  if (idx >= 0) {
    all[idx] = mergeBookingData(all[idx], entry)
  } else {
    all.unshift(entry)
  }
  cacheBookings(all)
}

function dispatch() {
  if (!canUseStorage()) return
  window.dispatchEvent(new Event('gonow_booking_received'))
}

function normalizeRemoteBooking(raw: Partial<BookingRequest>): BookingRequest {
  return {
    id: String(raw.id ?? crypto.randomUUID()),
    trip_id: String(raw.trip_id ?? ''),
    sender_id: raw.sender_id ?? undefined,
    service_type: (raw.service_type ?? 'package') as BookingServiceType,
    seats_requested: raw.seats_requested ?? undefined,
    weight_kg: Number(raw.weight_kg ?? 0),
    description: raw.description ?? '',
    pickup_address: raw.pickup_address ?? '',
    dropoff_address: raw.dropoff_address ?? '',
    sender_name: raw.sender_name ?? '',
    sender_phone: raw.sender_phone ?? '',
    sender_email: raw.sender_email ?? '',
    recipient_name: raw.recipient_name ?? '',
    recipient_phone: raw.recipient_phone ?? '',
    recipient_email: raw.recipient_email ?? '',
    status: (raw.status ?? 'pending') as BookingStatus,
    order_id: raw.order_id ?? undefined,
    price_est: raw.price_est ?? undefined,
    carrier_note: raw.carrier_note ?? undefined,
    created_at: raw.created_at ?? new Date().toISOString(),
    responded_at: raw.responded_at ?? undefined,
  }
}

async function fetchRemoteBookings(filter?: { tripId?: string }) {
  const supabase = createClient()
  let query = supabase
    .from('booking_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (filter?.tripId) {
    query = query.eq('trip_id', filter.tripId)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message || 'Kunde inte ladda bokningar.')
  }

  return (data ?? []).map((booking: Record<string, unknown>) => normalizeRemoteBooking(booking as Partial<BookingRequest>))
}

export async function saveBooking(
  booking: Omit<BookingRequest, 'id' | 'created_at'>
): Promise<BookingRequest> {
  const entry: BookingRequest = {
    ...booking,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  }

  let res: Response
  try {
    res = await authedFetch('/api/booking-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error('Kunde inte skicka bokningsförfrågan.')
  }

  const json = await res.json().catch(() => ({} as { error?: string; booking?: Partial<BookingRequest> }))
  if (!res.ok || !json.booking) {
    throw new Error(json.error || 'Kunde inte skicka bokningsförfrågan.')
  }

  const saved = normalizeRemoteBooking(json.booking)
  upsertCachedBooking(saved)
  dispatch()
  return saved
}

export async function loadAllBookings(): Promise<BookingRequest[]> {
  const remote = await fetchRemoteBookings()
  return mergeRemoteWithCache(remote)
}

export async function getBookingsForTrip(trip_id: string): Promise<BookingRequest[]> {
  const remote = await fetchRemoteBookings({ tripId: trip_id })
  return mergeRemoteWithCache(remote).filter((booking) => booking.trip_id === trip_id)
}

export async function updateBookingStatus(
  id: string,
  status: 'accepted' | 'declined',
  carrier_note?: string
): Promise<void> {
  const current = (await loadAllBookings()).find((booking) => booking.id === id)
  if (!current) {
    throw new Error('Bokningen hittades inte. Ladda om sidan och försök igen.')
  }

  const res = await authedFetch(`/api/booking-requests/${id}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, carrier_note }),
  })

  const json = await res.json().catch(() => ({} as { error?: string; booking?: Partial<BookingRequest> }))
  if (!res.ok || !json.booking) {
    throw new Error(json.error || 'Kunde inte uppdatera bokningen.')
  }

  upsertCachedBooking(normalizeRemoteBooking(json.booking))
  dispatch()
}

export async function cancelBooking(id: string): Promise<void> {
  const res = await authedFetch(`/api/booking-requests/${id}/cancel`, { method: 'POST' })
  const json = await res.json().catch(() => ({} as { error?: string }))
  if (!res.ok) {
    throw new Error(json.error || 'Kunde inte avbryta förfrågan.')
  }

  const all = lsLoad().map((booking) =>
    booking.id === id ? { ...booking, status: 'cancelled' as BookingStatus } : booking
  )
  cacheBookings(all)
  dispatch()
}

export function loadAllBookingsSync(): BookingRequest[] {
  return lsLoad()
}

export function getBookingsForTripSync(trip_id: string): BookingRequest[] {
  return lsLoad().filter((booking) => booking.trip_id === trip_id)
}
