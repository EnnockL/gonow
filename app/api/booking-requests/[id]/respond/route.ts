import { createServiceClient } from '@/lib/supabase'
import type { BookingRequest } from '@/lib/bookings'
import { canAcceptBooking } from '@/lib/trip-capacity'
import { NextRequest, NextResponse } from 'next/server'

type ResponseStatus = 'accepted' | 'declined'

function toOrderType(serviceType: string) {
  switch (serviceType) {
    case 'passenger':
      return 'lift'
    case 'return':
      return 'return'
    default:
      return 'package'
  }
}

function toBookingStatusFromOrder(order: { status: string; confirmed_at?: string | null }) {
  if (order.status === 'cancelled') return 'declined'
  if (order.confirmed_at || ['matched', 'picked_up', 'in_transit', 'delivered', 'confirmed'].includes(order.status)) {
    return 'accepted'
  }
  return 'pending'
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

function toPseudoBooking(
  order: Record<string, unknown>,
  sender?: { name?: string | null; phone?: string | null; email?: string | null }
) {
  return {
    id: String(order.id),
    trip_id: String(order.trip_id || ''),
    sender_id: typeof order.sender_id === 'string' ? order.sender_id : undefined,
    service_type: order.type === 'lift' ? 'passenger' : order.type === 'return' ? 'return' : 'package',
    weight_kg: Number(order.weight_kg || 0),
    description: String(order.description || ''),
    pickup_address: String(order.pickup_address || ''),
    dropoff_address: String(order.dropoff_address || ''),
    sender_name: sender?.name || 'Avsandare',
    sender_phone: sender?.phone || '',
    sender_email: sender?.email || '',
    recipient_name: '',
    recipient_phone: '',
    recipient_email: '',
    status: toBookingStatusFromOrder({
      status: String(order.status || 'pending'),
      confirmed_at: typeof order.confirmed_at === 'string' ? order.confirmed_at : null,
    }),
    order_id: String(order.id),
    price_est: Number(order.price || 0),
    created_at: String(order.created_at || new Date().toISOString()),
    responded_at: typeof order.confirmed_at === 'string' ? order.confirmed_at : undefined,
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const status = body?.status as ResponseStatus | undefined
  const carrierNote = typeof body?.carrier_note === 'string' ? body.carrier_note.trim() : null

  if (status !== 'accepted' && status !== 'declined') {
    return NextResponse.json({ error: 'Ogiltig status' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: booking, error: bookingError } = await supabase
    .from('booking_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (!bookingError && booking) {
    if (booking.status !== 'pending') {
      return NextResponse.json(
        { error: `Bokningen har redan status ${booking.status}` },
        { status: 409 }
      )
    }

    const respondedAt = new Date().toISOString()

    if (status === 'declined') {
      const { data: declinedBooking, error: declineError } = await supabase
        .from('booking_requests')
        .update({
          status,
          carrier_note: carrierNote,
          responded_at: respondedAt,
        })
        .eq('id', id)
        .select('*')
        .single()

      if (declineError) {
        return NextResponse.json({ error: declineError.message }, { status: 500 })
      }

      return NextResponse.json({ booking: declinedBooking })
    }

    if (!booking.sender_id) {
      return NextResponse.json(
        { error: 'Bokningen saknar avsandare och kan inte bli order annu' },
        { status: 400 }
      )
    }

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', booking.trip_id)
      .single()

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Resan bakom bokningen hittades inte' }, { status: 404 })
    }

    const { data: tripBookings, error: tripBookingsError } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('trip_id', booking.trip_id)

    if (tripBookingsError) {
      return NextResponse.json({ error: tripBookingsError.message }, { status: 500 })
    }

    const capacityCheck = canAcceptBooking(trip, (tripBookings ?? []) as typeof booking[], booking)
    if (!capacityCheck.ok) {
      return NextResponse.json(
        { error: capacityCheck.reason ?? 'Resan har inte tillracklig kapacitet langre.' },
        { status: 409 }
      )
    }

    const priceEstimate = Number(booking.price_est ?? 0)
    const seatPrice = Number(trip.price_per_seat ?? 0)
    const kiloPrice = Number(trip.price_per_kg ?? 0)
    const weight = Number(booking.weight_kg ?? 0)

    const fallbackPrice =
      booking.service_type === 'passenger'
        ? seatPrice || 0
        : weight > 0
          ? kiloPrice * weight
          : kiloPrice || 0

    const price = roundCurrency(priceEstimate > 0 ? priceEstimate : fallbackPrice)
    const commission = roundCurrency(price * 0.15)
    const carrierPayout = roundCurrency(price - commission)

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        sender_id: booking.sender_id,
        receiver_id: trip.carrier_id,
        trip_id: trip.id,
        booking_request_id: booking.id,
        type: toOrderType(booking.service_type),
        description: booking.description,
        weight_kg: booking.weight_kg,
        pickup_address: booking.pickup_address,
        dropoff_address: booking.dropoff_address,
        price,
        commission,
        carrier_payout: carrierPayout,
        status: 'pending',
        confirmed_at: respondedAt,
      })
      .select('*')
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: orderError?.message ?? 'Kunde inte skapa order' }, { status: 500 })
    }

    const { data: acceptedBooking, error: acceptedError } = await supabase
      .from('booking_requests')
      .update({
        status,
        carrier_note: carrierNote,
        responded_at: respondedAt,
        order_id: order.id,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (acceptedError) {
      await supabase.from('orders').delete().eq('id', order.id)
      return NextResponse.json({ error: acceptedError.message }, { status: 500 })
    }

    return NextResponse.json({ booking: acceptedBooking, order })
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Bokningsforfragan hittades inte' }, { status: 404 })
  }

  if (order.status === 'cancelled' || order.confirmed_at) {
    return NextResponse.json({ error: 'Bokningen har redan hanterats.' }, { status: 409 })
  }

  const respondedAt = new Date().toISOString()

  if (status === 'declined') {
    const { data: declinedOrder, error: declineError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        confirmed_at: respondedAt,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (declineError || !declinedOrder) {
      return NextResponse.json({ error: declineError?.message ?? 'Kunde inte avböja ordern' }, { status: 500 })
    }

    let sender: { name?: string | null; phone?: string | null; email?: string | null } | null = null
    if (order.sender_id) {
      const senderResult = await supabase.from('users').select('name, phone, email').eq('id', order.sender_id).single()
      sender = senderResult.data ?? null
    }

    return NextResponse.json({ booking: toPseudoBooking(declinedOrder as Record<string, unknown>, sender ?? undefined), order: declinedOrder })
  }

  if (!order.trip_id) {
    return NextResponse.json({ error: 'Ordern saknar kopplad resa.' }, { status: 400 })
  }

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*')
    .eq('id', order.trip_id)
    .single()

  if (tripError || !trip) {
    return NextResponse.json({ error: 'Resan bakom bokningen hittades inte' }, { status: 404 })
  }

  const { data: tripOrders, error: tripOrdersError } = await supabase
    .from('orders')
    .select('*')
    .eq('trip_id', order.trip_id)

  if (tripOrdersError) {
    return NextResponse.json({ error: tripOrdersError.message }, { status: 500 })
  }

  const mappedTripBookings: BookingRequest[] = ((tripOrders ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id || ''),
    trip_id: String(row.trip_id || ''),
    sender_id: typeof row.sender_id === 'string' ? row.sender_id : undefined,
    service_type: row.type === 'lift' ? 'passenger' : row.type === 'return' ? 'return' : 'package',
    weight_kg: Number(row.weight_kg ?? 0),
    description: String(row.description || ''),
    pickup_address: String(row.pickup_address || ''),
    dropoff_address: String(row.dropoff_address || ''),
    sender_name: '',
    sender_phone: '',
    sender_email: '',
    recipient_name: '',
    recipient_phone: '',
    recipient_email: '',
    status: row.id === order.id ? 'pending' : toBookingStatusFromOrder({
      status: String(row.status || 'pending'),
      confirmed_at: typeof row.confirmed_at === 'string' ? row.confirmed_at : null,
    }),
    created_at: String(row.created_at || new Date().toISOString()),
  }))

  const candidate = mappedTripBookings.find((row) => row.id === order.id)
  if (!candidate) {
    return NextResponse.json({ error: 'Ordern kunde inte matchas mot resan.' }, { status: 404 })
  }

  const capacityCheck = canAcceptBooking(trip, mappedTripBookings, candidate)
  if (!capacityCheck.ok) {
    return NextResponse.json(
      { error: capacityCheck.reason ?? 'Resan har inte tillracklig kapacitet langre.' },
      { status: 409 }
    )
  }

  const { data: acceptedOrder, error: acceptError } = await supabase
    .from('orders')
    .update({
      receiver_id: trip.carrier_id,
      confirmed_at: respondedAt,
      status: 'pending',
    })
    .eq('id', id)
    .select('*')
    .single()

  if (acceptError || !acceptedOrder) {
    return NextResponse.json({ error: acceptError?.message ?? 'Kunde inte acceptera ordern' }, { status: 500 })
  }

  let sender: { name?: string | null; phone?: string | null; email?: string | null } | null = null
  if (order.sender_id) {
    const senderResult = await supabase.from('users').select('name, phone, email').eq('id', order.sender_id).single()
    sender = senderResult.data ?? null
  }

  return NextResponse.json({ booking: toPseudoBooking(acceptedOrder as Record<string, unknown>, sender ?? undefined), order: acceptedOrder })
}
