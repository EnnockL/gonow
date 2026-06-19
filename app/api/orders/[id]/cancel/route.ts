import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

const CANCELLABLE = ['pending', 'matched']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    const { data: order } = await supabase
      .from('orders')
      .select('id, status, booking_request_id')
      .eq('id', id)
      .single()

    if (!order) {
      return NextResponse.json({ error: 'Ordern hittades inte.' }, { status: 404 })
    }

    if (!CANCELLABLE.includes(order.status)) {
      return NextResponse.json(
        { error: `Kan bara avbryta ordrar med status väntande eller betald. (nuvarande: ${order.status})` },
        { status: 409 }
      )
    }

    const { error: rpcErr } = await supabase.rpc('cancel_order_status', { p_order_id: id })
    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }

    if (order.booking_request_id) {
      await supabase
        .rpc('cancel_booking_request_status', { p_booking_request_id: order.booking_request_id })
        .catch(() => null)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Serverfel: ${msg}` }, { status: 500 })
  }
}
