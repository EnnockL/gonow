export interface GonowScoreInput {
  rating_avg: number
  rating_count: number
  bankid_verified: boolean
  completion_rate?: number    // 0–100 (percent)
  completed_trips?: number    // absolute count
  punctuality_rate?: number   // 0–100, % on time (future data)
  avg_response_min?: number   // minutes (future data)
}

export interface GonowScoreTier {
  key: 'new' | 'verified' | 'trusted' | 'premium' | 'elite'
  label: string
  min: number
  max: number
  color: string
  bg: string
  emoji: string
}

export const TIERS: GonowScoreTier[] = [
  { key: 'new',      label: 'Ny förare',  min: 0,  max: 20,  color: '#9ca3af', bg: 'rgba(156,163,175,0.1)',       emoji: '⚫' },
  { key: 'verified', label: 'Verifierad', min: 20, max: 50,  color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',        emoji: '🔵' },
  { key: 'trusted',  label: 'Pålitlig',   min: 50, max: 75,  color: '#22c55e', bg: 'rgba(34,197,94,0.1)',         emoji: '🟢' },
  { key: 'premium',  label: 'Premium',    min: 75, max: 90,  color: '#a8b5c8', bg: 'rgba(168,181,200,0.12)',       emoji: '🥈' },
  { key: 'elite',    label: 'Elite',      min: 90, max: 100, color: '#c8912a', bg: 'rgba(200,145,42,0.1)',         emoji: '🥇' },
]

export interface GonowScoreBreakdown {
  rating:      { pts: number; max: number }
  trips:       { pts: number; max: number }
  bankid:      { pts: number; max: number }
  completion:  { pts: number; max: number }
  punctuality: { pts: number; max: number }
  response:    { pts: number; max: number }
}

export interface GonowScoreResult {
  score: number
  tier: GonowScoreTier
  nextTier: GonowScoreTier | null
  progressToNext: number  // 0–1 within current tier
  breakdown: GonowScoreBreakdown
}

export interface NextLevelRequirement {
  label: string
  done: boolean
  current: number
  target: number
  unit: string
  icon: string
}

export function calculateGonowScore(input: GonowScoreInput): GonowScoreResult {
  const trips = input.completed_trips ?? input.rating_count

  // Rating: 35p (only counts when there are actual reviews)
  const ratingPts = input.rating_count > 0 ? (input.rating_avg / 5) * 35 : 0

  // BankID: 15p
  const bankidPts = input.bankid_verified ? 15 : 0

  // Trips: logarithmic 0→0, 1→7, 5→13, 20→20, 100→25 (max 25p)
  const tripsPts = trips > 0 ? Math.min(Math.log(trips + 1) / Math.log(101) * 25, 25) : 0

  // Completion: 15p (completion_rate is 0–100)
  const completionRate = input.completion_rate ?? (trips > 0 ? 95 : 0)
  const completionPts = (completionRate / 100) * 15

  // Punctuality: 5p bonus (future — show as locked until data exists)
  // punctuality_rate is 0–100
  const punctualityRate = input.punctuality_rate ?? 0
  const punctualityPts = (punctualityRate / 100) * 5

  // Response time: 5p bonus (10min=5p, 60min=2p, >60min=0)
  const avgMin = input.avg_response_min
  const responsePts = avgMin == null ? 0
    : avgMin <= 10  ? 5
    : avgMin <= 30  ? 3
    : avgMin <= 60  ? 1
    : 0

  const raw = ratingPts + bankidPts + tripsPts + completionPts + punctualityPts + responsePts
  const score = Math.min(Math.round(raw), 100)

  const tier     = TIERS.find(t => score >= t.min && score < t.max) ?? TIERS[TIERS.length - 1]
  const tierIdx  = TIERS.indexOf(tier)
  const nextTier = tierIdx < TIERS.length - 1 ? TIERS[tierIdx + 1] : null

  const progressToNext = nextTier
    ? (score - tier.min) / (tier.max - tier.min)
    : 1

  return {
    score,
    tier,
    nextTier,
    progressToNext,
    breakdown: {
      rating:      { pts: Math.round(ratingPts),      max: 35 },
      trips:       { pts: Math.round(tripsPts),        max: 25 },
      bankid:      { pts: bankidPts,                   max: 15 },
      completion:  { pts: Math.round(completionPts),   max: 15 },
      punctuality: { pts: Math.round(punctualityPts),  max: 5  },
      response:    { pts: Math.round(responsePts),     max: 5  },
    },
  }
}

export function getNextLevelRequirements(
  input: GonowScoreInput,
  result: GonowScoreResult,
): NextLevelRequirement[] {
  if (!result.nextTier) return []

  const trips = input.completed_trips ?? input.rating_count
  const reqs: NextLevelRequirement[] = []

  if (!input.bankid_verified) {
    reqs.push({ label: 'BankID-verifiering', done: false, current: 0, target: 1, unit: '', icon: '🆔' })
  }

  const reviewTarget = result.nextTier.key === 'verified' ? 1
    : result.nextTier.key === 'trusted'  ? 5
    : result.nextTier.key === 'premium'  ? 20
    : 50
  if (input.rating_count < reviewTarget) {
    reqs.push({ label: 'Recensioner', done: input.rating_count >= reviewTarget, current: input.rating_count, target: reviewTarget, unit: 'st', icon: '⭐' })
  }

  const tripTarget = result.nextTier.key === 'verified' ? 1
    : result.nextTier.key === 'trusted'  ? 5
    : result.nextTier.key === 'premium'  ? 20
    : 100
  if (trips < tripTarget) {
    reqs.push({ label: 'Genomförda leveranser', done: trips >= tripTarget, current: trips, target: tripTarget, unit: 'st', icon: '📦' })
  }

  if (result.nextTier.key !== 'verified' && (input.rating_avg ?? 0) < 4.5 && input.rating_count > 0) {
    reqs.push({ label: 'Genomsnittligt betyg', done: (input.rating_avg ?? 0) >= 4.5, current: Number((input.rating_avg ?? 0).toFixed(1)), target: 4.5, unit: '★', icon: '⭐' })
  }

  return reqs
}

// Returns 0–100 to match the DB column and GonowScoreInput.completion_rate
export function completionRateFromOrders(
  orders: { carrier_id?: string | null; status: string }[],
  userId: string
): number {
  const mine = orders.filter(o => o.carrier_id === userId)
  if (mine.length === 0) return 0
  const done = mine.filter(o => o.status === 'delivered' || o.status === 'confirmed').length
  return Math.round((done / mine.length) * 100)
}
