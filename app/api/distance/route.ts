import { NextRequest, NextResponse } from 'next/server'

// Remove apartment/unit designations that Nominatim can't geocode
function stripApt(address: string): string {
  return address
    .replace(/\s*,?\s*(?:lgh|lägenhet|apt|apartment|unit|enhet)\.?\s*\d+[a-z]?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

async function geocode(place: string): Promise<{ lat: number; lng: number; display: string } | null> {
  const cleaned = stripApt(place)
  const hasStreetNumber = /\d/.test(cleaned) || cleaned.includes(',')
  const query = hasStreetNumber ? cleaned : `${cleaned}, Sverige`

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=se`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Gonow/1.0 (gonow.se)' },
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.length) {
    // Fallback: retry with ", Sverige" appended
    const fallback = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleaned + ', Sverige')}&format=json&limit=1`
    const res2 = await fetch(fallback, { headers: { 'User-Agent': 'Gonow/1.0 (gonow.se)' } })
    if (!res2.ok) return null
    const data2 = await res2.json()
    if (!data2.length) return null
    return { lat: parseFloat(data2[0].lat), lng: parseFloat(data2[0].lon), display: data2[0].display_name }
  }
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
