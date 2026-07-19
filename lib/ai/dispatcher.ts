// ============================================================
// GONOW AI DISPATCHER — server-side only
//
// Unified AI brain for all Gonow features.
// V1: deterministic engine (no API key needed)
// V2: Claude enhances insights (set ANTHROPIC_API_KEY in .env.local)
//
// To activate Claude: add ANTHROPIC_API_KEY=sk-ant-... to .env.local
// No code changes needed — the switch is automatic.
//
// DO NOT import this file from client components.
// ============================================================

import { createServiceClient } from '@/lib/supabase'
import { geocode, drivingDistance } from '@/lib/distance'
import { calcTripPotential } from '@/lib/price'
import type { PackageMatch, LiftMatch, TripOptimizationResult, TripOptimizationInput } from './types'

// Shared distance cache — 30 min TTL (same pattern as price-ceiling route)
const distCache = new Map<string, { km: number; ts: number }>()
const CACHE_TTL = 30 * 60 * 1000

async function getKm(from: string, to: string): Promise<number | null> {
  const key = `${from.toLowerCase()}|${to.toLowerCase()}`
  const hit = distCache.get(key)
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.km

  const [fromGeo, toGeo] = await Promise.all([geocode(from), geocode(to)])
  if (!fromGeo || !toGeo) return null

  const route = await drivingDistance(fromGeo.lat, fromGeo.lng, toGeo.lat, toGeo.lng)
  if (!route) return null

  distCache.set(key, { km: route.distance_km, ts: Date.now() })
  return route.distance_km
}

async function fetchPackages(from: string, to: string): Promise<PackageMatch[]> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('packages')
    .select('id, from_city, to_city, weight_kg, price_ceiling, deadline')
    .eq('status', 'open')
    .gt('expires_at', new Date().toISOString())
    .ilike('from_city', `%${from}%`)
    .ilike('to_city', `%${to}%`)
    .limit(10)

  return (data ?? []).map((p: {
    id: string; from_city: string; to_city: string
    weight_kg: number; price_ceiling: number; deadline: string
  }) => ({
    id: p.id, fromCity: p.from_city, toCity: p.to_city,
    weightKg: p.weight_kg, ceiling: p.price_ceiling, deadline: p.deadline,
  }))
}

async function fetchLifts(from: string, to: string): Promise<LiftMatch[]> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('lift_requests')
    .select('id, from_city, to_city, travel_date, passengers, max_price')
    .eq('status', 'open')
    .gt('expires_at', new Date().toISOString())
    .ilike('from_city', `%${from}%`)
    .ilike('to_city', `%${to}%`)
    .limit(10)

  return (data ?? []).map((l: {
    id: string; from_city: string; to_city: string
    travel_date: string; passengers: number; max_price: number | null
  }) => ({
    id: l.id, fromCity: l.from_city, toCity: l.to_city,
    travelDate: l.travel_date, passengers: l.passengers, maxPrice: l.max_price,
  }))
}

function engineInsight(
  from: string, to: string, km: number,
  pkgs: PackageMatch[], lifts: LiftMatch[], payout: number,
): string {
  if (pkgs.length === 0 && lifts.length === 0) {
    return `Inga öppna uppdrag på ${from} → ${to} just nu. Lägg upp din resa — beställningar matchas i realtid.`
  }
  const parts: string[] = []
  if (pkgs.length > 0) {
    const totalKg = pkgs.reduce((s, p) => s + p.weightKg, 0)
    parts.push(`${pkgs.length} paket (${totalKg.toFixed(0)} kg)`)
  }
  if (lifts.length > 0) {
    const totalPass = lifts.reduce((s, l) => s + l.passengers, 0)
    parts.push(`${lifts.length} liftresa${lifts.length > 1 ? 'r' : ''} (${totalPass} passagerare)`)
  }
  return `Upp till ${payout} kr extra på ${km} km — ${parts.join(' + ')} längs ${from} → ${to}.`
}

type AnthropicMessage = {
  content: Array<{ type: string; text: string }>
}

async function fetchClaudeInsight(
  apiKey: string,
  from: string, to: string, km: number,
  pkgs: PackageMatch[], lifts: LiftMatch[],
  totalPassengers: number, payout: number,
): Promise<string | null> {
  try {
    const prompt = `Du är Gonows AI-assistent för förare. Svar på svenska, max 2 korta meningar. Inga listor.

Förare kör: ${from} → ${to} (${km} km)
Öppna paket: ${pkgs.length} st (${pkgs.reduce((s, p) => s + p.weightKg, 0).toFixed(0)} kg totalt)
Öppna lift: ${lifts.length} st (${totalPassengers} passagerare)
Potentiell utbetalning (80 %): ${payout} kr

Ge ett konkret råd om hur föraren maximerar sin resa. Nämn specifika siffror.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':          apiKey,
        'anthropic-version':  '2023-06-01',
        'content-type':       'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 120,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) return null
    const data = await res.json() as AnthropicMessage
    const block = data.content?.[0]
    return block?.type === 'text' ? block.text : null
  } catch {
    return null
  }
}

// ─── Public API ───────────────────────────────────────────────

export async function optimizeTrip(
  input: TripOptimizationInput,
): Promise<TripOptimizationResult | null> {
  const km = await getKm(input.fromCity, input.toCity)
  if (!km) return null

  const [packages, lifts] = await Promise.all([
    fetchPackages(input.fromCity, input.toCity),
    fetchLifts(input.fromCity, input.toCity),
  ])

  const avgWeight       = packages.length > 0
    ? packages.reduce((s, p) => s + p.weightKg, 0) / packages.length
    : 3
  const totalPassengers = lifts.reduce((s, l) => s + l.passengers, 0)

  const potential = calcTripPotential({
    km,
    packageCount:   packages.length,
    avgWeightKg:    avgWeight,
    passengerCount: totalPassengers,
  })

  const base: Omit<TripOptimizationResult, 'insight' | 'source'> = {
    fromCity:          input.fromCity,
    toCity:            input.toCity,
    km,
    packages,
    lifts,
    potentialEarnings: potential.totalGross,
    carrierPayout:     potential.carrierPayout,
    extraKm:           0,
    breakdown: {
      packageEarnings: potential.packageEarnings,
      liftEarnings:    potential.liftEarnings,
      gonowFee:        potential.gonowCommission,
    },
  }

  const fallback = engineInsight(
    input.fromCity, input.toCity, km,
    packages, lifts, potential.carrierPayout,
  )

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { ...base, insight: fallback, source: 'engine' }
  }

  const aiText = await fetchClaudeInsight(
    apiKey,
    input.fromCity, input.toCity, km,
    packages, lifts, totalPassengers, potential.carrierPayout,
  )

  return {
    ...base,
    insight: aiText ?? fallback,
    source:  aiText ? 'claude' : 'engine',
  }
}
