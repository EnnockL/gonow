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
  try {
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

  console.log('[respond] booking lookup:', { found: !!booking, err: bookingError?.message, sender_id: booking?.sender_id, trip_id: booking?.trip_id })

  if (!bookingError && booking) {
    if (booking.status !== 'pending') {
      return NextResponse.json(
        { error: `Bokningen har redan status ${booking.status}` },
        { status: 409 }
      )
    }

    const respondedAt = new Date().toISOString()

    if (status === 'declined') {
      const { error: declineError } = await supabase.rpc('decline_booking_request', {
        p_booking_request_id: id,
        p_carrier_note: carrierNote ?? null,
      })

      if (declineError) {
        return NextResponse.json({ error: declineError.message }, { status: 500 })
      }

      const { data: declinedBooking } = await supabase.from('booking_requests').select('*').eq('id', id).single()
      return NextResponse.json({ booking: declinedBooking })
    }

    if (!booking.sender_id) {
      return NextResponse.json(
        { error: 'Bokningen saknar avsandare och kan inte bli order annu' },
        { status: 400 }
      )
    }

    const { data: tripBookings } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('trip_id', booking.trip_id)

    const { data: trip, error: tripError } = await supabase
      .from('trips').select('*').eq('id', booking.trip_id).single()

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Resan bakom bokningen hittades inte' }, { status: 404 })
    }

    const capacityCheck = canAcceptBooking(trip, (tripBookings ?? []) as typeof booking[], booking)
    if (!capacityCheck.ok) {
      return NextResponse.json(
        { error: capacityCheck.reason ?? 'Resan har inte tillracklig kapacitet langre.' },
        { status: 409 }
      )
    }

    const { data: result, error: rpcError } = await supabase.rpc('accept_booking_request', {
      p_booking_request_id: booking.id,
      p_carrier_note: carrierNote ?? null,
    })

    if (rpcError || !result) {
      console.error('[respond] accept_booking_request error:', JSON.stringify(rpcError))
      return NextResponse.json({ error: rpcError?.message ?? 'Kunde inte acceptera bokning' }, { status: 500 })
    }

    const orderId = (result as { order_id: string }).order_id
    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single()
    const { data: acceptedBooking } = await supabase.from('booking_requests').select('*').eq('id', id).single()

    return NextResponse.json({ booking: acceptedBooking ?? booking, order: order ?? { id: orderId } })
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
    const { error: declineError } = await supabase.rpc('cancel_order_status', { p_order_id: id })

    if (declineError) {
      return NextResponse.json({ error: declineError.message }, { status: 500 })
    }

    const { data: declinedOrder } = await supabase.from('orders').select('*').eq('id', id).single()

    let sender: { name?: string | null; phone?: string | null; email?: string | null } | null = null
    if (order.sender_id) {
      const senderResult = await supabase.from('users').select('name, phone, email').eq('id', order.sender_id).single()
      sender = senderResult.data ?? null
    }

    return NextResponse.json({ booking: toPseudoBooking((declinedOrder ?? order) as Record<string, unknown>, sender ?? undefined), order: declinedOrder ?? order })
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

  const { error: acceptError } = await supabase.rpc('accept_order_direct', {
    p_order_id: id,
    p_receiver_id: trip.carrier_id,
    p_confirmed_at: respondedAt,
  })

  if (acceptError) {
    return NextResponse.json({ error: acceptError.message ?? 'Kunde inte acceptera ordern' }, { status: 500 })
  }

  const { data: acceptedOrder } = await supabase.from('orders').select('*').eq('id', id).single()

  let sender: { name?: string | null; phone?: string | null; email?: string | null } | null = null
  if (order.sender_id) {
    const senderResult = await supabase.from('users').select('name, phone, email').eq('id', order.sender_id).single()
    sender = senderResult.data ?? null
  }

  return NextResponse.json({ booking: toPseudoBooking((acceptedOrder ?? order) as Record<string, unknown>, sender ?? undefined), order: acceptedOrder ?? order })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[respond] unhandled:', msg)
    return NextResponse.json({ error: `Serverfel: ${msg}` }, { status: 500 })
  }
}
