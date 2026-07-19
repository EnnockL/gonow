import { createServiceClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { endpoint: '/api/dispatcher/health' })
  if (guard.response) return guard.response
  try {
    const supabase = createServiceClient()

    const [matchesRes, oppsRes, openPkgsRes, forecastRes] = await Promise.all([
      supabase.from('package_matches').select('status, created_at, driver_confirmed_at'),
      supabase.from('logistics_opportunities').select('status'),
      supabase.from('packages').select('created_at').not('status', 'in', '("delivered","cancelled")'),
      supabase.from('forecast_departures').select('id, predicted_package_count').eq('status', 'planned'),
    ])

    // ── Match success rate ───────────────────────────────────────────────────
    type MatchRow = { status: string; created_at: string; driver_confirmed_at: string | null }
    const matches = (matchesRes.data ?? []) as MatchRow[]
    const total_matched   = matches.filter(m => m.status === 'matched').length
    const total_expired   = matches.filter(m => m.status === 'expired').length
    const total_cancelled = matches.filter(m => m.status === 'cancelled').length
    const matchAttempts   = total_matched + total_expired + total_cancelled
    const match_success_rate = matchAttempts > 0 ? Math.round(total_matched / matchAttempts * 100) : 0

    // ── Average match time (hours: created_at → driver_confirmed_at) ─────────
    const confirmedMatches = matches.filter(
      m => m.status === 'matched' && m.driver_confirmed_at && m.created_at,
    )
    const matchTimes = confirmedMatches.map(m =>
      (new Date(m.driver_confirmed_at!).getTime() - new Date(m.created_at).getTime()) / 3600000,
    )
    const avg_match_time_hours = matchTimes.length > 0
      ? Math.round(matchTimes.reduce((a, b) => a + b, 0) / matchTimes.length * 10) / 10
      : 0

    // ── Vehicle utilization ──────────────────────────────────────────────────
    const opps = (oppsRes.data ?? []) as Array<{ status: string }>
    const accepted_opps = opps.filter(o => o.status === 'accepted').length
    const vehicle_utilization = opps.length > 0 ? Math.round(accepted_opps / opps.length * 100) : 0

    // ── Average package wait days ────────────────────────────────────────────
    const openPkgs = (openPkgsRes.data ?? []) as Array<{ created_at: string }>
    const now = Date.now()
    const waitDays = openPkgs.map(p => (now - new Date(p.created_at).getTime()) / 86400000)
    const avg_wait_days = waitDays.length > 0
      ? Math.round(waitDays.reduce((a, b) => a + b, 0) / waitDays.length * 10) / 10
      : 0

    // ── Forecast accuracy (booked vs predicted) ──────────────────────────────
    const forecasts = (forecastRes.data ?? []) as Array<{ id: string; predicted_package_count: number }>
    let forecast_accuracy = 0

    if (forecasts.length > 0) {
      const depIds = forecasts.map(f => f.id)
      const { data: bookedData } = await supabase
        .from('packages')
        .select('forecast_departure_id')
        .in('forecast_departure_id', depIds)
        .not('status', 'eq', 'cancelled')

      const bookedByDep: Record<string, number> = {}
      for (const pkg of (bookedData ?? []) as Array<{ forecast_departure_id: string }>) {
        bookedByDep[pkg.forecast_departure_id] = (bookedByDep[pkg.forecast_departure_id] ?? 0) + 1
      }

      const accuracies = forecasts
        .filter(f => f.predicted_package_count > 0)
        .map(f => Math.min(100, Math.round(((bookedByDep[f.id] ?? 0) / f.predicted_package_count) * 100)))

      if (accuracies.length > 0) {
        forecast_accuracy = Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length)
      }
    }

    return NextResponse.json({
      match_success_rate,
      avg_match_time_hours,
      vehicle_utilization,
      avg_wait_days,
      forecast_accuracy,
      total_matched,
      total_expired,
      total_cancelled,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
