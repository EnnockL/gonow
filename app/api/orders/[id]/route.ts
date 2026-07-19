import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getRequestUser(req)
  if (!user) return unauthorized()

  const { id } = await params
  const supabase = createServiceClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select('*, trips(from_city, to_city, departure_at, carrier_id)')
    .eq('id', id)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'Order hittades inte.' }, { status: 404 })
  }

  const tripCarrierId = order.trips?.carrier_id ?? null
  const carrierId = tripCarrierId ?? order.receiver_id ?? order.carrier_id ?? null
  const canAccess =
    order.sender_id === user.id ||
    order.receiver_id === user.id ||
    order.carrier_id === user.id ||
    tripCarrierId === user.id

  if (!canAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [carrierRes, senderRes] = await Promise.all([
    carrierId
      ? supabase.from('users').select('id, name, rating_avg, avatar_url').eq('id', carrierId).single()
      : Promise.resolve({ data: null }),
    order.sender_id
      ? supabase.from('users').select('id, name').eq('id', order.sender_id).single()
      : Promise.resolve({ data: null }),
  ])

  let recipient = null
  if (order.booking_request_id) {
    const { data: booking } = await supabase
      .from('booking_requests')
      .select('recipient_name, recipient_phone')
      .eq('id', order.booking_request_id)
      .single()

    if (booking?.recipient_name) {
      recipient = {
        name: booking.recipient_name,
        phone: booking.recipient_phone ?? undefined,
      }
    }
  }

  return NextResponse.json({
    order,
    carrier: carrierRes.data ?? null,
    sender: senderRes.data ?? null,
    recipient,
  })
}
