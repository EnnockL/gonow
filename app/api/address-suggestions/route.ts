import { NextRequest, NextResponse } from 'next/server'
import { searchPhoton } from '@/lib/geocoding'

interface NominatimResult {
  display_name: string
  address?: {
    road?: string
    house_number?: string
    postcode?: string
    city?: string
    town?: string
    village?: string
    municipality?: string
    residential?: string
  }
}

export async function GET(request: NextRequest) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (query.length < 2) return NextResponse.json({ suggestions: [] })
  if (query.length > 120) return NextResponse.json({ error: 'Sökningen är för lång.' }, { status: 400 })

  try {
    const photonResults = await searchPhoton(query, 6)
    if (photonResults.length) {
      const suggestions = photonResults
        .map(result => result.display)
        .filter((value, index, all) => all.indexOf(value) === index)
      return NextResponse.json({ suggestions, source: 'photon' })
    }

    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', `${query}, Sverige`)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '6')
    url.searchParams.set('countrycodes', 'se')
    url.searchParams.set('addressdetails', '1')

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Gonow/1.0 (address search; contact: support@gonow.se)' },
      next: { revalidate: 3600 },
    })
    if (!response.ok) return NextResponse.json({ suggestions: [], unavailable: true })

    const results = await response.json() as NominatimResult[]
    const suggestions = results.map(result => {
      const address = result.address ?? {}
      const road = address.road || address.residential || ''
      const number = address.house_number ? ` ${address.house_number}` : ''
      const postcode = address.postcode || ''
      const city = address.city || address.town || address.village || address.municipality || ''
      return road
        ? `${road}${number}${postcode ? `, ${postcode}` : ''}${city ? ` ${city}` : ''}`.trim()
        : result.display_name.split(',').slice(0, 3).join(',').trim()
    }).filter((value, index, all) => value && all.indexOf(value) === index)

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('[address-suggestions] lookup failed:', error)
    return NextResponse.json({ suggestions: [], unavailable: true })
  }
}
