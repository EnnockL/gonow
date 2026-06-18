import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const carrierId = searchParams.get('carrier_id')

  if (!carrierId) {
    return NextResponse.json({ error: 'carrier_id krävs.' }, { status: 400 })
  }

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('escrow_ledger')
      .select('*')
      .eq('carrier_id', carrierId)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ entries: data || [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kunde inte läsa ledger.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
