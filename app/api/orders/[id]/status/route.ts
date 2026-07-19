import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'
import { OrderStatus } from '@/lib/types'
import { notifyOrderStatus } from '@/lib/notify'

const ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ['matched', 'paid'],
  matched: ['picked_up'],
  paid: ['picked_up'],
  picked_up: ['in_transit'],
  in_transit: ['delivered'],
  delivered: ['confirmed'],
}

function canActorSetStatus(params: {
  nextStatus: OrderStatus
  isSender: boolean
  isCarrier: boolean
}) {
  const { nextStatus, isSender, isCarrier } = params

  if (nextStatus === 'confirmed') return isSender
  if (nextStatus === 'paid') return false
  if (nextStatus === 'matched') return isCarrier
  return isCarrier
}

async function updateOrderStatusRow(
  supabase: ReturnType<typeof createServiceClient>,
  orderId: string,
  nextStatus: OrderStatus,
) {
  try {
    const { error } = await supabase.rpc('update_order_status', {
      p_order_id: orderId,
      p_status: nextStatus,
    })

    if (!error) return null
  } catch {
    // Fall through to direct updates below.
  }

  const timestamp = new Date().toISOString()
  const payload: Record<string, string> = { status: nextStatus }

  if (nextStatus === 'picked_up') payload.picked_up_at = timestamp
  if (nextStatus === 'delivered') payload.delivered_at = timestamp
  if (nextStatus === 'confirmed') payload.confirmed_at = timestamp

  const { error } = await supabase.from('orders').update(payload).eq('id', orderId)
  return error
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequestUser(req)
    if (!user) return unauthorized()

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const nextStatus = body?.status as OrderStatus | undefined

    if (!nextStatus) {
      return NextResponse.json({ error: 'Ny status saknas.' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, sender_id, carrier_id, receiver_id')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order hittades inte.' }, { status: 404 })
    }

    const isSender = order.sender_id === user.id
    const isCarrier = order.carrier_id === user.id || order.receiver_id === user.id

    if (!isSender && !isCarrier) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const allowed = ALLOWED_TRANSITIONS[order.status as OrderStatus] ?? []
    if (!allowed.includes(nextStatus)) {
      return NextResponse.json(
        { error: `Status kan inte gå från ${order.status} till ${nextStatus}.` },
        { status: 409 },
      )
    }

    if (!canActorSetStatus({ nextStatus, isSender, isCarrier })) {
      return NextResponse.json(
        { error: 'Fel part försöker uppdatera den här statusen.' },
        { status: 403 },
      )
    }

    const updateError = await updateOrderStatusRow(supabase, id, nextStatus)
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const { data: updated } = await supabase.from('orders').select('*').eq('id', id).single()

    const carrierId = order.carrier_id ?? order.receiver_id ?? null
    notifyOrderStatus(id, nextStatus, order.sender_id, carrierId).catch(() => {})

    return NextResponse.json({ order: updated ?? { id, status: nextStatus } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Serverfel: ${message}` }, { status: 500 })
  }
}
