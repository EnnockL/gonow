import { createServiceClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const WEEKDAYS = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag']
const MIN_PACKAGES = 5 // minimum historical packages to create a forecast

interface PackageRow {
  from_city: string
  to_city: string
  created_at: string
  weight_kg: number
}

function nextWeekdayDate(weekday: number): string {
  const now = new Date()
  const daysUntil = (weekday - now.getDay() + 7) % 7 || 7
  const target = new Date(now)
  target.setDate(now.getDate() + daysUntil)
  return target.toISOString().split('T')[0]
}

function bookingDeadline(departureDate: string): string {
  const d = new Date(departureDate)
  d.setDate(d.getDate() - 1)
  d.setHours(18, 0, 0, 0)
  return d.toISOString()
}

export async function POST() {
  try {
    const supabase = createServiceClient()

    // Fetch all historical packages
    const { data: packages, error: pkgErr } = await supabase
      .from('packages')
      .select('from_city, to_city, created_at, weight_kg')
      .not('from_city', 'is', null)
      .not('to_city', 'is', null)

    if (pkgErr) return NextResponse.json({ error: pkgErr.message }, { status: 500 })
    if (!packages?.length) return NextResponse.json({ created: 0, departures: [] })

    // Group by route + weekday
    const groups: Record<string, { count: number; totalWeight: number; weekday: number }> = {}

    for (const pkg of packages as PackageRow[]) {
      const weekday = new Date(pkg.created_at).getDay()
      const key = `${pkg.from_city.trim()}|${pkg.to_city.trim()}|${weekday}`
      if (!groups[key]) groups[key] = { count: 0, totalWeight: 0, weekday }
      groups[key].count++
      groups[key].totalWeight += pkg.weight_kg ?? 5
    }

    const forecasts: {
      from_city: string; to_city: string; departure_date: string; departure_time: string
      booking_deadline: string; predicted_package_count: number; predicted_total_weight: number
      status: string; ai_reason: string
    }[] = []

    for (const [key, stats] of Object.entries(groups)) {
      if (stats.count < MIN_PACKAGES) continue

      const [from_city, to_city] = key.split('|')
      const departureDate = nextWeekdayDate(stats.weekday)
      const deadline = bookingDeadline(departureDate)

      const avgWeight = Math.round(stats.totalWeight / stats.count)
      const predictedWeight = Math.round(avgWeight * stats.count * 0.8)

      // Check if we already have a planned departure for this route + date
      const { data: existing } = await supabase
        .from('forecast_departures')
        .select('id')
        .eq('from_city', from_city)
        .eq('to_city', to_city)
        .eq('departure_date', departureDate)
        .maybeSingle()

      if (existing) continue

      forecasts.push({
        from_city,
        to_city,
        departure_date: departureDate,
        departure_time: '09:00',
        booking_deadline: deadline,
        predicted_package_count: stats.count,
        predicted_total_weight: predictedWeight,
        status: 'planned',
        ai_reason: `${stats.count} historiska paket på ${from_city} → ${to_city} på ${WEEKDAYS[stats.weekday]}. AI skapar planerad avgång för kommande ${WEEKDAYS[stats.weekday]}.`,
      })
    }

    if (!forecasts.length) {
      return NextResponse.json({ created: 0, departures: [] })
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('forecast_departures')
      .insert(forecasts)
      .select()

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    return NextResponse.json({ created: inserted?.length ?? 0, departures: inserted ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
