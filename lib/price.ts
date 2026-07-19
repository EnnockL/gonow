// ============================================================
// GONOW PRISMOTOR v1.4  (Production Ready — Closed Beta)
//
// Gonow säljer INTE transporter.
// Gonow säljer ledig kapacitet i resor som ändå genomförs.
//
// Prismotorn är byggd för:
//   • Kunder:  billigare än PostNord (paket) och SJ/FlixBus (lift)
//   • Förare:  motiverande utbetalning (80 %)
//   • AI V2:   ändra ENBART MARKET_MULTIPLIER-nivån, aldrig grundformlerna
//
// KONFIGURATION: lib/pricing-config.ts
// Ändra siffror där — aldrig här.
//
// ============================================================
// ROADMAP
//
// V1 — Statisk prismotor (denna fil, v1.4)
//       MULTIPLIERS.packageMarket = 1.0
//       MULTIPLIERS.liftMarket    = 1.0
//       Alla priser beräknas deterministiskt.
//
// V2 — AI modifierar priset ±20–30 %
//       AI analyserar rutten och väljer en MARKET_MULTIPLIER-nivå:
//         LOW_DEMAND (0.90) | NORMAL (1.00) | HIGH (1.10) | VERY_HIGH (1.25)
//       AI-input (aldrig grundformeln — bara multiplikatorn):
//         • antal förare aktiva på rutten just nu
//         • antal öppna paket längs rutten
//         • antal öppna lift-förfrågningar
//         • historiska accepterade priser på rutten
//         • veckodag och tid på dygnet
//         • väderläge
//         • omväg för föraren
//       AI returnerar: { multiplier: 0.90 | 1.00 | 1.10 | 1.25 }
//       Prismotorn applicerar det — grundformeln ändras aldrig.
//
// V3 — AI optimerar hela resan
//       Ny knapp under /kor: 💰 Optimera min resa
//       AI visar:
//         Nuvarande intäkt   →  Optimerad intäkt
//         Extra intäkt       →  Ingen extra omväg
//       AI analyserar: öppna paket, öppna lift, vikt,
//                      lediga säten, omväg, timing
//
// V4 — Självlärande prismotor
//       AI analyserar tusentals historiska bokningar:
//         • vilka priser som accepteras respektive avvisas
//         • vilka rutter som är populärast per veckodag
//         • genomsnittlig tid från bokning till acceptans
//       MARKET_MULTIPLIER-nivåerna justeras automatiskt.
//       Ingen ändring av grundformler behövs.
// ============================================================

import {
  PACKAGE, URGENCY, LIFT, TAXI_CAP_PER_MIL,
  MULTIPLIERS, PAYOUT, LIFT_BUSINESS_RULE,
} from '@/lib/pricing-config'

// ─── 1. PAKET ────────────────────────────────────────────────

export function calcPackagePrice(opts: {
  km:       number
  kg:       number
  urgency?: keyof typeof URGENCY
  fragile?: boolean
}) {
  const urgencyFee = URGENCY[opts.urgency ?? 'flexible']
  const fragileFee = opts.fragile ? 25 : 0

  const basePrice =
    PACKAGE.base +
    opts.kg * PACKAGE.perKg +
    opts.km * PACKAGE.perKm +
    urgencyFee +
    fragileFee

  const recommended = Math.round(basePrice * MULTIPLIERS.packageMarket)
  const ceiling      = Math.round(recommended * PACKAGE.ceilingMultiplier)

  return {
    recommended,
    ceiling,
    breakdown: {
      base:     PACKAGE.base,
      weight:   Math.round(opts.kg * PACKAGE.perKg),
      distance: Math.round(opts.km * PACKAGE.perKm),
      urgency:  urgencyFee,
      fragile:  fragileFee,
    },
  }
}

// ─── 2. LIFT ─────────────────────────────────────────────────

export function calcLiftPrice(opts: {
  km:          number
  passengers:  number
  isWeekend?:  boolean
  highDemand?: boolean
}) {
  const extras =
    (opts.isWeekend  ? LIFT.weekendExtra    : 0) +
    (opts.highDemand ? LIFT.highDemandExtra : 0)

  // Taxitak: 18,50 kr/mil = 1,85 kr/km per säte
  const taxiCapPerSeat = Math.round((opts.km / 10) * TAXI_CAP_PER_MIL)

  const basePrice  = LIFT.base + opts.km * LIFT.perKm + extras
  let pricePerSeat = Math.round(basePrice * MULTIPLIERS.liftMarket)

  // Affärsregel: lift ska alltid kosta mer än ett standard 3 kg-paket
  // på korta rutter där crossover inte sker naturligt (~92 km).
  // Undantag accepterat: om taxitaket gör lift billigare vid < ~60 km.
  if (opts.km < LIFT_BUSINESS_RULE.thresholdKm) {
    const refPkg = calcPackagePrice({
      km: opts.km,
      kg: LIFT_BUSINESS_RULE.referenceWeightKg,
    }).recommended
    if (pricePerSeat <= refPkg) {
      pricePerSeat = refPkg + LIFT_BUSINESS_RULE.minMarginKr
    }
  }

  // Taxilag (2024:152): priset per säte får ALDRIG överstiga taxitaket
  const recommendedPerSeat = Math.min(pricePerSeat, taxiCapPerSeat)
  const ceilingPerSeat     = Math.min(
    Math.round(pricePerSeat * 1.15),
    taxiCapPerSeat
  )

  return {
    recommendedPerSeat,
    ceilingPerSeat,
    totalRecommended: recommendedPerSeat * opts.passengers,
    totalCeiling:     ceilingPerSeat     * opts.passengers,
    taxiCapPerSeat,
    breakdown: {
      base:     LIFT.base,
      distance: Math.round(opts.km * LIFT.perKm),
      extras,
    },
  }
}

// ─── 3. UTBETALNING ──────────────────────────────────────────

export function calcCarrierPayout(gross: number) {
  return {
    gross,
    carrierPayout:   Math.round(gross * PAYOUT.carrier),
    gonowCommission: Math.round(gross * PAYOUT.commission),
    insurancePool:   Math.round(gross * PAYOUT.insurance),
  }
}

// ─── 4. TRIP POTENTIAL ───────────────────────────────────────
// Visas i /kor när föraren registrerar en resa.

export function calcTripPotential(opts: {
  km:             number
  packageCount:   number
  avgWeightKg:    number
  passengerCount: number
}) {
  const packageEarnings = opts.packageCount > 0
    ? calcPackagePrice({ km: opts.km, kg: opts.avgWeightKg }).recommended * opts.packageCount
    : 0
  const liftEarnings = opts.passengerCount > 0
    ? calcLiftPrice({ km: opts.km, passengers: opts.passengerCount }).totalRecommended
    : 0
  const totalGross = packageEarnings + liftEarnings
  const split      = calcCarrierPayout(totalGross)

  return {
    packageEarnings: Math.round(packageEarnings),  // 📦 Paketpotential
    liftEarnings:    Math.round(liftEarnings),      // 👤 Liftpotential
    totalGross:      Math.round(totalGross),        // 💰 Total möjlig intäkt
    carrierPayout:   split.carrierPayout,           // 🏦 Förarens utbetalning (80 %)
    gonowCommission: split.gonowCommission,
    insurancePool:   split.insurancePool,
  }
}

// ─── 5. VERIFIERING ──────────────────────────────────────────
// Anropas vid kall start av API-routern för att bekräfta att
// prismotorn returnerar korrekta värden efter deployment.

export type PriceVerificationResult = {
  ok:     boolean
  routes: {
    label:    string
    km:       number
    pkg:      { recommended: number; ceiling: number }
    lift:     { perSeat: number; taxiCap: number; capped: boolean }
    pkgLtLift: boolean
    note?:   string
  }[]
  warnings: string[]
}

export function verifyPricingEngine(): PriceVerificationResult {
  const PKG_ROUTES = [
    { label: 'Stockholm → Uppsala',   km: 70   },
    { label: 'Stockholm → Göteborg',  km: 470  },
    { label: 'Luleå → Stockholm',     km: 900  },
    { label: 'Kiruna → Örebro',       km: 1200 },
    { label: 'Kiruna → Malmö',        km: 1500 },
  ]

  const LIFT_ROUTES = [
    { label: 'Stockholm → Uppsala',   km: 70   },
    { label: 'Stockholm → Göteborg',  km: 470  },
    { label: 'Luleå → Stockholm',     km: 900  },
    { label: 'Kiruna → Stockholm',    km: 1250 },
  ]

  const warnings: string[] = []
  // Comparison uses the reference weight (same as the business rule) so
  // results are consistent: paket(3 kg) must always be cheaper than lift.
  // Taxi-cap inversion is accepted when the route is short enough that the
  // cap actually bites (crossover: ~63 km for 3 kg reference weight).
  const REF_KG      = LIFT_BUSINESS_RULE.referenceWeightKg
  const SHORT_KM    = 80   // conservative boundary — covers taxi-cap zone

  const allKms = new Set([...PKG_ROUTES, ...LIFT_ROUTES].map(r => r.km))

  const routes = [...allKms].sort((a, b) => a - b).map(km => {
    const routeLabel = (
      [...PKG_ROUTES, ...LIFT_ROUTES].find(r => r.km === km)?.label ?? `${km} km`
    )

    const pkg  = calcPackagePrice({ km, kg: REF_KG })
    const lift = calcLiftPrice({ km, passengers: 1 })

    const pkgLtLift  = pkg.recommended < lift.recommendedPerSeat
    const shortRoute = km < SHORT_KM

    if (!pkgLtLift && !shortRoute) {
      warnings.push(`⚠️  ${routeLabel}: paket ${REF_KG} kg (${pkg.recommended} kr) ≥ lift (${lift.recommendedPerSeat} kr/säte) — oväntat`)
    }
    // Accepted: taxi cap can invert the relation on short routes

    if (lift.recommendedPerSeat > lift.taxiCapPerSeat) {
      warnings.push(`❌  ${routeLabel}: lift (${lift.recommendedPerSeat} kr) överstiger taxitak (${lift.taxiCapPerSeat} kr) — KRITISK`)
    }

    return {
      label:     routeLabel,
      km,
      pkg:       { recommended: pkg.recommended, ceiling: pkg.ceiling },
      lift:      { perSeat: lift.recommendedPerSeat, taxiCap: lift.taxiCapPerSeat, capped: lift.recommendedPerSeat === lift.taxiCapPerSeat },
      pkgLtLift,
      ...(shortRoute && !pkgLtLift ? { note: 'Kortrutt — taxitak accepterat undantag' } : {}),
    }
  })

  const ok = warnings.filter(w => w.startsWith('❌')).length === 0

  return { ok, routes, warnings }
}
