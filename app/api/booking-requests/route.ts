import type { BookingRequest, BookingServiceType } from '@/lib/bookings'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

type CreateBookingBody = Partial<BookingRequest>

function normalizeServiceType(value: unknown): BookingServiceType {
  return value === 'passenger' || value === 'return' ? value : 'package'
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req)
    if (!user) return unauthorized()

    const body = (await req.json()) as CreateBookingBody
    if (!body.trip_id) return badRequest('trip_id saknas.')
    if (!body.pickup_address?.trim()) return badRequest('Upphämtningsadress saknas.')
    if (!body.dropoff_address?.trim()) return badRequest('Avlämningsadress saknas.')
    if (!body.sender_name?.trim()) return badRequest('Avsändarnamn saknas.')
    if (!body.sender_phone?.trim()) return badRequest('Avsändartelefon saknas.')
    if (!body.recipient_name?.trim()) return badRequest('Mottagarnamn saknas.')
    if (!body.recipient_phone?.trim()) return badRequest('Mottagartelefon saknas.')

    const supabase = createServiceClient()

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, carrier_id, status, allows_packages, allows_passengers, allows_returns')
      .eq('id', body.trip_id)
      .single()

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Resan hittades inte.' }, { status: 404 })
    }

    if (trip.status !== 'active') {
      return NextResponse.json({ error: 'Resan är inte längre aktiv.' }, { status: 409 })
    }

    const serviceType = normalizeServiceType(body.service_type)
    if (serviceType === 'package' && !trip.allows_packages) {
      return NextResponse.json({ error: 'Den här resan tar inte paket.' }, { status: 409 })
    }
    if (serviceType === 'passenger' && !trip.allows_passengers) {
      return NextResponse.json({ error: 'Den här resan tar inte passagerare.' }, { status: 409 })
    }
    if (serviceType === 'return' && !trip.allows_returns) {
      return NextResponse.json({ error: 'Den här resan tar inte returer.' }, { status: 409 })
    }

    if (trip.carrier_id === user.id) {
      return NextResponse.json({ error: 'Du kan inte boka din egen resa.' }, { status: 409 })
    }

    const bookingId = body.id && typeof body.id === 'string' ? body.id : crypto.randomUUID()
    const payload = {
      id: bookingId,
      trip_id: trip.id,
      sender_id: user.id,
      service_type: serviceType,
      seats_requested: serviceType === 'passenger' ? Math.max(1, Number(body.seats_requested ?? 1)) : null,
      weight_kg: serviceType === 'passenger' ? 0 : Number(body.weight_kg ?? 0),
      description: body.description?.trim() ?? '',
      pickup_address: body.pickup_address.trim(),
      dropoff_address: body.dropoff_address.trim(),
      sender_name: body.sender_name.trim(),
      sender_phone: body.sender_phone.trim(),
      sender_email: (body.sender_email || user.email || '').trim(),
      recipient_name: body.recipient_name.trim(),
      recipient_phone: body.recipient_phone.trim(),
      recipient_email: (body.recipient_email || '').trim(),
      status: 'pending',
      price_est: body.price_est ?? null,
    }

    const { data, error } = await supabase
      .from('booking_requests')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ booking: data }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
