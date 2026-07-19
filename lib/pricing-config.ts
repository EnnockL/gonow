// ============================================================
// GONOW PRICING CONFIG v1.4  (Production Ready — Closed Beta)
//
// Gonow säljer ledig kapacitet i resor som ändå genomförs.
// Prissättning bygger på detta: billigare än traditionella
// transportbolag, motiverande för föraren (80 % utbetalning).
//
// Justeras UTAN att röra prismotorn i lib/price.ts.
// I V2 justerar AI enbart market-multiplikatorer.
// Grundformler i price.ts ska aldrig behöva ändras.
// ============================================================

// --- Paket ---

export const PACKAGE = {
  base:              79,    // kr — grundavgift per pakettjänst
  perKg:             12,    // kr/kg — vikt dominerar priset
  perKm:             0.03,  // kr/km — liten faktor; Gonow är inte ett transportbolag
  ceilingMultiplier: 1.15,  // tak = recommended × 1.15
} as const

export const URGENCY = {
  flexible: 0,
  tomorrow: 0,
  today:    39,
  express:  79,
} as const

// --- Lift ---

export const LIFT = {
  base:             79,    // kr — grundavgift per säte
  perKm:            0.42,  // kr/km — konkurrerar mot SJ/FlixBus/samåkning
  weekendExtra:     25,    // kr/säte helgtillägg
  highDemandExtra:  30,    // kr/säte högtrafiktillägg (V2: AI bestämmer via MARKET_MULTIPLIER)
} as const

// Taxilag (2024:152) — aldrig mer än 18,50 kr/mil per säte
export const TAXI_CAP_PER_MIL = 18.50

// --- Market multipliers (V1: statisk 1.0) ---
// V2: AI justerar ENBART packageMarket/liftMarket (±20–30 %)
// Grundformlerna i lib/price.ts ska aldrig behöva ändras.
//
// Exempel V2:
//   packageMarket = 0.92   (låg efterfrågan på rutten)
//   liftMarket    = 1.06   (hög efterfrågan på rutten)

export const MULTIPLIERS = {
  packageMarket: 1.0,
  liftMarket:    1.0,
} as const

// --- AI V2: Market Multiplier-nivåer ---
// Dessa används INTE i V1.
// AI väljer en nivå baserat på: antal förare, paket, lift,
// historiska priser, veckodag, tid, väder och omväg.
// V2: AI returnerar ENBART multiplicatorn — grundformeln ändras aldrig.

export const MARKET_MULTIPLIER = {
  LOW_DEMAND: 0.90,   // låg efterfrågan på rutten
  NORMAL:     1.00,   // standardläge
  HIGH:       1.10,   // hög efterfrågan
  VERY_HIGH:  1.25,   // extremt hög efterfrågan (t.ex. storhelg + begränsade förare)
} as const

// --- Utbetalning ---

export const PAYOUT = {
  carrier:    0.80,   // 80 % till föraren
  commission: 0.15,   // 15 % Gonow
  insurance:  0.05,   // 5 % försäkringspool
} as const

// --- Affärsregel: lift alltid dyrare än paket (kort rutt) ---
// Gäller för km < thresholdKm.
// Crossover sker naturligt vid ~92 km utan regeln.
// Undantag: taxitaket kan göra lift billigare vid < ~60 km.

export const LIFT_BUSINESS_RULE = {
  referenceWeightKg:  3,    // referensvikt för jämförelse (standard 3 kg-paket)
  minMarginKr:       20,    // lift = paketpris + 20 kr om lift ≤ paket
  thresholdKm:      150,    // regeln gäller enbart för km < 150
} as const
