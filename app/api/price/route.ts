import { NextRequest, NextResponse } from 'next/server'
import { calcPackagePrice, calcCarrierPayout, verifyPricingEngine } from '@/lib/price'

// Run once on cold start — confirms the engine is correct after deploy
if (process.env.NODE_ENV !== 'test') {
  const v = verifyPricingEngine()
  const prefix = v.ok ? '✅ Gonow Prismotor V1.4 OK' : '❌ Gonow Prismotor V1.4 FEL'
  console.log(`\n${prefix}`)
  v.routes.forEach(r => {
    const capStr = r.lift.capped ? ' [CAP]' : ''
    const rel    = r.pkgLtLift ? '✅' : (r.note ? '⚠️ ' : '❌')
    console.log(
      `  ${r.label.padEnd(30)} paket ${String(r.pkg.recommended).padStart(4)} kr` +
      ` | lift ${String(r.lift.perSeat).padStart(4)} kr/säte${capStr}  ${rel}`
    )
  })
  if (v.warnings.length) v.warnings.forEach(w => console.warn(w))
  console.log('')
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // ?verify=1 → returnerar hela verifieringsrapporten som JSON
  if (searchParams.get('verify') === '1') {
    const result = verifyPricingEngine()
    return NextResponse.json(result, { status: result.ok ? 200 : 500 })
  }

  const distance_km = parseFloat(searchParams.get('distance_km') ?? '0')
  const weight_kg   = parseFloat(searchParams.get('weight_kg')   ?? '2')
  const urgency     = (searchParams.get('urgency') ?? 'flexible') as 'flexible' | 'tomorrow' | 'today' | 'express'

  if (!distance_km || distance_km <= 0) {
    return NextResponse.json({ error: 'distance_km krävs' }, { status: 400 })
  }

  const result = calcPackagePrice({ km: distance_km, kg: weight_kg, urgency })
  const split  = calcCarrierPayout(result.recommended)

  return NextResponse.json({
    price:          result.recommended,
    ceiling:        result.ceiling,
    commission:     split.gonowCommission,
    carrier_payout: split.carrierPayout,
    breakdown: {
      base_fee:    result.breakdown.base,
      km_fee:      result.breakdown.distance,
      kg_fee:      result.breakdown.weight,
      urgency_fee: result.breakdown.urgency,
    },
  })
}
