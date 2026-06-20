import { createServiceClient } from '@/lib/supabase'
import { sendSmsNotification } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('lift_requests')
      .select('*, users(name, rating_avg, avatar_url)')
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json({ lift_request: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const supabase = createServiceClient()

    const updatePayload: Record<string, unknown> = { status: body.status }
    if (body.carrier_id !== undefined) updatePayload.carrier_id = body.carrier_id
    if (body.matched_trip_id) updatePayload.matched_trip_id = body.matched_trip_id
    if (body.final_price !== undefined) updatePayload.final_price = body.final_price

    const { data, error } = await supabase
      .from('lift_requests')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notiser vid statusändring
    if (body.status === 'offered' && data.passenger_id) {
      const { data: passenger } = await supabase.from('users').select('phone, name').eq('id', data.passenger_id).single()
      if (passenger?.phone) {
        await sendSmsNotification(
          passenger.phone,
          `En förare har erbjudit dig plats på din resa ${data.from_city} → ${data.to_city}. Öppna Gonow för att acceptera.`
        )
      }
    }

    if (body.status === 'matched' && data.carrier_id) {
      const { data: carrier } = await supabase.from('users').select('phone, name').eq('id', data.carrier_id).single()
      if (carrier?.phone) {
        await sendSmsNotification(
          carrier.phone,
          `Passageraren har accepterat din plats på resan ${data.from_city} → ${data.to_city}. Kontakta passageraren för detaljer.`
        )
      }
    }

    return NextResponse.json({ lift_request: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
