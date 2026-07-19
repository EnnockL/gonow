import { NextRequest, NextResponse } from 'next/server'
import { bankidCollect } from '@/lib/bankid'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { orderRef } = await req.json() as { orderRef: string }
    if (!orderRef) return NextResponse.json({ error: 'orderRef krävs' }, { status: 400 })

    const result = await bankidCollect(orderRef)

    if (result.status !== 'complete' || !result.completionData) {
      return NextResponse.json({ error: 'BankID ej komplett' }, { status: 400 })
    }

    const { personalNumber, name } = result.completionData.user
    const supabase = createServiceClient()

    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('bankid_personal_number', personalNumber)
      .single()

    if (!userRow) {
      return NextResponse.json({ error: 'no_account', name, personalNumber }, { status: 404 })
    }

    const { data: sessionData, error } = await supabase.auth.admin.createSession({
      user_id: userRow.id,
    })

    if (error || !sessionData?.session) {
      console.error('[bankid/login-session]', error)
      return NextResponse.json({ error: 'Kunde inte skapa session' }, { status: 500 })
    }

    await supabase.from('bankid_sessions').delete().eq('order_ref', orderRef)

    return NextResponse.json({
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
    })
  } catch (err) {
    console.error('[bankid/login-session]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
