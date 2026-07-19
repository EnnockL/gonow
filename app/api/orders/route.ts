import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'
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

function getPackageIdFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return null
  const packageId = (metadata as Record<string, unknown>).package_id
  return typeof packageId === 'string' && packageId.trim().length > 0 ? packageId : null
}

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorized()

  const { searchParams } = new URL(req.url)
  const tripId = searchParams.get('trip_id')
  const supabase = createServiceClient()

  const query = supabase
    .from('orders')
    .select('*, trips(from_city, to_city, departure_at)')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id},carrier_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (tripId) {
    query.eq('trip_id', tripId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const orders = (data ?? []) as Record<string, unknown>[]
  const allUserIds = [
    ...new Set(
      [
        ...orders.map((order) => order.sender_id as string),
        ...orders.map((order) => (order.receiver_id || order.carrier_id) as string),
      ].filter(Boolean),
    ),
  ]

  const { data: allUsers } = allUserIds.length
    ? await supabase.from('users').select('id, name, phone').in('id', allUserIds)
    : { data: [] }
  const userMap = new Map((allUsers ?? []).map((entry: Record<string, string>) => [entry.id, entry]))

  const bookingRequestIds = [
    ...new Set(
      orders
        .filter((order) => !getPackageIdFromMetadata(order.metadata))
        .map((order) => order.booking_request_id as string)
        .filter(Boolean),
    ),
  ]
  const { data: bookingRows } = bookingRequestIds.length
    ? await supabase
        .from('booking_requests')
        .select('id, sender_name, sender_phone, recipient_name, recipient_phone')
        .in('id', bookingRequestIds)
    : { data: [] }
  const bookingMap = new Map((bookingRows ?? []).map((entry: Record<string, string>) => [entry.id, entry]))

  const enriched = orders.map((order) => {
    const carrierId = (order.receiver_id || order.carrier_id) as string | undefined
    return {
      ...order,
      _sender: userMap.get(order.sender_id as string) ?? null,
      _carrier: carrierId ? userMap.get(carrierId) ?? null : null,
      _booking_request: order.booking_request_id
        ? bookingMap.get(order.booking_request_id as string) ?? null
        : null,
    }
  })

  return NextResponse.json({ orders: enriched })
}

export async function POST(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorized()

  const body = await req.json()
  const supabase = createServiceClient()

  if (!body?.trip_id) {
    return NextResponse.json({ error: 'trip_id kravs.' }, { status: 400 })
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
  const carrierPayout = Math.round((price - commission) * 100) / 100

  const payload = {
    sender_id: user.id,
    carrier_id: trip.carrier_id,
    receiver_id: trip.carrier_id,
    trip_id: trip.id,
    type: body.type || toOrderType(body.service_type),
    description: body.description || '',
    weight_kg: Number(body.weight_kg ?? 0),
    pickup_address: body.pickup_address || '',
    dropoff_address: body.dropoff_address || '',
    price,
    commission,
    carrier_payout: carrierPayout,
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
