// Gonow Score v1.1
//
// Fyra kategorier — max 100 poäng:
//   Rating:       40p — genomsnittsbetyg (1–5 ★)
//   Prissättning: 30p — hur konkurrenskraftigt föraren prissätter
//   Completion:   20p — andel genomförda körningar (0–100 %)
//   Erfarenhet:   10p — antal resor + BankID-verifiering

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max)
}

// ---- Tier-definitioner (används av ScoreBadge och ProfilSida) ----

export interface ScoreTier {
  key:   'new' | 'verified' | 'trusted' | 'premium' | 'elite'
  label: string
  min:   number
  max:   number
  color: string
  bg:    string
  emoji: string
}

export const SCORE_TIERS: ScoreTier[] = [
  { key: 'new',      label: 'Ny förare',  min: 0,  max: 20,  color: '#9ca3af', bg: 'rgba(156,163,175,0.1)',  emoji: '⚫' },
  { key: 'verified', label: 'Verifierad', min: 20, max: 50,  color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',   emoji: '🔵' },
  { key: 'trusted',  label: 'Pålitlig',   min: 50, max: 75,  color: '#22c55e', bg: 'rgba(34,197,94,0.1)',    emoji: '🟢' },
  { key: 'premium',  label: 'Premium',    min: 75, max: 90,  color: '#a8b5c8', bg: 'rgba(168,181,200,0.12)', emoji: '🥈' },
  { key: 'elite',    label: 'Elite',      min: 90, max: 100, color: '#c8912a', bg: 'rgba(200,145,42,0.1)',   emoji: '🥇' },
]

export function tierForScore(score: number): ScoreTier {
  return SCORE_TIERS.find(t => score >= t.min && score < t.max) ?? SCORE_TIERS[SCORE_TIERS.length - 1]
}

// ---- Input ----

export interface ScoreInput {
  rating_avg:        number   // 1.0–5.0
  rating_count:      number
  offer_avg_ratio?:  number   // genomsnittligt bud / pristak (0–1.0), default 1.0
  completion_rate?:  number   // 0–100 (procent)
  completed_trips?:  number
  bankid_verified?:  boolean
}

// ---- Breakdown och resultat ----

export interface ScoreBreakdown {
  rating:     { pts: number; max: 40 }
  pricing:    { pts: number; max: 30 }
  completion: { pts: number; max: 20 }
  experience: { pts: number; max: 10 }
}

export interface ScoreResult {
  score:          number
  tier:           ScoreTier
  nextTier:       ScoreTier | null
  progressToNext: number        // 0–1 inom nuvarande tier
  breakdown:      ScoreBreakdown
}

// ---- Beräkning ----

export function calcGonowScore(input: ScoreInput): ScoreResult {
  // Rating: 0–40 pts
  const ratingPts = clamp(
    input.rating_count > 0 ? (input.rating_avg / 5) * 40 : 0,
    0, 40
  )

  // Prissättning: 0–30 pts
  // offer_avg_ratio < 1.0 = erbjuder under pristak = mer konkurrenskraftigt
  // ratio 0.70 → 30p | ratio 1.00 → 0p | linear interpolation
  const ratio       = clamp(input.offer_avg_ratio ?? 1.0, 0, 2)
  const pricingPts  = clamp(
    ratio >= 1.0 ? 0 : ((1.0 - ratio) / 0.30) * 30,
    0, 30
  )

  // Completion: 0–20 pts (completion_rate är 0–100 procent)
  const completionRate = clamp(input.completion_rate ?? 0, 0, 100)
  const completionPts  = clamp((completionRate / 100) * 20, 0, 20)

  // Erfarenhet: 0–10 pts (BankID = 3p, resor = upp till 7p log)
  const trips      = clamp(input.completed_trips ?? 0, 0, Infinity)
  const bankidPts  = (input.bankid_verified ?? false) ? 3 : 0
  const tripsPts   = clamp(
    trips > 0 ? (Math.log(trips + 1) / Math.log(101)) * 7 : 0,
    0, 7
  )
  const experiencePts = clamp(bankidPts + tripsPts, 0, 10)

  const score = clamp(
    Math.round(ratingPts + pricingPts + completionPts + experiencePts),
    0, 100
  )

  const tier      = tierForScore(score)
  const tierIdx   = SCORE_TIERS.indexOf(tier)
  const nextTier  = tierIdx < SCORE_TIERS.length - 1 ? SCORE_TIERS[tierIdx + 1] : null

  const progressToNext = nextTier
    ? clamp((score - tier.min) / (tier.max - tier.min), 0, 1)
    : 1

  return {
    score,
    tier,
    nextTier,
    progressToNext,
    breakdown: {
      rating:     { pts: Math.round(ratingPts),     max: 40 },
      pricing:    { pts: Math.round(pricingPts),    max: 30 },
      completion: { pts: Math.round(completionPts), max: 20 },
      experience: { pts: Math.round(experiencePts), max: 10 },
    },
  }
}

// ---- Completion rate från ordrar ----

export function completionRateFromOrders(
  orders: { carrier_id?: string | null; status: string }[],
  userId: string
): number {
  const mine = orders.filter(o => o.carrier_id === userId)
  if (mine.length === 0) return 0
  const done = mine.filter(o => o.status === 'delivered' || o.status === 'confirmed').length
  return clamp(Math.round((done / mine.length) * 100), 0, 100)
}
