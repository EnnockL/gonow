import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorized()

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('escrow_ledger')
      .select('*')
      .eq('carrier_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ entries: data || [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kunde inte lasa ledger.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
