import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const date = searchParams.get('date')
    const supabase = createServiceClient()

    let query = supabase
      .from('lift_requests')
      .select('*, users(name, rating_avg, avatar_url)')
      .eq('status', 'open')
      .gt('expires_at', new Date().toISOString())
      .order('travel_date', { ascending: true })

    if (from) query = query.ilike('from_city', `%${from}%`)
    if (to) query = query.ilike('to_city', `%${to}%`)
    if (date) query = query.eq('travel_date', date)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ lift_requests: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate travel_date not in the past
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const travelDate = new Date(body.travel_date)
    if (travelDate < today) {
      return NextResponse.json(
        { error: 'Resedatum kan inte vara i dåtid.' },
        { status: 422 }
      )
    }

    const supabase = createServiceClient()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data, error } = await supabase
      .from('lift_requests')
      .insert({
        passenger_id: body.passenger_id ?? null,
        from_city: body.from_city,
        from_address: body.from_address ?? null,
        to_city: body.to_city,
        to_address: body.to_address ?? null,
        travel_date: body.travel_date,
        flexibility: body.flexibility ?? 'exact',
        passengers: body.passengers ?? 1,
        has_luggage: body.has_luggage ?? false,
        luggage_kg: body.luggage_kg ?? null,
        note: body.note ?? null,
        max_price: body.max_price ?? null,
        status: 'open',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ lift_request: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
