import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const date = searchParams.get('date')
    const supabase = createServiceClient()

    const passengerId = searchParams.get('passenger_id')
    const carrierId = searchParams.get('carrier_id')

    let query = supabase
      .from('lift_requests')
      .select('*')
      .order('travel_date', { ascending: true })

    if (carrierId) {
      query = query.eq('carrier_id', carrierId)
    } else if (passengerId) {
      query = query.eq('passenger_id', passengerId)
    } else {
      query = query.eq('status', 'open').gt('expires_at', new Date().toISOString())
    }

    if (from) query = query.ilike('from_city', `%${from}%`)
    if (to) query = query.ilike('to_city', `%${to}%`)
    if (date) query = query.eq('travel_date', date)

    const { data: liftData, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!liftData || liftData.length === 0) {
      return NextResponse.json({ lift_requests: [] })
    }

    // Batch-fetch user info for passengers and carriers without relying on FK relations
    const userIds = [
      ...new Set([
        ...liftData.map((l: { passenger_id: string | null }) => l.passenger_id).filter(Boolean) as string[],
        ...liftData.map((l: { carrier_id: string | null }) => l.carrier_id).filter(Boolean) as string[],
      ]),
    ]

    // Include phone only for personal queries (passenger or carrier filtered)
    const includePhone = !!(passengerId || carrierId)
    const userSelect = includePhone
      ? 'id, name, rating_avg, avatar_url, phone'
      : 'id, name, rating_avg, avatar_url'

    const usersMap = new Map<string, { id: string; name: string; rating_avg: number; avatar_url: string | null; phone?: string | null }>()
    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select(userSelect)
        .in('id', userIds)
      for (const u of usersData ?? []) {
        usersMap.set(u.id, u)
      }
    }

    const enriched = liftData.map((l: { passenger_id: string | null; carrier_id: string | null }) => ({
      ...l,
      users: l.passenger_id ? (usersMap.get(l.passenger_id) ?? null) : null,
      carrier: l.carrier_id ? (usersMap.get(l.carrier_id) ?? null) : null,
    }))

    return NextResponse.json({ lift_requests: enriched })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

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
