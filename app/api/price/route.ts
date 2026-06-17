import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const distance_km = parseFloat(searchParams.get('distance_km') ?? '0')
  const weight_kg   = parseFloat(searchParams.get('weight_kg')   ?? '1')

  if (!distance_km || distance_km <= 0) {
    return NextResponse.json({ error: 'distance_km krävs' }, { status: 400 })
  }

  const supabase = createClient()
  const { data: pricing } = await supabase
    .from('pricing')
    .select('*')
    .single() as { data: { base_fee: number; per_km: number; per_kg: number; commission_pct: number } | null }

  const p = pricing ?? { base_fee: 49, per_km: 0.85, per_kg: 8.00, commission_pct: 15 }

  const price         = Math.round(p.base_fee + distance_km * p.per_km + weight_kg * p.per_kg)
  const commission    = Math.round(price * (p.commission_pct / 100))
  const carrier_payout = price - commission

  return NextResponse.json({
    price,
    commission,
    carrier_payout,
    breakdown: {
      base_fee:   p.base_fee,
      km_fee:     Math.round(distance_km * p.per_km),
      kg_fee:     Math.round(weight_kg   * p.per_kg),
      commission_pct: p.commission_pct,
    },
  })
}
