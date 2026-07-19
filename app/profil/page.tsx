'use client'


import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, Car, CheckCircle2, ChevronDown, Clock, CreditCard, Loader2, LogOut,
  Mail, MapPin, Package, Phone, Shield, Star, UserRound, Users, Wallet,
} from 'lucide-react'
import LiftChat from '@/components/lift/LiftChat'
import MatchSuggestions from '@/components/matches/MatchSuggestions'
import BankIDVerify from '@/components/auth/BankIDVerify'
import { useAuth } from '@/hooks/useAuth'
import AuthModal from '@/components/auth/AuthModal'
import { createClient } from '@/lib/supabase'
import { EscrowLedgerEntry, Order, OrderStatus, Payout, Trip, User } from '@/lib/types'
import { BookingRequest, cancelBooking, loadAllBookings, updateBookingStatus } from '@/lib/bookings'
import { authedFetch } from '@/lib/auth/authed-fetch'
import { SavedTrip, loadTripsForCarrier } from '@/components/driver/MyTrips'
import {
  getDefaultProfileMeta,
  getProfileCompletion,
  loadUserProfileMeta,
  saveUserProfileMeta,
  type RoleIntent,
  type UserProfileMeta,
} from '@/lib/profile-meta'
import { SIM_TRIPS } from '@/lib/simulation/data'
import { calculateGonowScore, completionRateFromOrders, getNextLevelRequirements } from '@/lib/gonow-score'
import { GonowScoreCard, GonowScoreBadgeCompact } from '@/components/GonowScoreBadge'
import { loadSignupEmail } from '@/lib/pending-booking'
import CarrierProfileModal from '@/components/carrier/CarrierProfileModal'
import RatingModal from '@/components/RatingModal'

type TabKey =
  | 'overview'
  // Paket
  | 'my_packages' | 'my_bids' | 'package_deliveries' | 'orders'
  // Lift
  | 'my_lift_requests' | 'lift_offers' | 'lift_matched' | 'lift_history'
  // Kör & tjäna
  | 'my_trips' | 'assignments' | 'packages_on_route' | 'lift_on_route' | 'earnings' | 'statistics'
  // Konto
  | 'profile' | 'bankid' | 'payment' | 'settings'
  // Legacy (ej i nav men URL-tillgängliga)
  | 'carriers' | 'requests'

type PackageOffer = {
  id: string
  carrier_id: string
  offered_price: number
  message: string | null
  status: string
  created_at: string
  users?: { name: string; rating_avg: number; avatar_url: string | null } | null
}

type MyPackage = {
  id: string
  from_city: string
  to_city: string
  description: string
  weight_kg: number
  price_ceiling: number
  deadline: string
  status: string
  created_at: string
  package_offers?: PackageOffer[]
}

type MyBid = {
  id: string
  package_id: string
  offered_price: number
  message: string | null
  status: string
  created_at: string
  packages?: { from_city: string; to_city: string; description: string; price_ceiling: number; status: string } | null
}

type MyDriverMatch = {
  id: string
  package_id: string
  driver_id: string
  status: string
  proposed_price: number | null
  ai_message_driver: string | null
  ai_message_customer: string | null
  expires_at: string | null
  created_at: string
  packages?: { id: string; from_city: string; to_city: string; description: string; weight_kg?: number; price_ceiling: number; status: string } | null
  drivers?: { id: string; name: string; rating_avg: number; avatar_url: string | null } | null
}

type PkgAssignment = {
  id: string
  from_city: string
  to_city: string
  description: string | null
  weight_kg: number | null
  price_ceiling: number | null
  status: string
  pickup_confirmed_at: string | null
  delivery_confirmed_at: string | null
  sender: { name: string | null; phone: string | null } | null
}

type LiftOffer = {
  id: string
  from_city: string
  to_city: string
  travel_date: string
  passengers: number
  status: string
  max_price: number | null
  final_price: number | null
  note: string | null
  users?: { name: string; rating_avg: number; avatar_url: string | null; phone?: string | null } | null
}
type BookingRequestWithTrip = BookingRequest & {
  trips?: { from_city: string; to_city: string; departure_at: string | null }
}

function isLegacyLiftBooking(booking: Pick<BookingRequest, 'service_type'> | null | undefined) {
  return booking?.service_type === 'passenger'
}

type CarrierDirectoryItem = {
  id: string
  name: string
  rating: number
  ratingCount: number
  bankidVerified: boolean
  activeTrips: number
  activeSeats: number
  nextRoute: string
  vehicleType: string
}

function getOrderCarrierId(order: Order) {
  return order.carrier_id || order.receiver_id || null
}

function getOrderPackageId(order: Order) {
  const metadata = order.metadata
  if (!metadata || typeof metadata !== 'object') return null
  const packageId = (metadata as Record<string, unknown>).package_id
  return typeof packageId === 'string' ? packageId : null
}

function ledgerEntryLabel(entry: EscrowLedgerEntry) {
  switch (entry.entry_type) {
    case 'customer_payment_received':
      return 'Kund betalade'
    case 'platform_fee_reserved':
      return 'Plattformsavgift reserverad'
    case 'carrier_payout_reserved':
      return 'Förarandel säkrad hos Gonow'
    case 'carrier_available':
      return 'Redo för utbetalning'
    case 'carrier_payout_processing':
      return 'Utbetalning pågår'
    case 'carrier_payout_paid':
      return 'Utbetalt'
    case 'refund_reserved':
      return 'Återbetalning reserverad'
    case 'refund_completed':
      return 'Återbetalning klar'
    case 'dispute_hold':
      return 'Saldo pausat vid tvist'
    case 'dispute_release':
      return 'Saldo släppt efter tvist'
    default:
      return entry.entry_type
  }
}

type NavItem = { key: TabKey; label: string; isNew?: boolean }
type NavGroupDef = { id: string; icon: string; label: string; key?: TabKey; items?: NavItem[] }

const NAV_GROUPS: NavGroupDef[] = [
  { id: 'overview', icon: '🏠', label: 'Översikt', key: 'overview' },
  {
    id: 'paket', icon: '📦', label: 'Paket',
    items: [
      { key: 'my_packages',        label: 'Mina paket' },
      { key: 'my_bids',            label: 'Erbjudanden' },
      { key: 'package_deliveries', label: 'Pågående leveranser' },
      { key: 'orders',             label: 'Leveranshistorik' },
    ],
  },
  {
    id: 'lift', icon: '👤', label: 'Lift',
    items: [
      { key: 'my_lift_requests', label: 'Mina liftresor', isNew: true },
      { key: 'lift_offers',      label: 'Erbjudanden' },
      { key: 'lift_matched',     label: 'Matchade resor', isNew: true },
      { key: 'lift_history',     label: 'Historik', isNew: true },
    ],
  },
  {
    id: 'kor', icon: '🚗', label: 'Kör & tjäna',
    items: [
      { key: 'my_trips',          label: 'Mina resor' },
      { key: 'requests',          label: 'Förfrågningar' },
      { key: 'assignments',       label: 'Aktiva leveranser' },
      { key: 'packages_on_route', label: 'Paket längs rutten', isNew: true },
      { key: 'lift_on_route',     label: 'Lift längs rutten', isNew: true },
      { key: 'earnings',          label: 'Intäkter', isNew: true },
      { key: 'statistics',        label: 'Statistik', isNew: true },
    ],
  },
  {
    id: 'konto', icon: '⚙️', label: 'Konto',
    items: [
      { key: 'profile',  label: 'Profil' },
      { key: 'bankid',   label: 'BankID', isNew: true },
      { key: 'payment',  label: 'Betalning', isNew: true },
      { key: 'settings', label: 'Inställningar', isNew: true },
    ],
  },
]

function getGroupId(tab: TabKey): string {
  for (const g of NAV_GROUPS) {
    if (g.key === tab) return g.id
    if (g.items?.some(i => i.key === tab)) return g.id
  }
  return 'overview'
}

function getNavBadge(
  key: TabKey,
  counts: { activeAssignments: number; pendingIncoming: number; driverPendingNew: number; liftOffersCount: number; packagesWithBids: number; pendingBids: number }
): number {
  switch (key) {
    case 'assignments': return counts.activeAssignments + counts.driverPendingNew
    case 'requests':    return counts.pendingIncoming + counts.driverPendingNew
    case 'my_trips':    return counts.pendingIncoming
    case 'lift_offers': return counts.liftOffersCount
    case 'my_packages':        return 0
    case 'my_bids':            return counts.packagesWithBids   // väntande erbjudanden
    case 'package_deliveries': return counts.pendingBids        // aktiva leveranser
    default:            return 0
  }
}

const ASSIGNMENT_STEPS: { status: OrderStatus; label: string; color: string }[] = [
  { status: 'pending',    label: 'Väntar betalning',  color: '#f59e0b' },
  { status: 'matched',    label: 'Transport klar',    color: '#3b82f6' },
  { status: 'paid',       label: 'Betald',            color: 'var(--gn-dk)' },
  { status: 'picked_up',  label: 'Upphämtad',   color: '#7c3aed' },
  { status: 'in_transit', label: 'På väg',       color: '#0f766e' },
  { status: 'delivered',  label: 'Levererad',    color: 'var(--gn-dk)' },
]

const NEXT_ACTION: Record<string, { label: string; next: OrderStatus; border: string; bg: string; color: string }> = {
  matched:    { label: 'Markera upphämtad', next: 'picked_up',  border: 'rgba(124,58,237,0.3)',  bg: 'rgba(124,58,237,0.08)',  color: '#7c3aed' },
  paid:       { label: 'Markera upphämtad', next: 'picked_up',  border: 'rgba(124,58,237,0.3)',  bg: 'rgba(124,58,237,0.08)',  color: '#7c3aed' },
  picked_up:  { label: 'Markera på väg',    next: 'in_transit', border: 'rgba(20,184,166,0.3)',  bg: 'rgba(20,184,166,0.08)',  color: '#0f766e' },
  in_transit: { label: 'Markera levererad', next: 'delivered',  border: 'var(--gn-030)',   bg: 'var(--gn-008)',   color: 'var(--gn-dk)' },
}

const ORDER_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Väntar betalning', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  matched: { label: 'Transport klar', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  paid: { label: 'Betald', color: 'var(--gn-dk)', bg: 'var(--gn-012)' },
  picked_up: { label: 'Upphämtad', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
  in_transit: { label: 'På väg', color: '#0f766e', bg: 'rgba(20,184,166,0.12)' },
  delivered: { label: 'Levererad', color: 'var(--gn-dk)', bg: 'var(--gn-012)' },
  confirmed: { label: 'Bekräftad', color: 'var(--gn-dk)', bg: 'var(--gn-012)' },
  disputed: { label: 'Tvist', color: '#dc2626', bg: 'rgba(239,68,68,0.12)' },
  cancelled: { label: 'Avbruten', color: '#64748b', bg: 'rgba(148,163,184,0.14)' },
}

const BOOKING_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Väntar svar', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  accepted: { label: 'Accepterad', color: 'var(--gn-dk)', bg: 'var(--gn-012)' },
  declined: { label: 'Avböjd', color: '#dc2626', bg: 'rgba(239,68,68,0.12)' },
  cancelled: { label: 'Avbruten', color: '#64748b', bg: 'rgba(148,163,184,0.14)' },
}

const PACKAGE_STATUS_META: Record<string, { label: string; shortLabel: string; color: string; bg: string }> = {
  open: { label: 'Söker transport', shortLabel: 'Söker', color: '#64748b', bg: 'rgba(148,163,184,0.12)' },
  matched: { label: 'Transport matchad', shortLabel: 'Matchad', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  paid: { label: 'Betalning säkrad', shortLabel: 'Betald', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  picked_up: { label: 'Upphämtad', shortLabel: 'Upphämtad', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  in_transit: { label: 'På väg', shortLabel: 'På väg', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  delivered: { label: 'Levererad', shortLabel: 'Levererad', color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
  confirmed: { label: 'Slutförd', shortLabel: 'Slutförd', color: 'var(--gn-dk)', bg: 'var(--gn-010)' },
  cancelled: { label: 'Avbokad', shortLabel: 'Avbokad', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  expired: { label: 'Utgången', shortLabel: 'Utgången', color: '#b45309', bg: 'rgba(180,83,9,0.1)' },
}

const PACKAGE_FLOW_STEPS = [
  { status: 'matched', label: 'Matchad', color: '#3b82f6' },
  { status: 'paid', label: 'Betald', color: '#10b981' },
  { status: 'picked_up', label: 'Upphämtad', color: '#7c3aed' },
  { status: 'in_transit', label: 'På väg', color: '#f59e0b' },
  { status: 'delivered', label: 'Levererad', color: '#16a34a' },
] as const

function getPackageStatusMeta(status: string) {
  return PACKAGE_STATUS_META[status] ?? PACKAGE_STATUS_META.open
}

function getOrderPaymentSummary(order?: Order | null) {
  if (!order?.price) return null

  if (order.status === 'pending') return `Betalning väntar ${order.price} kr`
  if (order.status === 'matched') return `Transport klar · ${order.price} kr`
  if (['paid', 'picked_up', 'in_transit', 'delivered', 'confirmed'].includes(order.status)) {
    return `Betalning säkrad ${order.price} kr`
  }

  return `${order.price} kr`
}

function isAwaitingPayment(order?: Order | null) {
  return order?.status === 'pending' || order?.status === 'matched'
}

function panelStyle(glow = false, isDark = false, mobile = false): React.CSSProperties {
  if (!isDark) {
    return {
      background: '#ffffff',
      border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: mobile ? 16 : 24,
      boxShadow: mobile ? 'none' : '0 2px 12px rgba(0,0,0,0.06)',
    }
  }
  return {
    background: glow ? 'var(--enterprise-panel-bg)' : 'var(--surface)',
    border: '1px solid var(--enterprise-panel-border)',
    borderRadius: mobile ? 16 : 24,
    boxShadow: mobile ? 'none' : 'var(--shadow-md)',
  }
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ fontSize: '1.04rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', marginBottom: subtitle ? 6 : 0 }}>{title}</p>
      {subtitle && <p style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.62, maxWidth: 720 }}>{subtitle}</p>}
    </div>
  )
}

function MobileSectionIntro({
  eyebrow,
  title,
  subtitle,
  meta,
}: {
  eyebrow: string
  title: string
  subtitle: string
  meta?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <p style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          {eyebrow}
        </p>
        {meta && (
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '6px 10px', borderRadius: 999 }}>
            {meta}
          </span>
        )}
      </div>
      <h2 style={{ fontSize: '1.18rem', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.04, color: 'var(--text)' }}>
        {title}
      </h2>
      <p style={{ fontSize: '0.82rem', lineHeight: 1.65, color: 'var(--muted)' }}>
        {subtitle}
      </p>
    </div>
  )
}

function statCard(label: string, value: string, hint: string, icon: React.ReactNode, isDark = false, mobile = false): React.ReactNode {
  return (
    <div style={{ ...panelStyle(false, isDark, mobile), padding: mobile ? 18 : 20, boxShadow: isDark ? '0 14px 30px rgba(0,0,0,0.18)' : '0 14px 30px rgba(15,23,42,0.05)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: -34, top: -34, width: 112, height: 112, borderRadius: '50%', background: 'var(--enterprise-panel-glow)', pointerEvents: 'none', opacity: 0.7 }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 8, fontWeight: 800 }}>{label}</p>
          <p style={{ fontSize: mobile ? '1.48rem' : '1.7rem', fontWeight: 850, letterSpacing: '-0.05em', color: 'var(--text)', marginBottom: 6, lineHeight: 1 }}>{value}</p>
          <p style={{ fontSize: '0.77rem', color: 'var(--muted)', lineHeight: 1.55, maxWidth: 180 }}>{hint}</p>
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.92)', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function groupCarriers(trips: (Trip & { users?: { name: string; rating_avg: number; rating_count: number } })[]): CarrierDirectoryItem[] {
  const grouped = new Map<string, CarrierDirectoryItem>()

  for (const trip of trips) {
    const id = trip.carrier_id || trip.id
    const current = grouped.get(id)
    const nextRoute = `${trip.from_city} → ${trip.to_city}`
    if (!current) {
      grouped.set(id, {
        id,
        name: trip.users?.name || 'Bärare',
        rating: trip.users?.rating_avg || 0,
        ratingCount: trip.users?.rating_count || 0,
        bankidVerified: true,
        activeTrips: 1,
        activeSeats: Math.max(0, Number(trip.seats_available || 0)),
        nextRoute,
        vehicleType: trip.vehicle_type || 'Bil',
      })
      continue
    }

    current.activeTrips += 1
    current.activeSeats += Math.max(0, Number(trip.seats_available || 0))
  }

  return [...grouped.values()].sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating
    if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount
    return b.activeTrips - a.activeTrips
  })
}

const VALID_TABS: TabKey[] = [
  'overview',
  'my_packages', 'my_bids', 'package_deliveries', 'orders',
  'my_lift_requests', 'lift_offers', 'lift_matched', 'lift_history',
  'my_trips', 'assignments', 'packages_on_route', 'lift_on_route', 'earnings', 'statistics',
  'profile', 'bankid', 'payment', 'settings',
  'carriers', 'requests',
]

export default function ProfilPage() {
  const { userId, profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  function openPackageFlow() {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('gonow_open_package_booking'))
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab') as TabKey | null
    if (tab && VALID_TABS.includes(tab)) setActiveTab(tab)
  }, [])

  // Trigger onboarding for new users who haven't completed it
  useEffect(() => {
    if (authLoading || !profile) return
    if (profile.onboarding_completed) return
    const created = new Date(profile.created_at)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    if (created > sevenDaysAgo) {
      router.replace('/profil/onboarding')
    }
  }, [authLoading, profile, router])

  function handleTabChange(tab: TabKey) {
    setActiveTab(tab)
    router.replace(`/profil?tab=${tab}`, { scroll: false })
  }
  const [showAuth, setShowAuth] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')
  const [isDark, setIsDark] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const [user, setUser] = useState<User | null>(null)
  const [meta, setMeta] = useState<UserProfileMeta>(getDefaultProfileMeta())
  const [orders, setOrders] = useState<Order[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [ledgerEntries, setLedgerEntries] = useState<EscrowLedgerEntry[]>([])
  const [incoming, setIncoming] = useState<BookingRequestWithTrip[]>([])
  const [myRequests, setMyRequests] = useState<BookingRequestWithTrip[]>([])
  const [myTrips, setMyTrips] = useState<SavedTrip[]>([])
  const [carriers, setCarriers] = useState<CarrierDirectoryItem[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [payoutingId, setPayoutingId] = useState<string | null>(null)
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [respondError, setRespondError] = useState<string | null>(null)
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [statusError, setStatusError] = useState<{ id: string; msg: string } | null>(null)
  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [myLiftOffers, setMyLiftOffers] = useState<LiftOffer[]>([])
  const [withdrawingLiftId, setWithdrawingLiftId] = useState<string | null>(null)
  const [liftOffersTab, setLiftOffersTab] = useState<string | null>(null)
  const [myPackages, setMyPackages] = useState<MyPackage[]>([])
  const [myBids, setMyBids] = useState<MyBid[]>([])
  const [myDriverOffers, setMyDriverOffers] = useState<MyDriverMatch[]>([])
  const [driverIncoming, setDriverIncoming] = useState<MyDriverMatch[]>([])
  const [actionMatchId, setActionMatchId] = useState<string | null>(null)
  const [pkgAssignments, setPkgAssignments] = useState<PkgAssignment[]>([])
  const [pkgSubTab, setPkgSubTab] = useState<'active'|'previous'|'cancelled'>('active')
  const [cancellingPkgId, setCancellingPkgId] = useState<string | null>(null)
  const [pendingRating, setPendingRating] = useState<{ orderId: string; toUserId: string; toName: string; role: 'sender' | 'carrier' } | null>(null)

  useEffect(() => {
    // Don't do anything while auth is still resolving Ã¢â‚¬â€ avoids flash of wrong state
    if (authLoading) return

    if (!userId || !profile) {
      const rememberedEmail = loadSignupEmail() || ''
      setPendingEmail(rememberedEmail)
      setShowAuth(Boolean(rememberedEmail))
      setUser(null)
      setLoadingData(false)
      return
    }

    const activeUserId = userId

    setPendingEmail('')
    setShowAuth(false)
    setUser(profile)
    setMeta(loadUserProfileMeta(activeUserId))
    setMyTrips([])
    setLoadingData(false) // visa UI omedelbart Ã¢â‚¬â€ data laddas i bakgrunden

    async function loadDashboard() {
      const supabase = createClient()

      const safeBookingRequests = async (
        mode: 'sender' | 'trip_ids',
        tripIds: string[] = []
      ): Promise<BookingRequestWithTrip[]> => {
        try {
          let query = supabase
            .from('booking_requests')
            .select('*, trips(from_city, to_city, departure_at)')
            .eq('service_type', 'passenger')
            .order('created_at', { ascending: false })

          if (mode === 'sender') {
            query = query.eq('sender_id', activeUserId)
          } else if (tripIds.length > 0) {
            query = query.in('trip_id', tripIds)
          } else {
            return []
          }

          const { data, error } = await query.limit(mode === 'sender' ? 30 : 50)
          if (error) return []
          return (data as BookingRequestWithTrip[]) || []
        } catch {
          return []
        }
      }

      const [ordersPayload, payoutsPayload, ledgerPayload, carrierTripsPayload, remoteMyRequests, allTripsRes, allBookings, liftOffersData, pkgsData, bidsData, senderMatchesPayload, driverMatchesPayload, pkgAssignmentsPayload] = await Promise.all([
        authedFetch('/api/orders').then(async (res) => (res.ok ? await res.json() : { orders: [] })).catch(() => ({ orders: [] })),
        authedFetch('/api/payouts').then(async (res) => (res.ok ? await res.json() : { payouts: [] })).catch(() => ({ payouts: [] })),
        authedFetch('/api/ledger').then(async (res) => (res.ok ? await res.json() : { entries: [] })).catch(() => ({ entries: [] })),
        authedFetch(`/api/trips?carrier_id=${activeUserId}`).then(async (res) => (res.ok ? await res.json() : { trips: [] })).catch(() => ({ trips: [] })),
        safeBookingRequests('sender'),
        fetch('/api/trips').then(async (res) => (res.ok ? (await res.json()).trips : [])).catch(() => []),
        loadAllBookings().catch(() => []),
        fetch(`/api/lift?carrier_id=${activeUserId}`).then(async (res) => (res.ok ? await res.json() : null)).catch(() => null),
        authedFetch(`/api/packages?sender_id=${activeUserId}`).then(async (res) => {
          if (!res.ok) return { data: [] }
          const payload = await res.json() as { packages?: MyPackage[] }
          return { data: payload.packages ?? [] }
        }).catch(() => ({ data: [] })),
        supabase.from('package_offers').select('id, package_id, offered_price, message, status, created_at, packages(from_city, to_city, description, price_ceiling, status)').eq('carrier_id', activeUserId).order('created_at', { ascending: false }).limit(20),
        fetch(`/api/matches?sender_id=${activeUserId}`).then(async (res) => (res.ok ? await res.json() : { matches: [] })).catch(() => ({ matches: [] })),
        fetch(`/api/matches?driver_id=${activeUserId}`).then(async (res) => (res.ok ? await res.json() : { matches: [] })).catch(() => ({ matches: [] })),
        authedFetch(`/api/packages?carrier_id=${activeUserId}&statuses=matched,paid,picked_up,in_transit,delivered`).then(async (res) => (res.ok ? await res.json() : { packages: [] })).catch(() => ({ packages: [] })),
      ])

      setOrders((ordersPayload.orders as Order[]) || [])
      setPayouts((payoutsPayload.payouts as Payout[]) || [])
      setLedgerEntries((ledgerPayload.entries as EscrowLedgerEntry[]) || [])
      const localBookings = (allBookings as BookingRequestWithTrip[]).filter(isLegacyLiftBooking)
      const localMyRequests = localBookings.filter((booking) => booking.sender_id === activeUserId)
      const mergedMyRequests = [
        ...remoteMyRequests.map((booking) => ({
          ...localMyRequests.find((item) => item.id === booking.id),
          ...booking,
        })),
        ...localMyRequests.filter((booking) => !remoteMyRequests.some((item) => item.id === booking.id)),
      ]
      setMyRequests(mergedMyRequests)

      const localTrips = loadTripsForCarrier(activeUserId)
      const remoteTrips = (carrierTripsPayload.trips as SavedTrip[]) || []
      const unsyncedLocalTrips = localTrips.filter((trip) => !remoteTrips.some((remote) => remote.id === trip.id))
      const combinedTrips = [...remoteTrips, ...unsyncedLocalTrips]
      setMyTrips(combinedTrips)

      const carrierTripIds = combinedTrips.map((trip) => trip.id)
      const incomingLocal = localBookings.filter((booking) => combinedTrips.some((trip) => trip.id === booking.trip_id))

      if (carrierTripIds.length > 0) {
        const remoteIncoming = await safeBookingRequests('trip_ids', carrierTripIds)
        const mergedIncoming = [
          ...remoteIncoming.map((booking) => ({
            ...incomingLocal.find((item) => item.id === booking.id),
            ...booking,
          })),
          ...incomingLocal.filter((booking) => !remoteIncoming.some((item) => item.id === booking.id)),
        ]
        setIncoming(mergedIncoming)
      } else {
        setIncoming(incomingLocal as BookingRequestWithTrip[])
      }

      const tripList = Array.isArray(allTripsRes) && allTripsRes.length > 0 ? allTripsRes : SIM_TRIPS
      setCarriers(groupCarriers(tripList))

      if (liftOffersData) setMyLiftOffers((liftOffersData.lift_requests as LiftOffer[]) ?? [])
      setMyPackages((pkgsData.data as MyPackage[]) ?? [])
      setMyBids((bidsData.data as MyBid[]) ?? [])
      setMyDriverOffers((senderMatchesPayload as { matches?: MyDriverMatch[] }).matches ?? [])
      setDriverIncoming((driverMatchesPayload as { matches?: MyDriverMatch[] }).matches ?? [])
      setPkgAssignments((pkgAssignmentsPayload as { packages?: PkgAssignment[] }).packages ?? [])
    }

    loadDashboard()

    const pollId = window.setInterval(() => {
      loadDashboard()
    }, 8000)

    const onTrips = () => {
      if (!activeUserId) return
      void loadDashboard()
    }
    const onBookings = () => loadDashboard()
    window.addEventListener('gonow_trips_updated', onTrips)
    window.addEventListener('gonow_booking_received', onBookings)
    return () => {
      window.clearInterval(pollId)
      window.removeEventListener('gonow_trips_updated', onTrips)
      window.removeEventListener('gonow_booking_received', onBookings)
    }
  }, [userId, profile, authLoading])

  const completion = useMemo(() => {
    if (!user) return 0
    return getProfileCompletion(meta, { name: user.name, phone: user.phone, email: user.email })
  }, [meta, user])

  const pendingIncoming    = incoming.filter(r => r.status === 'pending').length
  const activeCarrierTrips = myTrips.filter(t => new Date(t.departure_at).getTime() >= Date.now()).length
  const carrierOrders = useMemo(
    () => orders.filter((order) => getOrderCarrierId(order) === userId),
    [orders, userId]
  )
  const payoutByOrderId = useMemo(
    () => new Map(payouts.map((payout) => [payout.order_id, payout])),
    [payouts]
  )
  const activeAssignments = orders.filter(o =>
    getOrderCarrierId(o) === userId && (
      ['matched', 'paid', 'picked_up', 'in_transit'].includes(o.status) ||
      (o.status === 'pending' && o.confirmed_at)
    )
  )
  const completedTrips = orders.filter(o =>
    getOrderCarrierId(o) === userId && (o.status === 'delivered' || o.status === 'confirmed')
  ).length
  const gonowScoreInput = user ? {
    rating_avg:       user.rating_avg   ?? 0,
    rating_count:     user.rating_count ?? 0,
    bankid_verified:  user.bankid_verified ?? false,
    completion_rate:  completionRateFromOrders(orders, userId ?? ''),
    completed_trips:  completedTrips,
  } : null
  const gonowScore = gonowScoreInput ? calculateGonowScore(gonowScoreInput) : null
  const gonowNextReqs = gonowScore && gonowScoreInput ? getNextLevelRequirements(gonowScoreInput, gonowScore) : []
  const driverWallet = useMemo(() => {
    const sum = (items: number[]) => Math.round(items.reduce((total, value) => total + value, 0) * 100) / 100

    if (ledgerEntries.length > 0) {
      const hold = sum(
        ledgerEntries
          .filter((entry) => entry.entry_type === 'carrier_payout_reserved')
          .map((entry) => entry.amount ?? 0)
      ) - sum(
        ledgerEntries
          .filter((entry) => entry.entry_type === 'carrier_available')
          .map((entry) => entry.amount ?? 0)
      )

      const available = sum(
        ledgerEntries
          .filter((entry) => entry.entry_type === 'carrier_available')
          .map((entry) => entry.amount ?? 0)
      ) - sum(
        ledgerEntries
          .filter((entry) => entry.entry_type === 'carrier_payout_processing')
          .map((entry) => entry.amount ?? 0)
      )

      const processing = sum(
        ledgerEntries
          .filter((entry) => entry.entry_type === 'carrier_payout_processing')
          .map((entry) => entry.amount ?? 0)
      ) - sum(
        ledgerEntries
          .filter((entry) => entry.entry_type === 'carrier_payout_paid')
          .map((entry) => entry.amount ?? 0)
      )

      const paid = sum(
        ledgerEntries
          .filter((entry) => entry.entry_type === 'carrier_payout_paid')
          .map((entry) => entry.amount ?? 0)
      )

      const grossBooked = sum(
        ledgerEntries
          .filter((entry) =>
            [
              'carrier_payout_reserved',
              'carrier_available',
              'carrier_payout_processing',
              'carrier_payout_paid',
            ].includes(entry.entry_type)
          )
          .map((entry) => entry.amount ?? 0)
      )

      return {
        hold,
        available,
        processing,
        paid,
        grossBooked,
        availableOrders: new Set(
          ledgerEntries.filter((entry) => entry.entry_type === 'carrier_available').map((entry) => entry.order_id)
        ).size,
        processingOrders: new Set(
          ledgerEntries.filter((entry) => entry.entry_type === 'carrier_payout_processing').map((entry) => entry.order_id)
        ).size,
        paidOrders: new Set(
          ledgerEntries.filter((entry) => entry.entry_type === 'carrier_payout_paid').map((entry) => entry.order_id)
        ).size,
      }
    }

    const hold = sum(
      carrierOrders
        .filter((order) => ['paid', 'picked_up', 'in_transit'].includes(order.status))
        .map((order) => order.carrier_payout ?? 0)
    )

    const available = sum(
      carrierOrders
        .filter((order) => ['delivered', 'confirmed'].includes(order.status))
        .filter((order) => {
          const payout = payoutByOrderId.get(order.id)
          return !payout || payout.status === 'failed'
        })
        .map((order) => order.carrier_payout ?? 0)
    )

    const processing = sum(
      payouts
        .filter((payout) => payout.status === 'pending' || payout.status === 'processing')
        .map((payout) => payout.amount ?? 0)
    )

    const paid = sum(
      payouts
        .filter((payout) => payout.status === 'paid')
        .map((payout) => payout.amount ?? 0)
    )

    const grossBooked = sum(
      carrierOrders
        .filter((order) => order.status !== 'cancelled')
        .map((order) => order.carrier_payout ?? 0)
    )

    return {
      hold,
      available,
      processing,
      paid,
      grossBooked,
      availableOrders: carrierOrders.filter((order) => ['delivered', 'confirmed'].includes(order.status)).length,
      processingOrders: payouts.filter((payout) => payout.status === 'pending' || payout.status === 'processing').length,
      paidOrders: payouts.filter((payout) => payout.status === 'paid').length,
    }
  }, [carrierOrders, ledgerEntries, payoutByOrderId, payouts])
  const recentLedgerEntries = useMemo(() => ledgerEntries.slice(0, 5), [ledgerEntries])
  const payoutReadyOrders = useMemo(
    () =>
      carrierOrders.filter((order) => {
        if (order.status !== 'confirmed') return false
        const payout = payoutByOrderId.get(order.id)
        return !payout || payout.status === 'failed'
      }),
    [carrierOrders, payoutByOrderId]
  )
  // Enrich assignments with sender contact from booking_requests
  const bookingById = useMemo(
    () => new Map([...myRequests, ...incoming].map(b => [b.id, b])),
    [myRequests, incoming]
  )
  const orderById = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders]
  )
  const orderByPackageId = useMemo(
    () =>
      new Map(
        orders
          .map((order) => {
            const packageId = getOrderPackageId(order)
            return packageId ? [packageId, order] as const : null
          })
          .filter(Boolean) as readonly (readonly [string, Order])[]
      ),
    [orders]
  )
  const senderMatchByPackageId = useMemo(
    () =>
      new Map(
        myDriverOffers
          .filter((match) => match.packages?.id)
          .map((match) => [match.packages!.id, match] as const)
      ),
    [myDriverOffers]
  )
  const activePackageJourney = useMemo(() => {
    const priority = ['matched', 'paid', 'picked_up', 'in_transit', 'delivered', 'confirmed']
    for (const status of priority) {
      const found = myPackages.find((pkg) => pkg.status === status)
      if (found) return found
    }
    return null
  }, [myPackages])
  const activePackageJourneyOrder = useMemo(
    () => (activePackageJourney ? orderByPackageId.get(activePackageJourney.id) ?? null : null),
    [activePackageJourney, orderByPackageId]
  )
  const packageDeliveries = useMemo(
    () => myPackages.filter((pkg) => ['matched', 'paid', 'picked_up', 'in_transit', 'delivered'].includes(pkg.status)),
    [myPackages]
  )
  const customerJourneyPackages = useMemo(
    () =>
      myPackages.filter((pkg) => {
        if (['cancelled', 'expired', 'open'].includes(pkg.status)) return false
        if (pkg.status === 'matched') {
          const linkedOrder = orderByPackageId.get(pkg.id)
          return !!linkedOrder && !isAwaitingPayment(linkedOrder)
        }
        return true
      }),
    [myPackages, orderByPackageId]
  )
  const customerRequestPackages = useMemo(
    () =>
      myPackages.filter((pkg) => {
        if (['cancelled', 'expired', 'confirmed'].includes(pkg.status)) return false
        if (pkg.status === 'open') return true
        if (pkg.status === 'matched') {
          const linkedOrder = orderByPackageId.get(pkg.id)
          return !linkedOrder || isAwaitingPayment(linkedOrder)
        }
        return false
      }),
    [myPackages, orderByPackageId]
  )
  const customerPendingCount = customerRequestPackages.length
  const customerWaitingMatchCount = customerRequestPackages.filter((pkg) => pkg.status === 'open').length
  const customerWaitingEscrowCount = customerRequestPackages.filter((pkg) => pkg.status === 'matched' && isAwaitingPayment(orderByPackageId.get(pkg.id) ?? null)).length
  const activePackageAssignments = useMemo(
    () => pkgAssignments.filter((pkg) => ['matched', 'paid', 'picked_up', 'in_transit', 'delivered'].includes(pkg.status)),
    [pkgAssignments]
  )
  const legacyActiveAssignments = useMemo(
    () =>
      activeAssignments.filter((order) => {
        const packageId = getOrderPackageId(order)
        return !packageId || !activePackageAssignments.some((pkg) => pkg.id === packageId)
      }),
    [activeAssignments, activePackageAssignments]
  )
  const activeDriverWorkCount = activePackageAssignments.length + legacyActiveAssignments.length

  async function handleSaveProfile() {
    if (!userId || !user) return
    setSaving(true)
    setSaveMessage(null)

    try {
      saveUserProfileMeta(userId, meta)

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          name: user.name,
          phone: user.phone || null,
          role: meta.role_intent === 'both' ? 'carrier' : meta.role_intent === 'carrier' ? 'carrier' : user.role,
          city: user.city || null,
          age: user.age || null,
          gender: (user as any).gender || null,
          bio: meta.bio || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      setSaveMessage('Profil sparad.')
    } catch {
      setSaveMessage('Profil sparad lokalt. Databasen kunde inte uppdateras just nu.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    await createClient().auth.signOut()
    window.location.href = '/'
  }

  async function handlePay(orderId: string) {
    setPayingId(orderId)
    setPaymentError(null)
    try {
      const res = await authedFetch(`/api/orders/${orderId}/checkout`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Kunde inte starta betalning.')

      if (data.mock) {
        // Demo mode: update localStorage order to paid, then refresh
        const stored = JSON.parse(localStorage.getItem('gonow_bookings') || '[]')
        const updated = stored.map((o: { id: string; status: string }) =>
          o.id === orderId ? { ...o, status: 'paid' } : o
        )
        localStorage.setItem('gonow_bookings', JSON.stringify(updated))
        await new Promise(r => setTimeout(r, 600))
        window.location.href = `/spara/${orderId}?payment=success`
        return
      }

      if (data.url) {
        window.location.href = data.url
        return
      }
      throw new Error('Ingen checkout-länk kunde skapas.')
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Betalning kunde inte startas.')
      setPayingId(null)
    }
  }

  async function handleCancel(bookingId: string) {
    if (!confirm('Är du säker på att du vill avbryta denna förfrågan?')) return
    setCancellingId(bookingId)
    try {
      await cancelBooking(bookingId)
      setMyRequests((prev) => prev.map((r) => r.id === bookingId ? { ...r, status: 'cancelled' } : r))
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Kunde inte avbryta förfrågan.')
    } finally {
      setCancellingId(null)
    }
  }

  async function handleRespond(id: string, status: 'accepted' | 'declined') {
    setRespondingId(id)
    setRespondError(null)
    try {
      await updateBookingStatus(id, status)
      const nextBookings = await loadAllBookings().catch(() => [])
      const liftBookings = nextBookings.filter(isLegacyLiftBooking)
      setIncoming(liftBookings.filter((booking) => myTrips.some((trip) => trip.id === booking.trip_id)) as BookingRequestWithTrip[])
      setMyRequests(liftBookings.filter((booking) => booking.sender_id === userId) as BookingRequestWithTrip[])
    } catch (error) {
      setRespondError(error instanceof Error ? error.message : 'Kunde inte uppdatera bokningen.')
    } finally {
      setRespondingId(null)
    }
  }

  async function handleCancelOrder(orderId: string) {
    if (!confirm('Är du säker på att du vill avboka detta uppdrag?')) return
    setCancellingOrderId(orderId)
    try {
      const res = await authedFetch(`/api/orders/${orderId}/cancel`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Kunde inte avboka uppdraget.')
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: 'cancelled' as OrderStatus } : o))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Kunde inte avboka uppdraget.')
    } finally {
      setCancellingOrderId(null)
    }
  }

  async function handleOrderStatusUpdate(orderId: string, status: OrderStatus) {
    setUpdatingOrderId(orderId)
    setStatusError(null)
    try {
      const res = await authedFetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Kunde inte uppdatera orderstatus.')
      }
      setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, ...data.order } : order)))

      // Trigger rating modal after sender confirms delivery
      if (status === 'confirmed') {
        const order = orders.find((o) => o.id === orderId)
        if (order && order.sender_id === userId) {
          const carrierId = getOrderCarrierId(order)
          const carrierObj = (order as unknown as Record<string, unknown>)._carrier as { name?: string } | null
          const carrierName = carrierObj?.name ?? 'Din transportkontakt'
          if (carrierId) {
            setPendingRating({ orderId, toUserId: carrierId, toName: carrierName, role: 'sender' })
          }
        }
      }
    } catch (error) {
      setStatusError({ id: orderId, msg: error instanceof Error ? error.message : 'Kunde inte uppdatera orderstatus.' })
    } finally {
      setUpdatingOrderId(null)
    }
  }

  async function handleWithdrawOffer(liftId: string) {
    if (!confirm('Dra tillbaka ditt erbjudande?')) return
    setWithdrawingLiftId(liftId)
    try {
      const res = await fetch(`/api/lift/${liftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'open', carrier_id: null }),
      })
      if (res.ok) {
        setMyLiftOffers(prev => prev.filter(l => l.id !== liftId))
      }
    } catch {
      // noop
    } finally {
      setWithdrawingLiftId(null)
    }
  }

  async function reloadLedger() {
    if (!userId) return
    const res = await authedFetch('/api/ledger').catch(() => null)
    if (res?.ok) {
      const data = await res.json()
      setLedgerEntries(data.entries || [])
    }
  }

  async function handlePkgDeliveryAction(pkgId: string, action: 'pickup' | 'start_transit' | 'deliver') {
    const res = await authedFetch(`/api/packages/${pkgId}/driver-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (!res.ok) return
    const data = await res.json()
    if (data.package) {
      setPkgAssignments(prev => prev.map(p => p.id === pkgId ? { ...p, ...data.package } : p))
    }
  }

  async function handleDriverMatchAction(matchId: string, action: 'driver_confirm' | 'driver_decline') {
    setActionMatchId(matchId)
    try {
      const res = await authedFetch(`/api/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) return
      const nextStatus = action === 'driver_confirm' ? 'matched' : 'cancelled'
      setDriverIncoming(prev => prev.map(m => m.id === matchId ? { ...m, status: nextStatus } : m))
    } finally {
      setActionMatchId(null)
    }
  }

  async function handleMatchAction(matchId: string, action: 'customer_accept' | 'customer_decline') {
    setActionMatchId(matchId)
    try {
      const res = await authedFetch(`/api/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) return
      const nextStatus = action === 'customer_accept' ? 'customer_accepted' : 'cancelled'
      setMyDriverOffers(prev => prev.map(m => m.id === matchId ? { ...m, status: nextStatus } : m))
    } finally {
      setActionMatchId(null)
    }
  }

  async function handleCancelPackage(packageId: string) {
    if (!confirm('Avboka paketet?')) return
    setCancellingPkgId(packageId)
    try {
      const res = await authedFetch(`/api/packages/${packageId}/cancel`, { method: 'POST' })
      if (res.ok) {
        setMyPackages(prev => prev.map(p => p.id === packageId ? { ...p, status: 'cancelled' } : p))
      }
    } finally {
      setCancellingPkgId(null)
    }
  }


  async function handleStartPayout(orderId: string) {
    setPayoutingId(orderId)
    setSaveMessage(null)
    try {
      const res = await authedFetch('/api/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Kunde inte starta payout.')

      if (data.payout) {
        setPayouts((current) => {
          const filtered = current.filter((item) => item.id !== data.payout.id)
          return [data.payout, ...filtered]
        })
      }

      await reloadLedger()
      setSaveMessage('Payout startad. Beloppet har flyttats från Tillgängligt till Pågående payout.')
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Kunde inte starta payout.')
    } finally {
      setPayoutingId(null)
    }
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) {
    return (
      <>
        {showAuth && (
          <AuthModal
            onClose={() => setShowAuth(false)}
            onSuccess={() => setShowAuth(false)}
            defaultTab="login"
            initialEmail={pendingEmail}
            reason="Din e-post är bekräftad. Logga in för att fortsätta till Mina sidor."
          />
        )}
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px 24px' }}>
          <div style={{ ...panelStyle(false, isDark, isMobile), maxWidth: 460, width: '100%', padding: 36, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', color: 'var(--accent)' }}>
              <Shield size={24} />
            </div>
            <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.04em', marginBottom: 10 }}>Logga in för Mina sidor</h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.7, marginBottom: 18 }}>
              {pendingEmail
                ? 'Din e-post verkar vara bekräftad. Logga in med samma adress för att fortsätta till din profil och dina bokningar.'
                : 'Här kommer du se dina bokningar, dina resor, din profil och alla förare du kan utforska.'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {pendingEmail && (
                <button
                  onClick={() => setShowAuth(true)}
                  className="btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Logga in nu <ArrowRight size={14} />
                </button>
              )}
              <Link href="/" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px' }}>
                Till startsidan <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </>
    )
  }

  const initials = user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{
      minHeight: '100vh',
      paddingTop: isMobile ? 56 : 88,
      paddingBottom: isMobile ? 40 : 96,
      background: isMobile
        ? (isDark
          ? 'linear-gradient(180deg,#0a0a0a 0%,#111111 100%)'
          : 'linear-gradient(180deg,#f8fafc 0%,#eefbf1 100%)')
        : (isDark
          ? 'linear-gradient(180deg, var(--gn-002) 0%, var(--gn-006) 100%)'
          : 'linear-gradient(180deg,#fcfdfc 0%,#f1faef 100%)'),
      overflowX: 'clip',
    }}>
      {/* Ã¢â€â‚¬Ã¢â€â‚¬ MOBILE: compact app header Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {isMobile && (
        <div style={{
          background: isDark ? 'rgba(17,17,17,0.92)' : 'rgba(255,255,255,0.92)',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          position: 'sticky',
          top: 0,
          zIndex: 21,
        }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: '#0a0a0a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0, letterSpacing: '-0.02em' }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: 3, letterSpacing: '-0.02em' }}>{user.name}</p>
            {gonowScore && <GonowScoreBadgeCompact result={gonowScore} />}
          </div>
          <button onClick={handleSignOut} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', cursor: 'pointer', flexShrink: 0 }}>
            <LogOut size={16} />
          </button>
        </div>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ MOBILE: 2-level nav (group bar + sub-tab bar) Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {isMobile && (() => {
        const badgeCounts = {
          activeAssignments: activeDriverWorkCount,
          pendingIncoming,
          driverPendingNew: driverIncoming.filter(m => m.status === 'driver_pending_confirmation').length,
          liftOffersCount: myLiftOffers.filter(l => l.status === 'offered').length,
          packagesWithBids: myDriverOffers.filter((match) => match.status === 'suggested').length,
          pendingBids: myPackages.filter(p => ['matched', 'paid', 'picked_up', 'in_transit', 'delivered'].includes(p.status)).length,
        }
        const activeGroup = NAV_GROUPS.find(g => getGroupId(activeTab) === g.id)
        return (
          <>
            <div style={{ position: 'sticky', top: 66, zIndex: 20, background: isDark ? 'rgba(17,17,17,0.94)' : 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`, boxShadow: isDark ? '0 8px 22px rgba(0,0,0,0.22)' : '0 10px 28px rgba(15,23,42,0.05)', display: 'flex', justifyContent: 'space-around' }}>
              {NAV_GROUPS.map((group) => {
                const isGroupActive = getGroupId(activeTab) === group.id
                const groupBadge = group.items?.reduce((sum, item) => sum + getNavBadge(item.key, badgeCounts), 0) ?? 0
                return (
                  <button
                    key={group.id}
                    onClick={() => {
                      if (group.key) handleTabChange(group.key)
                      else if (group.items?.[0]) handleTabChange(group.items[0].key)
                    }}
                    style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '11px 4px 8px', border: 'none', borderBottom: `2.5px solid ${isGroupActive ? 'var(--gn)' : 'transparent'}`, background: isGroupActive ? (isDark ? 'rgba(146,255,99,0.05)' : 'rgba(146,255,99,0.06)') : 'none', cursor: 'pointer', color: isGroupActive ? 'var(--text)' : 'var(--muted)', marginBottom: -1 }}
                  >
                    <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>{group.icon}</span>
                    <span style={{ fontSize: '0.6rem', fontWeight: isGroupActive ? 800 : 650, whiteSpace: 'nowrap', letterSpacing: '0.01em' }}>{group.label}</span>
                    {groupBadge > 0 && <span style={{ position: 'absolute', top: 6, right: '18%', fontSize: '0.5rem', fontWeight: 800, minWidth: 13, height: 13, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px', background: 'var(--gn)', color: '#0a0a0a' }}>{groupBadge}</span>}
                  </button>
                )
              })}
            </div>
            {activeGroup?.items && (
              <div className="mobile-app-tabs" style={{ position: 'sticky', top: 114, zIndex: 19, background: isDark ? 'rgba(14,14,14,0.92)' : 'rgba(248,250,252,0.92)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)'}`, display: 'flex', overflowX: 'auto', scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'], scrollSnapType: 'x proximity', padding: '4px 8px 6px', gap: 6 }}>
                {activeGroup.items.map((item) => {
                  const badge = getNavBadge(item.key, badgeCounts)
                  const isActive = activeTab === item.key
                  return (
                    <button key={item.key} onClick={() => handleTabChange(item.key)} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '10px 13px', border: `1px solid ${isActive ? 'var(--gn-030)' : 'transparent'}`, borderRadius: 999, background: isActive ? 'var(--gn-008)' : 'none', color: isActive ? 'var(--text)' : 'var(--muted)', fontWeight: isActive ? 700 : 500, fontSize: '0.79rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'color 0.15s, background 0.15s, border-color 0.15s' }}>
                      {item.label}
                      {item.isNew && <span style={{ fontSize: '0.5rem', fontWeight: 800, color: 'var(--gn)', background: 'var(--gn-012)', padding: '1px 4px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ny</span>}
                      {badge > 0 && <span style={{ fontSize: '0.58rem', fontWeight: 800, minWidth: 15, height: 15, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', background: 'var(--gn)', color: '#0a0a0a' }}>{badge}</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )
      })()}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ DESKTOP: maxWidth wrapper Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div style={isMobile ? undefined : { maxWidth: 1260, margin: '0 auto', padding: '0 24px' }}>

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ DESKTOP ONLY: stepper header Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px', marginBottom: 24, border: `1px solid ${isDark ? 'var(--gn-014)' : 'var(--gn-012)'}`, borderRadius: 24, background: isDark ? 'linear-gradient(135deg,rgba(18,22,29,0.95) 0%,rgba(23,28,35,0.98) 100%)' : 'linear-gradient(180deg,#ffffff 0%,#fbfdf9 100%)', boxShadow: isDark ? '0 16px 38px rgba(0,0,0,0.22)' : '0 18px 40px rgba(15,23,42,0.06)', gap: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginRight: 'auto' }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 700, background: '#0a0a0a', color: '#ffffff', border: '1px solid rgba(0,0,0,0.2)' }}>{initials}</div>
              <div>
                <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{user.name}</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Mina sidor</p>
              </div>
            </div>
            <div style={{ width: 1, height: 32, background: 'var(--border)', margin: '0 16px', flexShrink: 0 }} />
            {[{ num: '01', label: 'Ditt konto.', desc: 'Profil & uppgifter' }, { num: '02', label: 'Ditt nätverk.', desc: 'Resor & förare' }, { num: '03', label: 'Din kontroll.', desc: 'Bokningar & uppdrag' }].map((step, i, arr) => (
              <div key={step.num} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700, border: '1px solid rgba(0,0,0,0.15)', background: '#0a0a0a', color: '#ffffff' }}>{step.num}</div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{step.label}</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{step.desc}</p>
                  </div>
                </div>
                {i < arr.length - 1 && <div style={{ width: 28, height: 2, background: 'var(--border)', flexShrink: 0, margin: '0 6px', borderRadius: 2 }} />}
              </div>
            ))}
            <div style={{ width: 1, height: 32, background: 'var(--border)', margin: '0 16px', flexShrink: 0 }} />
            <button onClick={handleSignOut} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600, flexShrink: 0 }}>
              <LogOut size={13} /> Logga ut
            </button>
          </div>
        )}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Layout: sidebar (desktop) + content Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

          {/* Desktop sidebar only */}
          {!isMobile && (
            <aside style={{ ...panelStyle(false, isDark, isMobile), padding: 12, position: 'sticky', top: 96, borderRadius: 24, boxShadow: isDark ? '0 16px 40px rgba(0,0,0,0.22)' : '0 18px 36px rgba(15,23,42,0.05)', maxHeight: 'calc(100vh - 112px)', overflowY: 'auto', width: 248, flexShrink: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {NAV_GROUPS.map((group) => {
                  const badgeCounts = {
                    activeAssignments: activeDriverWorkCount,
                    pendingIncoming,
                    driverPendingNew: driverIncoming.filter(m => m.status === 'driver_pending_confirmation').length,
                    liftOffersCount: myLiftOffers.filter(l => l.status === 'offered').length,
                    packagesWithBids: myDriverOffers.filter((match) => match.status === 'suggested').length,
                    pendingBids: myPackages.filter((pkg) => ['matched', 'paid', 'picked_up', 'in_transit', 'delivered'].includes(pkg.status)).length,
                  }
                  if (group.key) {
                    return (
                      <button key={group.id} onClick={() => handleTabChange(group.key!)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 12, border: '1px solid transparent', background: activeTab === group.key ? 'var(--accent-soft)' : 'transparent', color: activeTab === group.key ? 'var(--text)' : 'var(--muted)', fontWeight: activeTab === group.key ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                        <span>{group.icon}</span> {group.label}
                      </button>
                    )
                  }
                  const isGroupActive = getGroupId(activeTab) === group.id
                  const isCollapsed   = collapsedGroups.has(group.id)
                  function toggleGroup() {
                    setCollapsedGroups(prev => {
                      const next = new Set(prev)
                      next.has(group.id) ? next.delete(group.id) : next.add(group.id)
                      return next
                    })
                  }
                  return (
                    <div key={group.id} style={{ marginTop: 4 }}>
                      <button
                        onClick={toggleGroup}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                          padding: '8px 10px 6px 12px',
                          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                          borderRadius: 10,
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                      >
                        <span style={{ fontSize: '0.82rem' }}>{group.icon}</span>
                        <p style={{ flex: 1, textAlign: 'left', fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: isGroupActive ? 'var(--text)' : 'var(--muted)', margin: 0 }}>{group.label}</p>
                        <ChevronDown
                          size={13}
                          style={{
                            color: 'var(--muted)',
                            flexShrink: 0,
                            transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.18s',
                          }}
                        />
                      </button>
                      {!isCollapsed && group.items?.map((item) => {
                        const badge = getNavBadge(item.key, badgeCounts)
                        const isActive = activeTab === item.key
                        return (
                          <button key={item.key} onClick={() => handleTabChange(item.key)} style={{ width: '100%', textAlign: 'left', padding: '8px 10px 8px 28px', borderRadius: 11, border: '1px solid transparent', background: isActive ? 'var(--accent-soft)' : 'transparent', color: isActive ? 'var(--text)' : 'var(--muted)', fontWeight: isActive ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: '0.82rem' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              {item.label}
                              {item.isNew && <span style={{ fontSize: '0.52rem', fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '1px 4px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ny</span>}
                            </span>
                            {badge > 0 && <span style={{ fontSize: '0.6rem', fontWeight: 800, minWidth: 17, height: 17, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', background: 'var(--accent)', color: '#0a0a0a' }}>{badge}</span>}
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </aside>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 24, minWidth: 0, flex: 1, padding: isMobile ? '18px 14px 32px' : 0 }}>
            {isMobile && (
              <div style={{ ...panelStyle(true, isDark, isMobile), padding: '20px 18px', position: 'relative', overflow: 'hidden', borderRadius: 22, boxShadow: isDark ? '0 18px 44px rgba(0,0,0,0.28)' : '0 20px 46px var(--gn-010)' }}>
                <div style={{ position: 'absolute', right: -48, top: -48, width: 140, height: 140, borderRadius: '50%', background: 'var(--enterprise-panel-glow)', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                  <div>
                    <p style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Min panel</p>
                    <p style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>{user.name}</p>
                    <p style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: 6 }}>Allt viktigt samlat på ett ställe: bokningar, uppdrag, saldo och förare.</p>
                  </div>
                  <div style={{ minWidth: 52, height: 52, padding: '0 12px', borderRadius: 16, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: '0.95rem', fontWeight: 800 }}>
                    {completion}%
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
                  {[
                    { label: 'Förfrågningar', value: customerPendingCount },
                    { label: 'Resor', value: activeCarrierTrips },
                    { label: 'Saldo', value: `${driverWallet.available} kr` },
                  ].map((item) => (
                    <div key={item.label} style={{ padding: '12px 10px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--enterprise-panel-border)' }}>
                      <p style={{ fontSize: '0.68rem', color: 'var(--muted)', marginBottom: 4, lineHeight: 1.2 }}>{item.label}</p>
                      <p style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {paymentError && (
              <div style={{ ...panelStyle(false, isDark, isMobile), padding: '14px 16px', borderColor: 'rgba(239,68,68,0.22)', color: '#dc2626', background: 'rgba(239,68,68,0.05)' }}>
                {paymentError}
              </div>
            )}

            {activeTab === 'overview' && (
              <>
                {isMobile && (
                  <MobileSectionIntro
                    eyebrow="Översikt"
                    title="Din panel, lugn och tydlig."
                    subtitle="Här får du direkt koll på konto, bokningar, resor och nästa steg utan att behöva hoppa mellan vyer."
                    meta={`${customerPendingCount} väntar`}
                  />
                )}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0,1fr))' : 'repeat(3, minmax(0,1fr))', gap: 14 }}>
                  {statCard('Aktiva paket', `${myPackages.filter(p => ['open', 'matched'].includes(p.status)).length}`, 'Publicerade och matchade', <Package size={18} />, isDark, isMobile)}
                  {statCard('Liftresor', `${myLiftOffers.filter(l => ['offered', 'matched'].includes(l.status)).length}`, 'Erbjudanden och matchningar', <Users size={18} />, isDark, isMobile)}
                  {statCard('Leveranser', `${activeDriverWorkCount}`, 'Pågående som förare', <Car size={18} />, isDark, isMobile)}
                  {statCard('Saldo', `${driverWallet.available} kr`, 'Tillgängligt för utbetalning', <Wallet size={18} />, isDark, isMobile)}
                  {statCard('Gonow Score', `${gonowScore?.score ?? 0}`, gonowScore?.tier.label ?? 'Ny förare', <Star size={18} />, isDark, isMobile)}
                  {statCard('Mina resor', `${activeCarrierTrips}`, 'Registrerade rutter', <MapPin size={18} />, isDark, isMobile)}
                </div>

                {gonowScore && user && (
                  <GonowScoreCard
                    result={gonowScore}
                    ratingAvg={user.rating_avg ?? 0}
                    ratingCount={user.rating_count ?? 0}
                    bankidVerified={user.bankid_verified ?? false}
                    completedTrips={completedTrips}
                    nextRequirements={gonowNextReqs}
                    isDark={isDark}
                    mobile={isMobile}
                  />
                )}

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.15fr 0.85fr', gap: 20 }}>
                  <div style={{ ...panelStyle(true, isDark, isMobile), padding: 24, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', right: -70, top: -70, width: 220, height: 220, borderRadius: '50%', background: 'var(--enterprise-panel-glow)', pointerEvents: 'none' }} />
                    <SectionTitle
                      title="Din ekonomi i Gonow" subtitle="Se vad som är låst i transporten, vad som är redo för utbetalning och vad som redan har betalats ut."
                    />
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
                      <div>
                        <p style={{ fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Redo för utbetalning</p>
                        <p style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.06em', color: 'var(--text)', lineHeight: 1 }}>{driverWallet.available} kr</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 10 }}>
                          {driverWallet.availableOrders} leveranser är klara att betalas ut
                        </p>
                      </div>
                      <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                        <Wallet size={22} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
                      <div style={{ padding: 16, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--enterprise-panel-border)' }}>
                        <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6 }}>Låst i transport</p>
                        <p style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{driverWallet.hold} kr</p>
                        <p style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Kunden har betalat men leveransen är inte slutbekräftad.</p>
                      </div>
                      <div style={{ padding: 16, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--enterprise-panel-border)' }}>
                        <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6 }}>Utbetalning påbörjad</p>
                        <p style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{driverWallet.processing} kr</p>
                        <p style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{driverWallet.processingOrders} poster är på väg ut till ditt konto.</p>
                      </div>
                      <div style={{ padding: 16, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--enterprise-panel-border)' }}>
                        <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6 }}>Utbetalt totalt</p>
                        <p style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{driverWallet.paid} kr</p>
                        <p style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{driverWallet.paidOrders} utbetalningar är redan avslutade.</p>
                      </div>
                      <div style={{ padding: 16, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--enterprise-panel-border)' }}>
                        <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6 }}>Totalt intjänat</p>
                        <p style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{driverWallet.grossBooked} kr</p>
                        <p style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Summerat över dina aktiva och avslutade uppdrag.</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: 12, paddingTop: 4 }}>
                      <p style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                        Du ska alltid kunna skilja på pengar som är låsta i transporten, redo för utbetalning och redan utbetalade.
                      </p>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: isMobile ? 'stretch' : 'flex-end' }}>
                        {payoutReadyOrders[0] && (
                          <button onClick={() => handleStartPayout(payoutReadyOrders[0].id)} className="btn-primary" style={{ padding: '11px 16px', whiteSpace: 'nowrap', width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}>
                            {payoutingId === payoutReadyOrders[0].id ? 'Startar payout...' : 'Skicka payout'}
                          </button>
                        )}
                        <button onClick={() => handleTabChange('assignments')} className="btn-primary" style={{ padding: '11px 16px', whiteSpace: 'nowrap', width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}>
                          Se aktiva uppdrag
                        </button>
                      </div>
                    </div>

                    {recentLedgerEntries.length > 0 && (
                      <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--enterprise-panel-border)' }}>
                        <p style={{ fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 10 }}>
                          Senaste saldohändelser
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {recentLedgerEntries.map((entry) => (
                            <div
                              key={entry.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                                padding: '11px 12px',
                                borderRadius: 14,
                                background: 'var(--surface)',
                                border: '1px solid var(--enterprise-panel-border)',
                              }}
                            >
                              <div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text)', fontWeight: 700, marginBottom: 3 }}>
                                  {ledgerEntryLabel(entry)}
                                </p>
                                <p style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                                  Order {entry.order_id.slice(0, 8)} · {new Date(entry.created_at).toLocaleDateString('sv-SE')}
                                </p>
                              </div>
                              <strong style={{ color: 'var(--text)', fontSize: '0.82rem' }}>
                                {entry.amount} kr
                              </strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                    <SectionTitle title="Det här kräver din uppmärksamhet" subtitle="Det viktigaste att följa upp just nu för att hålla Gonow-resan snabb och tydlig." />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ padding: 16, borderRadius: 18, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: 4 }}>Nya förfrågningar</p>
                        <p style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)' }}>{pendingIncoming}</p>
                      </div>
                      <div style={{ padding: 16, borderRadius: 18, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: 4 }}>Aktiva leveranser</p>
                        <p style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)' }}>{activeDriverWorkCount}</p>
                      </div>
                      <div style={{ padding: 16, borderRadius: 18, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: 4 }}>Resor live</p>
                        <p style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)' }}>{activeCarrierTrips}</p>
                      </div>
                    </div>
                    <div style={{ marginTop: 16, padding: 16, borderRadius: 18, background: 'var(--accent-soft)', border: '1px solid var(--gn-020)' }}>
                      <p style={{ fontSize: '0.76rem', color: 'var(--muted)', marginBottom: 8 }}>Nästa steg</p>
                      <p style={{ fontSize: '0.84rem', color: 'var(--text)', lineHeight: 1.7 }}>
                        När utbetalningar är helt inkopplade blir den här ytan ditt fasta ställe för saldo, utbetalning och historik.
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
                  <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                    <SectionTitle title="Aktiv leverans" subtitle="Din pågående kundresa - status och nästa åtgärd." />
                    {activePackageJourney ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ padding: 16, borderRadius: 18, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                          <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>Gonow ansvarar nu</p>
                          <p style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                            {activePackageJourney.description || 'Bokning pågår'}
                          </p>
                          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: 12 }}>
                            {`${activePackageJourney.from_city || 'Upphämtning'} → ${activePackageJourney.to_city || 'Avlämning'}`}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--gn-dk)', background: 'var(--gn-010)', padding: '4px 9px', borderRadius: 999 }}>
                              {getPackageStatusMeta(activePackageJourney.status).label}
                            </span>
                            {getOrderPaymentSummary(activePackageJourneyOrder) ? (
                              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{getOrderPaymentSummary(activePackageJourneyOrder)}</span>
                            ) : null}
                            {senderMatchByPackageId.get(activePackageJourney.id)?.drivers?.name ? (
                              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Transport via {senderMatchByPackageId.get(activePackageJourney.id)?.drivers?.name}</span>
                            ) : null}
                          </div>
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {activePackageJourney.status === 'matched' && activePackageJourneyOrder && isAwaitingPayment(activePackageJourneyOrder) && (
                              <button onClick={() => handlePay(activePackageJourneyOrder.id)} className="btn-primary" style={{ padding: '11px 16px' }}>
                                {payingId === activePackageJourneyOrder.id ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Startar...</> : <><CreditCard size={13} /> Betala och lås transport</>}
                              </button>
                            )}
                            {!(activePackageJourney.status === 'matched' && isAwaitingPayment(activePackageJourneyOrder)) && (
                              <Link href={`/paket/${activePackageJourney.id}`} className="btn-primary" style={{ padding: '11px 16px', display: 'inline-flex', gap: 8 }}>
                                Följ paket <ArrowRight size={14} />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: 28, borderRadius: 18, background: 'var(--surface-2)', border: '1px dashed var(--border)', textAlign: 'center' }}>
                        <Package size={24} style={{ color: 'var(--muted)', marginBottom: 10 }} />
                        <p style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.7 }}>Ingen aktiv leverans just nu.</p>
                        <button onClick={() => handleTabChange('my_packages')} className="btn-primary" style={{ marginTop: 14, padding: '10px 16px', display: 'inline-flex', gap: 8 }}>
                          Skicka paket <ArrowRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                    <SectionTitle title="Snabbåtkomst" subtitle="Vanligaste åtgärderna — max ett klick bort." />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { icon: '📦', label: 'Skicka paket', sub: `${myPackages.filter(p => p.status === 'open').length} Öppna`, tab: 'my_packages' as TabKey },
                        { icon: '🚗', label: 'Aktiva leveranser', sub: `${activeDriverWorkCount} pågående`, tab: 'assignments' as TabKey },
                        { icon: '🗺️', label: 'Mina resor', sub: `${activeCarrierTrips} registrerade`, tab: 'my_trips' as TabKey },
                        { icon: '👤', label: 'Lift-erbjudanden', sub: `${myLiftOffers.filter(l => l.status === 'offered').length} Öppna`, tab: 'lift_offers' as TabKey },
                        { icon: '💰', label: 'Intäkter', sub: `${driverWallet.available} kr tillgängligt`, tab: 'earnings' as TabKey },
                      ].map((item) => (
                        <button
                          key={item.tab}
                          onClick={() => handleTabChange(item.tab)}
                          style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.15s' }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--surface)')}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'var(--surface-2)')}
                        >
                          <span style={{ fontSize: '1rem', flexShrink: 0 }}>{item.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{item.label}</p>
                            <p style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{item.sub}</p>
                          </div>
                          <ArrowRight size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'assignments' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {isMobile && (
                  <MobileSectionIntro
                    eyebrow="Kör & tjäna"
                    title="Aktiva leveranser."
                    subtitle="Följ dina pågående uppdrag från accepterad bokning till leverans."
                    meta={`${activeDriverWorkCount} aktiva`}
                  />
                )}

                {/* Inkommande paketförfrågningar via trip-selected flow */}
                {(() => {
                  const pending = driverIncoming.filter(m => m.status === 'driver_pending_confirmation')
                  if (pending.length === 0) return null
                  return (
                    <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                      <div style={{ marginBottom: 16 }}>
                        <p style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>Nya förfrågningar</p>
                        <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0 }}>Kunder vill skicka paket med din resa. Svara inom 30 minuter.</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {pending.map(match => {
                          const pkg = match.packages
                          const expiresIn = match.expires_at
                            ? Math.max(0, Math.round((new Date(match.expires_at).getTime() - Date.now()) / 60000))
                            : null
                          return (
                            <div key={match.id} style={{ borderRadius: 14, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.04)', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                                  {pkg?.from_city ?? '?'} {'\u2192'} {pkg?.to_city ?? '?'}
                                </p>
                                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '3px 0 0' }}>
                                  {pkg?.description ?? 'Paket'}{pkg?.weight_kg ? ` · ${pkg.weight_kg} kg` : ''}
                                </p>
                                {match.proposed_price != null && (
                                  <p style={{ fontSize: '0.78rem', color: 'var(--text)', fontWeight: 600, margin: '3px 0 0' }}>
                                    Upp till {match.proposed_price} kr
                                  </p>
                                )}
                                {expiresIn !== null && (
                                  <p style={{ fontSize: '0.7rem', color: '#b45309', margin: '4px 0 0' }}>
                                    Svarar senast om {expiresIn} min
                                  </p>
                                )}
                                {match.ai_message_driver && (
                                  <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: '4px 0 0', fontStyle: 'italic' }}>&ldquo;{match.ai_message_driver}&rdquo;</p>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                <button
                                  onClick={() => handleDriverMatchAction(match.id, 'driver_decline')}
                                  disabled={actionMatchId === match.id}
                                  style={{ padding: '7px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontWeight: 600, cursor: actionMatchId === match.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', opacity: actionMatchId === match.id ? 0.6 : 1 }}
                                >
                                  Neka
                                </button>
                                <button
                                  onClick={() => handleDriverMatchAction(match.id, 'driver_confirm')}
                                  disabled={actionMatchId === match.id}
                                  style={{ padding: '7px 14px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#0a0a0a', fontWeight: 700, cursor: actionMatchId === match.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', opacity: actionMatchId === match.id ? 0.6 : 1 }}
                                >
                                  {actionMatchId === match.id ? '...' : 'Acceptera'}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                <div style={{ ...panelStyle(true, isDark, isMobile), padding: 24, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', right: -80, top: -80, width: 240, height: 240, borderRadius: '50%', background: 'var(--enterprise-panel-glow)', pointerEvents: 'none' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0,1fr))' : 'repeat(4, minmax(0,1fr))', gap: 12 }}>
                    {statCard('Tillgängligt', `${driverWallet.available} kr`, 'Levererat och redo för payout', <Wallet size={18} />, isDark, isMobile)}
                    {statCard('På hold', `${driverWallet.hold} kr`, 'Låst tills uppdraget är klart', <Shield size={18} />, isDark, isMobile)}
                    {statCard('I payout', `${driverWallet.processing} kr`, 'Väntar överföring', <CreditCard size={18} />, isDark, isMobile)}
                    {statCard('Utbetalt', `${driverWallet.paid} kr`, 'Historiskt utbetalt till förare', <CheckCircle2 size={18} />, isDark, isMobile)}
                  </div>
                </div>

                  <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                  <SectionTitle
                    title="Aktiva leveranser"
                    subtitle="Följ dina pågående uppdrag från accepterad bokning till leverans."
                  />

                  {activeDriverWorkCount === 0 ? (
                    <div style={{ padding: 32, borderRadius: 18, background: 'var(--surface-2)', border: '1px dashed var(--border)', textAlign: 'center' }}>
                      <Package size={28} style={{ color: 'var(--muted)', marginBottom: 10 }} />
                      <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>Inga aktiva leveranser just nu.</p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>Acceptera inkommande förfrågningar under Kör & tjäna → Mina resor för att starta ett uppdrag.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Package assignments from the package_matches flow */}
                      {activePackageAssignments.map(pkg => {
                        const PKG_STEPS = [
                          { status: 'matched',    label: 'Transport klar', color: '#3b82f6' },
                          { status: 'paid',       label: 'Betald',     color: '#10b981' },
                          { status: 'picked_up',  label: 'Upphämtad',  color: '#7c3aed' },
                          { status: 'in_transit', label: 'På väg',     color: '#0f766e' },
                          { status: 'delivered',  label: 'Levererad',  color: 'var(--gn-dk)' },
                        ]
                        const pkgStepIdx = pkg.status === 'paid' ? 1 : pkg.status === 'picked_up' ? 2 : pkg.status === 'in_transit' ? 3 : pkg.status === 'delivered' ? 4 : 0
                        const pkgNext = pkg.status === 'paid'
                          ? { label: 'Bekräfta upphämtning', action: 'pickup' as const,          border: 'rgba(124,58,237,0.3)', bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' }
                          : pkg.status === 'picked_up'
                          ? { label: 'Markera på väg',         action: 'start_transit' as const,   border: 'rgba(20,184,166,0.3)', bg: 'rgba(20,184,166,0.08)', color: '#0f766e' }
                          : pkg.status === 'in_transit'
                          ? { label: 'Markera levererad',        action: 'deliver' as const,         border: 'var(--gn-030)',        bg: 'var(--gn-008)',         color: 'var(--gn-dk)' }
                          : null

                        return (
                          <div key={pkg.id} style={{ padding: isMobile ? 18 : 22, borderRadius: isMobile ? 22 : 24, background: isDark ? 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))' : 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.98))', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 18, boxShadow: isMobile ? 'none' : '0 16px 36px rgba(15,23,42,0.05)' }}>
                            {/* Route + badge */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                  <MapPin size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)' }}>{pkg.from_city}</span>
                                  <span style={{ color: 'var(--muted)' }}>{'\u2192'}</span>
                                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)' }}>{pkg.to_city}</span>
                                </div>
                                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0 }}>
                                  Paket{pkg.description ? ` · ${pkg.description}` : ''}{pkg.weight_kg ? ` · ${pkg.weight_kg} kg` : ''}
                                </p>
                              </div>
                              <div style={{ padding: '6px 12px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, background: PKG_STEPS[pkgStepIdx]?.color ? `${PKG_STEPS[pkgStepIdx].color}22` : 'var(--surface-2)', color: PKG_STEPS[pkgStepIdx]?.color ?? 'var(--muted)', flexShrink: 0 }}>
                                {PKG_STEPS[pkgStepIdx]?.label}
                              </div>
                            </div>

                            {/* Timeline */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                              {PKG_STEPS.map((step, i) => {
                                const done = i < pkgStepIdx
                                const current = i === pkgStepIdx
                                return (
                                  <div key={step.status} style={{ display: 'flex', alignItems: 'center', flex: i < PKG_STEPS.length - 1 ? 1 : 'none' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 64 }}>
                                      <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${done || current ? step.color : 'var(--border)'}`, background: done ? step.color : current ? `${step.color}22` : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                        {current && <div style={{ width: 8, height: 8, borderRadius: '50%', background: step.color }} />}
                                      </div>
                                      <span style={{ fontSize: '0.65rem', color: done || current ? 'var(--text)' : 'var(--muted)', fontWeight: current ? 800 : 600, textAlign: 'center', lineHeight: 1.2 }}>{step.label}</span>
                                    </div>
                                    {i < PKG_STEPS.length - 1 && (
                                      <div style={{ flex: 1, height: 2, background: done ? step.color : 'var(--border)', borderRadius: 999, margin: '0 4px', marginBottom: 16 }} />
                                    )}
                                  </div>
                                )
                              })}
                            </div>

                            {/* Sender info + payout */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {pkg.sender && (
                                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <Users size={13} style={{ color: 'var(--muted)' }} />
                                      <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Avsändare:</span>
                                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>{pkg.sender.name ?? 'Kund'}</span>
                                    </div>
                                    {pkg.sender.phone && (
                                      <a href={`tel:${pkg.sender.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--gn-dk)', textDecoration: 'none', fontWeight: 600 }}>
                                        <Phone size={12} />
                                        {pkg.sender.phone}
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                              {pkg.price_ceiling && (
                                <div style={{ textAlign: 'right' }}>
                                  <p style={{ fontSize: '0.62rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                                    {pkg.status === 'delivered' ? 'Väntar payout' : 'Utbetalning'}
                                  </p>
                                  <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>{pkg.price_ceiling} kr</p>
                                </div>
                              )}
                            </div>

                            {/* Action button */}
                            {pkgNext && (
                              <button
                                onClick={() => handlePkgDeliveryAction(pkg.id, pkgNext.action)}
                                style={{ width: '100%', padding: '14px 18px', borderRadius: 14, border: `1.5px solid ${pkgNext.border}`, background: pkgNext.bg, color: pkgNext.color, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: '0.9rem', transition: 'opacity 0.15s' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.8' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                              >
                                {pkgNext.label}
                              </button>
                            )}
                            {pkg.status === 'delivered' && (
                              <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--gn-006)', border: '1px solid var(--gn-020)', fontSize: '0.8rem', color: 'var(--gn-dk)', textAlign: 'center', fontWeight: 600, lineHeight: 1.6 }}>
                                Levererat. Gonow väntar nu på kundens bekräftelse innan payout frigörs till ditt saldo.
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {legacyActiveAssignments.map((order) => {
                        const nextAction = NEXT_ACTION[order.status]
                        const stepIndex = ASSIGNMENT_STEPS.findIndex(s => s.status === order.status)
                        // Use nested booking_requests join data (from API), fallback to bookingById map
                        const linkedBooking = order.booking_request_id ? bookingById.get(order.booking_request_id) : undefined
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const br = (order as any)._booking_request as { sender_name?: string; sender_phone?: string; recipient_name?: string; recipient_phone?: string } | null
                        const senderUser = (order as any)._sender as { name?: string; phone?: string } | null
                        const senderName = br?.sender_name || linkedBooking?.sender_name || senderUser?.name || 'Kund'
                        const senderPhone = br?.sender_phone || linkedBooking?.sender_phone || senderUser?.phone
                        const recipientName = br?.recipient_name || linkedBooking?.recipient_name
                        const recipientPhone = br?.recipient_phone || linkedBooking?.recipient_phone

                        return (
                          <div key={order.id} style={{ padding: isMobile ? 18 : 22, borderRadius: isMobile ? 22 : 24, background: isDark ? 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))' : 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.98))', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 18, boxShadow: isMobile ? 'none' : '0 16px 36px rgba(15,23,42,0.05)' }}>
                            {/* Top row: route + status badge */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                                  <MapPin size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>
                                    {order.pickup_address || 'Upphämtning'}
                                  </span>
                                  <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{'\u2192'}</span>
                                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>
                                    {order.dropoff_address || 'Avlämning'}
                                  </span>
                                </div>
                                <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                                  {order.description || 'Paket'}
                                  {order.weight_kg ? ` · ${order.weight_kg} kg` : ''}
                                </p>
                              </div>
                              <div style={{ padding: '6px 12px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, background: ORDER_STATUS[order.status]?.bg || 'var(--surface)', color: ORDER_STATUS[order.status]?.color || 'var(--muted)', flexShrink: 0 }}>
                                {ORDER_STATUS[order.status]?.label || order.status}
                              </div>
                            </div>

                            {/* Progress timeline */}
                            {isMobile ? (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                                {ASSIGNMENT_STEPS.map((step, i) => {
                                  const done = i < stepIndex
                                  const current = i === stepIndex
                                  return (
                                    <div
                                      key={step.status}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        minWidth: 0,
                                        padding: '10px 12px',
                                        borderRadius: 14,
                                        border: `1px solid ${done || current ? `${step.color}55` : 'var(--border)'}`,
                                        background: done ? `${step.color}14` : current ? `${step.color}10` : 'var(--surface)',
                                        gridColumn: i === ASSIGNMENT_STEPS.length - 1 ? '1 / -1' : 'auto',
                                      }}
                                    >
                                      <div style={{
                                        width: 22, height: 22, borderRadius: '50%',
                                        border: `2px solid ${done || current ? step.color : 'var(--border)'}`,
                                        background: done ? step.color : current ? `${step.color}22` : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                      }}>
                                        {done && (
                                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                            <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                          </svg>
                                        )}
                                        {current && (
                                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: step.color }} />
                                        )}
                                      </div>
                                      <span style={{ fontSize: '0.72rem', color: done || current ? 'var(--text)' : 'var(--muted)', fontWeight: current ? 800 : 600, lineHeight: 1.2, minWidth: 0 }}>
                                        {step.label}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                                {ASSIGNMENT_STEPS.map((step, i) => {
                                  const done = i < stepIndex
                                  const current = i === stepIndex
                                  return (
                                    <div key={step.status} style={{ display: 'flex', alignItems: 'center', flex: i < ASSIGNMENT_STEPS.length - 1 ? 1 : 'none' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 56 }}>
                                        <div style={{
                                          width: 22, height: 22, borderRadius: '50%',
                                          border: `2px solid ${done || current ? step.color : 'var(--border)'}`,
                                          background: done ? step.color : current ? `${step.color}22` : 'transparent',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          flexShrink: 0,
                                        }}>
                                          {done && (
                                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                              <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                          )}
                                          {current && (
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: step.color }} />
                                          )}
                                        </div>
                                        <span style={{ fontSize: '0.6rem', color: done || current ? 'var(--text)' : 'var(--muted)', fontWeight: current ? 700 : 500, textAlign: 'center', lineHeight: 1.2 }}>
                                          {step.label}
                                        </span>
                                      </div>
                                      {i < ASSIGNMENT_STEPS.length - 1 && (
                                        <div style={{ flex: 1, height: 2, background: done ? step.color : 'var(--border)', borderRadius: 999, margin: '0 4px', marginBottom: 16 }} />
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                            {/* Sender + recipient info + payout */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: isMobile ? 16 : 12 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {/* Sender */}
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--muted)' }}>
                                    <Users size={13} style={{ flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Avsändare:</span>
                                    {order.sender_id ? (
                                      <button onClick={() => setViewProfileUserId(order.sender_id!)} style={{ background: 'none', border: 'none', padding: 0, fontWeight: 600, color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                                        {senderName}
                                      </button>
                                    ) : (
                                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{senderName}</span>
                                    )}
                                  </div>
                                  {senderPhone && (
                                    <a href={`tel:${senderPhone}`} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--gn-dk)', textDecoration: 'none', fontWeight: 600 }}>
                                      <Phone size={12} style={{ flexShrink: 0 }} />
                                      {senderPhone}
                                    </a>
                                  )}
                                </div>
                                {/* Recipient */}
                                {recipientName && (
                                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: '8px 12px', borderRadius: 10, background: 'var(--gn-006)', border: '1px solid var(--gn-020)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
                                      <UserRound size={13} color="var(--gn-dk)" style={{ flexShrink: 0 }} />
                                      <span style={{ fontSize: '0.72rem', color: 'var(--gn-dk)' }}>Mottagare:</span>
                                      <span style={{ fontWeight: 700, color: 'var(--gn-dk)' }}>{recipientName}</span>
                                    </div>
                                    {recipientPhone && (
                                      <a href={`tel:${recipientPhone}`} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--gn-dk)', textDecoration: 'none', fontWeight: 700 }}>
                                        <Phone size={12} style={{ flexShrink: 0 }} />
                                        {recipientPhone}
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div style={{ textAlign: isMobile ? 'left' : 'right', minWidth: isMobile ? '100%' : undefined }}>
                                <p style={{ fontSize: '0.62rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Utbetalning</p>
                                <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                                  {order.carrier_payout ?? order.price} kr
                                </p>
                              </div>
                            </div>

                            {/* CTA button */}
                            {nextAction && (
                              <button
                                onClick={() => handleOrderStatusUpdate(order.id, nextAction.next)}
                                style={{
                                  width: '100%', padding: '14px 18px',
                                  borderRadius: 14, border: `1.5px solid ${nextAction.border}`,
                                  background: nextAction.bg, color: nextAction.color,
                                  cursor: 'pointer', fontFamily: 'inherit',
                                  fontWeight: 800, fontSize: '0.9rem',
                                  transition: 'opacity 0.15s',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.8' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                              >
                                {updatingOrderId === order.id ? 'Sparar...' : nextAction.label}
                              </button>
                            )}

                            {statusError?.id === order.id && (
                              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626', fontSize: '0.8rem', fontWeight: 600 }}>
                                {statusError.msg}
                              </div>
                            )}

                            {order.status === 'delivered' && (
                              <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--gn-006)', border: '1px solid var(--gn-020)', fontSize: '0.8rem', color: 'var(--gn-dk)', textAlign: 'center', fontWeight: 600 }}>
                                Levererat — inväntar kundens bekräftelse
                              </div>
                            )}

                            {['pending', 'matched'].includes(order.status) && (
                              <button
                                onClick={() => handleCancelOrder(order.id)}
                                disabled={cancellingOrderId === order.id}
                                style={{ width: '100%', padding: '10px 18px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.82rem', opacity: cancellingOrderId === order.id ? 0.6 : 1 }}
                              >
                                {cancellingOrderId === order.id ? 'Avbokar...' : 'Avboka uppdrag'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Ongoing payouts Ã¢â‚¬â€ mark as paid */}
                {payouts.filter(p => p.status === 'processing' || p.status === 'pending').length > 0 && (
                  <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                    <SectionTitle
                      title="Pågående utbetalningar"
                      subtitle="Gonow följer utbetalningen automatiskt och uppdaterar status när pengarna har betalats ut."
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {payouts
                        .filter(p => p.status === 'processing' || p.status === 'pending')
                        .map((payout) => {
                          const order = orders.find(o => o.id === payout.order_id)
                          return (
                            <div
                              key={payout.id}
                              style={{ padding: 18, borderRadius: 18, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}
                            >
                              <div>
                                <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                                  {order?.description || `Order ${payout.order_id.slice(0, 8).toUpperCase()}`}
                                </p>
                                <p style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                                  {payout.amount} kr · via Stripe Connect
                                </p>
                                <span style={{ display: 'inline-block', marginTop: 6, padding: '3px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, background: 'rgba(251,191,36,0.12)', color: '#b45309' }}>
                                  Pågående
                                </span>
                              </div>
                              <span style={{ padding: '9px 12px', borderRadius: 999, border: '1px solid var(--border)', color: 'var(--muted)', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                Uppdateras automatiskt
                              </span>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}
                {/* Quick link to all orders */}
                <button
                  onClick={() => handleTabChange('orders')}
                  style={{ padding: '12px 16px', borderRadius: 14, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.82rem' }}
                >
                  Visa alla bokningar →
                </button>
              </div>
            )}

            {activeTab === 'orders' && (
              <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                {(() => {
                  const visiblePackages = myPackages.filter((pkg) => {
                    const isHistoryPackage = ['cancelled', 'expired'].includes(pkg.status)
                    if (customerJourneyPackages.some((journeyPkg) => journeyPkg.id === pkg.id)) return true
                    return showHistory && isHistoryPackage
                  })
                  const stats = [
                    { label: 'Aktiva', value: customerJourneyPackages.filter((pkg) => pkg.status !== 'confirmed').length, hint: 'kräver uppföljning' },
                    { label: 'Betalda', value: customerJourneyPackages.filter((pkg) => pkg.status === 'paid').length, hint: 'betalning säkrad hos Gonow' },
                    { label: 'På väg', value: customerJourneyPackages.filter((pkg) => ['picked_up', 'in_transit', 'delivered'].includes(pkg.status)).length, hint: 'leveranser i drift' },
                    { label: 'Klara', value: customerJourneyPackages.filter((pkg) => pkg.status === 'confirmed').length, hint: 'bekräftade resor' },
                  ]

                  return (
                    <>
                      {isMobile && (
                        <div style={{ marginBottom: 18 }}>
                          <MobileSectionIntro
                            eyebrow="Bokningar"
                            title="Följ varje paket i samma resa."
                            subtitle="Bokning, betalning, spårning och bekräftelse ska hänga ihop utan att du behöver förstå interna betalningssteg."
                            meta={`${myPackages.length} totalt`}
                          />
                        </div>
                      )}
                      <SectionTitle title="Mina bokningar" subtitle="Paketresan visas här som en sammanhängande Gonow-resa från bokning till bekräftad leverans." />
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
                        {stats.map((item) => (
                          <div key={item.label} style={{ padding: isMobile ? 14 : 16, borderRadius: 20, background: isDark ? 'rgba(255,255,255,0.03)' : 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(244,248,255,0.98))', border: '1px solid var(--border)', boxShadow: isMobile ? 'none' : '0 12px 28px rgba(15,23,42,0.045)' }}>
                            <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>{item.label}</p>
                            <p style={{ fontSize: isMobile ? '1.2rem' : '1.4rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 4 }}>{item.value}</p>
                            <p style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{item.hint}</p>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {visiblePackages.length === 0 && (
                          <div style={{ padding: 28, borderRadius: 18, background: 'var(--surface-2)', border: '1px dashed var(--border)', textAlign: 'center', color: 'var(--muted)' }}>
                            Inga aktiva bokningar. Börja med att boka från en aktiv resa eller låt Gonow hitta rätt transport.
                          </div>
                        )}
                        {visiblePackages.map((pkg) => {
                          const statusMeta = getPackageStatusMeta(pkg.status)
                          const linkedOrder = orderByPackageId.get(pkg.id)
                          const driverName = senderMatchByPackageId.get(pkg.id)?.drivers?.name
                          const canPayNow = pkg.status === 'matched' && Boolean(linkedOrder) && isAwaitingPayment(linkedOrder)
                          const canConfirmPackage = pkg.status === 'delivered'
                          const isCompletedJourney = pkg.status === 'confirmed'

                          return (
                            <div key={pkg.id} style={{ padding: isMobile ? 16 : 20, borderRadius: 24, background: isDark ? 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))' : 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(243,248,255,0.99))', border: '1px solid var(--border)', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: isMobile ? 12 : 16, alignItems: isMobile ? 'flex-start' : 'center', boxShadow: isMobile ? 'none' : '0 16px 36px rgba(15,23,42,0.05)' }}>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                                  {pkg.from_city} {'\u2192'} {pkg.to_city}
                                </p>
                                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                                  {pkg.description || 'Paketbokning'}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                                  {pkg.weight_kg > 0 && <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{pkg.weight_kg} kg</span>}
                                  {getOrderPaymentSummary(linkedOrder) ? <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{getOrderPaymentSummary(linkedOrder)}</span> : null}
                                  {driverName ? <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Transport via {driverName}</span> : null}
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: 10, flexShrink: 0, width: isMobile ? '100%' : 'auto' }}>
                                <span style={{ padding: '5px 10px', borderRadius: 999, fontSize: '0.72rem', color: statusMeta.color, background: statusMeta.bg }}>
                                  {statusMeta.label}
                                </span>
                                {linkedOrder && canPayNow ? (
                                  <button onClick={() => handlePay(linkedOrder.id)} className="btn-primary" style={{ padding: '10px 14px', width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}>
                                    {payingId === linkedOrder.id ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Startar...</> : <><CreditCard size={13} /> Betala</>}
                                  </button>
                                ) : canConfirmPackage ? (
                                  <Link href={`/paket/${pkg.id}`} className="btn-primary" style={{ padding: '10px 14px', width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}>
                                    Bekräfta leverans
                                  </Link>
                                ) : isCompletedJourney ? (
                                  <Link href={`/paket/${pkg.id}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--gn-030)', color: 'var(--gn-dk)', background: 'var(--gn-008)', fontWeight: 700, fontSize: '0.78rem', textDecoration: 'none', width: isMobile ? '100%' : 'auto' }}>
                                    Visa avslutad resa
                                  </Link>
                                ) : (
                                  <Link href={`/paket/${pkg.id}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--gn)', color: 'var(--gn)', background: '#0a0a0a', fontWeight: 700, fontSize: '0.78rem', textDecoration: 'none', cursor: 'pointer', whiteSpace: 'nowrap', width: isMobile ? '100%' : 'auto' }}>
                                    <MapPin size={12} /> Spåra paket
                                  </Link>
                                )}
                              </div>
                            </div>
                          )
                        })}
                        {myPackages.some((pkg) => ['cancelled', 'expired'].includes(pkg.status)) && (
                          <button
                            onClick={() => setShowHistory((h) => !h)}
                            style={{ padding: '10px 16px', borderRadius: 12, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600, textAlign: 'center' }}
                          >
                            {showHistory
                              ? 'Dölj historik'
                              : `Visa historik (${myPackages.filter((pkg) => ['cancelled', 'expired'].includes(pkg.status)).length} avslutade)`}
                          </button>
                        )}
                      </div>
                    </>
                  )
                })()}
              </div>
            )}

            {activeTab === 'package_deliveries' && (() => {
              const deliveries = packageDeliveries
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {isMobile && (
                  <MobileSectionIntro
                    eyebrow="Paket"
                    title="Pågående leveranser."
                    subtitle="Dina paket som är matchade och på väg. Följ statusen i realtid och spåra leveransen."
                    meta={`${deliveries.length} aktiva`}
                  />
                )}
                  <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                    {!isMobile && (
                      <SectionTitle
                        title="Pågående leveranser"
                        subtitle="Dina skickade paket som nu är matchade med en förare och på väg."
                      />
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, minmax(0,1fr))' : 'repeat(3, minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
                      {[
                        { label: 'Transport klara', value: myPackages.filter(p => p.status === 'matched').length, hint: 'förare utsedd' },
                        { label: 'Betalda', value: myPackages.filter(p => p.status === 'paid').length, hint: 'betalning säkrad hos Gonow' },
                        { label: 'På väg', value: myPackages.filter(p => ['picked_up', 'in_transit'].includes(p.status)).length, hint: 'under leverans' },
                      ].map(item => (
                        <div key={item.label} style={{ padding: isMobile ? 14 : 16, borderRadius: 18, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                          <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>{item.label}</p>
                          <p style={{ fontSize: isMobile ? '1.2rem' : '1.4rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 4 }}>{item.value}</p>
                          <p style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{item.hint}</p>
                        </div>
                      ))}
                    </div>
                    {deliveries.length === 0 ? (
                      <div style={{ padding: 32, borderRadius: 18, background: 'var(--surface-2)', border: '1px dashed var(--border)', textAlign: 'center' }}>
                        <Package size={28} style={{ color: 'var(--muted)', marginBottom: 10 }} />
                        <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>Inga pågående leveranser.</p>
                        <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4, lineHeight: 1.65 }}>
                          Bokningar som matchats med en förare och är på väg visas här.
                        </p>
                        <button onClick={() => handleTabChange('my_packages')} className="btn-primary" style={{ marginTop: 16, padding: '10px 16px', display: 'inline-flex', gap: 8 }}>
                          Skicka paket <ArrowRight size={14} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {deliveries.map((pkg) => {
                          const linkedOrder = orderByPackageId.get(pkg.id)
                          const linkedMatch = senderMatchByPackageId.get(pkg.id)
                          const carrierId = linkedMatch?.driver_id || (linkedOrder ? getOrderCarrierId(linkedOrder) : null)
                          const carrierName = linkedMatch?.drivers?.name || (linkedOrder as any)?._carrier?.name || null
                          const statusMeta = getPackageStatusMeta(pkg.status)
                          const stepIndex = PACKAGE_FLOW_STEPS.findIndex((step) => step.status === pkg.status)
                          return (
                            <div key={pkg.id} style={{ padding: isMobile ? 18 : 22, borderRadius: 22, background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                                    <MapPin size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>{pkg.from_city || 'Upphämtning'}</span>
                                    <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{'\u2192'}</span>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>{pkg.to_city || 'Avlämning'}</span>
                                  </div>
                                  <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                                    {pkg.description || 'Paket'}
                                    {pkg.weight_kg ? ` · ${pkg.weight_kg} kg` : ''}
                                    {getOrderPaymentSummary(linkedOrder) ? ` · ${getOrderPaymentSummary(linkedOrder)}` : ''}
                                  </p>
                                  {carrierId && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                                      <Shield size={11} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                                      <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Transport via</span>
                                      <button onClick={() => setViewProfileUserId(carrierId)} style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.76rem', fontWeight: 600, color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                                        {carrierName || 'Visa profil'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <div style={{ padding: '6px 12px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, background: statusMeta.bg, color: statusMeta.color, flexShrink: 0 }}>
                                  {statusMeta.shortLabel}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                                {PACKAGE_FLOW_STEPS.map((step, i) => {
                                  const done = i < stepIndex
                                  const current = i === stepIndex
                                  return (
                                    <div key={step.status} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                                        <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${done || current ? step.color : 'var(--border)'}`, background: done ? step.color : current ? `${step.color}22` : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                          {done && <CheckCircle2 size={10} style={{ color: '#fff' }} />}
                                        </div>
                                        <span style={{ fontSize: '0.58rem', fontWeight: current ? 700 : 500, color: done || current ? 'var(--text)' : 'var(--muted)', textAlign: 'center', lineHeight: 1.2 }}>{step.label}</span>
                                      </div>
                                      {i < PACKAGE_FLOW_STEPS.length - 1 && (
                                        <div style={{ height: 2, flex: 1, background: done ? step.color : 'var(--border)', margin: '0 2px', marginBottom: 16, flexShrink: 0 }} />
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <Link href={`/paket/${pkg.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--gn)', color: 'var(--gn)', background: '#0a0a0a', fontWeight: 700, fontSize: '0.78rem', textDecoration: 'none' }}>
                                  <MapPin size={12} /> Följ paket
                                </Link>
                                {linkedOrder && pkg.status === 'matched' && isAwaitingPayment(linkedOrder) && (
                                  <button onClick={() => handlePay(linkedOrder.id)} className="btn-primary" style={{ padding: '9px 14px' }}>
                                    {payingId === linkedOrder.id ? 'Startar...' : 'Betala transport'}
                                  </button>
                                )}
                                {linkedMatch?.proposed_price != null && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)', fontWeight: 600, fontSize: '0.78rem' }}>
                                    Pris {linkedMatch.proposed_price} kr
                                  </span>
                                )}
                                {pkg.status === 'delivered' && linkedOrder && (
                                  <button onClick={() => handleOrderStatusUpdate(linkedOrder.id, 'confirmed')} className="btn-primary" style={{ padding: '9px 14px', background: 'var(--gn-dk)', borderColor: 'var(--gn-dk)' }}>
                                    {updatingOrderId === linkedOrder.id ? 'Sparar...' : 'Bekräfta leverans'}
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {activeTab === 'lift_offers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {isMobile && (
                  <MobileSectionIntro
                    eyebrow="Mina erbjudanden"
                    title="Lift-resor du erbjudit dig att köra."
                    subtitle="Här ser du alla lift-förfrågningar där du har skickat ett erbjudande. När passageraren accepterar visas det som Matchad."
                    meta={`${myLiftOffers.length} totalt`}
                  />
                )}
                <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                  {!isMobile && (
                    <SectionTitle
                      title="Mina erbjudanden"
                      subtitle="Lift-förfrågningar där du har erbjudit plats. Passageraren behöver acceptera för att resan ska bli Matchad."
                    />
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
                    {[
                      { label: 'Erbjudna', value: myLiftOffers.filter(l => l.status === 'offered').length, hint: 'väntar på svar' },
                      { label: 'Matchade', value: myLiftOffers.filter(l => l.status === 'matched').length, hint: 'bekräftade resor' },
                      { label: 'Totalt', value: myLiftOffers.length, hint: 'alla erbjudanden' },
                    ].map(item => (
                      <div key={item.label} style={{ padding: isMobile ? 14 : 16, borderRadius: 18, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>{item.label}</p>
                        <p style={{ fontSize: isMobile ? '1.2rem' : '1.4rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 4 }}>{item.value}</p>
                        <p style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{item.hint}</p>
                      </div>
                    ))}
                  </div>
                  {(() => {
                    const offerStatusMeta: Record<string, { label: string; color: string; bg: string }> = {
                      offered:   { label: 'Erbjuden',  color: '#b45309', bg: 'rgba(245,158,11,0.12)' },
                      matched:   { label: 'Matchad',   color: '#1d4ed8', bg: 'rgba(59,130,246,0.12)' },
                      open:      { label: 'Öppen',     color: 'var(--gn-dk)', bg: 'var(--gn-010)' },
                      cancelled: { label: 'Avbruten',  color: '#64748b', bg: 'rgba(148,163,184,0.14)' },
                      expired:   { label: 'Utgått',    color: '#64748b', bg: 'rgba(148,163,184,0.14)' },
                    }
                    const renderOfferCard = (lift: LiftOffer) => {
                      const s = offerStatusMeta[lift.status] ?? offerStatusMeta.open
                      const passengerName = lift.users?.name ?? 'Passagerare'
                      return (
                        <div key={lift.id} style={{ padding: isMobile ? 16 : 20, borderRadius: 20, background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: isMobile ? 'none' : '0 10px 28px rgba(15,23,42,0.05)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                                <MapPin size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>{lift.from_city}</span>
                                <span style={{ color: 'var(--muted)' }}>→</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>{lift.to_city}</span>
                              </div>
                              <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                                {new Date(lift.travel_date).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}
                                {' · '}{lift.passengers} passagerare
                                {lift.max_price ? ` · max ${lift.max_price} kr` : ''}
                              </p>
                            </div>
                            <span style={{ padding: '5px 11px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, color: s.color, background: s.bg, flexShrink: 0 }}>
                              {s.label}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <UserRound size={14} style={{ color: 'var(--muted)' }} />
                            </div>
                            <div>
                              <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Passagerare</p>
                              <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>{passengerName}</p>
                            </div>
                            {lift.users?.rating_avg ? (
                              <span style={{ marginLeft: 'auto', fontSize: '0.76rem', color: '#b45309', fontWeight: 700 }}>
                                ★ {lift.users.rating_avg.toFixed(1)}
                              </span>
                            ) : null}
                          </div>
                          {lift.note && (
                            <p style={{ fontSize: '0.78rem', color: 'var(--muted)', fontStyle: 'italic', padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                              &ldquo;{lift.note}&rdquo;
                            </p>
                          )}
                          {lift.status === 'matched' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
                                <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1d4ed8', margin: '0 0 4px' }}>
                                  {passengerName} har accepterat - resan är bekräftad!
                                </p>
                                {lift.users?.phone ? (
                                  <a href={`tel:${lift.users.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: '#1d4ed8', fontWeight: 600, textDecoration: 'none' }}>
                                    <Phone size={12} /> {lift.users.phone}
                                  </a>
                                ) : (
                                  <p style={{ fontSize: '0.74rem', color: 'var(--muted)', margin: 0 }}>Ingen telefon sparad - chatta nedan</p>
                                )}
                              </div>
                              <LiftChat liftId={lift.id} />
                              <button
                                onClick={async () => {
                                  if (!confirm('Är du säker på att du vill avboka denna matchade resa? Passageraren behöver hitta en ny förare.')) return
                                  setWithdrawingLiftId(lift.id)
                                  try {
                                    const res = await fetch(`/api/lift/${lift.id}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ status: 'cancelled', carrier_id: null }),
                                    })
                                    if (res.ok) setMyLiftOffers(prev => prev.map(l => l.id === lift.id ? { ...l, status: 'cancelled' } : l))
                                  } finally {
                                    setWithdrawingLiftId(null)
                                  }
                                }}
                                disabled={withdrawingLiftId === lift.id}
                                style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600, opacity: withdrawingLiftId === lift.id ? 0.6 : 1 }}
                              >
                                {withdrawingLiftId === lift.id ? 'Avbokar...' : 'Avboka resa'}
                              </button>
                            </div>
                          )}
                          {lift.status === 'offered' && (
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              <div style={{ flex: 1, padding: '10px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', fontSize: '0.8rem', color: '#b45309', fontWeight: 600 }}>
                                Väntar på svar från passageraren...
                              </div>
                              <button
                                onClick={() => handleWithdrawOffer(lift.id)}
                                disabled={withdrawingLiftId === lift.id}
                                style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)', color: '#dc2626', cursor: withdrawingLiftId === lift.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600, opacity: withdrawingLiftId === lift.id ? 0.6 : 1, whiteSpace: 'nowrap' }}
                              >
                                {withdrawingLiftId === lift.id ? 'Drar tillbaka...' : 'Dra tillbaka'}
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    }

                    if (myLiftOffers.length === 0) return (
                      <div style={{ padding: 32, borderRadius: 18, background: 'var(--surface-2)', border: '1px dashed var(--border)', textAlign: 'center' }}>
                        <Users size={28} style={{ color: 'var(--muted)', marginBottom: 10 }} />
                        <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>Inga erbjudanden Än.</p>
                        <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>Gå till Lift och klicka &quot;Erbjud plats&quot; på en förfrågan för att komma igång.</p>
                      </div>
                    )

                    const matchedOffers  = myLiftOffers.filter(l => l.status === 'matched')
                    const pendingOffers  = myLiftOffers.filter(l => l.status === 'offered')
                    const historyOffers  = myLiftOffers.filter(l => ['cancelled', 'expired', 'open'].includes(l.status))

                    const offerTabs = [
                      ...(matchedOffers.length > 0 ? [{ key: 'matched', label: 'Matchade',  count: matchedOffers.length }] : []),
                      ...(pendingOffers.length > 0 ? [{ key: 'pending', label: 'Väntande',  count: pendingOffers.length }] : []),
                      ...(historyOffers.length > 0 ? [{ key: 'history', label: 'Historik',  count: historyOffers.length }] : []),
                    ]
                    const defaultOfferTab = offerTabs[0]?.key ?? 'pending'
                    const activeOfferTab  = liftOffersTab ?? defaultOfferTab

                    return (
                      <div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                          {offerTabs.map(t => (
                            <button
                              key={t.key}
                              onClick={() => setLiftOffersTab(t.key)}
                              style={{
                                padding: '6px 13px', borderRadius: 999, border: '1px solid',
                                fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                background: activeOfferTab === t.key ? 'var(--accent)' : 'var(--surface)',
                                color: activeOfferTab === t.key ? '#0a0a0a' : 'var(--muted)',
                                borderColor: activeOfferTab === t.key ? 'var(--accent)' : 'var(--border)',
                                display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
                              }}
                            >
                              {t.label}
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 5px', borderRadius: 999, background: activeOfferTab === t.key ? 'rgba(0,0,0,0.15)' : 'var(--surface-2)', color: 'inherit' }}>
                                {t.count}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {(activeOfferTab === 'matched' ? matchedOffers : activeOfferTab === 'pending' ? pendingOffers : historyOffers).map(renderOfferCard)}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}

            {activeTab === 'requests' && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
                {isMobile && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <MobileSectionIntro
                      eyebrow="Förfrågningar"
                      title="Både skickat och inkommande på ett ställe."
                      subtitle="Som kund ser du öppna paketresor som ännu inte låsts. Som förare ser du inkommande lift separat från paketflödet."
                      meta={`${customerPendingCount} öppna`}
                    />
                  </div>
                )}
                <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                  {(() => {
                    return (
                      <>
                        <SectionTitle title="Mina öppna paketresor" subtitle="Här ser du bara det som fortfarande väntar på transport eller betalning. Pågående paketresor följer du under Bokningar." />
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: 14 }}>
                          {[
                            { label: 'Aktiva', value: customerPendingCount },
                            { label: 'Väntar transport', value: customerWaitingMatchCount },
                            { label: 'Väntar betalning', value: customerWaitingEscrowCount },
                          ].map((item) => (
                            <div key={item.label} style={{ padding: 14, borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                              <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>{item.label}</p>
                              <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>{item.value}</p>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {customerRequestPackages.length === 0 ? (
                            <p style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Inga öppna förfrågningar just nu. När Gonow har låst transporten fortsätter resan under Bokningar.</p>
                          ) : customerRequestPackages.map((pkg) => {
                            const statusMeta = getPackageStatusMeta(pkg.status)
                            const linkedOrder = orderByPackageId.get(pkg.id)
                            const linkedMatch = senderMatchByPackageId.get(pkg.id)
                            const canPayNow = pkg.status === 'matched' && Boolean(linkedOrder) && isAwaitingPayment(linkedOrder)

                            return (
                              <div key={pkg.id} style={{ padding: 16, borderRadius: isMobile ? 18 : 16, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                                  <strong style={{ color: 'var(--text)', fontSize: '0.84rem' }}>{pkg.from_city} {'\u2192'} {pkg.to_city}</strong>
                                  <span style={{ padding: '4px 8px', borderRadius: 999, fontSize: '0.68rem', color: statusMeta.color, background: statusMeta.bg }}>{statusMeta.label}</span>
                                </div>
                                <p style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>{pkg.description || 'Paketresa hos Gonow'}</p>
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                                  {pkg.weight_kg ? <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{pkg.weight_kg} kg</span> : null}
                                  {getOrderPaymentSummary(linkedOrder) ? <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{getOrderPaymentSummary(linkedOrder)}</span> : null}
                                  {linkedMatch?.drivers?.name ? <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Transport via {linkedMatch.drivers.name}</span> : null}
                                </div>
                                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                                  {linkedOrder && canPayNow ? (
                                    <button onClick={() => handlePay(linkedOrder.id)} className="btn-primary" style={{ padding: '10px 14px', width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}>
                                      {payingId === linkedOrder.id ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Startar...</> : <><CreditCard size={13} /> Betala nu</>}
                                    </button>
                                  ) : (
                                    <Link href={`/paket/${pkg.id}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--gn)', color: 'var(--gn)', background: '#0a0a0a', fontWeight: 700, fontSize: '0.78rem', textDecoration: 'none', width: isMobile ? '100%' : 'auto' }}>
                                      <MapPin size={12} />
                                      {pkg.status === 'open' ? 'Följ matchning' : 'Öppna paketresa'}
                                    </Link>
                                  )}

                                  {pkg.status === 'open' && (
                                    <span style={{ fontSize: '0.74rem', color: 'var(--muted)', alignSelf: 'center' }}>
                                      Gonow söker fortfarande rätt transport.
                                    </span>
                                  )}
                                  {pkg.status === 'matched' && !canPayNow && (
                                    <span style={{ fontSize: '0.74rem', color: 'var(--muted)', alignSelf: 'center' }}>
                                      Transporten är säkrad. Paketresan fortsätter nu under Bokningar.
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )
                  })()}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* New flow: driver_pending_confirmation from package_matches */}
                {driverIncoming.filter(m => m.status === 'driver_pending_confirmation').length > 0 && (
                  <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24, border: '1px solid rgba(245,158,11,0.3)' }}>
                    <SectionTitle title="Paketförfrågningar — svara snart" subtitle="Kunder vill skicka paket med din resa. Acceptera eller neka inom 30 min." />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {driverIncoming.filter(m => m.status === 'driver_pending_confirmation').map(match => {
                        const pkg = match.packages
                        const expiresIn = match.expires_at
                          ? Math.max(0, Math.round((new Date(match.expires_at).getTime() - Date.now()) / 60000))
                          : null
                        return (
                          <div key={match.id} style={{ borderRadius: 14, border: '1px solid rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.04)', padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 3px' }}>
                                  {pkg?.from_city ?? '?'} {'\u2192'} {pkg?.to_city ?? '?'}
                                </p>
                                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0 }}>
                                  {pkg?.description ?? 'Paket'}{pkg?.weight_kg ? ` · ${pkg.weight_kg} kg` : ''}
                                  {match.proposed_price != null ? ` · Upp till ${match.proposed_price} kr` : ''}
                                </p>
                                {expiresIn !== null && (
                                  <p style={{ fontSize: '0.7rem', color: '#b45309', margin: '4px 0 0' }}>Svarar senast om {expiresIn} min</p>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                <button
                                  onClick={() => handleDriverMatchAction(match.id, 'driver_decline')}
                                  disabled={actionMatchId === match.id}
                                  style={{ padding: '7px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontWeight: 600, cursor: actionMatchId === match.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', opacity: actionMatchId === match.id ? 0.6 : 1 }}
                                >Neka</button>
                                <button
                                  onClick={() => handleDriverMatchAction(match.id, 'driver_confirm')}
                                  disabled={actionMatchId === match.id}
                                  style={{ padding: '7px 14px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#0a0a0a', fontWeight: 700, cursor: actionMatchId === match.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', opacity: actionMatchId === match.id ? 0.6 : 1 }}
                                >{actionMatchId === match.id ? '...' : 'Acceptera'}</button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                  </div>
                )}

                <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                  <SectionTitle title="Inkommande lift till mina resor" subtitle="Hantera passagerarförfrågningar separat medan paketresor fortsätter i Gonows paketflöde." />
                  <div style={{ marginBottom: 14, padding: '16px 18px', borderRadius: 20, background: isDark ? 'rgba(255,255,255,0.03)' : 'linear-gradient(180deg, rgba(255,255,255,0.93), rgba(244,248,255,0.98))', border: '1px solid var(--border)', boxShadow: isMobile || isDark ? 'none' : '0 14px 30px rgba(15,23,42,0.045)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0,1fr))', gap: 10 }}>
                      {[
                        { label: 'Lift inkommande', value: incoming.length },
                        { label: 'Nya lift', value: incoming.filter(item => item.status === 'pending').length },
                        { label: 'Accepterade lift', value: incoming.filter(item => item.status === 'accepted').length },
                        { label: 'Mina resor', value: myTrips.length },
                      ].map((item) => (
                        <div key={item.label}>
                          <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>{item.label}</p>
                          <p style={{ fontSize: '1.08rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {respondError && (
                    <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#dc2626', fontSize: '0.82rem' }}>
                      {respondError}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {incoming.length === 0 ? (
                      <p style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Inga inkommande liftförfrågningar ännu.</p>
                    ) : incoming.map((item) => {
                      const status = BOOKING_STATUS[item.status] || BOOKING_STATUS.pending
                      const pending = item.status === 'pending'
                      const senderInitials = item.sender_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?'
                      return (
                        <div key={item.id} style={{ padding: 16, borderRadius: isMobile ? 18 : 16, background: 'var(--surface-2)', border: `1px solid ${pending ? 'var(--gn-020)' : 'var(--border)'}` }}>
                          {/* Sender row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <button
                              onClick={() => item.sender_id && setViewProfileUserId(item.sender_id)}
                              disabled={!item.sender_id}
                              title="Se profil"
                              style={{
                                width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                                background: 'linear-gradient(135deg, var(--gn-020), var(--gn-008))',
                                border: '1.5px solid var(--gn-030)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.82rem', fontWeight: 800, color: 'var(--gn-dk)',
                                cursor: item.sender_id ? 'pointer' : 'default',
                                transition: 'transform 0.12s ease', padding: 0,
                              }}
                              onMouseEnter={e => { if (item.sender_id) (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
                            >
                              {senderInitials}
                            </button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                <div>
                                  <strong style={{ color: 'var(--text)', fontSize: '0.88rem', display: 'block' }}>{item.sender_name || 'Avsändare'}</strong>
                                  {item.sender_id && (
                                    <button onClick={() => setViewProfileUserId(item.sender_id!)} style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.68rem', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                                      Se profil
                                    </button>
                                  )}
                                </div>
                                <span style={{ padding: '4px 8px', borderRadius: 999, fontSize: '0.68rem', color: status.color, background: status.bg, flexShrink: 0 }}>{status.label}</span>
                              </div>
                            </div>
                          </div>

                          {/* Route + details */}
                          <div style={{ padding: '12px 14px', borderRadius: 14, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(245,248,252,0.85)', border: '1px solid var(--border)', marginBottom: 10 }}>
                            <p style={{ fontSize: '0.76rem', color: 'var(--text)', fontWeight: 600, marginBottom: 3 }}>
                              {item.pickup_address} {'\u2192'} {item.dropoff_address}
                            </p>
                            {item.description && <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: 0 }}>{item.description}</p>}
                            {item.weight_kg > 0 && <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: '3px 0 0' }}>{item.weight_kg} kg</p>}
                            {item.sender_phone && (
                              <a href={`tel:${item.sender_phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 5, fontSize: '0.72rem', color: 'var(--gn-dk)', textDecoration: 'none', fontWeight: 600 }}>
                                <Phone size={11} /> {item.sender_phone}
                              </a>
                            )}
                          </div>

                          {pending && (
                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8 }}>
                              <button onClick={() => handleRespond(item.id, 'accepted')} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--gn-030)', background: 'var(--gn-008)', color: 'var(--gn-dk)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                                {respondingId === item.id ? 'Sparar...' : 'Acceptera'}
                              </button>
                              <button onClick={() => handleRespond(item.id, 'declined')} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                                Avböj
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                </div>{/* closes flex column wrapper for right grid column */}
              </div>
            )}

            {activeTab === 'my_trips' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {isMobile && (
                  <MobileSectionIntro
                    eyebrow="Kör & tjäna"
                    title="Dina resor och inkommande förfrågningar."
                    subtitle="Rutter du kör och avsändare som vill boka plats."
                    meta={`${pendingIncoming} nya`}
                  />
                )}
                <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                  {!isMobile && <SectionTitle title="Mina registrerade resor" subtitle="Rutter du kör. Avsändare kan boka plats på dessa." />}
                  {/* AI match confirmation requests for driver */}
                  {userId && <MatchSuggestions driverId={userId} />}
                  {myTrips.length === 0 ? (
                    <div style={{ padding: 32, borderRadius: 18, background: 'var(--surface-2)', border: '1px dashed var(--border)', textAlign: 'center' }}>
                      <Car size={28} style={{ color: 'var(--muted)', marginBottom: 10 }} />
                      <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>Inga registrerade resor ännu.</p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>Gå till <Link href="/kor" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 700 }}>Kör</Link> för att registrera din första resa.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {myTrips.map(trip => {
                        const tripDate = new Date(trip.departure_at)
                        const isPast = tripDate < new Date()
                        return (
                          <div key={trip.id} style={{ padding: '16px 18px', borderRadius: 18, background: 'var(--surface-2)', border: `1px solid ${isPast ? 'var(--border)' : 'var(--gn-020)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <div>
                              <p style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{trip.from_city} {'\u2192'} {trip.to_city}</p>
                              <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                                {tripDate.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <span style={{ padding: '5px 12px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, background: isPast ? 'rgba(148,163,184,0.12)' : 'var(--gn-010)', color: isPast ? 'var(--muted)' : 'var(--gn-dk)' }}>
                              {isPast ? 'Avslutad' : 'Kommande'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                  <SectionTitle title="Inkommande förfrågningar" subtitle="Bokningsförfrågningar från avsändare till dina resor. Acceptera eller avböj direkt." />
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 14 }}>
                    {[
                      { label: 'Totalt', value: incoming.length },
                      { label: 'Nya', value: incoming.filter(item => item.status === 'pending').length },
                      { label: 'Accepterade', value: incoming.filter(item => item.status === 'accepted').length },
                      { label: 'Mina resor', value: myTrips.length },
                    ].map((item) => (
                      <div key={item.label} style={{ padding: 14, borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>{item.label}</p>
                        <p style={{ fontSize: '1.08rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  {respondError && (
                    <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#dc2626', fontSize: '0.82rem' }}>
                      {respondError}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {incoming.length === 0 ? (
                      <p style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Inga inkommande förfrågningar ännu.</p>
                    ) : incoming.map((item) => {
                      const status = BOOKING_STATUS[item.status] || BOOKING_STATUS.pending
                      const pending = item.status === 'pending'
                      const senderInitials = item.sender_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?'
                      return (
                        <div key={item.id} style={{ padding: 16, borderRadius: isMobile ? 18 : 16, background: 'var(--surface-2)', border: `1px solid ${pending ? 'var(--gn-020)' : 'var(--border)'}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <button
                              onClick={() => item.sender_id && setViewProfileUserId(item.sender_id)}
                              disabled={!item.sender_id}
                              title="Se profil"
                              style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: 'linear-gradient(135deg, var(--gn-020), var(--gn-008))', border: '1.5px solid var(--gn-030)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 800, color: 'var(--gn-dk)', cursor: item.sender_id ? 'pointer' : 'default', transition: 'transform 0.12s ease', padding: 0 }}
                              onMouseEnter={e => { if (item.sender_id) (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
                            >
                              {senderInitials}
                            </button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                <div>
                                  <strong style={{ color: 'var(--text)', fontSize: '0.88rem', display: 'block' }}>{item.sender_name || 'Avsändare'}</strong>
                                  {item.sender_id && (
                                    <button onClick={() => setViewProfileUserId(item.sender_id!)} style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.68rem', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                                      Se profil
                                    </button>
                                  )}
                                </div>
                                <span style={{ padding: '4px 8px', borderRadius: 999, fontSize: '0.68rem', color: status.color, background: status.bg, flexShrink: 0 }}>{status.label}</span>
                              </div>
                            </div>
                          </div>
                          <div style={{ padding: '12px 14px', borderRadius: 14, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(245,248,252,0.85)', border: '1px solid var(--border)', marginBottom: 10 }}>
                            <p style={{ fontSize: '0.76rem', color: 'var(--text)', fontWeight: 600, marginBottom: 3 }}>{item.pickup_address} {'\u2192'} {item.dropoff_address}</p>
                            {item.description && <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: 0 }}>{item.description}</p>}
                            {item.weight_kg > 0 && <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: '3px 0 0' }}>{item.weight_kg} kg</p>}
                            {item.sender_phone && (
                              <a href={`tel:${item.sender_phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 5, fontSize: '0.72rem', color: 'var(--gn-dk)', textDecoration: 'none', fontWeight: 600 }}>
                                <Phone size={11} /> {item.sender_phone}
                              </a>
                            )}
                          </div>
                          {pending && (
                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8 }}>
                              <button onClick={() => handleRespond(item.id, 'accepted')} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--gn-030)', background: 'var(--gn-008)', color: 'var(--gn-dk)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                                {respondingId === item.id ? 'Sparar...' : 'Acceptera'}
                              </button>
                              <button onClick={() => handleRespond(item.id, 'declined')} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                                Avböj
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

                                    {activeTab === 'my_packages' && (() => {
              const mkGpId = (id: string) => 'GP-' + id.replace(/-/g, '').slice(0, 6).toUpperCase()
              const active = myPackages.filter(p => ['open', 'matched', 'paid', 'picked_up', 'in_transit', 'delivered'].includes(p.status))
              const previous = myPackages.filter(p => p.status === 'confirmed')
              const cancelled = myPackages.filter(p => ['cancelled', 'expired'].includes(p.status))

              const PkgCard = ({ pkg }: { pkg: MyPackage }) => {
                const s = getPackageStatusMeta(pkg.status)
                const canCancel = ['open', 'matched'].includes(pkg.status)
                const linkedOrder = orderByPackageId.get(pkg.id)
                const canPayNow = pkg.status === 'matched' && Boolean(linkedOrder) && isAwaitingPayment(linkedOrder)

                return (
                  <div style={{ borderRadius: 18, border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.06em' }}>{mkGpId(pkg.id)}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: s.color, background: s.bg, padding: '3px 9px', borderRadius: 999 }}>{s.shortLabel}</span>
                      </div>
                    </div>

                    <div style={{ padding: '0 16px 10px' }}>
                      <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>{pkg.from_city} → {pkg.to_city}</p>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {pkg.price_ceiling > 0 && <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Max {pkg.price_ceiling} kr</span>}
                        {pkg.weight_kg > 0 && <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>· {pkg.weight_kg} kg</span>}
                        {pkg.description && <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>· {pkg.description}</span>}
                      </div>
                    </div>

                    {['matched', 'paid', 'picked_up', 'in_transit', 'delivered'].includes(pkg.status) && (() => {
                      const stepIdx = PACKAGE_FLOW_STEPS.findIndex(s => s.status === pkg.status)
                      return (
                        <div style={{ padding: '0 16px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                            {PACKAGE_FLOW_STEPS.map((step, i) => {
                              const done = i < stepIdx
                              const curr = i === stepIdx
                              return (
                                <div key={step.status} style={{ display: 'flex', alignItems: 'center', flex: i < PACKAGE_FLOW_STEPS.length - 1 ? 1 : 'none' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 48 }}>
                                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${done || curr ? step.color : 'var(--border)'}`, background: done ? step.color : curr ? `${step.color}22` : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      {done && <svg width="8" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                      {curr && <div style={{ width: 7, height: 7, borderRadius: '50%', background: step.color }} />}
                                    </div>
                                    <span style={{ fontSize: '0.58rem', color: done || curr ? 'var(--text)' : 'var(--muted)', fontWeight: curr ? 800 : 500, textAlign: 'center', lineHeight: 1.2 }}>{step.label}</span>
                                  </div>
                                  {i < PACKAGE_FLOW_STEPS.length - 1 && (
                                    <div style={{ flex: 1, height: 2, background: done ? step.color : 'var(--border)', borderRadius: 999, margin: '0 2px', marginBottom: 14 }} />
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}

                    {pkg.status === 'open' && (
                      <div style={{ margin: '0 16px 12px', padding: '8px 12px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>→</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)' }}>Väntar på matchning</span>
                      </div>
                    )}

                    {pkg.status === 'open' && <div style={{ padding: '0 16px 12px' }}><MatchSuggestions packageId={pkg.id} /></div>}

                    <div style={{ padding: '10px 16px 14px', display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--border)' }}>
                      {canPayNow && linkedOrder && (
                        <button onClick={() => handlePay(linkedOrder.id)} className="btn-primary" style={{ flex: 1, padding: '8px 12px', justifyContent: 'center' }}>
                          {payingId === linkedOrder.id ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Startar...</> : <><CreditCard size={13} /> Betala nu</>}
                        </button>
                      )}
                      {pkg.status !== 'expired' && (
                        <Link href={`/paket/${pkg.id}`} style={{ flex: 1, textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: 'var(--gn-dk)', textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: 'var(--gn-010)', border: '1px solid var(--gn-020)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          Spåra →
                        </Link>
                      )}
                      {pkg.status === 'expired' && (
                        <button onClick={openPackageFlow} style={{ flex: 1, textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#b45309', padding: '8px 12px', borderRadius: 10, background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Publicera igen →
                        </button>
                      )}
                      {pkg.status === 'delivered' && (
                        <Link href={`/paket/${pkg.id}`} style={{ flex: 1, textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#fff', textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: '#16a34a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          Bekräfta leverans
                        </Link>
                      )}
                      {pkg.status === 'confirmed' && (
                        <Link href={`/paket/${pkg.id}`} style={{ flex: 1, textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: 'var(--gn-dk)', textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: 'var(--gn-010)', border: '1px solid var(--gn-020)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          Lämna recension
                        </Link>
                      )}
                      {canCancel && (
                        <button
                          onClick={() => handleCancelPackage(pkg.id)}
                          disabled={cancellingPkgId === pkg.id}
                          style={{ fontSize: '0.78rem', fontWeight: 600, color: '#dc2626', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', cursor: 'pointer', fontFamily: 'inherit', opacity: cancellingPkgId === pkg.id ? 0.6 : 1 }}
                        >
                          {cancellingPkgId === pkg.id ? 'Avbokar…' : 'Avboka'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              }

              const activePkgIds = new Set(active.map(p => p.id))
              const matchedFromOffers = pkgSubTab === 'active'
                ? myDriverOffers.filter(m => m.status === 'matched' && m.packages && !activePkgIds.has(m.packages.id))
                : []

              const SUB_TABS = [
                { key: 'active' as const, label: 'Aktiva', items: active, dim: false },
                { key: 'previous' as const, label: 'Tidigare', items: previous, dim: false },
                { key: 'cancelled' as const, label: 'Avbokade/Utgångna', items: cancelled, dim: true },
              ]
              const visibleItems = SUB_TABS.find(t => t.key === pkgSubTab)?.items ?? []
              const isDimmed = SUB_TABS.find(t => t.key === pkgSubTab)?.dim ?? false

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 2px' }}>Mina paket</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: 0 }}>Paket du skickar via Gonow</p>
                    </div>
                    <button onClick={openPackageFlow} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1.5px solid var(--gn-030)', background: 'var(--gn-008)', color: 'var(--gn-dk)', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                      + Nytt paket
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 4 }}>
                    {SUB_TABS.map(t => {
                      const isActive = pkgSubTab === t.key
                      return (
                        <button key={t.key} onClick={() => setPkgSubTab(t.key)} style={{ flex: 1, padding: '7px 10px', borderRadius: 9, border: 'none', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: isActive ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s', background: isActive ? 'var(--surface)' : 'transparent', color: isActive ? 'var(--text)' : 'var(--muted)', boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          {t.label}
                          {t.items.length > 0 && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, minWidth: 18, height: 18, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: isActive ? 'var(--gn-010)' : 'rgba(0,0,0,0.06)', color: isActive ? 'var(--gn-dk)' : 'var(--muted)', padding: '0 5px' }}>
                              {t.items.length}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {visibleItems.length === 0 && matchedFromOffers.length === 0 ? (
                    <div style={{ padding: 40, borderRadius: 18, background: 'var(--surface-2)', border: '1px dashed var(--border)', textAlign: 'center' }}>
                      <Package size={24} style={{ color: 'var(--muted)', marginBottom: 10 }} />
                      <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>
                        {pkgSubTab === 'active' ? 'Inga aktiva paket' : pkgSubTab === 'previous' ? 'Inga slutförda paket' : 'Inga avbokade eller utgångna paket'}
                      </p>
                      {pkgSubTab === 'active' && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 6 }}>
                          <button onClick={openPackageFlow} style={{ color: 'var(--gn-dk)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }}>Skicka ett paket →</button>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: isDimmed ? 0.7 : 1 }}>
                      {visibleItems.map(pkg => <PkgCard key={pkg.id} pkg={pkg} />)}
                      {matchedFromOffers.map(m => {
                        const pkg = m.packages!
                        const driver = m.drivers
                        return (
                          <div key={m.id} style={{ borderRadius: 18, border: '1px solid rgba(59,130,246,0.25)', background: 'rgba(59,130,246,0.03)', overflow: 'hidden' }}>
                            <div style={{ padding: '10px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div>
                                <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: 'var(--muted)', fontWeight: 700 }}>{'GP-' + pkg.id.replace(/-/g, '').slice(0, 6).toUpperCase()}</span>
                                <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', margin: '2px 0 0', letterSpacing: '-0.02em' }}>{pkg.from_city} → {pkg.to_city}</p>
                              </div>
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: getPackageStatusMeta('matched').color, background: getPackageStatusMeta('matched').bg, padding: '3px 9px', borderRadius: 999 }}>{getPackageStatusMeta('matched').label}</span>
                            </div>
                            {driver && (
                              <div style={{ padding: '0 16px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--gn-010)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, color: 'var(--gn-dk)', flexShrink: 0 }}>
                                  {driver.name?.[0]?.toUpperCase() ?? '?'}
                                </div>
                                <div>
                                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{driver.name ?? 'Förare'}</p>
                                  <p style={{ fontSize: '0.7rem', color: 'var(--muted)', margin: 0 }}>{m.proposed_price ? `${m.proposed_price} kr` : ''}{driver.rating_avg ? ` · ★ ${driver.rating_avg.toFixed(1)}` : ''}</p>
                                </div>
                              </div>
                            )}
                            <div style={{ padding: '0 16px 12px', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                              <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: '0 0 8px' }}>→ Gonow har matchat transporten och väntar på upphämtning</p>
                              <Link href={`/paket/${pkg.id}`} style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gn-dk)', textDecoration: 'none', padding: '7px 14px', borderRadius: 10, background: 'var(--gn-010)', border: '1px solid var(--gn-020)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                Spåra →
                              </Link>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}

            {activeTab === 'my_bids' && (() => {
              const mkGpId2 = (id: string) => 'GP-' + id.replace(/-/g, '').slice(0, 6).toUpperCase()
              const pendingCount = myDriverOffers.filter(m => m.status === 'suggested').length

              const statusStyle = (status: string) => {
                if (status === 'suggested') return { label: 'Nytt erbjudande', color: '#b45309', bg: 'rgba(245,158,11,0.1)' }
                if (status === 'customer_accepted') return { label: 'Accepterat av dig ✓', color: 'var(--gn-dk)', bg: 'var(--gn-010)' }
                if (status === 'driver_pending_confirmation') return { label: 'Väntar på föraren', color: '#2563eb', bg: 'rgba(37,99,235,0.08)' }
                if (status === 'matched') return { label: 'Transport klar', color: 'var(--gn-dk)', bg: 'var(--gn-010)' }
                return { label: 'Avböjt', color: '#64748b', bg: 'rgba(148,163,184,0.1)' }
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>Erbjudanden</p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0 }}>
                      Transportförslag som Gonow har hittat för dina paket. Bekräfta det alternativ som passar bäst.
                    </p>
                  </div>

                  {pendingCount > 0 && (
                    <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(146,255,99,0.06)', border: '1px solid rgba(146,255,99,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gn)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gn-dk)' }}>
                        {pendingCount} nytt erbjudande{pendingCount > 1 ? 'n' : ''} väntar på ditt svar
                      </span>
                    </div>
                  )}

                  {myDriverOffers.length === 0 ? (
                    <div style={{ padding: 40, borderRadius: 18, background: 'var(--surface-2)', border: '1px dashed var(--border)', textAlign: 'center' }}>
                      <Package size={26} style={{ color: 'var(--muted)', marginBottom: 10 }} />
                      <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0 0 4px' }}>Inga erbjudanden ännu</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: 0 }}>Gonow Intelligent System söker transport åt dig automatiskt.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {myDriverOffers.map(match => {
                        const isSuggested = match.status === 'suggested'
                        const s = statusStyle(match.status)
                        const pkg = match.packages
                        const driver = match.drivers
                        return (
                          <div key={match.id} style={{ borderRadius: 18, border: `1px solid ${isSuggested ? 'rgba(245,158,11,0.25)' : 'var(--border)'}`, background: isSuggested ? 'rgba(245,158,11,0.03)' : 'var(--surface)', overflow: 'hidden' }}>
                            {pkg && (
                              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'var(--surface-2)' }}>
                                <div>
                                  <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.06em' }}>{mkGpId2(pkg.id)}</span>
                                  <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text)', margin: '1px 0 0' }}>{pkg.from_city} → {pkg.to_city}</p>
                                </div>
                                <Link href={`/paket/${pkg.id}`} style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gn-dk)', textDecoration: 'none', padding: '5px 10px', borderRadius: 8, background: 'var(--gn-010)', whiteSpace: 'nowrap' }}>
                                  Spåra →
                                </Link>
                              </div>
                            )}
                            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--gn-010)', border: '1px solid var(--gn-020)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 800, color: 'var(--gn-dk)', flexShrink: 0 }}>
                                {driver?.name?.[0]?.toUpperCase() ?? '?'}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{driver?.name ?? 'Gonow-transport'}</p>
                                <p style={{ fontSize: '0.73rem', color: 'var(--muted)', margin: '2px 0 0' }}>
                                  <strong style={{ color: 'var(--text)' }}>{match.proposed_price ?? '—'} kr</strong>
                                  {driver?.rating_avg ? ` · ★ ${driver.rating_avg.toFixed(1)}` : ''}
                                </p>
                                {match.ai_message_driver && (
                                  <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: '3px 0 0', fontStyle: 'italic' }}>&ldquo;{match.ai_message_driver}&rdquo;</p>
                                )}
                              </div>
                              {isSuggested ? (
                                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                  <button
                                    onClick={() => handleMatchAction(match.id, 'customer_decline')}
                                    disabled={actionMatchId === match.id}
                                    style={{ padding: '7px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontWeight: 600, cursor: actionMatchId === match.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', opacity: actionMatchId === match.id ? 0.6 : 1 }}
                                  >
                                    Avböj
                                  </button>
                                  <button
                                    onClick={() => handleMatchAction(match.id, 'customer_accept')}
                                    disabled={actionMatchId === match.id}
                                    style={{ padding: '7px 14px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#0a0a0a', fontWeight: 700, cursor: actionMatchId === match.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', opacity: actionMatchId === match.id ? 0.6 : 1 }}
                                  >
                                    {actionMatchId === match.id ? '…' : 'Acceptera'}
                                  </button>
                                </div>
                              ) : (
                                <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: s.color, background: s.bg, flexShrink: 0 }}>{s.label}</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}

            {activeTab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {isMobile && (
                  <MobileSectionIntro
                    eyebrow="Profil"
                    title="Spara allt en gång, använd Överallt."
                    subtitle="Kontakt, roll och fordonsdata ska Återanvändas i bokning, support, verifiering och payout utan att du fyller om något."
                    meta={`${completion}% klart`}
                  />
                )}
                <div style={{ ...panelStyle(true, isDark, isMobile), padding: isMobile ? 18 : 24, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', right: -70, top: -80, width: 220, height: 220, borderRadius: '50%', background: 'var(--enterprise-panel-glow)', pointerEvents: 'none' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.05fr 0.95fr', gap: 18, position: 'relative' }}>
                    <div>
                      <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 8 }}>Mina sidor</p>
                      <h2 style={{ fontSize: isMobile ? '1.2rem' : '1.45rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 8 }}>
                        Ett konto som Återanvänder allt Över hela flödet
                      </h2>
                      <p style={{ fontSize: '0.82rem', lineHeight: 1.7, color: 'var(--muted)', maxWidth: 640 }}>
                        Fyll kontakt, roll och fordonsdata en gång här, så ska bokningar, resor, acceptflöden och framtida payout-logik kunna använda samma källa utan dubbelarbete.
                      </p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
                      {[
                        { label: 'Profil', value: `${completion}%`, hint: 'ifylld' },
                        { label: 'Roll', value: meta.role_intent === 'both' ? 'Båda' : meta.role_intent === 'carrier' ? 'Förare' : 'Kund', hint: 'nuvarande' },
                        { label: 'Säten', value: String(meta.vehicle_seats_total || 0), hint: 'totalt i bil' },
                      ].map((item) => (
                        <div key={item.label} style={{ padding: 14, borderRadius: 16, background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(0,0,0,0.08)' }}>
                          <p style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>{item.label}</p>
                          <p style={{ fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{item.value}</p>
                          <p style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{item.hint}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.05fr 0.95fr', gap: 20 }}>
                <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                  <SectionTitle title="Profil och onboarding" subtitle="Fyll allt en gång här så ska resten av appen kunna Återanvända uppgifterna." />
                  <div style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>Kontobas</p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.65 }}>
                      Kontaktuppgifter här ska Återanvändas automatiskt i bokningar, supportärenden och statusuppdateringar.
                    </p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Namn</span>
                      <input value={user.name} onChange={(e) => setUser({ ...user, name: e.target.value })} style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'inherit' }} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Telefon</span>
                      <input value={user.phone || ''} onChange={(e) => setUser({ ...user, phone: e.target.value })} style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'inherit' }} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>E-post</span>
                      <input value={user.email} disabled style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--muted)', fontFamily: 'inherit' }} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Stad</span>
                      <input value={user.city || ''} onChange={(e) => setUser({ ...user, city: e.target.value })} style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'inherit' }} placeholder="T.ex. Stockholm" />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Ålder</span>
                      <input type="number" min={18} max={99} value={user.age || ''} onChange={(e) => setUser({ ...user, age: e.target.value ? parseInt(e.target.value) : null })} style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'inherit' }} placeholder="T.ex. 28" />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Kön</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[['man', 'Man'], ['kvinna', 'Kvinna'], ['annat', 'Vill ej säga']].map(([val, label]) => {
                          const selected = ((user as any).gender || '') === val
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setUser({ ...user, gender: val } as any)}
                              style={{
                                padding: '9px 16px', borderRadius: 999, cursor: 'pointer',
                                fontFamily: 'inherit', fontWeight: 600, fontSize: '0.82rem',
                                border: `1px solid ${selected ? 'var(--gn-040)' : 'var(--border)'}`,
                                background: selected ? 'var(--accent-soft)' : 'var(--surface-2)',
                                color: selected ? 'var(--text)' : 'var(--muted)',
                                transition: 'all 0.15s',
                              }}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    </label>
                  </div>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Adress</span>
                    <input value={meta.address} onChange={(e) => setMeta({ ...meta, address: e.target.value })} style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'inherit' }} />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Kort bio</span>
                    <textarea value={meta.bio} onChange={(e) => setMeta({ ...meta, bio: e.target.value })} rows={4} style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'inherit', resize: 'vertical' }} />
                  </label>

                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: 8 }}>Roll i plattformen</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {([
                        ['sender', 'Vill skicka'],
                        ['carrier', 'Vill köra'],
                        ['both', 'Båda'],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          onClick={() => setMeta({ ...meta, role_intent: value as RoleIntent })}
                          style={{
                            padding: '9px 14px',
                            borderRadius: 999,
                            border: `1px solid ${meta.role_intent === value ? 'var(--gn-038)' : 'var(--border)'}`,
                            background: meta.role_intent === value ? 'var(--accent-soft)' : 'var(--surface-2)',
                            color: meta.role_intent === value ? 'var(--text)' : 'var(--muted)',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontWeight: 700,
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ paddingTop: 20 }}>
                    <button onClick={handleSaveProfile} className="btn-primary" style={{ padding: '12px 18px' }}>
                      {saving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Sparar...</> : <>Spara profil</>}
                    </button>
                    {saveMessage && <p style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--muted)' }}>{saveMessage}</p>}
                  </div>
                </div>

                <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                  <SectionTitle title="Förarprofil och bil" subtitle="Den här informationen används när du registrerar nya resor, så att du slipper fylla om allt." />
                  <div style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>Fordonskort</p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.65 }}>
                      När detta är ifyllt kan `/kor` förifylla bil, kapacitet och lediga säten. Det gör hela operationsflödet tydligare och snabbare.
                    </p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Märke</span>
                      <input value={meta.vehicle_make} onChange={(e) => setMeta({ ...meta, vehicle_make: e.target.value })} style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'inherit' }} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Modell</span>
                      <input value={meta.vehicle_model} onChange={(e) => setMeta({ ...meta, vehicle_model: e.target.value })} style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'inherit' }} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Färg</span>
                      <input value={meta.vehicle_color} onChange={(e) => setMeta({ ...meta, vehicle_color: e.target.value })} style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'inherit' }} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Registreringsnummer</span>
                      <input value={meta.vehicle_plate} onChange={(e) => setMeta({ ...meta, vehicle_plate: e.target.value.toUpperCase() })} style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'inherit' }} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Totala säten</span>
                      <input type="number" min={1} max={8} value={meta.vehicle_seats_total} onChange={(e) => setMeta({ ...meta, vehicle_seats_total: Number(e.target.value) })} style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontFamily: 'inherit' }} />
                    </label>
                  </div>

                  <div style={{ marginTop: 16, padding: 18, borderRadius: 18, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 700, marginBottom: 8 }}>Detta ger oss nu direkt</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.78rem', color: 'var(--muted)' }}>
                      <span>Biluppgifter kan Återanvändas i `/kor`.</span>
                      <span>Lediga säten kan börja visas tydligare i framtida bokningsflöden.</span>
                      <span>Det blir mycket enklare att bygga kapacitetslogik per resa härnäst.</span>
                    </div>
                  </div>
                </div>
                </div>
              </div>
            )}

            {/* Ã¢â€â‚¬Ã¢â€â‚¬ Lift: platshållare Ã¢â€â‚¬Ã¢â€â‚¬ */}
            {activeTab === 'my_lift_requests' && (
              <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                <SectionTitle title="Mina liftresor" subtitle="Lifttjänster du beställt som passagerare." />
                <div style={{ padding: 40, borderRadius: 18, background: 'var(--surface-2)', border: '1px dashed var(--border)', textAlign: 'center' }}>
                  <Users size={28} style={{ color: 'var(--muted)', marginBottom: 12 }} />
                  <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Kommer snart</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.7 }}>Lift-bokningar som passagerare visas här. Funktionen är under uppbyggnad.</p>
                </div>
              </div>
            )}
            {activeTab === 'lift_matched' && (
              <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                <SectionTitle title="Matchade resor" subtitle="Liftresor där du och en förare är matchade - bekräftade och klara." />
                <div style={{ padding: 40, borderRadius: 18, background: 'var(--surface-2)', border: '1px dashed var(--border)', textAlign: 'center' }}>
                  <CheckCircle2 size={28} style={{ color: 'var(--muted)', marginBottom: 12 }} />
                  <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Kommer snart</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.7 }}>Matchade liftresor visas här. Funktionen är under uppbyggnad.</p>
                </div>
              </div>
            )}
            {activeTab === 'lift_history' && (
              <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                <SectionTitle title="Historik" subtitle="Avslutade liftresor och tidigare bokningar." />
                <div style={{ padding: 40, borderRadius: 18, background: 'var(--surface-2)', border: '1px dashed var(--border)', textAlign: 'center' }}>
                  <Clock size={28} style={{ color: 'var(--muted)', marginBottom: 12 }} />
                  <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Kommer snart</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.7 }}>Din lift-historik visas här. Funktionen är under uppbyggnad.</p>
                </div>
              </div>
            )}

            {/* Ã¢â€â‚¬Ã¢â€â‚¬ Kör & tjäna: platshållare Ã¢â€â‚¬Ã¢â€â‚¬ */}
            {activeTab === 'packages_on_route' && (
              <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                <SectionTitle title="Paket längs rutten" subtitle="Öppna paket som matchar din planerade resa - ta med extra och tjäna mer." />
                <div style={{ padding: 40, borderRadius: 18, background: 'var(--surface-2)', border: '1px dashed var(--border)', textAlign: 'center' }}>
                  <Package size={28} style={{ color: 'var(--muted)', marginBottom: 12 }} />
                  <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Kommer snart</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.7 }}>Paket som matchar din rutt visas automatiskt här. Gonow-matchning är under uppbyggnad.</p>
                </div>
              </div>
            )}
            {activeTab === 'lift_on_route' && (
              <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                <SectionTitle title="Lift längs rutten" subtitle="Passagerare som vill åka med på din planerade resa." />
                <div style={{ padding: 40, borderRadius: 18, background: 'var(--surface-2)', border: '1px dashed var(--border)', textAlign: 'center' }}>
                  <Users size={28} style={{ color: 'var(--muted)', marginBottom: 12 }} />
                  <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Kommer snart</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.7 }}>Liftförfrågningar längs din rutt visas automatiskt här. Funktionen är under uppbyggnad.</p>
                </div>
              </div>
            )}
            {activeTab === 'earnings' && (
              <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                <SectionTitle title="Intäkter" subtitle="Sammanfattning av dina intjänade, utbetalade och kommande intäkter." />
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0,1fr))' : 'repeat(4, minmax(0,1fr))', gap: 14, marginBottom: 20 }}>
                  {statCard('Tillgängligt', `${driverWallet.available} kr`, 'Redo för payout', <Wallet size={18} />, isDark, isMobile)}
                  {statCard('På hold', `${driverWallet.hold} kr`, 'Pågående leveranser', <Shield size={18} />, isDark, isMobile)}
                  {statCard('Pågående', `${driverWallet.processing} kr`, 'I payout-kö', <CreditCard size={18} />, isDark, isMobile)}
                  {statCard('Utbetalt', `${driverWallet.paid} kr`, 'Historiskt totalt', <CheckCircle2 size={18} />, isDark, isMobile)}
                </div>
                <div style={{ padding: 20, borderRadius: 18, background: 'var(--surface-2)', border: '1px dashed var(--border)', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.7 }}>Detaljerade intäktsrapporter, exportfunktion och utbetalningsschema kommer snart.</p>
                  {payoutReadyOrders[0] && (
                    <button onClick={() => handleStartPayout(payoutReadyOrders[0].id)} className="btn-primary" style={{ marginTop: 16, padding: '11px 20px' }}>
                      {payoutingId === payoutReadyOrders[0].id ? 'Startar payout...' : 'Starta payout'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'statistics' && (
              <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                <SectionTitle title="Statistik" subtitle="Din prestandaöversikt som förare - resor, rating-trend, svarstid och mer." />
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0,1fr))' : 'repeat(4, minmax(0,1fr))', gap: 14, marginBottom: 20 }}>
                  {statCard('Genomförda', `${completedTrips}`, 'Levererade uppdrag totalt', <CheckCircle2 size={18} />, isDark, isMobile)}
                  {statCard('Betyg', user.rating_avg ? user.rating_avg.toFixed(1) : '—', `${user.rating_count ?? 0} omdömen`, <Star size={18} />, isDark, isMobile)}
                  {statCard('Gonow Score', `${gonowScore?.score ?? 0}`, gonowScore?.tier.label ?? 'Ny förare', <Shield size={18} />, isDark, isMobile)}
                  {statCard('Utbetalt', `${driverWallet.paid} kr`, 'Historiskt totalt', <Wallet size={18} />, isDark, isMobile)}
                </div>
                <div style={{ padding: 32, borderRadius: 18, background: 'var(--surface-2)', border: '1px dashed var(--border)', textAlign: 'center' }}>
                  <Star size={28} style={{ color: 'var(--muted)', marginBottom: 12 }} />
                  <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Detaljerad statistik - kommer snart</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.7 }}>
                    Rating-trend, genomsnittlig svarstid, acceptansgrad och inkomstgraf per månad.
                  </p>
                </div>
              </div>
            )}

            {/* Ã¢â€â‚¬Ã¢â€â‚¬ Konto: platshållare Ã¢â€â‚¬Ã¢â€â‚¬ */}
            {activeTab === 'bankid' && (
              <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                <SectionTitle title="BankID-verifiering" subtitle="Verifiera din identitet för ökad trovärdighet och +15 poäng i Gonow Score." />
                {user?.bankid_verified ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 24px', borderRadius: 18, background: 'var(--gn-006)', border: '1px solid var(--gn-022)', textAlign: 'center' }}>
                    <Shield size={36} style={{ color: 'var(--gn)' }} />
                    <p style={{ fontWeight: 700, fontSize: '1rem', color: isDark ? '#fff' : '#111' }}>Du är BankID-verifierad</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                      {user.bankid_name ? `Verifierad som ${user.bankid_name}` : 'Din identitet är bekräftad med BankID.'}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 999, background: 'var(--gn-012)', border: '1px solid var(--gn-025)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--gn-dk)' }}>
                      <Shield size={12} /> BankID-verifierad
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
                      {[
                        { icon: Shield,       title: '+15 Gonow Score',    desc: 'Verifierade förare prioriteras i matchningar.' },
                        { icon: CheckCircle2, title: 'Verifieringsbadge',  desc: 'Syns på din profil och för avsändare.' },
                        { icon: Shield,       title: 'Fler uppdrag',       desc: 'Avsändare väljer hellre verifierade förare.' },
                      ].map(({ icon: Icon, title, desc }) => (
                        <div key={title} style={{ padding: '14px 16px', borderRadius: 14, background: isDark ? 'rgba(255,255,255,0.03)' : '#f8f9fa', border: '1px solid var(--border)' }}>
                          <Icon size={18} style={{ color: 'var(--gn)', marginBottom: 8 }} />
                          <p style={{ fontWeight: 700, fontSize: '0.82rem', color: isDark ? '#fff' : '#111', marginBottom: 4 }}>{title}</p>
                          <p style={{ fontSize: '0.74rem', color: 'var(--muted)', lineHeight: 1.5 }}>{desc}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                      <BankIDVerify
                        userId={user?.id ?? ''}
                        isDark={isDark}
                        onVerified={() => {
                          setUser(prev => prev ? { ...prev, bankid_verified: true } : prev)
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'payment' && (
              <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                <SectionTitle title="Betalning" subtitle="Hantera dina betalningsuppgifter och utbetalningskonto." />
                <div style={{ padding: 40, borderRadius: 18, background: 'var(--surface-2)', border: '1px dashed var(--border)', textAlign: 'center' }}>
                  <CreditCard size={28} style={{ color: 'var(--muted)', marginBottom: 12 }} />
                  <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Kommer snart</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.7 }}>Stripe Connect-konto och utbetalningsinställningar kopplas hit. Bygg klart Stripe-flödet och kör din första riktiga payout.</p>
                </div>
              </div>
            )}
            {activeTab === 'settings' && (
              <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                <SectionTitle title="Inställningar" subtitle="Aviseringar, synlighet, integritetsinställningar och mer." />
                <div style={{ padding: 40, borderRadius: 18, background: 'var(--surface-2)', border: '1px dashed var(--border)', textAlign: 'center' }}>
                  <Mail size={28} style={{ color: 'var(--muted)', marginBottom: 12 }} />
                  <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Kommer snart</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.7 }}>SMS-notiser via Twilio, e-postpreferenser och kontoinställningar är under uppbyggnad.</p>
                </div>
              </div>
            )}

            {activeTab === 'carriers' && (
              <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                <SectionTitle title="Utforska förare" subtitle="En inloggad premium-vy där användaren kan jämföra förare på rating, aktivitet och kapacitet." />
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 18 }}>
                  {[
                    { label: 'Förare', value: carriers.length, hint: 'visas nu' },
                    { label: 'Verifierade', value: carriers.filter(c => c.bankidVerified).length, hint: 'kvalitet / tillit' },
                    { label: 'Snittrating', value: carriers.length ? (carriers.reduce((sum, c) => sum + c.rating, 0) / carriers.length).toFixed(1) : '0.0', hint: 'Över katalogen' },
                    { label: 'Aktiva säten', value: carriers.reduce((sum, c) => sum + c.activeSeats, 0), hint: 'samlad kapacitet' },
                  ].map((item) => (
                    <div key={item.label} style={{ padding: 16, borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                      <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>{item.label}</p>
                      <p style={{ fontSize: isMobile ? '1.1rem' : '1.35rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 4 }}>{item.value}</p>
                      <p style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{item.hint}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0,1fr))', gap: 14 }}>
                  {carriers.map((carrier) => (
                    <div key={carrier.id} style={{ padding: 20, borderRadius: 20, background: 'var(--service-card-bg)', border: '1px solid var(--service-card-border)', boxShadow: 'var(--service-card-shadow)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                        <div>
                          <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>{carrier.name}</p>
                          <p style={{ fontSize: '0.76rem', color: 'var(--muted)', lineHeight: 1.5 }}>{carrier.nextRoute}</p>
                        </div>
                        <div style={{ padding: '5px 10px', borderRadius: 999, background: carrier.bankidVerified ? 'var(--gn-012)' : 'rgba(148,163,184,0.12)', color: carrier.bankidVerified ? 'var(--gn-dk)' : 'var(--muted)', fontSize: '0.68rem', fontWeight: 700 }}>
                          {carrier.bankidVerified ? 'Verifierad' : 'Ny'}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                        <div style={{ padding: 12, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                          <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 4 }}>Rating</p>
                          <strong style={{ color: 'var(--text)' }}>{carrier.rating.toFixed(1)}</strong>
                        </div>
                        <div style={{ padding: 12, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                          <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 4 }}>Resor</p>
                          <strong style={{ color: 'var(--text)' }}>{carrier.activeTrips}</strong>
                        </div>
                        <div style={{ padding: 12, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                          <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 4 }}>Säten</p>
                          <strong style={{ color: 'var(--text)' }}>{carrier.activeSeats}</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.76rem', color: 'var(--muted)' }}>
                          <Star size={12} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
                          {carrier.ratingCount} omdömen · {carrier.vehicleType}
                        </div>
                        <button onClick={() => setViewProfileUserId(carrier.id)} style={{ border: 'none', background: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Visa profil
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <CarrierProfileModal
        carrierId={viewProfileUserId}
        onClose={() => setViewProfileUserId(null)}
      />

      {pendingRating && userId && (
        <RatingModal
          orderId={pendingRating.orderId}
          fromUserId={userId}
          toUserId={pendingRating.toUserId}
          toUserName={pendingRating.toName}
          role={pendingRating.role}
          onDone={() => setPendingRating(null)}
        />
      )}
    </div>
  )
}



