// Deterministic trip scoring — used by both the API route (server)
// and optionally client-side. No Supabase or Anthropic imports.

export type ScoredTrip = {
  tripId:  string
  score:   number
  reasons: string[]
}

type TripForScoring = {
  id:                  string
  users?:              { name: string; rating_avg: number; rating_count: number } | null
  departure_at?:       string | null
  weight_capacity_kg?: number | null
}

type ScoringRequest = {
  weight_kg?:      number | null
  departure_date?: string | null
}

function buildReasons(
  trip: TripForScoring,
  requestedWeightKg: number,
  now: number,
): string[] {
  const reasons: string[] = []

  const rating = trip.users?.rating_avg ?? 0
  const count  = trip.users?.rating_count ?? 0

  if (rating >= 4.8 && count >= 10) {
    reasons.push(`${rating.toFixed(1)} ⭐ — ${count} genomförda resor`)
  } else if (rating >= 4.5) {
    reasons.push(`${rating.toFixed(1)} ⭐ betyg`)
  } else if (count > 0) {
    reasons.push(`${count} genomförda resor`)
  }

  if (trip.departure_at) {
    const hoursAway = (new Date(trip.departure_at).getTime() - now) / (1000 * 3600)
    if (hoursAway >= 0 && hoursAway <= 24)  reasons.push('Avgår inom 24 timmar')
    else if (hoursAway >= 0 && hoursAway <= 48) reasons.push('Avgår imorgon')
  }

  const capacity = trip.weight_capacity_kg ?? null
  if (capacity !== null && capacity >= requestedWeightKg) {
    reasons.push(
      capacity - requestedWeightKg >= 5
        ? `${capacity} kg kapacitet — gott om utrymme`
        : `${capacity} kg kapacitet — passar din leverans`,
    )
  }

  return reasons.length > 0 ? reasons : ['Verifierad bärare']
}

export function scoreTrips(
  trips: TripForScoring[],
  request: ScoringRequest,
): ScoredTrip[] {
  const now              = Date.now()
  const requestedWeight  = request.weight_kg ?? 1

  return trips.map(trip => {
    let score = 0

    // Rating quality (0-30 pts)
    const rating   = trip.users?.rating_avg ?? 4.0
    score += Math.round((rating / 5.0) * 30)

    // Rating confidence (0-15 pts)
    const count    = trip.users?.rating_count ?? 0
    score += Math.round(Math.min(count / 20, 1) * 15)

    // Departure timing (0-25 pts)
    if (trip.departure_at) {
      const hoursAway = (new Date(trip.departure_at).getTime() - now) / (1000 * 3600)
      if      (hoursAway >= 0 && hoursAway <= 12) score += 25
      else if (hoursAway >= 0 && hoursAway <= 36) score += 20
      else if (hoursAway >= 0 && hoursAway <= 72) score += 15
      else if (hoursAway >= 0)                    score += 5
    }

    // Capacity match (0-20 pts)
    const capacity = trip.weight_capacity_kg ?? null
    if (capacity !== null) {
      if (capacity >= requestedWeight) score += 20
    } else {
      score += 10  // unknown = neutral
    }

    return {
      tripId:  trip.id,
      score,
      reasons: buildReasons(trip, requestedWeight, now),
    }
  })
}

export function pickBestTrip(
  trips: TripForScoring[],
  request: ScoringRequest,
): ScoredTrip | null {
  if (trips.length === 0) return null
  return scoreTrips(trips, request).reduce((best, cur) =>
    cur.score > best.score ? cur : best,
  )
}
