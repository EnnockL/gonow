import { createServiceClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'

type ActivityItem = {
  id: string
  time: string
  type: string
  description: string
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { endpoint: '/api/dispatcher/activity' })
  if (guard.response) return guard.response
  try {
    const supabase = createServiceClient()

    const [pkgRes, tripRes, matchRes, oppRes, forecastRes, inTransitRes, deliveredRes] = await Promise.all([
      supabase
        .from('packages')
        .select('id, from_city, to_city, created_at')
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('trips')
        .select('id, from_city, to_city, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('package_matches')
        .select('id, status, created_at, packages(from_city, to_city)')
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('logistics_opportunities')
        .select('id, from_city, to_city, status, created_at, accepted_at')
        .order('created_at', { ascending: false })
        .limit(4),
      supabase
        .from('forecast_departures')
        .select('id, from_city, to_city, departure_date, created_at')
        .order('created_at', { ascending: false })
        .limit(4),
      supabase
        .from('packages')
        .select('id, from_city, to_city, updated_at')
        .eq('status', 'in_transit')
        .order('updated_at', { ascending: false })
        .limit(4),
      supabase
        .from('packages')
        .select('id, from_city, to_city, updated_at')
        .eq('status', 'delivered')
        .order('updated_at', { ascending: false })
        .limit(4),
    ])

    const items: ActivityItem[] = []

    // Packages published
    for (const p of (pkgRes.data ?? []) as Array<{ id: string; from_city: string; to_city: string; created_at: string }>) {
      items.push({ id: `pkg-${p.id}`, time: p.created_at, type: 'package', description: `Paket publicerat: ${p.from_city} → ${p.to_city}` })
    }

    // Trips registered
    for (const t of (tripRes.data ?? []) as Array<{ id: string; from_city: string; to_city: string; created_at: string }>) {
      items.push({ id: `trip-${t.id}`, time: t.created_at, type: 'trip', description: `Resa registrerad: ${t.from_city} → ${t.to_city}` })
    }

    // Matches
    for (const m of (matchRes.data ?? []) as Array<{ id: string; status: string; created_at: string; packages: { from_city: string; to_city: string } | null }>) {
      const route = m.packages ? `${m.packages.from_city} → ${m.packages.to_city}` : 'okänd rutt'
      if (m.status === 'matched') {
        items.push({ id: `match-matched-${m.id}`, time: m.created_at, type: 'matched', description: `Matchning bekräftad: ${route}` })
      } else {
        items.push({ id: `match-suggested-${m.id}`, time: m.created_at, type: 'match_suggested', description: `AI föreslog match: ${route}` })
      }
    }

    // Logistics opportunities
    for (const o of (oppRes.data ?? []) as Array<{ id: string; from_city: string; to_city: string; status: string; created_at: string; accepted_at: string | null }>) {
      items.push({ id: `opp-created-${o.id}`, time: o.created_at, type: 'opportunity_created', description: `Logistikmöjlighet skapad: ${o.from_city} → ${o.to_city}` })
      if (o.status === 'accepted' && o.accepted_at) {
        items.push({ id: `opp-accepted-${o.id}`, time: o.accepted_at, type: 'opportunity_accepted', description: `Logistikuppdrag accepterat: ${o.from_city} → ${o.to_city}` })
      }
    }

    // Forecast departures
    for (const d of (forecastRes.data ?? []) as Array<{ id: string; from_city: string; to_city: string; departure_date: string; created_at: string }>) {
      items.push({ id: `forecast-${d.id}`, time: d.created_at, type: 'forecast', description: `AI planerade avgång: ${d.from_city} → ${d.to_city} (${d.departure_date})` })
    }

    // Packages picked up (in_transit)
    for (const p of (inTransitRes.data ?? []) as Array<{ id: string; from_city: string; to_city: string; updated_at: string }>) {
      items.push({ id: `pickup-${p.id}`, time: p.updated_at, type: 'pickup', description: `Paket upphämtat: ${p.from_city} → ${p.to_city}` })
    }

    // Packages delivered
    for (const p of (deliveredRes.data ?? []) as Array<{ id: string; from_city: string; to_city: string; updated_at: string }>) {
      items.push({ id: `delivered-${p.id}`, time: p.updated_at, type: 'delivered', description: `Paket levererat: ${p.from_city} → ${p.to_city}` })
    }

    items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

    return NextResponse.json({ activity: items.slice(0, 20) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
