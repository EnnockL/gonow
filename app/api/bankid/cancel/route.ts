import { NextRequest, NextResponse } from 'next/server'
import { bankidCancel } from '@/lib/bankid'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { orderRef } = await req.json() as { orderRef: string }
    if (!orderRef) return NextResponse.json({ error: 'orderRef krävs' }, { status: 400 })

    await bankidCancel(orderRef)

    // Clean up session
    const supabase = createServiceClient()
    await supabase.from('bankid_sessions').delete().eq('order_ref', orderRef)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[bankid/cancel]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
