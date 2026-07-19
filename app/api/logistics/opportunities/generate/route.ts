import { createServiceClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const MIN_PACKAGES = 5

function recommendedVehicle(totalWeight: number): string {
  if (totalWeight >= 1000) return 'lastbil'
  if (totalWeight >= 300) return 'lätt lastbil'
  return 'skåpbil'
}

type PkgRow = { forecast_departure_id: string | null; weight_kg: number | null; price_ceiling: number | null }
type RecoveryPkgRow = { id: string; from_city: string; to_city: string; weight_kg: number | null; price_ceiling: number | null }

export async function POST() {
  try {
    const supabase = createServiceClient()
    const created: unknown[] = []

    // ── Phase 1: Forecast-linked packages ──────────────────────────────────────
    const { data: departures, error: depErr } = await supabase
      .from('forecast_departures')
      .select('id, from_city, to_city, departure_date, departure_time, predicted_package_count')
      .eq('status', 'planned')
      .gte('departure_date', new Date().toISOString().split('T')[0])

    if (depErr) return NextResponse.json({ error: depErr.message }, { status: 500 })

    if (departures?.length) {
      const depIds = departures.map((d: { id: string }) => d.id)

      const { data: packages, error: pkgErr } = await supabase
        .from('packages')
        .select('forecast_departure_id, weight_kg, price_ceiling')
        .in('forecast_departure_id', depIds)
        .not('status', 'eq', 'cancelled')

      if (pkgErr) return NextResponse.json({ error: pkgErr.message }, { status: 500 })

      const stats: Record<string, { count: number; totalWeight: number; totalGmv: number }> = {}
      for (const pkg of (packages ?? []) as PkgRow[]) {
        const fid = pkg.forecast_departure_id!
        if (!stats[fid]) stats[fid] = { count: 0, totalWeight: 0, totalGmv: 0 }
        stats[fid].count++
        stats[fid].totalWeight += pkg.weight_kg ?? 5
        stats[fid].totalGmv += pkg.price_ceiling ?? 149
      }

      for (const dep of departures as { id: string; from_city: string; to_city: string; departure_date: string; departure_time: string }[]) {
        const s = stats[dep.id]
        if (!s || s.count < MIN_PACKAGES) continue

        const { data: existing } = await supabase
          .from('logistics_opportunities')
          .select('id')
          .eq('forecast_departure_id', dep.id)
          .maybeSingle()

        if (existing) continue

        const vehicle = recommendedVehicle(s.totalWeight)
        const gmv = s.totalGmv > 0 ? s.totalGmv : s.count * 149

        const { data: opp, error: insErr } = await supabase
          .from('logistics_opportunities')
          .insert({
            forecast_departure_id: dep.id,
            from_city: dep.from_city,
            to_city: dep.to_city,
            departure_date: dep.departure_date,
            departure_time: dep.departure_time,
            package_count: s.count,
            total_weight: Math.round(s.totalWeight * 10) / 10,
            estimated_gmv: Math.round(gmv),
            recommended_vehicle: vehicle,
            status: 'open',
            ai_reason: `${s.count} bokade paket (${Math.round(s.totalWeight)} kg) på ${dep.from_city} → ${dep.to_city}. AI rekommenderar ${vehicle}. Potentiell omsättning: ${Math.round(gmv)} kr.`,
          })
          .select()
          .single()

        if (!insErr && opp) created.push(opp)
      }
    }

    // ── Phase 2: Open packages without forecast — cluster by route ─────────────
    // Includes all open packages (never matched, declined, or expired driver matches)
    // that are not yet assigned to logistics and have no forecast_departure_id.
    const { data: openPkgs, error: openErr } = await supabase
      .from('packages')
      .select('id, from_city, to_city, weight_kg, price_ceiling')
      .eq('status', 'open')
      .is('forecast_departure_id', null)
      .is('assigned_provider_type', null)

    if (openErr) return NextResponse.json({ error: openErr.message }, { status: 500 })

    const routeStats: Record<string, { count: number; totalWeight: number; totalGmv: number; fromCity: string; toCity: string }> = {}
    for (const pkg of (openPkgs ?? []) as RecoveryPkgRow[]) {
      const key = `${pkg.from_city}|${pkg.to_city}`
      if (!routeStats[key]) {
        routeStats[key] = { count: 0, totalWeight: 0, totalGmv: 0, fromCity: pkg.from_city, toCity: pkg.to_city }
      }
      routeStats[key].count++
      routeStats[key].totalWeight += pkg.weight_kg ?? 5
      routeStats[key].totalGmv += pkg.price_ceiling ?? 149
    }

    const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    for (const s of Object.values(routeStats)) {
      if (s.count < MIN_PACKAGES) continue

      // Skip if any open/accepted opportunity already exists for this route
      const { data: existingOpps } = await supabase
        .from('logistics_opportunities')
        .select('id')
        .eq('from_city', s.fromCity)
        .eq('to_city', s.toCity)
        .in('status', ['open', 'accepted'])
        .limit(1)

      if (existingOpps && existingOpps.length > 0) continue

      const vehicle = recommendedVehicle(s.totalWeight)
      const gmv = s.totalGmv > 0 ? s.totalGmv : s.count * 149

      const { data: opp, error: insErr } = await supabase
        .from('logistics_opportunities')
        .insert({
          forecast_departure_id: null,
          from_city: s.fromCity,
          to_city: s.toCity,
          departure_date: tomorrowDate,
          departure_time: '09:00',
          package_count: s.count,
          total_weight: Math.round(s.totalWeight * 10) / 10,
          estimated_gmv: Math.round(gmv),
          recommended_vehicle: vehicle,
          status: 'open',
          ai_reason: `${s.count} öppna paket (${Math.round(s.totalWeight)} kg) på ${s.fromCity} → ${s.toCity} söker transport. Privatförare nekade eller förfrågan gick ut. Potentiell omsättning: ${Math.round(gmv)} kr.`,
        })
        .select()
        .single()

      if (!insErr && opp) created.push(opp)
    }

    return NextResponse.json({ created: created.length, opportunities: created })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
