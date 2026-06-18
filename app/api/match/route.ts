import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { from_city, to_city, departure_date, weight_kg, type } = body

  if (!from_city || !to_city) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (process.env.NEXT_PUBLIC_SIMULATION_MODE === 'true') {
    const { matchTrips } = await import('@/lib/simulation/data')
    const trips = matchTrips({ from_city, to_city, weight_kg: weight_kg || 0, type: type || 'package' })
    return NextResponse.json({ trips })
  }

  const { findMatchingTrips } = await import('@/lib/matching')
  const trips = await findMatchingTrips({
    from_city,
    to_city,
    departure_date: departure_date || null,
    weight_kg: weight_kg || 0,
    type: type || 'package',
  })

  return NextResponse.json({ trips })
}
