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
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const nextStatus = body?.status as OrderStatus | undefined

  if (!nextStatus) {
    return NextResponse.json({ error: 'Ny status saknas.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
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

  const payload: Record<string, string> = { status: nextStatus }

  if (nextStatus === 'picked_up') {
    payload.picked_up_at = new Date().toISOString()
  }

  if (nextStatus === 'delivered') {
    payload.delivered_at = new Date().toISOString()
  }

  if (nextStatus === 'confirmed') {
    payload.confirmed_at = new Date().toISOString()
  }

  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message || 'Kunde inte uppdatera ordern.' }, { status: 500 })
  }

  return NextResponse.json({ order: updated })
}
