import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { OrderStatus } from '@/lib/types'

const ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ['matched'],
  matched: ['picked_up'],
  picked_up: ['in_transit'],
  in_transit: ['delivered'],
  delivered: ['confirmed'],
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const nextStatus = body?.status as OrderStatus | undefined

    if (!nextStatus) {
      return NextResponse.json({ error: 'Ny status saknas.' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order hittades inte.' }, { status: 404 })
    }

    const allowed = ALLOWED_TRANSITIONS[order.status as OrderStatus] ?? []
    if (!allowed.includes(nextStatus)) {
      return NextResponse.json(
        { error: `Status kan inte gå från ${order.status} till ${nextStatus}.` },
        { status: 409 }
      )
    }

    const { error: rpcErr } = await supabase.rpc('update_order_status', {
      p_order_id: id,
      p_status: nextStatus,
    })

    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }

    const { data: updated } = await supabase.from('orders').select('*').eq('id', id).single()

    return NextResponse.json({ order: updated ?? { id, status: nextStatus } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Serverfel: ${msg}` }, { status: 500 })
  }
}
