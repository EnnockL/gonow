// AI layer types — V1 engine mode + V2 Claude mode (requires ANTHROPIC_API_KEY)
// Swap from engine→claude without touching any UI or API routes.

export type PackageMatch = {
  id:       string
  fromCity: string
  toCity:   string
  weightKg: number
  ceiling:  number
  deadline: string
}

export type LiftMatch = {
  id:         string
  fromCity:   string
  toCity:     string
  travelDate: string
  passengers: number
  maxPrice:   number | null
}

export type TripOptimizationResult = {
  fromCity:          string
  toCity:            string
  km:                number
  packages:          PackageMatch[]
  lifts:             LiftMatch[]
  potentialEarnings: number
  carrierPayout:     number
  extraKm:           number
  insight:           string
  breakdown: {
    packageEarnings: number
    liftEarnings:    number
    gonowFee:        number
  }
  source: 'engine' | 'claude'
}

export type TripOptimizationInput = {
  fromCity: string
  toCity:   string
}

// ─── Trip match ranking (used in /skicka step 2) ─────────────

export type AIMatchResult = {
  bestTripId: string
  score:      number
  reasons:    string[]
  source:     'engine' | 'claude'
}
