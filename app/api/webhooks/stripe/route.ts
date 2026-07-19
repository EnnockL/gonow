import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { reportEvent } from '@/lib/system-guardian/report-event'

function getMetadata(object: { metadata?: Record<string, string | undefined> | null }) {
  return object.metadata ?? {}
}

async function updateLinkedPackageStatus(
  supabase: ReturnType<typeof createServiceClient>,
  packageId: string | null | undefined,
  status: 'paid' | 'matched'
) {
  if (!packageId) return

  try {
    await supabase.from('packages').update({ status }).eq('id', packageId)
  } catch {
    // Ignore until all environments are fully aligned.
  }
}

async function getOrderPackageId(
  supabase: ReturnType<typeof createServiceClient>,
  orderId: string | null | undefined
) {
  if (!orderId) return null

  try {
    const { data: order } = await supabase
      .from('orders')
      .select('metadata')
      .eq('id', orderId)
      .maybeSingle()

    const metadata = order?.metadata
    if (!metadata || typeof metadata !== 'object') return null
    const packageId = (metadata as Record<string, unknown>).package_id
    return typeof packageId === 'string' ? packageId : null
  } catch {
    return null
  }
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
  try {
    await supabase.from('orders').update(preferredPayload).eq('id', params.orderId)
    return
  } catch {
    // Fall back to legacy-safe payload for pre-migration environments.
  }

  const legacyPayload: Record<string, unknown> = {}
  if (params.stripePaymentIntentId !== undefined) legacyPayload.stripe_payment_intent_id = params.stripePaymentIntentId
  if (params.status) legacyPayload.status = params.status
  if (Object.keys(legacyPayload).length > 0) {
    await supabase.from('orders').update(legacyPayload).eq('id', params.orderId)
  }
}

async function updatePayoutFromProvider(
  supabase: ReturnType<typeof createServiceClient>,
  providerPayout: {
    id: string
    status?: string | null
    metadata?: { payout_id?: string; order_id?: string }
    failure_code?: string | null
    failure_message?: string | null
  },
  status: 'processing' | 'paid' | 'failed',
) {
  let query = supabase.from('payouts').update({
    status,
    ...(status === 'paid' ? { paid_at: new Date().toISOString() } : {}),
    ...(status === 'failed' ? {
      failed_at: new Date().toISOString(),
      failure_reason: providerPayout.failure_message || providerPayout.failure_code || 'Stripe payout failed',
    } : {}),
  })

  if (providerPayout.metadata?.payout_id) query = query.eq('id', providerPayout.metadata.payout_id)
  else if (providerPayout.metadata?.order_id) query = query.eq('order_id', providerPayout.metadata.order_id)
  else query = query.contains('metadata', { stripe_payout_id: providerPayout.id })

  const { error } = await query
  if (error) throw new Error(`Payout webhook update failed: ${error.message}`)
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: ReturnType<typeof stripe.webhooks.constructEvent>
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    await reportEvent({
      severity: 'critical',
      source: 'stripe_webhook',
      event_type: 'stripe_webhook_signature_failure',
      message: `Stripe webhook signaturverifiering misslyckades: ${err instanceof Error ? err.message : String(err)}`,
      metadata: { has_sig: !!sig },
    })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()
  try {

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as {
      id: string
      payment_intent?: string | null
      metadata?: { order_id?: string; payment_id?: string; package_id?: string }
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
      status: 'paid',
      paidAt,
    })

    await updateLinkedPackageStatus(
      supabase,
      metadata.package_id || await getOrderPackageId(supabase, metadata.order_id),
      'paid'
    )
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as { id: string; metadata?: { order_id?: string; payment_id?: string; package_id?: string } }
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
      status: 'paid',
      paidAt,
    })

    await updateLinkedPackageStatus(
      supabase,
      metadata.package_id || await getOrderPackageId(supabase, metadata.order_id),
      'paid'
    )
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as { id: string; metadata?: { order_id?: string; payment_id?: string; package_id?: string } }
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

    await updateLinkedPackageStatus(
      supabase,
      metadata.package_id || await getOrderPackageId(supabase, metadata.order_id),
      'matched'
    )
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

  if (event.type === 'payout.created' || event.type === 'payout.updated') {
    const payout = event.data.object as { id: string; status?: string | null; metadata?: { payout_id?: string; order_id?: string } }
    await updatePayoutFromProvider(supabase, payout, 'processing')
  }

  if (event.type === 'payout.paid') {
    const payout = event.data.object as { id: string; status?: string | null; metadata?: { payout_id?: string; order_id?: string } }
    await updatePayoutFromProvider(supabase, payout, 'paid')
  }

  if (event.type === 'payout.failed') {
    const payout = event.data.object as {
      id: string
      status?: string | null
      metadata?: { payout_id?: string; order_id?: string }
      failure_code?: string | null
      failure_message?: string | null
    }
    await updatePayoutFromProvider(supabase, payout, 'failed')
  }

  } catch (err) {
    await reportEvent({
      severity: 'critical',
      source: 'stripe_webhook',
      event_type: 'stripe_webhook_processing_failure',
      message: `Stripe webhook-behandling misslyckades (${event.type}): ${err instanceof Error ? err.message : String(err)}`,
      metadata: { event_type: event.type },
    })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
