import { NextRequest, NextResponse } from 'next/server'
import { bankidCollect } from '@/lib/bankid'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { orderRef } = await req.json() as { orderRef: string }
    if (!orderRef) return NextResponse.json({ error: 'orderRef krävs' }, { status: 400 })

    const result = await bankidCollect(orderRef)

    if (result.status === 'complete' && result.completionData) {
      const supabase = createServiceClient()

      // Look up which user this orderRef belongs to
      const { data: session } = await supabase
        .from('bankid_sessions')
        .select('user_id')
        .eq('order_ref', orderRef)
        .single()

      if (session?.user_id) {
        await supabase
          .from('users')
          .update({
            bankid_verified: true,
            bankid_name: result.completionData.user.name,
            bankid_personal_number: result.completionData.user.personalNumber,
            bankid_verified_at: new Date().toISOString(),
          })
          .eq('id', session.user_id)

        // Clean up session
        await supabase.from('bankid_sessions').delete().eq('order_ref', orderRef)
      }
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[bankid/collect]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
