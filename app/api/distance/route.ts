import { NextRequest, NextResponse } from 'next/server'

async function geocode(place: string): Promise<{ lat: number; lng: number; display: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place + ', Sverige')}&format=json&limit=1`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Gonow/1.0 (gonow.se)' },
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.length) return null
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    display: data[0].display_name,
  }
}

async function drivingDistance(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number
): Promise<{ distance_km: number; duration_min: number } | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) return null
  return {
    distance_km: Math.round(data.routes[0].distance / 1000),
    duration_min: Math.round(data.routes[0].duration / 60),
  }
}

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
