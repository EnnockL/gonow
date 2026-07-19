export type UserRole = 'user' | 'carrier' | 'admin'
export type OrderType = 'package' | 'pickup' | 'return' | 'lift'
export type OrderStatus =
  | 'pending'
  | 'matched'
  | 'paid'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'confirmed'
  | 'disputed'
  | 'cancelled'
export type TripStatus = 'active' | 'full' | 'completed' | 'cancelled'

export interface User {
  id: string
  email: string
  name: string
  phone?: string
  avatar_url?: string
  bankid_verified: boolean
  bankid_name?: string | null
  bankid_personal_number?: string | null
  bankid_verified_at?: string | null
  stripe_account_id?: string
  role: UserRole
  rating_avg: number
  rating_count: number
  created_at: string
  age?: number | null
  city?: string | null
  gender?: string | null
  bio?: string | null
  onboarding_completed?: boolean
  completion_rate?: number | null
}

export interface Trip {
  id: string
  carrier_id: string
  carrier?: User
  from_city: string
  from_lat?: number
  from_lng?: number
  to_city: string
  to_lat?: number
  to_lng?: number
  departure_at: string
  arrival_est?: string
  vehicle_type?: string
  vehicle_make?: string
  vehicle_model?: string
  vehicle_color?: string
  vehicle_plate?: string
  vehicle_seats_total?: number
  seats_available: number
  weight_capacity_kg: number
  allows_passengers: boolean
  allows_packages: boolean
  allows_returns: boolean
  allows_pets: boolean
  price_per_seat?: number
  price_per_kg?: number
  status: TripStatus
  waypoints?: { city: string; lat: number; lng: number }[]
  match_score?: number
}

export interface Order {
  id: string
  sender_id: string
  carrier_id?: string
  receiver_id?: string
  trip_id?: string
  booking_request_id?: string
  type: OrderType
  description?: string
  weight_kg?: number
  photo_url?: string
  pickup_address?: string
  pickup_lat?: number
  pickup_lng?: number
  dropoff_address?: string
  dropoff_lat?: number
  dropoff_lng?: number
  store_name?: string
  store_address?: string
  order_reference?: string
  price: number
  commission: number
  carrier_payout: number
  stripe_payment_intent_id?: string
  stripe_transfer_id?: string
  payment_provider?: string
  payment_status?: string
  order_phase?: string
  metadata?: Record<string, unknown>
  status: OrderStatus
  pickup_qr_code?: string
  delivery_photo_url?: string
  confirmed_at?: string
  picked_up_at?: string
  delivered_at?: string
  created_at: string
}

export interface Review {
  id: string
  order_id: string
  from_user_id: string
  to_user_id: string
  rating: number
  comment?: string
  created_at: string
}

export interface Payout {
  id: string
  carrier_id: string
  order_id: string
  amount: number
  status: 'pending' | 'processing' | 'paid' | 'failed'
  stripe_transfer_id?: string
  paid_at?: string
  created_at: string
}

export interface EscrowLedgerEntry {
  id: string
  order_id: string
  payment_id?: string
  payout_id?: string
  sender_id?: string
  carrier_id?: string
  entry_type:
    | 'customer_payment_received'
    | 'platform_fee_reserved'
    | 'carrier_payout_reserved'
    | 'carrier_available'
    | 'carrier_payout_processing'
    | 'carrier_payout_paid'
    | 'refund_reserved'
    | 'refund_completed'
    | 'dispute_hold'
    | 'dispute_release'
  direction: 'credit' | 'debit'
  bucket:
    | 'customer_funds'
    | 'escrow_hold'
    | 'platform_revenue'
    | 'carrier_pending'
    | 'carrier_available'
    | 'carrier_in_payout'
    | 'carrier_paid'
    | 'refund_pool'
    | 'dispute_hold'
  amount: number
  currency: string
  note?: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface AIParseResult {
  type: OrderType
  from_city: string
  to_city: string
  description: string
  weight_kg: number | null
  departure_date: string | null
  urgency: 'today' | 'tomorrow' | 'flexible'
  store_name: string | null
  order_reference: string | null
  passengers: number | null
  special_requirements: string | null
  estimated_price_sek: number
  confidence: number
}

export interface ContactInfo {
  name: string
  phone: string
  email: string
}

export interface WaitlistEntry {
  email: string
  role?: 'sender' | 'carrier' | 'both'
  city?: string
}
