import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'

function stripeConfigured() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

  return Boolean(
    secretKey &&
    publishableKey &&
    !secretKey.includes('placeholder') &&
    !publishableKey.includes('placeholder')
  )
}

function getOrderCarrierId(order: { carrier_id?: string | null; receiver_id?: string | null }) {
  return order.carrier_id ?? order.receiver_id ?? ''
}

async function ensurePaymentRecord(
  supabase: ReturnType<typeof createServiceClient>,
  order: {
    id: string
    sender_id?: string | null
    price?: number | string | null
    payment_provider?: string | null
    payment_status?: string | null
    carrier_id?: string | null
    receiver_id?: string | null
  }
) {
  try {
    const { data: existing } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) return existing

    const { data: created } = await supabase
      .from('payments')
      .insert({
        order_id: order.id,
        sender_id: order.sender_id ?? null,
        carrier_id: getOrderCarrierId(order) || null,
        provider: order.payment_provider || 'stripe',
        amount: Number(order.price ?? 0),
        currency: 'sek',
        status: order.payment_status || 'pending',
      })
      .select('*')
      .single()

    return created ?? null
  } catch {
    return null
  }
}

async function updateOrderForCheckout(
  supabase: ReturnType<typeof createServiceClient>,
  orderId: string,
  paymentId?: string | null
) {
  const preferredPayload = {
    payment_provider: 'stripe',
    payment_status: 'pending',
    order_phase: 'payment_pending',
    metadata: paymentId
      ? {
          payment_id: paymentId,
          checkout_started_at: new Date().toISOString(),
        }
      : undefined,
  }

  try {
    await supabase.from('orders').update(preferredPayload).eq('id', orderId)
    return
  } catch {
    // Fall through to legacy-safe update below.
  }

  await supabase
    .from('orders')
    .update({})
    .eq('id', orderId)
}

async function updatePaymentCheckoutState(
  supabase: ReturnType<typeof createServiceClient>,
  paymentId: string | null | undefined,
  payload: Record<string, unknown>
) {
  if (!paymentId) return

  try {
    await supabase.from('payments').update(payload).eq('id', paymentId)
  } catch {
    // Ignore until enterprise migration is applied.
  }
}

async function markPaymentPaidForMock(
  supabase: ReturnType<typeof createServiceClient>,
  orderId: string,
  paymentId?: string | null
) {
  const paidAt = new Date().toISOString()

  if (paymentId) {
    try {
      await supabase
        .from('payments')
        .update({
          provider: 'stripe',
          status: 'paid',
          paid_at: paidAt,
          provider_reference: 'mock_checkout',
          updated_at: paidAt,
        })
        .eq('id', paymentId)
      return
    } catch {
      // Fall back below for legacy/demo environments.
    }
  }

  await supabase
    .from('orders')
    .update({
      status: 'matched',
      confirmed_at: paidAt,
      stripe_payment_intent_id: 'mock_checkout',
    })
    .eq('id', orderId)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single()

  if (!stripeConfigured()) {
    // Mock payment: still go through payments so escrow and ledger can be tested locally.
    if (order && order.status === 'pending') {
      const payment = await ensurePaymentRecord(supabase, order)
      await updateOrderForCheckout(supabase, order.id, payment?.id)
      await markPaymentPaidForMock(supabase, order.id, payment?.id)
    }
    return NextResponse.json({ mock: true, orderId: id })
  }

  if (error || !order) {
    return NextResponse.json({ error: 'Order hittades inte.' }, { status: 404 })
  }

  if (order.status !== 'pending') {
    return NextResponse.json(
      { error: 'Bara väntande ordrar kan betalas.' },
      { status: 409 }
    )
  }

  const origin = new URL(req.url).origin
  const amount = Math.max(300, Math.round(Number(order.price ?? 0) * 100))
  const payment = await ensurePaymentRecord(supabase, order)
  await updateOrderForCheckout(supabase, order.id, payment?.id)

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>
  try {
    session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: `${origin}/spara/${order.id}?payment=success`,
    cancel_url: `${origin}/profil?payment=cancelled`,
    customer_email: undefined,
    metadata: {
      order_id: order.id,
      payment_id: payment?.id || '',
      sender_id: order.sender_id,
      carrier_id: getOrderCarrierId(order),
    },
    payment_intent_data: {
      metadata: {
        order_id: order.id,
        payment_id: payment?.id || '',
        sender_id: order.sender_id,
        carrier_id: getOrderCarrierId(order),
      },
      transfer_group: `order_${order.id}`,
      capture_method: 'automatic_async',
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'sek',
          unit_amount: amount,
          product_data: {
            name: order.description || 'Gonow-leverans',
            description:
              order.pickup_address && order.dropoff_address
                ? `${order.pickup_address} -> ${order.dropoff_address}`
                : 'Betalning för Gonow-order',
          },
        },
      },
    ],
  })
  } catch (stripeErr) {
    const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr)
    console.error('[checkout] stripe error:', msg)
    return NextResponse.json({ error: `Betalning kunde inte skapas: ${msg}` }, { status: 500 })
  }

  await updatePaymentCheckoutState(supabase, payment?.id, {
    provider: 'stripe',
    provider_checkout_id: session.id,
    provider_reference: session.url ?? null,
    idempotency_key: `checkout:${order.id}:${session.id}`,
    raw_payload: {
      checkout_session_id: session.id,
      order_id: order.id,
    },
  })

  return NextResponse.json({ url: session.url })
}
