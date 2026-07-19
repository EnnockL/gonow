import { searchPhoton } from '@/lib/geocoding'

function stripApt(address: string): string {
  return address
    .replace(/\s*,?\s*(?:lgh|lägenhet|apt|apartment|unit|enhet)\.?\s*\d+[a-z]?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export async function geocode(
  place: string
): Promise<{ lat: number; lng: number; display: string } | null> {
  const cleaned = stripApt(place)
  const photonResults = await searchPhoton(cleaned, 1).catch(() => [])
  if (photonResults.length) return photonResults[0]

  const hasStreetNumber = /\d/.test(cleaned) || cleaned.includes(',')
  const query = hasStreetNumber ? cleaned : `${cleaned}, Sverige`

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=se`
  const res = await fetch(url, { headers: { 'User-Agent': 'Gonow/1.0 (gonow.se)' } })
  if (!res.ok) return null
  const data = await res.json() as Array<{ lat: string; lon: string; display_name: string }>
  if (!data.length) {
    const fallback = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleaned + ', Sverige')}&format=json&limit=1`
    const res2 = await fetch(fallback, { headers: { 'User-Agent': 'Gonow/1.0 (gonow.se)' } })
    if (!res2.ok) return null
    const data2 = await res2.json() as typeof data
    if (!data2.length) return null
    return { lat: parseFloat(data2[0].lat), lng: parseFloat(data2[0].lon), display: data2[0].display_name }
  }
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name }
}

export async function drivingDistance(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<{ distance_km: number; duration_min: number } | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json() as {
    code: string
    routes: Array<{ distance: number; duration: number }>
  }
  if (data.code !== 'Ok' || !data.routes?.length) return null
  return {
    distance_km: Math.round(data.routes[0].distance / 1000),
    duration_min: Math.round(data.routes[0].duration / 60),
  }
}
