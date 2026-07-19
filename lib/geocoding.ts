export interface GeocodingResult {
  display: string
  lat: number
  lng: number
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] }
  properties?: {
    name?: string
    street?: string
    housenumber?: string
    postcode?: string
    city?: string
    town?: string
    village?: string
    municipality?: string
    county?: string
    countrycode?: string
  }
}

function formatPhoton(feature: PhotonFeature): string {
  const properties = feature.properties ?? {}
  const street = properties.street || properties.name || ''
  const number = properties.housenumber ? ` ${properties.housenumber}` : ''
  const postcode = properties.postcode || ''
  const city = properties.city || properties.town || properties.village || properties.municipality || ''

  if (street && city && street.toLocaleLowerCase('sv-SE') !== city.toLocaleLowerCase('sv-SE')) {
    return `${street}${number}${postcode ? `, ${postcode}` : ''} ${city}`.trim()
  }
  return (city || street || properties.county || '').trim()
}

export async function searchPhoton(query: string, limit = 6): Promise<GeocodingResult[]> {
  const url = new URL('https://photon.komoot.io/api/')
  url.searchParams.set('q', query)
  url.searchParams.set('limit', String(limit))

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Gonow/1.0 (address search; contact: support@gonow.se)' },
    next: { revalidate: 3600 },
  })
  if (!response.ok) return []

  const data = await response.json() as { features?: PhotonFeature[] }
  return (data.features ?? [])
    .filter(feature => feature.properties?.countrycode?.toUpperCase() === 'SE')
    .map(feature => {
      const coordinates = feature.geometry?.coordinates
      if (!coordinates) return null
      return { display: formatPhoton(feature), lat: coordinates[1], lng: coordinates[0] }
    })
    .filter((result): result is GeocodingResult => Boolean(result?.display))
}
