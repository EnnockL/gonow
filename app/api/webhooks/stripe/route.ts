import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

function getMetadata(object: { metadata?: Record<string, string | undefined> | null }) {
  return object.metadata ?? {}
}

async function updatePaymentByIdOrOrder(
  supabase: ReturnType<typeof createServiceClient>,
  params: {
    paymentId?: string | null
    orderId?: string | null
    payload: Record<string, unknown>
  }
) {
  const { paymentId, orderId, payload } = params

  try {
    if (paymentId) {
      const { data } = await supabase
        .from('payments')
        .update(payload)
        .eq('id', paymentId)
        .select('*')
        .maybeSingle()

      if (data) return data
    }

    if (orderId) {
      const { data } = await supabase
        .from('payments')
        .update(payload)
        .eq('order_id', orderId)
        .select('*')
        .maybeSingle()

      if (data) return data
    }
  } catch {
    return null
  }

  return null
}

async function updateOrderPaymentState(
  supabase: ReturnType<typeof createServiceClient>,
  params: {
    orderId?: string | null
    stripePaymentIntentId?: string | null
    paymentProvider?: 'stripe'
    paymentStatus?: string
    status?: string
    orderPhase?: string
    paidAt?: string | null
  }
) {
  if (!params.orderId) return

  const preferredPayload: Record<string, unknown> = {}
  if (params.stripePaymentIntentId !== undefined) preferredPayload.stripe_payment_intent_id = params.stripePaymentIntentId
  if (params.paymentProvider) preferredPayload.payment_provider = params.paymentProvider
  if (params.paymentStatus) preferredPayload.payment_status = params.paymentStatus
  if (params.orderPhase) preferredPayload.order_phase = params.orderPhase
  if (params.status) preferredPayload.status = params.status
  if (params.paidAt) preferredPayload.paid_at = params.paidAt
  if (params.status === 'matched') preferredPayload.confirmed_at = params.paidAt || new Date().toISOString()

  try {
    await supabase.from('orders').update(preferredPayload).eq('id', params.orderId)
    return
  } catch {
    // Fall back to legacy-safe payload for pre-migration environments.
  }

  const legacyPayload: Record<string, unknown> = {}
  if (params.stripePaymentIntentId !== undefined) legacyPayload.stripe_payment_intent_id = params.stripePaymentIntentId
  if (params.status) legacyPayload.status = params.status
  if (params.status === 'matched') legacyPayload.confirmed_at = params.paidAt || new Date().toISOString()

  if (Object.keys(legacyPayload).length > 0) {
    await supabase.from('orders').update(legacyPayload).eq('id', params.orderId)
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: ReturnType<typeof stripe.webhooks.constructEvent>
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as {
      id: string
      payment_intent?: string | null
      metadata?: { order_id?: string; payment_id?: string }
    }
    const metadata = getMetadata(session)
    const paidAt = new Date().toISOString()

    await updatePaymentByIdOrOrder(supabase, {
      paymentId: metadata.payment_id,
      orderId: metadata.order_id,
      payload: {
        provider: 'stripe',
        provider_checkout_id: session.id,
        provider_payment_id: session.payment_intent ?? null,
        status: 'paid',
        paid_at: paidAt,
        updated_at: paidAt,
      },
    })

    await updateOrderPaymentState(supabase, {
      orderId: metadata.order_id,
      stripePaymentIntentId: session.payment_intent ?? null,
      paymentProvider: 'stripe',
      paymentStatus: 'paid',
      orderPhase: 'paid_held',
      status: 'matched',
      paidAt,
    })
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as { id: string; metadata?: { order_id?: string; payment_id?: string } }
    const metadata = getMetadata(pi)
    const paidAt = new Date().toISOString()

    await updatePaymentByIdOrOrder(supabase, {
      paymentId: metadata.payment_id,
      orderId: metadata.order_id,
      payload: {
        provider: 'stripe',
        provider_payment_id: pi.id,
        status: 'paid',
        paid_at: paidAt,
        updated_at: paidAt,
      },
    })

    await updateOrderPaymentState(supabase, {
      orderId: metadata.order_id,
      stripePaymentIntentId: pi.id,
      paymentProvider: 'stripe',
      paymentStatus: 'paid',
      orderPhase: 'paid_held',
      status: 'matched',
      paidAt,
    })
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as { id: string; metadata?: { order_id?: string; payment_id?: string } }
    const metadata = getMetadata(pi)
    const failedAt = new Date().toISOString()

    await updatePaymentByIdOrOrder(supabase, {
      paymentId: metadata.payment_id,
      orderId: metadata.order_id,
      payload: {
        provider: 'stripe',
        provider_payment_id: pi.id,
        status: 'failed',
        failed_at: failedAt,
        updated_at: failedAt,
      },
    })

    await updateOrderPaymentState(supabase, {
      orderId: metadata.order_id,
      stripePaymentIntentId: pi.id,
      paymentProvider: 'stripe',
      paymentStatus: 'failed',
      orderPhase: 'payment_pending',
      status: 'pending',
    })
  }

  if (event.type === 'transfer.created') {
    const transfer = event.data.object as { id: string; metadata?: { order_id?: string } }
    if (transfer.metadata?.order_id) {
      await supabase
        .from('payouts')
        .update({ status: 'processing', stripe_transfer_id: transfer.id })
        .eq('order_id', transfer.metadata.order_id)
    }
  }

  return NextResponse.json({ received: true })
}
