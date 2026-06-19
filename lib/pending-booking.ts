export interface PendingBookingDraft {
  trip_id: string
  service_type: 'package' | 'passenger' | 'return'
  seats_requested?: number
  weight_kg: number
  description: string
  pickup_address: string
  dropoff_address: string
  sender_name: string
  sender_phone: string
  sender_email: string
  recipient_name: string
  recipient_phone: string
  recipient_email: string
  status: 'pending'
  price_est?: number
}

const PENDING_BOOKING_KEY = 'gonow_pending_booking_v1'
const SIGNUP_EMAIL_KEY = 'gonow_signup_email'

export function savePendingBookingDraft(draft: PendingBookingDraft) {
  if (typeof window === 'undefined') return
  localStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify({
    ...draft,
    saved_at: new Date().toISOString(),
  }))
}

export function loadPendingBookingDraft(): PendingBookingDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PENDING_BOOKING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingBookingDraft
    if (!parsed?.trip_id || !parsed?.service_type) return null
    return parsed
  } catch {
    return null
  }
}

export function clearPendingBookingDraft() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(PENDING_BOOKING_KEY)
}

export function saveSignupEmail(email: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SIGNUP_EMAIL_KEY, email)
}

export function loadSignupEmail() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(SIGNUP_EMAIL_KEY)
}

export function clearSignupEmail() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SIGNUP_EMAIL_KEY)
}
