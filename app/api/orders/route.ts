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
    .select('*, trips(from_city, to_city, departure_at), booking_requests(sender_name, sender_phone, recipient_name, recipient_phone, recipient_email)')
    .order('created_at', { ascending: false })

  if (userId) {
    query.or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
  }

  if (tripId) {
    query.eq('trip_id', tripId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const orders = (data ?? []) as Record<string, unknown>[]

  // Batch fetch all relevant user IDs (senders + receivers/carriers)
  const allUserIds = [...new Set([
    ...orders.map(o => o.sender_id as string),
    ...orders.map(o => (o.receiver_id || o.carrier_id) as string),
  ].filter(Boolean))]
  const { data: allUsers } = allUserIds.length
    ? await supabase.from('users').select('id, name, phone').in('id', allUserIds)
    : { data: [] }
  const userMap = new Map((allUsers ?? []).map((u: Record<string, string>) => [u.id, u]))

  // Batch fetch booking_request contact info
  const brIds = [...new Set(orders.map(o => o.booking_request_id as string).filter(Boolean))]
  const { data: brRows } = brIds.length
    ? await supabase.from('booking_requests').select('id, sender_name, sender_phone, recipient_name, recipient_phone').in('id', brIds)
    : { data: [] }
  const brMap = new Map((brRows ?? []).map((b: Record<string, string>) => [b.id, b]))

  const enriched = orders.map(o => {
    const carrierId = (o.receiver_id || o.carrier_id) as string | undefined
    return {
      ...o,
      _sender: userMap.get(o.sender_id as string) ?? null,
      _carrier: carrierId ? userMap.get(carrierId) ?? null : null,
      _booking_request: o.booking_request_id ? brMap.get(o.booking_request_id as string) ?? null : null,
    }
  })

  return NextResponse.json({ orders: enriched })
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
