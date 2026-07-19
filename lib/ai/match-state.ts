export type MatchStatus =
  | 'suggested'
  | 'customer_accepted'
  | 'driver_pending_confirmation'
  | 'matched'
  | 'expired'
  | 'cancelled'

export interface MatchTransitionResult {
  ok: boolean
  error?: string
  nextStatus: MatchStatus
  sideEffects: {
    notifyDriver?: boolean
    notifyCustomer?: boolean
    updatePackageStatus?: 'matched' | null
    setExpiresAt?: string | null
  }
}

const VALID_TRANSITIONS: Partial<Record<MatchStatus, MatchStatus[]>> = {
  suggested:                   ['customer_accepted', 'cancelled'],
  customer_accepted:           ['driver_pending_confirmation', 'cancelled'],
  driver_pending_confirmation: ['matched', 'expired', 'cancelled'],
}

export function transitionMatch(
  current: MatchStatus,
  action: 'customer_accept' | 'customer_decline' | 'driver_confirm' | 'driver_decline' | 'expire',
): MatchTransitionResult {
  const actionToNext: Record<typeof action, MatchStatus> = {
    customer_accept:  'customer_accepted',
    customer_decline: 'cancelled',
    driver_confirm:   'matched',
    driver_decline:   'cancelled',
    expire:           'expired',
  }

  const next = actionToNext[action]
  const allowed = VALID_TRANSITIONS[current] ?? []

  if (!allowed.includes(next)) {
    return { ok: false, error: `Ogiltig transition: ${current} → ${next}`, nextStatus: current, sideEffects: {} }
  }

  const sideEffects: MatchTransitionResult['sideEffects'] = {}

  if (next === 'customer_accepted') {
    sideEffects.notifyDriver = true
    // set 30 min window for driver to confirm
    sideEffects.setExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  }

  if (next === 'matched') {
    sideEffects.updatePackageStatus = 'matched'
    sideEffects.notifyCustomer = true
  }

  if (next === 'expired' || next === 'cancelled') {
    sideEffects.notifyCustomer = true
  }

  return { ok: true, nextStatus: next, sideEffects }
}
