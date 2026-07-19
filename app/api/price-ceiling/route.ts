import { NextRequest, NextResponse } from 'next/server'
import { geocode, drivingDistance } from '@/lib/distance'
import { calcPackagePrice, calcLiftPrice, calcCarrierPayout } from '@/lib/price'

// In-memory cache: geocode + distance results expire after 30 min
const distanceCache = new Map<string, { distanceKm: number; ts: number }>()
const CACHE_TTL_MS = 30 * 60 * 1000

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') as 'package' | 'lift' | null
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const kg = parseFloat(searchParams.get('kg') ?? '2')
  const passengers = parseInt(searchParams.get('passengers') ?? '1', 10)
  const urgencyRaw = searchParams.get('urgency') ?? 'standard'
  const fragile = searchParams.get('fragile') === 'true'

  if (!type || !from || !to) {
    return NextResponse.json({ error: 'type, from och to krävs' }, { status: 400 })
  }

  const cacheKey = `${from.toLowerCase()}|${to.toLowerCase()}`
  const cached = distanceCache.get(cacheKey)
  let distanceKm: number

  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    distanceKm = cached.distanceKm
  } else {
    const [fromGeo, toGeo] = await Promise.all([geocode(from), geocode(to)])
    if (!fromGeo) return NextResponse.json({ error: `Hittade inte "${from}"` }, { status: 404 })
    if (!toGeo) return NextResponse.json({ error: `Hittade inte "${to}"` }, { status: 404 })

    const route = await drivingDistance(fromGeo.lat, fromGeo.lng, toGeo.lat, toGeo.lng)
    if (!route) return NextResponse.json({ error: 'Kunde inte beräkna rutt' }, { status: 502 })

    distanceKm = route.distance_km
    distanceCache.set(cacheKey, { distanceKm, ts: Date.now() })
    // Prune old entries if cache grows too large
    if (distanceCache.size > 500) {
      const oldest = [...distanceCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]
      distanceCache.delete(oldest[0])
    }
  }

  if (type === 'package') {
    const urgency = (['flexible', 'tomorrow', 'today', 'express'] as const).includes(urgencyRaw as 'flexible')
      ? (urgencyRaw as 'flexible' | 'tomorrow' | 'today' | 'express')
      : urgencyRaw === 'standard' ? 'flexible' : 'flexible'
    const result = calcPackagePrice({
      km: distanceKm,
      kg: isNaN(kg) ? 2 : kg,
      urgency,
      fragile,
    })
    const split = calcCarrierPayout(result.recommended)
    return NextResponse.json({
      type,
      distanceKm,
      recommendedPrice: result.recommended,
      maxPrice: result.ceiling,
      carrierPayout: split.carrierPayout,
      breakdown: result.breakdown,
      split: {
        gonowCommission: split.gonowCommission,
        insurancePool: split.insurancePool,
      },
    })
  }

  if (type === 'lift') {
    const isWeekend = urgencyRaw === 'weekend'
    const result = calcLiftPrice({
      km: distanceKm,
      passengers: isNaN(passengers) ? 1 : passengers,
      isWeekend,
    })
    const split = calcCarrierPayout(result.totalRecommended)
    return NextResponse.json({
      type,
      distanceKm,
      recommendedPrice: result.totalRecommended,
      maxPrice: result.totalCeiling,
      carrierPayout: split.carrierPayout,
      taxiCapPerSeat: result.taxiCapPerSeat,
      breakdown: {
        baseFee:     result.breakdown.base,
        distanceFee: result.breakdown.distance,
        extrasFee:   result.breakdown.extras,
      },
      split: {
        gonowCommission: split.gonowCommission,
        insurancePool: split.insurancePool,
      },
    })
  }

  return NextResponse.json({ error: 'Okänd type — använd package eller lift' }, { status: 400 })
}
