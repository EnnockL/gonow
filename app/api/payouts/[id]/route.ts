import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const status = body?.status as 'paid' | 'failed' | 'processing' | undefined

  if (!status) {
    return NextResponse.json({ error: 'status krävs.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const payload: Record<string, unknown> = { status }

  if (status === 'paid') {
    payload.paid_at = new Date().toISOString()
  }

  if (status === 'failed') {
    payload.failed_at = new Date().toISOString()
    payload.failure_reason = body?.failure_reason || 'Manuellt markerad som misslyckad'
  }

  const { data: payout, error } = await supabase
    .from('payouts')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !payout) {
    return NextResponse.json({ error: error?.message || 'Kunde inte uppdatera payout.' }, { status: 500 })
  }

  if (status === 'paid') {
    try {
      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', payout.order_id)
        .single()

      if (order) {
        await supabase.from('escrow_ledger').insert({
          order_id: payout.order_id,
          payout_id: payout.id,
          sender_id: order.sender_id ?? null,
          carrier_id: payout.carrier_id ?? order.carrier_id ?? order.receiver_id ?? null,
          entry_type: 'carrier_payout_paid',
          direction: 'debit',
          bucket: 'carrier_paid',
          amount: payout.amount ?? order.carrier_payout ?? 0,
          currency: order.currency ?? 'sek',
          note: 'Utbetalning markerad som klar',
          metadata: {
            provider: payout.provider ?? 'stripe_connect',
          },
        })

        await supabase
          .from('orders')
          .update({
            order_phase: 'paid_out',
            paid_out_at: payload.paid_at,
          })
          .eq('id', payout.order_id)
      }
    } catch {
      // Non-blocking for ops testing.
    }
  }

  return NextResponse.json({ payout })
}
