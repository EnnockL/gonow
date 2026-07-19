import { suggestMatchesForTrip } from '@/lib/ai/suggest-matches'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const carrierId = searchParams.get('carrier_id')
  const supabase = createServiceClient()

  const now = new Date().toISOString()

  const query = supabase
    .from('trips')
    .select('*, users(name, rating_avg, rating_count, avatar_url)')
    .eq('status', 'active')
    .order('departure_at', { ascending: true })

  if (carrierId) {
    const user = await getRequestUser(req)
    if (!user) return unauthorized()
    if (user.id !== carrierId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    query.eq('carrier_id', carrierId)
  } else {
    query.gte('departure_at', now)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ trips: data })
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req)
    if (!user) return unauthorized()

    const body = await req.json()
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('trips')
      .insert({ ...body, carrier_id: user.id })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    suggestMatchesForTrip(data).catch(() => {})

    return NextResponse.json({ trip: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
