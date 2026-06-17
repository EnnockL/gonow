import { createClient } from './supabase'
import { Trip } from './types'

interface MatchRequest {
  from_city: string
  to_city: string
  departure_date: string
  weight_kg: number
  type: 'package' | 'pickup' | 'return' | 'lift'
}

type TripRow = Trip & {
  users?: { name: string; rating_avg: number; rating_count: number; avatar_url?: string }
}

export async function findMatchingTrips(req: MatchRequest) {
  const supabase = createClient()

  const { data } = (await supabase
    .from('trips')
    .select('*, users(name, rating_avg, rating_count, avatar_url)')
    .eq('status', 'active')
    .gte('weight_capacity_kg', req.weight_kg)
    .gte('departure_at', req.departure_date + 'T00:00:00')
    .lte('departure_at', req.departure_date + 'T23:59:59')
    .order('departure_at', { ascending: true })) as { data: TripRow[] | null }

  if (!data) return []

  return data
    .map((trip) => {
      let score = 0
      if (trip.from_city.toLowerCase().includes(req.from_city.toLowerCase())) score += 50
      if (trip.to_city.toLowerCase().includes(req.to_city.toLowerCase())) score += 50
      score += (trip.users?.rating_avg || 0) * 5
      if (req.type === 'lift' && trip.allows_passengers) score += 20
      if (req.type === 'return' && trip.allows_returns) score += 20
      if (req.type === 'pickup' && trip.allows_packages) score += 20
      return { ...trip, match_score: score }
    })
    .filter((t) => t.match_score > 50)
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 5)
}
