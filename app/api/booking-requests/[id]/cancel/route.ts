import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    // Try booking_requests first
    const { data: booking, error: bookingLookupErr } = await supabase
      .from('booking_requests')
      .select('id, status, order_id')
      .eq('id', id)
      .single()

    if (booking) {
      if (booking.status !== 'pending') {
        return NextResponse.json({ error: 'Kan bara avbryta förfrågningar med status "väntar".' }, { status: 409 })
      }

      const { error } = await supabase
        .from('booking_requests')
        .update({ status: 'cancelled', responded_at: new Date().toISOString() })
        .eq('id', id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      if (booking.order_id) {
        await supabase.rpc('cancel_order_status', { p_order_id: booking.order_id }).catch(() => null)
      }

      return NextResponse.json({ ok: true })
    }

    // Fallback: try orders table
    const { data: order } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', id)
      .single()

    if (!order) {
      return NextResponse.json({ error: `Förfrågan hittades inte.` }, { status: 404 })
    }

    if (order.status !== 'pending') {
      return NextResponse.json({ error: `Kan bara avbryta förfrågningar med status "väntar". (nuvarande: ${order.status})` }, { status: 409 })
    }

    // Use RPC to bypass PostgREST enum cache issue
    const { error: rpcErr } = await supabase.rpc('cancel_order_status', { p_order_id: id })

    if (rpcErr) {
      return NextResponse.json({ error: `RPC-fel: ${rpcErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Serverfel: ${msg}` }, { status: 500 })
  }
}
