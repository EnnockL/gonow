export interface PackagePriceInput {
  distanceKm: number
  weightKg: number
  urgency: 'standard' | 'today' | 'express'
  fragile: boolean
}

export interface PackageBreakdown {
  baseFee: number
  distanceFee: number
  weightFee: number
  urgencyFee: number
  fragileFee: number
}

export interface PackagePriceResult {
  recommendedPrice: number
  maxPrice: number
  breakdown: PackageBreakdown
}

export interface LiftPriceInput {
  distanceKm: number
  passengers: number
  urgency: 'standard' | 'today'
}

export interface LiftBreakdown {
  baseFee: number
  distanceFee: number
  urgencyFee: number
}

export interface LiftPriceResult {
  recommendedPrice: number
  maxPrice: number
  breakdown: LiftBreakdown
}

export interface CarrierPayoutResult {
  gross: number
  carrierPayout: number
  gonowCommission: number
  insurancePool: number
}

export interface TripPotentialInput {
  distanceKm: number
  packageCount: number
  avgWeightKg: number
  passengerCount: number
}

export interface TripPotentialResult {
  packageEarnings: number
  liftEarnings: number
  totalGross: number
  totalCarrierPayout: number
}

export function calculatePackagePrice(input: PackagePriceInput): PackagePriceResult {
  const baseFee = 59
  const distanceFee = Math.round(input.distanceKm * 0.9)
  const weightFee = Math.round(input.weightKg * 6)
  const urgencyFee = input.urgency === 'express' ? 69 : input.urgency === 'today' ? 35 : 0
  const fragileFee = input.fragile ? 25 : 0
  const recommendedPrice = baseFee + distanceFee + weightFee + urgencyFee + fragileFee
  const maxPrice = Math.round(recommendedPrice * 1.15)
  return {
    recommendedPrice,
    maxPrice,
    breakdown: { baseFee, distanceFee, weightFee, urgencyFee, fragileFee },
  }
}

export function calculateLiftPrice(input: LiftPriceInput): LiftPriceResult {
  const baseFee = 39
  const distanceFee = Math.round(input.distanceKm * 0.75 * input.passengers)
  const urgencyFee = input.urgency === 'today' ? 29 : 0
  const recommendedPrice = baseFee + distanceFee + urgencyFee
  const maxPrice = Math.round(recommendedPrice * 1.12)
  return {
    recommendedPrice,
    maxPrice,
    breakdown: { baseFee, distanceFee, urgencyFee },
  }
}

export function calculateCarrierPayout(totalPrice: number): CarrierPayoutResult {
  return {
    gross: totalPrice,
    carrierPayout: Math.round(totalPrice * 0.8),
    gonowCommission: Math.round(totalPrice * 0.15),
    insurancePool: Math.round(totalPrice * 0.05),
  }
}

export function calculateTripPotential(input: TripPotentialInput): TripPotentialResult {
  const packageEarnings = input.packageCount > 0
    ? calculatePackagePrice({
        distanceKm: input.distanceKm,
        weightKg: input.avgWeightKg,
        urgency: 'standard',
        fragile: false,
      }).recommendedPrice * input.packageCount
    : 0
  const liftEarnings = input.passengerCount > 0
    ? calculateLiftPrice({
        distanceKm: input.distanceKm,
        passengers: input.passengerCount,
        urgency: 'standard',
      }).recommendedPrice
    : 0
  const totalGross = packageEarnings + liftEarnings
  return {
    packageEarnings: Math.round(packageEarnings),
    liftEarnings: Math.round(liftEarnings),
    totalGross: Math.round(totalGross),
    totalCarrierPayout: Math.round(totalGross * 0.8),
  }
}
