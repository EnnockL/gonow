import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'

const CANCELLABLE = ['pending', 'matched']

async function cancelOrderRow(
  supabase: ReturnType<typeof createServiceClient>,
  orderId: string,
) {
  const preferredPayload = {
    status: 'cancelled',
    order_phase: 'cancelled',
    payment_status: 'cancelled',
  }

  try {
    const { error } = await supabase.rpc('cancel_order_status', { p_order_id: orderId })
    if (!error) return
  } catch {
    // Fall back to direct updates below.
  }

  try {
    const { error } = await supabase.from('orders').update(preferredPayload).eq('id', orderId)
    if (!error) return
  } catch {
    // Some demo databases do not yet have enterprise columns.
  }

  await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
}

async function cancelBookingRow(
  supabase: ReturnType<typeof createServiceClient>,
  bookingRequestId: string,
) {
  try {
    const { error } = await supabase.rpc('cancel_booking_request_status', {
      p_booking_request_id: bookingRequestId,
    })
    if (!error) return
  } catch {
    // Fall back to direct update below.
  }

  await supabase
    .from('booking_requests')
    .update({ status: 'cancelled' })
    .eq('id', bookingRequestId)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequestUser(req)
    if (!user) return unauthorized()

    const { id } = await params
    const supabase = createServiceClient()

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, booking_request_id, sender_id, carrier_id, receiver_id')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Ordern hittades inte.' }, { status: 404 })
    }

    const isSender = order.sender_id === user.id
    const isCarrier = order.carrier_id === user.id || order.receiver_id === user.id

    if (!isSender && !isCarrier) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!CANCELLABLE.includes(order.status)) {
      return NextResponse.json(
        {
          error: `Kan bara avbryta ordrar med status väntande eller matchad. (nuvarande: ${order.status})`,
        },
        { status: 409 }
      )
    }

    await cancelOrderRow(supabase, id)

    if (order.booking_request_id) {
      await cancelBookingRow(supabase, order.booking_request_id)
    }

    const { data: updated } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    return NextResponse.json({ ok: true, order: updated ?? { id, status: 'cancelled' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Serverfel: ${message}` }, { status: 500 })
  }
}
