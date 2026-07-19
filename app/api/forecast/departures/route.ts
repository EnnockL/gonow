import { createServiceClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createServiceClient()

    const { data: departures, error } = await supabase
      .from('forecast_departures')
      .select('*')
      .eq('status', 'planned')
      .gte('departure_date', new Date().toISOString().split('T')[0])
      .order('departure_date', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!departures?.length) return NextResponse.json({ departures: [] })

    // Count packages booked for each departure
    const ids = departures.map((d: { id: string }) => d.id)
    const { data: counts } = await supabase
      .from('packages')
      .select('forecast_departure_id')
      .in('forecast_departure_id', ids)
      .not('status', 'eq', 'cancelled')

    const countMap: Record<string, number> = {}
    for (const pkg of counts ?? []) {
      const fid = (pkg as { forecast_departure_id: string }).forecast_departure_id
      countMap[fid] = (countMap[fid] ?? 0) + 1
    }

    const enriched = departures.map((d: Record<string, unknown>) => ({
      ...d,
      booked_package_count: countMap[d.id as string] ?? 0,
    }))

    return NextResponse.json({ departures: enriched })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
