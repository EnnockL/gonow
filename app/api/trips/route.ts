import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const carrierId = searchParams.get('carrier_id')
  const supabase = createServiceClient()

  const query = supabase
    .from('trips')
    .select('*, users(name, rating_avg, rating_count, avatar_url)')
    .eq('status', 'active')
    .order('departure_at', { ascending: true })

  if (carrierId) {
    query.eq('carrier_id', carrierId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ trips: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = createServiceClient()

  const { data, error } = await supabase.from('trips').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ trip: data }, { status: 201 })
}
