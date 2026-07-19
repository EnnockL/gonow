import type { BookingRequest } from '@/lib/bookings'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'
import { canAcceptBooking } from '@/lib/trip-capacity'
import { createServiceClient } from '@/lib/supabase'
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

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequestUser(req)
    if (!user) return unauthorized()

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const status = body?.status as ResponseStatus | undefined
    const carrierNote = typeof body?.carrier_note === 'string' ? body.carrier_note.trim() : null

    if (status !== 'accepted' && status !== 'declined') {
      return NextResponse.json({ error: 'Ogiltig status.' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data: booking, error: bookingError } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Bokningsförfrågan hittades inte.' }, { status: 404 })
    }

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', booking.trip_id)
      .single()

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Resan bakom bokningen hittades inte.' }, { status: 404 })
    }

    if (trip.carrier_id !== user.id) {
      return NextResponse.json({ error: 'Du får bara svara på dina egna resor.' }, { status: 403 })
    }

    if (booking.status !== 'pending') {
      return NextResponse.json(
        { error: `Bokningen har redan status ${booking.status}.` },
        { status: 409 }
      )
    }

    const respondedAt = new Date().toISOString()

    if (status === 'declined') {
      const { data: declinedBooking, error: declineError } = await supabase
        .from('booking_requests')
        .update({
          status: 'declined',
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

    const { data: tripBookings, error: tripBookingsError } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('trip_id', booking.trip_id)

    if (tripBookingsError) {
      return NextResponse.json({ error: tripBookingsError.message }, { status: 500 })
    }

    const capacityCheck = canAcceptBooking(
      trip,
      (tripBookings ?? []) as BookingRequest[],
      booking as BookingRequest
    )

    if (!capacityCheck.ok) {
      return NextResponse.json(
        { error: capacityCheck.reason ?? 'Resan har inte tillräcklig kapacitet längre.' },
        { status: 409 }
      )
    }

    const price = Number(booking.price_est ?? 0)
    const commission = roundCurrency(price * 0.15)
    const carrierPayout = roundCurrency(price - commission)

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        sender_id: booking.sender_id,
        carrier_id: trip.carrier_id,
        receiver_id: trip.carrier_id,
        trip_id: trip.id,
        booking_request_id: booking.id,
        type: toOrderType(booking.service_type),
        description: booking.description || '',
        weight_kg: Number(booking.weight_kg ?? 0),
        pickup_address: booking.pickup_address || '',
        dropoff_address: booking.dropoff_address || '',
        price,
        commission,
        carrier_payout: carrierPayout,
        status: 'pending',
      })
      .select('*')
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: orderError?.message || 'Kunde inte skapa order.' }, { status: 500 })
    }

    const { data: acceptedBooking, error: acceptError } = await supabase
      .from('booking_requests')
      .update({
        status: 'accepted',
        carrier_note: carrierNote,
        responded_at: respondedAt,
        order_id: order.id,
      })
      .eq('id', booking.id)
      .select('*')
      .single()

    if (acceptError || !acceptedBooking) {
      await supabase.from('orders').delete().eq('id', order.id)
      return NextResponse.json({ error: acceptError?.message || 'Kunde inte uppdatera bokningen.' }, { status: 500 })
    }

    return NextResponse.json({ booking: acceptedBooking, order })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Serverfel: ${msg}` }, { status: 500 })
  }
}
