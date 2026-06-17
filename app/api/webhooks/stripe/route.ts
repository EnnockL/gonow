import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

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

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as { id: string; metadata?: { order_id?: string } }
    if (pi.metadata?.order_id) {
      await supabase
        .from('orders')
        .update({ status: 'matched', stripe_payment_intent_id: pi.id })
        .eq('id', pi.metadata.order_id)
    }
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
