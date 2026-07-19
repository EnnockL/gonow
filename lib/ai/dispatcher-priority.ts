export type DispatcherStage =
  | 'logistics_first'
  | 'private_fallback'
  | 'waiting_next_departure'
  | 'assigned_logistics'
  | 'matched'
  | 'cancelled'

export type ProviderType = 'logistics_company' | 'private_driver'

export function getNextDispatcherStage(input: {
  currentStage: DispatcherStage
  logisticsOfferExpiresAt?: string | null
  hasLogisticsOffer?: boolean
  hasPrivateOffer?: boolean
  now?: Date
}): DispatcherStage {
  const {
    currentStage,
    logisticsOfferExpiresAt,
    hasLogisticsOffer = false,
    hasPrivateOffer = false,
    now = new Date(),
  } = input

  if (currentStage === 'matched' || currentStage === 'cancelled') {
    return currentStage
  }

  if (currentStage === 'logistics_first') {
    if (hasLogisticsOffer) return 'matched'
    if (logisticsOfferExpiresAt && now >= new Date(logisticsOfferExpiresAt)) {
      return 'private_fallback'
    }
    return 'logistics_first'
  }

  if (currentStage === 'private_fallback') {
    if (hasPrivateOffer) return 'matched'
    return 'private_fallback'
  }

  if (currentStage === 'waiting_next_departure') {
    return 'waiting_next_departure'
  }

  return currentStage
}

export const VALID_TRANSITIONS: Partial<Record<DispatcherStage, DispatcherStage[]>> = {
  logistics_first:        ['private_fallback', 'assigned_logistics', 'matched', 'cancelled'],
  private_fallback:       ['waiting_next_departure', 'matched', 'cancelled'],
  waiting_next_departure: ['private_fallback', 'cancelled'],
  assigned_logistics:     ['matched', 'cancelled'],
}

export function isValidTransition(from: DispatcherStage, to: DispatcherStage): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}
