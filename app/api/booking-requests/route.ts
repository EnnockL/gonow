import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = createServiceClient()

    const { data, error } = await supabase.rpc('save_booking_request', {
      p_id: body.id,
      p_trip_id: body.trip_id,
      p_sender_id: body.sender_id ?? null,
      p_service_type: body.service_type ?? 'package',
      p_weight_kg: body.weight_kg ?? 0,
      p_description: body.description ?? '',
      p_pickup_address: body.pickup_address ?? '',
      p_dropoff_address: body.dropoff_address ?? '',
      p_sender_name: body.sender_name ?? '',
      p_sender_phone: body.sender_phone ?? '',
      p_sender_email: body.sender_email ?? '',
      p_recipient_name: body.recipient_name ?? '',
      p_recipient_phone: body.recipient_phone ?? '',
      p_recipient_email: body.recipient_email ?? '',
      p_price_est: body.price_est ?? null,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ booking: data }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
