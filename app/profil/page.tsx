'use client'


import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, Car, CheckCircle2, Clock, CreditCard, Loader2, LogOut,
  Mail, MapPin, Package, Phone, Shield, Star, UserRound, Users, Wallet,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import AuthModal from '@/components/auth/AuthModal'
import { createClient } from '@/lib/supabase'
import { EscrowLedgerEntry, Order, OrderStatus, Payout, Trip, User } from '@/lib/types'
import { BookingRequest, cancelBooking, loadAllBookings, updateBookingStatus } from '@/lib/bookings'
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

type TabKey = 'overview' | 'assignments' | 'orders' | 'requests' | 'profile' | 'carriers'
type BookingRequestWithTrip = BookingRequest & {
  trips?: { from_city: string; to_city: string; departure_at: string | null }
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

function ledgerEntryLabel(entry: EscrowLedgerEntry) {
  switch (entry.entry_type) {
    case 'customer_payment_received':
      return 'Kund betalade'
    case 'platform_fee_reserved':
      return 'Plattformsavgift reserverad'
    case 'carrier_payout_reserved':
      return 'Förarandel låst i escrow'
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

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview',     label: 'Översikt'        },
  { key: 'assignments',  label: 'Aktiva uppdrag'  },
  { key: 'orders',       label: 'Bokningar'       },
  { key: 'requests',     label: 'Förfrågningar'   },
  { key: 'profile',      label: 'Profil'          },
  { key: 'carriers',     label: 'Utforska förare' },
]

const ASSIGNMENT_STEPS: { status: OrderStatus; label: string; color: string }[] = [
  { status: 'pending',    label: 'Accepterad',  color: '#f59e0b' },
  { status: 'matched',    label: 'Betald',      color: '#15803d' },
  { status: 'picked_up',  label: 'Upphämtad',   color: '#7c3aed' },
  { status: 'in_transit', label: 'På väg',       color: '#0f766e' },
  { status: 'delivered',  label: 'Levererad',    color: '#15803d' },
]

const NEXT_ACTION: Record<string, { label: string; next: OrderStatus; border: string; bg: string; color: string }> = {
  pending:    { label: 'Starta uppdrag',    next: 'matched',    border: 'rgba(34,197,94,0.3)',   bg: 'rgba(34,197,94,0.08)',   color: '#15803d' },
  matched:    { label: 'Markera upphämtad', next: 'picked_up',  border: 'rgba(124,58,237,0.3)',  bg: 'rgba(124,58,237,0.08)',  color: '#7c3aed' },
  picked_up:  { label: 'Markera på väg',    next: 'in_transit', border: 'rgba(20,184,166,0.3)',  bg: 'rgba(20,184,166,0.08)',  color: '#0f766e' },
  in_transit: { label: 'Markera levererad', next: 'delivered',  border: 'rgba(34,197,94,0.3)',   bg: 'rgba(34,197,94,0.08)',   color: '#15803d' },
}

const ORDER_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Väntar betalning', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  matched: { label: 'Betald', color: '#15803d', bg: 'rgba(34,197,94,0.12)' },
  picked_up: { label: 'Upphämtad', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
  in_transit: { label: 'På väg', color: '#0f766e', bg: 'rgba(20,184,166,0.12)' },
  delivered: { label: 'Levererad', color: '#15803d', bg: 'rgba(34,197,94,0.12)' },
  confirmed: { label: 'Bekräftad', color: '#15803d', bg: 'rgba(34,197,94,0.12)' },
  disputed: { label: 'Tvist', color: '#dc2626', bg: 'rgba(239,68,68,0.12)' },
  cancelled: { label: 'Avbruten', color: '#64748b', bg: 'rgba(148,163,184,0.14)' },
}

const BOOKING_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Väntar svar', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  accepted: { label: 'Accepterad', color: '#15803d', bg: 'rgba(34,197,94,0.12)' },
  declined: { label: 'Avböjd', color: '#dc2626', bg: 'rgba(239,68,68,0.12)' },
  cancelled: { label: 'Avbruten', color: '#64748b', bg: 'rgba(148,163,184,0.14)' },
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
      <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: subtitle ? 6 : 0 }}>{title}</p>
      {subtitle && <p style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.55 }}>{subtitle}</p>}
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
    <div style={{ ...panelStyle(false, isDark, mobile), padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>{label}</p>
          <p style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text)', marginBottom: 6 }}>{value}</p>
          <p style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>{hint}</p>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
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

const VALID_TABS: TabKey[] = ['overview', 'assignments', 'orders', 'requests', 'profile', 'carriers']

export default function ProfilPage() {
  const { userId, profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab') as TabKey | null
    if (tab && VALID_TABS.includes(tab)) setActiveTab(tab)
  }, [])

  function handleTabChange(tab: TabKey) {
    setActiveTab(tab)
    router.replace(`/profil?tab=${tab}`, { scroll: false })
  }
  const [showAuth, setShowAuth] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')
  const [isDark, setIsDark] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
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
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null)
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [respondError, setRespondError] = useState<string | null>(null)
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [statusError, setStatusError] = useState<{ id: string; msg: string } | null>(null)
  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)

  useEffect(() => {
    // Don't do anything while auth is still resolving — avoids flash of wrong state
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
    setMyTrips(loadTripsForCarrier(activeUserId))

    async function loadDashboard(showSpinner = false) {
      if (showSpinner) setLoadingData(true)
      const supabase = createClient()

      const safeBookingRequests = async (
        mode: 'sender' | 'trip_ids',
        tripIds: string[] = []
      ): Promise<BookingRequestWithTrip[]> => {
        try {
          let query = supabase
            .from('booking_requests')
            .select('*, trips(from_city, to_city, departure_at)')
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

      const [ordersPayload, payoutsPayload, ledgerPayload, carrierTripsRes, remoteMyRequests, allTripsRes, allBookings] = await Promise.all([
        fetch(`/api/orders?user_id=${activeUserId}`).then(async (res) => (res.ok ? await res.json() : { orders: [] })).catch(() => ({ orders: [] })),
        fetch(`/api/payouts?carrier_id=${activeUserId}`).then(async (res) => (res.ok ? await res.json() : { payouts: [] })).catch(() => ({ payouts: [] })),
        fetch(`/api/ledger?carrier_id=${activeUserId}`).then(async (res) => (res.ok ? await res.json() : { entries: [] })).catch(() => ({ entries: [] })),
        supabase.from('trips').select('*').eq('carrier_id', activeUserId).order('departure_at', { ascending: true }).limit(30),
        safeBookingRequests('sender'),
        fetch('/api/trips').then(async (res) => (res.ok ? (await res.json()).trips : [])).catch(() => []),
        loadAllBookings().catch(() => []),
      ])

      setOrders((ordersPayload.orders as Order[]) || [])
      setPayouts((payoutsPayload.payouts as Payout[]) || [])
      setLedgerEntries((ledgerPayload.entries as EscrowLedgerEntry[]) || [])
      const localBookings = allBookings as BookingRequestWithTrip[]
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
      const remoteTrips = (carrierTripsRes.data as SavedTrip[]) || []
      const combinedTrips = [...localTrips, ...remoteTrips.filter((trip) => !localTrips.some((local) => local.id === trip.id))]
      setMyTrips(combinedTrips)

      const carrierTripIds = ((carrierTripsRes.data as { id: string }[]) || []).map((trip) => trip.id)
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
      setLoadingData(false)
    }

    loadDashboard(true)

    const pollId = window.setInterval(() => {
      loadDashboard(false)
    }, 8000)

    const onTrips = () => {
      if (!activeUserId) return
      setMyTrips(loadTripsForCarrier(activeUserId))
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

  const acceptedRequests   = myRequests.filter(r => r.status === 'accepted').length
  const pendingRequests    = myRequests.filter(r => r.status === 'pending').length
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
      ['matched', 'picked_up', 'in_transit'].includes(o.status) ||
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
        .filter((order) => ['matched', 'picked_up', 'in_transit'].includes(order.status))
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
  const orderByBookingRequestId = useMemo(
    () => new Map(orders.filter((order) => order.booking_request_id).map((order) => [order.booking_request_id as string, order])),
    [orders]
  )
  const orderById = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders]
  )
  const activeCustomerOrder = useMemo(
    () => orders.find((order) => order.sender_id === userId && ['pending', 'matched', 'picked_up', 'in_transit', 'confirmed'].includes(order.status)) ?? null,
    [orders, userId]
  )
  const acceptedRequestNeedingPayment = useMemo(
    () => myRequests.find((request) => request.status === 'accepted' && request.order_id && orderByBookingRequestId.has(request.id)) ?? null,
    [myRequests, orderByBookingRequestId]
  )

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
      const res = await fetch(`/api/orders/${orderId}/checkout`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Kunde inte starta betalning.')

      if (data.mock) {
        // Demo mode: update localStorage order to matched, then refresh
        const stored = JSON.parse(localStorage.getItem('gonow_bookings') || '[]')
        const updated = stored.map((o: { id: string; status: string }) =>
          o.id === orderId ? { ...o, status: 'matched' } : o
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
      setIncoming(nextBookings.filter((booking) => myTrips.some((trip) => trip.id === booking.trip_id)) as BookingRequestWithTrip[])
      setMyRequests(nextBookings.filter((booking) => booking.sender_id === userId) as BookingRequestWithTrip[])
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
      const res = await fetch(`/api/orders/${orderId}/cancel`, { method: 'POST' })
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
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Kunde inte uppdatera orderstatus.')
      }
      setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, ...data.order } : order)))
    } catch (error) {
      setStatusError({ id: orderId, msg: error instanceof Error ? error.message : 'Kunde inte uppdatera orderstatus.' })
    } finally {
      setUpdatingOrderId(null)
    }
  }

  async function reloadLedger() {
    if (!userId) return
    const res = await fetch(`/api/ledger?carrier_id=${userId}`).catch(() => null)
    if (res?.ok) {
      const data = await res.json()
      setLedgerEntries(data.entries || [])
    }
  }

  async function handleStartPayout(orderId: string) {
    setPayoutingId(orderId)
    setSaveMessage(null)
    try {
      const res = await fetch('/api/payouts', {
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

  async function handleMarkPayoutPaid(payoutId: string) {
    setMarkingPaidId(payoutId)
    setSaveMessage(null)
    try {
      const res = await fetch(`/api/payouts/${payoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Kunde inte markera payout som klar.')

      if (data.payout) {
        setPayouts((current) =>
          current.map((p) => (p.id === payoutId ? data.payout : p))
        )
      }

      await reloadLedger()
      setSaveMessage('Payout markerad som klar. Saldot har uppdaterats.')
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Kunde inte markera payout som klar.')
    } finally {
      setMarkingPaidId(null)
    }
  }

  if (authLoading || loadingData) {
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
    <div style={{ minHeight: '100vh', paddingTop: isMobile ? 56 : 88, paddingBottom: isMobile ? 32 : 88, background: isMobile ? (isDark ? '#0a0a0a' : '#f2f2f7') : (isDark ? 'linear-gradient(180deg, transparent 0%, rgba(34,197,94,0.04) 100%)' : '#f8f8f8'), overflowX: 'hidden' }}>

      {/* ── MOBILE: compact app header ── */}
      {isMobile && (
        <div style={{ background: isDark ? '#111' : '#fff', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 21 }}>
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

      {/* ── MOBILE: sticky underline tab bar ── */}
      {isMobile && (
        <div className="mobile-app-tabs" style={{ position: 'sticky', top: 66, zIndex: 20, background: isDark ? '#111' : '#fff', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`, display: 'flex', overflowX: 'auto', scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'], scrollSnapType: 'x proximity' }}>
          {TABS.map((tab) => {
            const badge = tab.key === 'assignments' ? activeAssignments.length : tab.key === 'requests' ? pendingIncoming : 0
            const isActive = activeTab === tab.key
            return (
              <button key={tab.key} onClick={() => handleTabChange(tab.key)} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '15px 15px 12px', border: 'none', borderBottom: `2.5px solid ${isActive ? '#22c55e' : 'transparent'}`, background: 'none', color: isActive ? 'var(--text)' : 'var(--muted)', fontWeight: isActive ? 700 : 500, fontSize: '0.81rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'color 0.15s', marginBottom: -1 }}>
                {tab.label}
                {badge > 0 && <span style={{ fontSize: '0.58rem', fontWeight: 800, minWidth: 15, height: 15, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', background: '#22c55e', color: '#0a0a0a' }}>{badge}</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* ── DESKTOP: maxWidth wrapper ── */}
      <div style={isMobile ? undefined : { maxWidth: 1260, margin: '0 auto', padding: '0 24px' }}>

        {/* ── DESKTOP ONLY: stepper header ── */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px 22px', marginBottom: 24, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', gap: 0 }}>
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

        {/* ── Grid: sidebar (desktop) + content ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '240px minmax(0,1fr)', gap: 24, alignItems: 'start' }}>

          {/* Desktop sidebar only */}
          {!isMobile && (
            <aside style={{ ...panelStyle(false, isDark, isMobile), padding: 16, position: 'sticky', top: 96 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {TABS.map((tab) => {
                  const badge = tab.key === 'assignments' ? activeAssignments.length : tab.key === 'requests' ? pendingIncoming : 0
                  return (
                    <button key={tab.key} onClick={() => handleTabChange(tab.key)} style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 14, border: '1px solid transparent', background: activeTab === tab.key ? 'var(--accent-soft)' : 'transparent', color: activeTab === tab.key ? 'var(--text)' : 'var(--muted)', fontWeight: activeTab === tab.key ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      {tab.label}
                      {badge > 0 && <span style={{ fontSize: '0.65rem', fontWeight: 800, minWidth: 18, height: 18, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', background: 'var(--accent)', color: '#0a0a0a' }}>{badge}</span>}
                    </button>
                  )
                })}
              </div>
            </aside>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 24, minWidth: 0, padding: isMobile ? '18px 14px 32px' : 0 }}>
            {isMobile && (
              <div style={{ ...panelStyle(true, isDark, isMobile), padding: '18px 16px', position: 'relative', overflow: 'hidden' }}>
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
                    { label: 'Förfrågningar', value: pendingRequests },
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
                    meta={`${pendingRequests} väntar`}
                  />
                )}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0,1fr))' : 'repeat(4, minmax(0,1fr))', gap: 14 }}>
                  {statCard('Profil', `${completion}%`, 'Onboarding och sparade standarduppgifter', <UserRound size={18} />, isDark, isMobile)}
                  {statCard('Aktiva resor', `${activeCarrierTrips}`, 'Registrerade rutter i din panel', <Car size={18} />, isDark, isMobile)}
                  {statCard('Väntande svar', `${pendingRequests}`, 'Dina skickade förfrågningar', <Clock size={18} />, isDark, isMobile)}
                  {statCard('Accepterade', `${acceptedRequests}`, 'Redo att betalas eller genomföras', <CheckCircle2 size={18} />, isDark, isMobile)}
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
                      title="F\u00f6rarsaldo"
                      subtitle="Byggt som en riktig operations-wallet: vad som \u00e4r p\u00e5 hold, vad som kan betalas ut och vad som redan har g\u00e5tt ut."
                    />
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
                      <div>
                        <p style={{ fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Tillg\u00e4ngligt saldo</p>
                        <p style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.06em', color: 'var(--text)', lineHeight: 1 }}>{driverWallet.available} kr</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 10 }}>
                          {driverWallet.availableOrders} leveranser klara f\u00f6r payout
                        </p>
                      </div>
                      <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                        <Wallet size={22} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
                      <div style={{ padding: 16, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--enterprise-panel-border)' }}>
                        <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6 }}>P\u00e5 hold</p>
                        <p style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{driverWallet.hold} kr</p>
                        <p style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Betalt av kund men jobbet \u00e4r inte avslutat.</p>
                      </div>
                      <div style={{ padding: 16, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--enterprise-panel-border)' }}>
                        <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6 }}>P\u00e5g\u00e5ende payout</p>
                        <p style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{driverWallet.processing} kr</p>
                        <p style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{driverWallet.processingOrders} poster i payout-k\u00f6n.</p>
                      </div>
                      <div style={{ padding: 16, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--enterprise-panel-border)' }}>
                        <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6 }}>Utbetalt totalt</p>
                        <p style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{driverWallet.paid} kr</p>
                        <p style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{driverWallet.paidOrders} payout-poster redan klara.</p>
                      </div>
                      <div style={{ padding: 16, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--enterprise-panel-border)' }}>
                        <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6 }}>Brutto till n\u00e4tverket</p>
                        <p style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{driverWallet.grossBooked} kr</p>
                        <p style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Summerat p\u00e5 dina aktiva och slutf\u00f6rda uppdrag.</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: 12, paddingTop: 4 }}>
                      <p style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                        Enterprise-t\u00e4nket h\u00e4r \u00e4r att f\u00f6raren alltid ska kunna skilja p\u00e5 intj\u00e4nat, l\u00e5st och utbetalt.
                      </p>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: isMobile ? 'stretch' : 'flex-end' }}>
                        {payoutReadyOrders[0] && (
                          <button onClick={() => handleStartPayout(payoutReadyOrders[0].id)} className="btn-primary" style={{ padding: '11px 16px', whiteSpace: 'nowrap', width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}>
                            {payoutingId === payoutReadyOrders[0].id ? 'Startar payout...' : 'Skicka payout'}
                          </button>
                        )}
                        <button onClick={() => handleTabChange('assignments')} className="btn-primary" style={{ padding: '11px 16px', whiteSpace: 'nowrap', width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}>
                          Se driftstatus
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
                    <SectionTitle title="Operationsl\u00e4ge" subtitle="Vad du b\u00f6r g\u00f6ra n\u00e4st f\u00f6r att h\u00e5lla fl\u00f6det snabbt och tydligt." />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ padding: 16, borderRadius: 18, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: 4 }}>Inkommande f\u00f6rfr\u00e5gningar</p>
                        <p style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)' }}>{pendingIncoming}</p>
                      </div>
                      <div style={{ padding: 16, borderRadius: 18, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: 4 }}>Aktiva uppdrag</p>
                        <p style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)' }}>{activeAssignments.length}</p>
                      </div>
                      <div style={{ padding: 16, borderRadius: 18, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: 4 }}>F\u00f6rarresor live</p>
                        <p style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)' }}>{activeCarrierTrips}</p>
                      </div>
                    </div>
                    <div style={{ marginTop: 16, padding: 16, borderRadius: 18, background: 'var(--accent-soft)', border: '1px solid rgba(34,197,94,0.2)' }}>
                      <p style={{ fontSize: '0.76rem', color: 'var(--muted)', marginBottom: 8 }}>N\u00e4sta enterprise-steg</p>
                      <p style={{ fontSize: '0.84rem', color: 'var(--text)', lineHeight: 1.7 }}>
                        N\u00e4r Stripe Connect \u00e4r inkopplat kan `Tillg\u00e4ngligt saldo` driva en riktig payout-knapp, payout-schema och exporthistorik.
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 0.9fr', gap: 20 }}>
                  <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                    <SectionTitle
                      title="Varför detta är rätt grund"
                      subtitle="Vi flyttar kärnupplevelsen till ett ställe där användaren slipper fylla om samma saker i varje nytt flöde."
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                      {[
                        'Bokningar och resor i samma panel',
                        'Profilen återanvänds i skicka, lift och kör',
                        'Förarinformation kan byggas ut utan att bryta resten',
                        'Utforska förare blir en trygg, inloggad premium-vy',
                      ].map((item) => (
                        <div key={item} style={{ padding: 16, borderRadius: 18, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.6 }}>
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                    <SectionTitle title="Snabböversikt" subtitle="Det som redan finns sparat och det som bör fyllas i härnäst." />
                    {(activeCustomerOrder || acceptedRequestNeedingPayment) && (
                      <div style={{ padding: 16, borderRadius: 18, background: 'var(--surface-2)', border: '1px solid var(--border)', marginBottom: 16 }}>
                        <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>Aktiv kundresa</p>
                        <p style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                          {activeCustomerOrder?.description || acceptedRequestNeedingPayment?.description || 'Bokning pågår'}
                        </p>
                        <p style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: 12 }}>
                          {activeCustomerOrder
                            ? `${activeCustomerOrder.pickup_address || 'Upphämtning'} → ${activeCustomerOrder.dropoff_address || 'Avlämning'}`
                            : `${acceptedRequestNeedingPayment?.pickup_address || 'Upphämtning'} → ${acceptedRequestNeedingPayment?.dropoff_address || 'Avlämning'}`}
                        </p>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {activeCustomerOrder?.status === 'pending' && (
                            <button onClick={() => handlePay(activeCustomerOrder.id)} className="btn-primary" style={{ padding: '11px 16px' }}>
                              {payingId === activeCustomerOrder.id ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Startar...</> : <><CreditCard size={13} /> Betala nu</>}
                            </button>
                          )}
                          {activeCustomerOrder && activeCustomerOrder.status !== 'pending' && (
                            <Link href={`/spara/${activeCustomerOrder.id}`} className="btn-primary" style={{ padding: '11px 16px', display: 'inline-flex', gap: 8 }}>
                              Spåra resa <ArrowRight size={14} />
                            </Link>
                          )}
                          <button onClick={() => handleTabChange('requests')} style={{ padding: '11px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                            Se förfrågningar
                          </button>
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Kontakt</span>
                        <strong style={{ color: 'var(--text)', fontSize: '0.82rem' }}>{user.phone || 'Saknas'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Stad</span>
                        <strong style={{ color: 'var(--text)', fontSize: '0.82rem' }}>{meta.city || 'Saknas'}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Roll</span>
                        <strong style={{ color: 'var(--text)', fontSize: '0.82rem' }}>{meta.role_intent}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Fordon</span>
                        <strong style={{ color: 'var(--text)', fontSize: '0.82rem' }}>
                          {meta.vehicle_make && meta.vehicle_model ? `${meta.vehicle_make} ${meta.vehicle_model}` : 'Inte sparat än'}
                        </strong>
                      </div>
                      <div style={{ paddingTop: 6 }}>
                        <button onClick={() => handleTabChange('profile')} className="btn-primary" style={{ padding: '11px 16px', display: 'inline-flex', gap: 8 }}>
                          Fyll profiluppgifter <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'assignments' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {isMobile && (
                  <MobileSectionIntro
                    eyebrow="Aktiva uppdrag"
                    title="Det här kör du just nu."
                    subtitle="Alla leveranser som pågår samlade i en tydlig driftvy med status, kontakt och nästa åtgärd."
                    meta={`${activeAssignments.length} aktiva`}
                  />
                )}
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
                    title="Aktiva uppdrag"
                    subtitle="Dina pågående leveranser — upphämtning, på väg och klara att bekräftas."
                  />

                  {activeAssignments.length === 0 ? (
                    <div style={{ padding: 32, borderRadius: 18, background: 'var(--surface-2)', border: '1px dashed var(--border)', textAlign: 'center' }}>
                      <Package size={28} style={{ color: 'var(--muted)', marginBottom: 10 }} />
                      <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>Inga aktiva uppdrag just nu.</p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>Acceptera förfrågningar under Förfrågningar-fliken för att starta ett uppdrag.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {activeAssignments.map((order) => {
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
                          <div key={order.id} style={{ padding: 22, borderRadius: 20, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 18 }}>
                            {/* Top row: route + status badge */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                                  <MapPin size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>
                                    {order.pickup_address || 'Upphämtning'}
                                  </span>
                                  <span style={{ color: 'var(--muted)', flexShrink: 0 }}>→</span>
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
                                    <a href={`tel:${senderPhone}`} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: '#15803d', textDecoration: 'none', fontWeight: 600 }}>
                                      <Phone size={12} style={{ flexShrink: 0 }} />
                                      {senderPhone}
                                    </a>
                                  )}
                                </div>
                                {/* Recipient */}
                                {recipientName && (
                                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: '8px 12px', borderRadius: 10, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
                                      <UserRound size={13} color="#15803d" style={{ flexShrink: 0 }} />
                                      <span style={{ fontSize: '0.72rem', color: '#15803d' }}>Mottagare:</span>
                                      <span style={{ fontWeight: 700, color: '#15803d' }}>{recipientName}</span>
                                    </div>
                                    {recipientPhone && (
                                      <a href={`tel:${recipientPhone}`} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: '#15803d', textDecoration: 'none', fontWeight: 700 }}>
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
                              <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', fontSize: '0.8rem', color: '#15803d', textAlign: 'center', fontWeight: 600 }}>
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

                {/* Ongoing payouts — mark as paid */}
                {payouts.filter(p => p.status === 'processing' || p.status === 'pending').length > 0 && (
                  <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                    <SectionTitle
                      title="Pågående utbetalningar"
                      subtitle="Dessa payouts är startade. Markera dem som klara när pengarna har gått ut."
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
                              <button
                                onClick={() => handleMarkPayoutPaid(payout.id)}
                                disabled={markingPaidId === payout.id}
                                style={{
                                  padding: '11px 16px', borderRadius: 12, border: 'none',
                                  background: markingPaidId === payout.id ? 'rgba(34,197,94,0.5)' : '#22c55e',
                                  color: '#0a0a0a', cursor: markingPaidId === payout.id ? 'not-allowed' : 'pointer',
                                  fontFamily: 'inherit', fontWeight: 700, fontSize: '0.84rem', whiteSpace: 'nowrap',
                                }}
                              >
                                {markingPaidId === payout.id ? 'Markerar...' : 'Markera klar'}
                              </button>
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
                {isMobile && (
                  <div style={{ marginBottom: 18 }}>
                    <MobileSectionIntro
                      eyebrow="Förare"
                      title="Jämför förare som en riktig marknadsplats."
                      subtitle="Den här vyn ska kännas trygg, sorterad och premium även på liten skärm."
                      meta={`${carriers.length} profiler`}
                    />
                  </div>
                )}
                {isMobile && (
                  <div style={{ marginBottom: 18 }}>
                    <MobileSectionIntro
                      eyebrow="Bokningar"
                      title="Följ varje leverans utan friktion."
                      subtitle="Här ska det vara självklart om något väntar på betalning, är på väg eller redan är klart."
                      meta={`${orders.length} totalt`}
                    />
                  </div>
                )}
                <SectionTitle title="Mina bokningar" subtitle="Här ska kundens status alltid vara tydlig: väntar, accepterad, på väg eller levererad." />
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'Aktiva', value: orders.filter(o => !['cancelled', 'confirmed'].includes(o.status)).length, hint: 'kräver uppföljning' },
                    { label: 'Väntar betalning', value: orders.filter(o => o.status === 'pending').length, hint: 'redo för checkout' },
                    { label: 'På väg', value: orders.filter(o => ['picked_up', 'in_transit'].includes(o.status)).length, hint: 'leveranser i drift' },
                    { label: 'Klara', value: orders.filter(o => ['delivered', 'confirmed'].includes(o.status)).length, hint: 'levererat / bekräftat' },
                  ].map((item) => (
                    <div key={item.label} style={{ padding: isMobile ? 14 : 16, borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                      <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>{item.label}</p>
                      <p style={{ fontSize: isMobile ? '1.2rem' : '1.4rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 4 }}>{item.value}</p>
                      <p style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{item.hint}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {orders.filter(o => showHistory || o.status !== 'cancelled').length === 0 && (
                    <div style={{ padding: 28, borderRadius: 18, background: 'var(--surface-2)', border: '1px dashed var(--border)', textAlign: 'center', color: 'var(--muted)' }}>
                      Inga aktiva bokningar. Börja med att boka från en aktiv resa eller låt AI:n matcha dig.
                    </div>
                  )}
                  {orders.filter(o => showHistory || o.status !== 'cancelled').map((order) => {
                      const status = ORDER_STATUS[order.status] || ORDER_STATUS.pending
                      const canPay = order.sender_id === userId && order.status === 'pending'
                      const isCarrierOrder = getOrderCarrierId(order) === userId
                      return (
                        <div key={order.id} style={{ padding: isMobile ? 16 : 18, borderRadius: isMobile ? 20 : 18, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: isMobile ? 12 : 16, alignItems: isMobile ? 'flex-start' : 'center' }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{order.description || 'Bokning'}</p>
                            <p style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.6 }}>{order.pickup_address} → {order.dropoff_address}</p>
                            {(() => {
                              const carrierId = getOrderCarrierId(order)
                              const carrierUser = (order as any)._carrier as { name?: string } | null
                              const carrierName = carrierUser?.name || (order as any).carrier_name || null
                              return carrierId && carrierId !== userId ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                                  <Shield size={11} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                                  <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Bärare:</span>
                                  <button onClick={() => setViewProfileUserId(carrierId)} style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.76rem', fontWeight: 600, color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                                    {carrierName || 'Visa profil'}
                                  </button>
                                </div>
                              ) : null
                            })()}
                            {isCarrierOrder && (
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                                {order.status === 'matched' && (
                                  <button onClick={() => handleOrderStatusUpdate(order.id, 'picked_up')} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(124,58,237,0.25)', background: 'rgba(124,58,237,0.08)', color: '#7c3aed', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                                    {updatingOrderId === order.id ? 'Sparar...' : 'Markera upphämtad'}
                                  </button>
                                )}
                                {order.status === 'picked_up' && (
                                  <button onClick={() => handleOrderStatusUpdate(order.id, 'in_transit')} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(20,184,166,0.25)', background: 'rgba(20,184,166,0.08)', color: '#0f766e', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                                    {updatingOrderId === order.id ? 'Sparar...' : 'Markera på väg'}
                                  </button>
                                )}
                                {order.status === 'in_transit' && (
                                  <button onClick={() => handleOrderStatusUpdate(order.id, 'delivered')} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(34,197,94,0.25)', background: 'rgba(34,197,94,0.08)', color: '#15803d', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                                    {updatingOrderId === order.id ? 'Sparar...' : 'Markera levererad'}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: 10, flexShrink: 0, width: isMobile ? '100%' : 'auto' }}>
                            <span style={{ padding: '5px 10px', borderRadius: 999, fontSize: '0.72rem', color: status.color, background: status.bg }}>{status.label}</span>
                            <strong style={{ color: 'var(--text)', fontSize: isMobile ? '1rem' : undefined }}>{order.price} kr</strong>
                            {canPay ? (
                              <button onClick={() => handlePay(order.id)} className="btn-primary" style={{ padding: '10px 14px', width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}>
                                {payingId === order.id ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Startar...</> : <><CreditCard size={13} /> Betala</>}
                              </button>
                            ) : order.status === 'delivered' && order.sender_id === userId ? (
                              <button
                                onClick={() => handleOrderStatusUpdate(order.id, 'confirmed')}
                                className="btn-primary"
                                style={{ padding: '10px 14px', background: '#15803d', borderColor: '#15803d', width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}
                              >
                                {updatingOrderId === order.id ? 'Sparar...' : 'Bekräfta leverans'}
                              </button>
                            ) : (
                              <Link href={`/spara/${order.id}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '10px 14px', borderRadius: 10, border: '1px solid #22c55e', color: '#22c55e', background: '#0a0a0a', fontWeight: 700, fontSize: '0.78rem', textDecoration: 'none', cursor: 'pointer', whiteSpace: 'nowrap', width: isMobile ? '100%' : 'auto' }}>
                                <MapPin size={12} /> Spåra
                              </Link>
                            )}
                            {['pending', 'matched'].includes(order.status) && !isCarrierOrder && (
                              <button
                                onClick={() => handleCancelOrder(order.id)}
                                disabled={cancellingOrderId === order.id}
                                style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 600, opacity: cancellingOrderId === order.id ? 0.6 : 1, width: isMobile ? '100%' : 'auto' }}
                              >
                                {cancellingOrderId === order.id ? 'Avbokar...' : 'Avboka'}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {orders.some(o => o.status === 'cancelled') && (
                      <button
                        onClick={() => setShowHistory(h => !h)}
                        style={{ padding: '10px 16px', borderRadius: 12, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600, textAlign: 'center' }}
                      >
                        {showHistory
                          ? 'Dölj historik'
                          : `Visa historik (${orders.filter(o => o.status === 'cancelled').length} avbrutna)`}
                      </button>
                    )}
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
                      subtitle="Som kund ska du se svarsläge direkt. Som förare ska du snabbt kunna sortera vad som är värt att acceptera."
                      meta={`${pendingIncoming} nya`}
                    />
                  </div>
                )}
                <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                  <SectionTitle title="Mina skickade förfrågningar" subtitle="Det här är den viktigaste kundvyn att bygga klart vidare på." />
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: 14 }}>
                    {[
                      { label: 'Skickade', value: myRequests.length },
                      { label: 'Accepterade', value: myRequests.filter(item => item.status === 'accepted').length },
                      { label: 'Väntar svar', value: myRequests.filter(item => item.status === 'pending').length },
                    ].map((item) => (
                      <div key={item.label} style={{ padding: 14, borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>{item.label}</p>
                        <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {myRequests.length === 0 ? (
                      <p style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Inga skickade förfrågningar än.</p>
                    ) : myRequests.map((item) => {
                      const status = BOOKING_STATUS[item.status] || BOOKING_STATUS.pending
                      const linkedOrder = orderByBookingRequestId.get(item.id) || (item.order_id ? orderById.get(item.order_id) : undefined) || orderById.get(item.id)
                      const canPayRequestOrder = linkedOrder?.sender_id === userId && linkedOrder.status === 'pending'
                      const fallbackPayOrderId = item.order_id || linkedOrder?.id || item.id
                      return (
                        <div key={item.id} style={{ padding: 16, borderRadius: isMobile ? 18 : 16, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                            <strong style={{ color: 'var(--text)', fontSize: '0.84rem' }}>{item.pickup_address} → {item.dropoff_address}</strong>
                            <span style={{ padding: '4px 8px', borderRadius: 999, fontSize: '0.68rem', color: status.color, background: status.bg }}>{status.label}</span>
                          </div>
                          <p style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>{item.description || 'Ingen extra beskrivning'}</p>
                          {item.trips && (
                            <p style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: 8 }}>
                              Rutt: {item.trips.from_city} {'\u2192'} {item.trips.to_city}
                            </p>
                          )}
                          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                            {canPayRequestOrder && (
                              <button onClick={() => handlePay(linkedOrder.id)} className="btn-primary" style={{ padding: '10px 14px', width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}>
                                {payingId === linkedOrder.id ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Startar...</> : <><CreditCard size={13} /> Betala nu</>}
                              </button>
                            )}
                            {!canPayRequestOrder && item.status === 'accepted' && fallbackPayOrderId && (
                              <button onClick={() => handlePay(fallbackPayOrderId)} className="btn-primary" style={{ padding: '10px 14px', width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}>
                                {payingId === fallbackPayOrderId ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Startar...</> : <><CreditCard size={13} /> Betala nu</>}
                              </button>
                            )}
                            {linkedOrder && linkedOrder.status !== 'pending' && (
                              <Link href={`/spara/${linkedOrder.id}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--accent)', color: '#0a0a0a', background: 'var(--accent)', fontWeight: 700, fontSize: '0.78rem', textDecoration: 'none', cursor: 'pointer', width: isMobile ? '100%' : 'auto' }}>
                                <MapPin size={12} /> Spåra order
                              </Link>
                            )}
                            {item.status === 'accepted' && !linkedOrder && (
                              <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>
                                Accepterad. Order synkas in för betalning.
                              </span>
                            )}
                            {item.status === 'pending' && (
                              <button
                                onClick={() => handleCancel(item.id)}
                                disabled={cancellingId === item.id}
                                style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600, opacity: cancellingId === item.id ? 0.6 : 1, width: isMobile ? '100%' : 'auto' }}
                              >
                                {cancellingId === item.id ? 'Avbryter...' : 'Avbryt förfrågan'}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                  <SectionTitle title="Inkommande till mina resor" subtitle="Här ska bärare kunna acceptera flera, men alltid med tydlig kapacitet." />
                  <div style={{ marginBottom: 14, padding: '14px 16px', borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0,1fr))', gap: 10 }}>
                      {[
                        { label: 'Inkommande', value: incoming.length },
                        { label: 'Nya', value: incoming.filter(item => item.status === 'pending').length },
                        { label: 'Accepterade', value: incoming.filter(item => item.status === 'accepted').length },
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
                      <p style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Inga inkommande förfrågningar ännu.</p>
                    ) : incoming.map((item) => {
                      const status = BOOKING_STATUS[item.status] || BOOKING_STATUS.pending
                      const pending = item.status === 'pending'
                      const senderInitials = item.sender_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?'
                      return (
                        <div key={item.id} style={{ padding: 16, borderRadius: isMobile ? 18 : 16, background: 'var(--surface-2)', border: `1px solid ${pending ? 'rgba(34,197,94,0.2)' : 'var(--border)'}` }}>
                          {/* Sender row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <button
                              onClick={() => item.sender_id && setViewProfileUserId(item.sender_id)}
                              disabled={!item.sender_id}
                              title="Se profil"
                              style={{
                                width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                                background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.08))',
                                border: '1.5px solid rgba(34,197,94,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.82rem', fontWeight: 800, color: '#15803d',
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
                          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border)', marginBottom: 10 }}>
                            <p style={{ fontSize: '0.76rem', color: 'var(--text)', fontWeight: 600, marginBottom: 3 }}>
                              {item.pickup_address} → {item.dropoff_address}
                            </p>
                            {item.description && <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: 0 }}>{item.description}</p>}
                            {item.weight_kg > 0 && <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: '3px 0 0' }}>{item.weight_kg} kg</p>}
                            {item.sender_phone && (
                              <a href={`tel:${item.sender_phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 5, fontSize: '0.72rem', color: '#15803d', textDecoration: 'none', fontWeight: 600 }}>
                                <Phone size={11} /> {item.sender_phone}
                              </a>
                            )}
                          </div>

                          {pending && (
                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8 }}>
                              <button onClick={() => handleRespond(item.id, 'accepted')} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)', color: '#15803d', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
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

            {activeTab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {isMobile && (
                  <MobileSectionIntro
                    eyebrow="Profil"
                    title="Spara allt en gång, använd överallt."
                    subtitle="Kontakt, roll och fordonsdata ska återanvändas i bokning, support, verifiering och payout utan att du fyller om något."
                    meta={`${completion}% klart`}
                  />
                )}
                <div style={{ ...panelStyle(true, isDark, isMobile), padding: isMobile ? 18 : 24, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', right: -70, top: -80, width: 220, height: 220, borderRadius: '50%', background: 'var(--enterprise-panel-glow)', pointerEvents: 'none' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.05fr 0.95fr', gap: 18, position: 'relative' }}>
                    <div>
                      <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 8 }}>Mina sidor</p>
                      <h2 style={{ fontSize: isMobile ? '1.2rem' : '1.45rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 8 }}>
                        Ett konto som återanvänder allt över hela flödet
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
                  <SectionTitle title="Profil och onboarding" subtitle="Fyll allt en gång här så ska resten av appen kunna återanvända uppgifterna." />
                  <div style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>Kontobas</p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.65 }}>
                      Kontaktuppgifter här ska återanvändas automatiskt i bokningar, supportärenden och statusuppdateringar.
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
                                border: `1px solid ${selected ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
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
                            border: `1px solid ${meta.role_intent === value ? 'rgba(34,197,94,0.38)' : 'var(--border)'}`,
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
                      <span>Biluppgifter kan återanvändas i `/kor`.</span>
                      <span>Lediga säten kan börja visas tydligare i framtida bokningsflöden.</span>
                      <span>Det blir mycket enklare att bygga kapacitetslogik per resa härnäst.</span>
                    </div>
                  </div>
                </div>
                </div>
              </div>
            )}

            {activeTab === 'carriers' && (
              <div style={{ ...panelStyle(false, isDark, isMobile), padding: 24 }}>
                <SectionTitle title="Utforska förare" subtitle="En inloggad premium-vy där användaren kan jämföra bärare på rating, aktivitet och kapacitet." />
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 18 }}>
                  {[
                    { label: 'Förare', value: carriers.length, hint: 'visas nu' },
                    { label: 'Verifierade', value: carriers.filter(c => c.bankidVerified).length, hint: 'kvalitet / tillit' },
                    { label: 'Snittrating', value: carriers.length ? (carriers.reduce((sum, c) => sum + c.rating, 0) / carriers.length).toFixed(1) : '0.0', hint: 'över katalogen' },
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
                        <div style={{ padding: '5px 10px', borderRadius: 999, background: carrier.bankidVerified ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.12)', color: carrier.bankidVerified ? '#15803d' : 'var(--muted)', fontSize: '0.68rem', fontWeight: 700 }}>
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
                        <button onClick={() => handleTabChange('orders')} style={{ border: 'none', background: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Utforska
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
    </div>
  )
}
