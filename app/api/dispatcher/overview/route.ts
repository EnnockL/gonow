import { createServiceClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createServiceClient()
    const today = new Date().toISOString().split('T')[0]
    const todayStart = `${today}T00:00:00.000Z`
    const now = new Date().toISOString()

    const [
      activePkgRes,
      activeTripsRes,
      forecastRes,
      openOppRes,
      acceptedOppRes,
      pendingMatchRes,
      matchedRes,
      deliveredRes,
      pkgsTodayRes,
      tripsTodayRes,
      inTransitRes,
      queueLFRes,
      queuePFRes,
      queueWNDRes,
      queueALRes,
      forecastsTodayRes,
      oppsTodayRes,
      acceptedTodayRes,
    ] = await Promise.all([
      supabase.from('packages').select('id', { count: 'exact', head: true }).not('status', 'in', '("delivered","cancelled")'),
      supabase.from('trips').select('id', { count: 'exact', head: true }).gte('departure_at', now),
      supabase.from('forecast_departures').select('id', { count: 'exact', head: true }).eq('status', 'planned').gte('departure_date', today),
      supabase.from('logistics_opportunities').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('logistics_opportunities').select('id', { count: 'exact', head: true }).eq('status', 'accepted'),
      supabase.from('package_matches').select('id', { count: 'exact', head: true }).eq('status', 'driver_pending_confirmation'),
      supabase.from('package_matches').select('id', { count: 'exact', head: true }).eq('status', 'matched'),
      supabase.from('packages').select('id', { count: 'exact', head: true }).eq('status', 'delivered').gte('updated_at', todayStart),
      supabase.from('packages').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabase.from('trips').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabase.from('packages').select('id', { count: 'exact', head: true }).eq('status', 'in_transit'),
      supabase.from('packages').select('id', { count: 'exact', head: true }).eq('dispatcher_stage', 'logistics_first'),
      supabase.from('packages').select('id', { count: 'exact', head: true }).eq('dispatcher_stage', 'private_fallback'),
      supabase.from('packages').select('id', { count: 'exact', head: true }).eq('dispatcher_stage', 'waiting_next_departure'),
      supabase.from('packages').select('id', { count: 'exact', head: true }).eq('dispatcher_stage', 'assigned_logistics'),
      supabase.from('forecast_departures').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabase.from('logistics_opportunities').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabase.from('logistics_opportunities').select('id', { count: 'exact', head: true }).eq('status', 'accepted').gte('accepted_at', todayStart),
    ])

    return NextResponse.json({
      active_packages: activePkgRes.count ?? 0,
      active_trips: activeTripsRes.count ?? 0,
      forecast_departures: forecastRes.count ?? 0,
      open_opportunities: openOppRes.count ?? 0,
      accepted_opportunities: acceptedOppRes.count ?? 0,
      pending_matches: pendingMatchRes.count ?? 0,
      matched_packages: matchedRes.count ?? 0,
      delivered_today: deliveredRes.count ?? 0,
      packages_today: pkgsTodayRes.count ?? 0,
      trips_today: tripsTodayRes.count ?? 0,
      in_transit: inTransitRes.count ?? 0,
      forecasts_today: forecastsTodayRes.count ?? 0,
      opportunities_today: oppsTodayRes.count ?? 0,
      accepted_today: acceptedTodayRes.count ?? 0,
      queue: {
        logistics_first: queueLFRes.count ?? 0,
        private_fallback: queuePFRes.count ?? 0,
        waiting_next_departure: queueWNDRes.count ?? 0,
        assigned_logistics: queueALRes.count ?? 0,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
