import { NextRequest, NextResponse } from 'next/server'
import { bankidAuth } from '@/lib/bankid'
import { createServiceClient } from '@/lib/supabase'
import { reportEvent } from '@/lib/system-guardian/report-event'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json() as { userId?: string }

    // Get real IP (or fallback for local dev)
    const forwarded = req.headers.get('x-forwarded-for')
    const endUserIp = forwarded?.split(',')[0]?.trim() ?? '127.0.0.1'

    const result = await bankidAuth(endUserIp)

    // Store orderRef → userId mapping in Supabase so collect can look it up
    const supabase = createServiceClient()
    await supabase.from('bankid_sessions').upsert({
      order_ref: result.orderRef,
      user_id: userId,
      created_at: new Date().toISOString(),
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[bankid/auth]', err)
    await reportEvent({
      severity: 'warning',
      source: 'bankid',
      event_type: 'auth_failure',
      message: `BankID-autentisering misslyckades: ${err instanceof Error ? err.message : String(err)}`,
      metadata: { step: 'auth' },
    })
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
