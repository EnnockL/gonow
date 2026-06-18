import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

function toOrderType(serviceType?: string) {
  switch (serviceType) {
    case 'passenger':
      return 'lift'
    case 'return':
      return 'return'
    default:
      return 'package'
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  const tripId = searchParams.get('trip_id')
  const supabase = createServiceClient()

  const query = supabase
    .from('orders')
    .select('*, trips(from_city, to_city, departure_at)')
    .order('created_at', { ascending: false })

  if (userId) {
    query.or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
  }

  if (tripId) {
    query.eq('trip_id', tripId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = createServiceClient()

  if (!body?.sender_id || !body?.trip_id) {
    return NextResponse.json({ error: 'sender_id och trip_id krävs.' }, { status: 400 })
  }

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, carrier_id')
    .eq('id', body.trip_id)
    .single()

  if (tripError || !trip) {
    return NextResponse.json({ error: 'Resan hittades inte.' }, { status: 404 })
  }

  const price = Number(body.price ?? body.price_est ?? 0)
  const commission = Math.round(price * 0.15 * 100) / 100
  const carrier_payout = Math.round((price - commission) * 100) / 100

  const payload = {
    sender_id: body.sender_id,
    receiver_id: trip.carrier_id,
    trip_id: trip.id,
    type: body.type || toOrderType(body.service_type),
    description: body.description || '',
    weight_kg: Number(body.weight_kg ?? 0),
    pickup_address: body.pickup_address || '',
    dropoff_address: body.dropoff_address || '',
    price,
    commission,
    carrier_payout,
    status: body.status || 'pending',
  }

  const { data, error } = await supabase
    .from('orders')
    .insert(payload)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ order: data }, { status: 201 })
}
