import { NextRequest, NextResponse } from 'next/server'
import { geocode, drivingDistance } from '@/lib/distance'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  if (!from || !to) {
    return NextResponse.json({ error: 'from och to krävs' }, { status: 400 })
  }

  const [fromGeo, toGeo] = await Promise.all([geocode(from), geocode(to)])

  if (!fromGeo) return NextResponse.json({ error: `Hittade inte "${from}"` }, { status: 404 })
  if (!toGeo)   return NextResponse.json({ error: `Hittade inte "${to}"` }, { status: 404 })

  const route = await drivingDistance(fromGeo.lat, fromGeo.lng, toGeo.lat, toGeo.lng)

  if (!route) return NextResponse.json({ error: 'Kunde inte beräkna rutt' }, { status: 502 })

  return NextResponse.json({
    from: { city: from, lat: fromGeo.lat, lng: fromGeo.lng },
    to:   { city: to,   lat: toGeo.lat,   lng: toGeo.lng },
    distance_km:  route.distance_km,
    duration_min: route.duration_min,
  })
}
