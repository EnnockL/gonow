import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest) {
  const user = await getRequestUser(_req)
  if (!user) return unauthorized()

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('payouts')
    .select('*')
    .eq('carrier_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ payouts: data || [] })
}

function resolveCarrierId(order: { carrier_id?: string | null; receiver_id?: string | null }) {
  return order.carrier_id ?? order.receiver_id ?? null
}

export async function POST(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const orderId = body?.order_id as string | undefined

  if (!orderId) {
    return NextResponse.json({ error: 'order_id kravs.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Order hittades inte.' }, { status: 404 })
  }

  const carrierId = resolveCarrierId(order)
  if (!carrierId) {
    return NextResponse.json({ error: 'Order saknar barare.' }, { status: 409 })
  }

  if (carrierId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (order.status !== 'confirmed') {
    return NextResponse.json({ error: 'Payout kan bara startas efter mottagarbekraftelse.' }, { status: 409 })
  }

  const { data: existingPayout } = await supabase
    .from('payouts')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingPayout && existingPayout.status !== 'failed') {
    return NextResponse.json({ payout: existingPayout, reused: true })
  }

  const { data: payout, error: payoutError } = await supabase
    .from('payouts')
    .insert({
      carrier_id: carrierId,
      order_id: orderId,
      amount: order.carrier_payout ?? 0,
      status: 'processing',
      provider: 'stripe_connect',
      scheduled_at: new Date().toISOString(),
      metadata: {
        source: 'manual_payout_start',
        order_phase: order.order_phase ?? null,
      },
    })
    .select('*')
    .single()

  if (payoutError || !payout) {
    return NextResponse.json({ error: payoutError?.message || 'Kunde inte skapa payout.' }, { status: 500 })
  }

  try {
    await supabase.from('escrow_ledger').insert({
      order_id: orderId,
      payout_id: payout.id,
      sender_id: order.sender_id ?? null,
      carrier_id: carrierId,
      entry_type: 'carrier_payout_processing',
      direction: 'debit',
      bucket: 'carrier_in_payout',
      amount: order.carrier_payout ?? payout.amount ?? 0,
      currency: order.currency ?? 'sek',
      note: 'Utbetalning initierad fran forarsaldo',
      metadata: {
        provider: payout.provider ?? 'stripe_connect',
      },
    })
  } catch {
    // Keep payout row even if ledger write fails.
  }

  try {
    await supabase
      .from('orders')
      .update({
        order_phase: 'payout_initiated',
        payout_batch_id: payout.id,
      })
      .eq('id', orderId)
  } catch {
    // Legacy-safe no-op.
  }

  return NextResponse.json({ payout })
}
