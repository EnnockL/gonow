import { createClient } from './supabase'
import { canAcceptBooking } from './trip-capacity'
import type { Order } from './types'

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
const TRIPS_KEY = 'gonow_my_trips'
type OrderRow = Order & { confirmed_at?: string | null }

function lsLoad(): BookingRequest[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function lsSave(all: BookingRequest[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(all))
}

function lsLoadTrips(): Array<{ id: string; seats_available?: number; weight_capacity_kg?: number }> {
  try {
    return JSON.parse(localStorage.getItem(TRIPS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function mergeBookingData(existing: BookingRequest | undefined, incoming: BookingRequest): BookingRequest {
  return {
    ...existing,
    ...incoming,
    seats_requested: incoming.seats_requested ?? existing?.seats_requested,
  }
}

function serviceTypeToOrderType(serviceType: BookingServiceType): Order['type'] {
  switch (serviceType) {
    case 'passenger':
      return 'lift'
    case 'return':
      return 'return'
    default:
      return 'package'
  }
}

function orderTypeToServiceType(type: string): BookingServiceType {
  switch (type) {
    case 'lift':
      return 'passenger'
    case 'return':
      return 'return'
    default:
      return 'package'
  }
}

function mapOrderStatusToBookingStatus(order: OrderRow): BookingStatus {
  if (order.status === 'cancelled') return 'declined'
  if (order.confirmed_at || ['matched', 'picked_up', 'in_transit', 'delivered', 'confirmed'].includes(order.status)) {
    return 'accepted'
  }
  return 'pending'
}

async function loadSenderMap(senderIds: string[]) {
  const uniqueIds = [...new Set(senderIds.filter(Boolean))]
  const senderMap = new Map<string, { name?: string; phone?: string; email?: string }>()
  if (uniqueIds.length === 0) return senderMap

  try {
    const supabase = createClient()
    const { data } = await supabase.from('users').select('id, name, phone, email').in('id', uniqueIds)
    for (const user of (data ?? []) as Array<{ id: string; name?: string; phone?: string; email?: string }>) {
      senderMap.set(user.id, user)
    }
  } catch {
    // Ignore user lookup errors and fall back to generic labels.
  }

  return senderMap
}

function bookingFromOrder(order: OrderRow, sender?: { name?: string; phone?: string; email?: string }): BookingRequest {
  return {
    id: order.id,
    trip_id: order.trip_id || '',
    sender_id: order.sender_id || undefined,
    service_type: orderTypeToServiceType(order.type),
    seats_requested: order.type === 'lift' ? 1 : undefined,
    weight_kg: order.weight_kg || 0,
    description: order.description || '',
    pickup_address: order.pickup_address || '',
    dropoff_address: order.dropoff_address || '',
    sender_name: sender?.name || 'Avsandare',
    sender_phone: sender?.phone || '',
    sender_email: sender?.email || '',
    recipient_name: '',
    recipient_phone: '',
    recipient_email: '',
    status: mapOrderStatusToBookingStatus(order),
    order_id: order.id,
    price_est: order.price,
    created_at: order.created_at,
    responded_at: order.confirmed_at || undefined,
  }
}

async function loadOrdersAsBookings(filter?: { tripId?: string }) {
  const search = new URLSearchParams()
  if (filter?.tripId) {
    search.set('trip_id', filter.tripId)
  }

  const res = await fetch(`/api/orders${search.toString() ? `?${search.toString()}` : ''}`, {
    cache: 'no-store',
  }).catch(() => null)

  if (!res || !res.ok) {
    return null
  }

  const payload = await res.json().catch(() => null)
  if (!payload?.orders) {
    return null
  }

  const orders = payload.orders as OrderRow[]
  const senderMap = await loadSenderMap(orders.map((order) => order.sender_id).filter(Boolean) as string[])
  return orders.map((order) => bookingFromOrder(order, order.sender_id ? senderMap.get(order.sender_id) : undefined))
}

function lsUpsert(entry: BookingRequest) {
  const all = lsLoad()
  const idx = all.findIndex((b) => b.id === entry.id)
  if (idx >= 0) {
    all[idx] = mergeBookingData(all[idx], entry)
  } else {
    all.unshift(entry)
  }
  lsSave(all)
}

function dispatch() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('gonow_booking_received'))
  }
}

export async function saveBooking(
  b: Omit<BookingRequest, 'id' | 'created_at'>
): Promise<BookingRequest> {
  const entry: BookingRequest = {
    ...b,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  }

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('booking_requests')
      .insert({
        id: entry.id,
        trip_id: entry.trip_id,
        sender_id: entry.sender_id ?? null,
        service_type: entry.service_type,
        weight_kg: entry.weight_kg,
        description: entry.description,
        pickup_address: entry.pickup_address,
        dropoff_address: entry.dropoff_address,
        sender_name: entry.sender_name,
        sender_phone: entry.sender_phone,
        sender_email: entry.sender_email || null,
        recipient_name: entry.recipient_name,
        recipient_phone: entry.recipient_phone,
        recipient_email: entry.recipient_email || null,
        status: entry.status,
        price_est: entry.price_est ?? null,
      })
      .select('*')
      .single()

    if (!error && data) {
      lsUpsert(data as BookingRequest)
      dispatch()
      return data as BookingRequest
    }
  } catch {
    // Fall back to local cache when Supabase is unavailable.
  }

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_id: entry.sender_id ?? null,
        trip_id: entry.trip_id,
        service_type: entry.service_type,
        description: entry.description,
        weight_kg: entry.weight_kg,
        pickup_address: entry.pickup_address,
        dropoff_address: entry.dropoff_address,
        price_est: entry.price_est ?? 0,
        status: 'pending',
      }),
    })

    const payload = await res.json().catch(() => null)
    if (res.ok && payload?.order) {
      const fallbackBooking = {
        ...entry,
        id: (payload.order as OrderRow).id,
        order_id: (payload.order as OrderRow).id,
      } satisfies BookingRequest
      lsUpsert(fallbackBooking)
      dispatch()
      return fallbackBooking
    }
  } catch {
    // Fall back to local cache if orders insert also fails.
  }

  lsUpsert(entry)
  dispatch()
  return entry
}

export async function loadAllBookings(): Promise<BookingRequest[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('booking_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data && data.length > 0) {
      const local = lsLoad()
      const merged = (data as BookingRequest[]).map((booking) => mergeBookingData(local.find((item) => item.id === booking.id), booking))
      const localOnly = local.filter((item) => !merged.some((booking) => booking.id === item.id))
      const all = [...merged, ...localOnly]
      lsSave(all)
      return all
    }
  } catch {
    // Fall through to local cache.
  }

  try {
    const remoteOrders = await loadOrdersAsBookings()
    if (remoteOrders) {
      const local = lsLoad()
      const merged = remoteOrders.map((booking) => mergeBookingData(local.find((item) => item.id === booking.id), booking))
      const localOnly = local.filter((item) => !merged.some((booking) => booking.id === item.id))
      const all = [...merged, ...localOnly]
      lsSave(all)
      return all
    }
  } catch {
    // Fall through to local cache.
  }

  return lsLoad()
}

export async function getBookingsForTrip(trip_id: string): Promise<BookingRequest[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('trip_id', trip_id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      const local = lsLoad().filter((item) => item.trip_id === trip_id)
      const merged = (data as BookingRequest[]).map((booking) => mergeBookingData(local.find((item) => item.id === booking.id), booking))
      const localOnly = local.filter((item) => !merged.some((booking) => booking.id === item.id))
      return [...merged, ...localOnly]
    }
  } catch {
    // Fall through to local cache.
  }

  try {
    const remoteOrders = await loadOrdersAsBookings({ tripId: trip_id })
    if (remoteOrders) {
      const local = lsLoad().filter((item) => item.trip_id === trip_id)
      const merged = remoteOrders.map((booking) => mergeBookingData(local.find((item) => item.id === booking.id), booking))
      const localOnly = local.filter((item) => !merged.some((booking) => booking.id === item.id))
      return [...merged, ...localOnly]
    }
  } catch {
    // Fall through to local cache.
  }

  return lsLoad().filter((b) => b.trip_id === trip_id)
}

export async function updateBookingStatus(
  id: string,
  status: 'accepted' | 'declined',
  carrier_note?: string
): Promise<void> {
  const responded_at = new Date().toISOString()
  let remoteError: Error | null = null
  let shouldSurfaceRemoteError = false

  try {
    const res = await fetch(`/api/booking-requests/${id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, carrier_note }),
    })

    if (res.ok) {
      const { booking } = await res.json()
      if (booking) {
        lsUpsert(booking as BookingRequest)
        dispatch()
        return
      }
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      shouldSurfaceRemoteError = true
      if (data?.error) {
        remoteError = new Error(data.error)
      } else {
        remoteError = new Error('Kunde inte uppdatera bokningen.')
      }
    }
  } catch (error) {
    remoteError = error instanceof Error ? error : new Error('Kunde inte uppdatera bokningen.')
  }

  const current = lsLoad().find((b) => b.id === id)
  if (!current) {
    throw remoteError ?? new Error('Bokningen hittades inte.')
  }

  if (status === 'accepted') {
    const trip = lsLoadTrips().find((item) => item.id === current.trip_id)
    if (trip) {
      const check = canAcceptBooking(trip, lsLoad().filter((booking) => booking.trip_id === current.trip_id), current)
      if (!check.ok) {
        throw new Error(check.reason || 'Resan har inte tillräcklig kapacitet.')
      }
    }
  }

  const all = lsLoad().map((b) =>
    b.id === id ? { ...b, status, carrier_note: carrier_note ?? b.carrier_note, responded_at } : b
  )
  lsSave(all)
  dispatch()

  if (remoteError && shouldSurfaceRemoteError) {
    throw remoteError
  }
}

export async function cancelBooking(id: string): Promise<void> {
  const res = await fetch(`/api/booking-requests/${id}/cancel`, { method: 'POST' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error || 'Kunde inte avbryta förfrågan.')
  }
  const all = lsLoad().map((b) =>
    b.id === id ? { ...b, status: 'cancelled' as BookingStatus } : b
  )
  lsSave(all)
  dispatch()
}

export function loadAllBookingsSync(): BookingRequest[] {
  return lsLoad()
}

export function getBookingsForTripSync(trip_id: string): BookingRequest[] {
  return lsLoad().filter((b) => b.trip_id === trip_id)
}
