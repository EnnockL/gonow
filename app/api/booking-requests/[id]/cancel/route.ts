import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequestUser(req)
    if (!user) return unauthorized()

    const { id } = await params
    const supabase = createServiceClient()

    const { data: booking, error: bookingError } = await supabase
      .from('booking_requests')
      .select('id, sender_id, status, order_id')
      .eq('id', id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Förfrågan hittades inte.' }, { status: 404 })
    }

    if (booking.sender_id !== user.id) {
      return NextResponse.json({ error: 'Du får bara avbryta dina egna förfrågningar.' }, { status: 403 })
    }

    if (!['pending', 'accepted'].includes(booking.status)) {
      return NextResponse.json(
        { error: 'Kan bara avbryta förfrågningar som väntar eller accepterats.' },
        { status: 409 }
      )
    }

    const { error: bookingUpdateError } = await supabase
      .from('booking_requests')
      .update({ status: 'cancelled' })
      .eq('id', id)

    if (bookingUpdateError) {
      return NextResponse.json({ error: bookingUpdateError.message }, { status: 500 })
    }

    if (booking.order_id) {
      await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', booking.order_id)
        .eq('sender_id', user.id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Serverfel: ${msg}` }, { status: 500 })
  }
}
