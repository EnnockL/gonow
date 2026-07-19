'use client'

import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Calendar, CheckCircle2, ChevronRight, Loader2, Mail,
  MapPin, Package, Phone, Route, Scale, Users, Zap, Shield, Clock,
} from 'lucide-react'
import AuthModal from '@/components/auth/AuthModal'
import AIChat from '@/components/booking/AIChat'
import TripBookingModal, { type TripInfo } from '@/components/booking/TripBookingModal'
import EnterpriseSendForm from '@/components/booking/EnterpriseSendForm'
import EnterpriseSendReview from '@/components/booking/EnterpriseSendReview'
import TravelerCard from '@/components/booking/TravelerCard'
import AIMatchBanner from '@/components/booking/AIMatchBanner'
import CarrierProfileModal from '@/components/carrier/CarrierProfileModal'
import { useAuth } from '@/hooks/useAuth'
import { useRoutePrice } from '@/lib/hooks/useRoutePrice'
import { loadAllBookings, saveBooking, type BookingRequest } from '@/lib/bookings'
import { savePendingBookingDraft } from '@/lib/pending-booking'
import { authedFetch } from '@/lib/auth/authed-fetch'
import { getMyTripBooking, getTripCapacitySnapshot } from '@/lib/trip-capacity'
import { AIParseResult, ContactInfo, Trip } from '@/lib/types'
import type { AIMatchResult } from '@/lib/ai/types'
import { loadTrips, type SavedTrip } from '@/components/driver/MyTrips'
import { loadSharedActiveTrips, localTripToActiveTrip, type ActiveTripRecord } from '@/lib/active-trips'

type Step = 'chat' | 'review' | 'matches' | 'submitting' | 'confirmed'
type MatchTrip = ActiveTripRecord & {
  users?: { name: string; rating_avg: number; rating_count: number }
}
type CreatedPackage = {
  id: string
  from_city: string
  to_city: string
  status: string
  description?: string | null
  weight_kg?: number | null
  price_ceiling?: number | null
  matched_trip_id?: string | null
  matched_carrier_id?: string | null
}
type CreatedPackageMatch = {
  id: string
  status: string
  driver_id?: string | null
  trip_id?: string | null
  proposed_price?: number | null
  drivers?: { id?: string; name?: string | null; rating_avg?: number | null } | null
}
type CreatedOrder = {
  id: string
  status: string
  price?: number | null
  metadata?: Record<string, unknown> | null
}

function isAwaitingPackagePayment(order?: CreatedOrder | null) {
  return order?.status === 'pending' || order?.status === 'matched'
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '9px 11px',
  fontSize: '0.82rem',
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
}

function toBookingServiceType(type: AIParseResult['type']) {
  if (type === 'lift') return 'passenger'
  if (type === 'return') return 'return'
  return 'package'
}

function normalize(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function localTripMatches(trip: SavedTrip, fromCity: string, toCity: string, departureDate?: string | null) {
  const from = normalize(fromCity)
  const to = normalize(toCity)
  const sameRoute = normalize(trip.from_city).includes(from) && normalize(trip.to_city).includes(to)
  if (!sameRoute) return false
  if (departureDate) return trip.departure_at.startsWith(departureDate)
  return new Date(trip.departure_at).getTime() >= Date.now()
}

function localTripToMatchTrip(trip: SavedTrip): MatchTrip {
  return localTripToActiveTrip(trip)
}

function estimateTripPrice(trip: MatchTrip, routePriceOverride?: number) {
  if (routePriceOverride && routePriceOverride > 0) return routePriceOverride
  return trip.price_per_kg ? Math.max(149, Math.round(99 + trip.price_per_kg * 5)) : 149
}

function getPackageIdFromOrderMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return null
  const value = (metadata as Record<string, unknown>).package_id
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function keepSearchFormVisible(target: HTMLElement) {
  if (typeof window === 'undefined') return
  if (!window.matchMedia('(max-width: 820px)').matches) return

  const form = target.closest('.sk-route-form') as HTMLElement | null
  const formSection = target.closest('.sk-simple-left') as HTMLElement | null
  const anchor = formSection ?? form ?? target

  const keepVisible = () => {
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight
    const rect = target.getBoundingClientRect()
    const topOffset = 108
    const bottomOffset = 92
    if (rect.top < topOffset || rect.bottom > viewportHeight - bottomOffset) {
      const anchorRect = anchor.getBoundingClientRect()
      const targetTop = Math.max(0, window.scrollY + anchorRect.top - topOffset)
      window.scrollTo({ top: targetTop, behavior: 'smooth' })
    }
  }

  window.setTimeout(keepVisible, 120)
  window.setTimeout(() => {
    keepVisible()
  }, 320)
}

function getTripMeta(trip: MatchTrip, bookings: BookingRequest[], userId?: string | null) {
  const tripBookings = bookings.filter((booking) => booking.trip_id === trip.id)
  const snapshot = getTripCapacitySnapshot(trip, tripBookings)
  const myBooking = getMyTripBooking(tripBookings, userId)

  return {
    ...snapshot,
    myBookingStatus: myBooking?.status ?? null,
  }
}

function toTripInfo(trip: MatchTrip, bookings: BookingRequest[], userId?: string | null, routePriceOverride?: number): TripInfo {
  const meta = getTripMeta(trip, bookings, userId)
  return {
    id: trip.id,
    from: trip.from_city,
    to: trip.to_city,
    carrier: trip.users?.name || 'Bärare',
    carrier_id: trip.carrier_id,
    price: estimateTripPrice(trip, routePriceOverride),
    pricePerKg: trip.price_per_kg ?? undefined,
    pricePerSeat: trip.price_per_seat ?? undefined,
    vehicleType: trip.vehicle_type,
    vehicleMake: trip.vehicle_make,
    vehicleModel: trip.vehicle_model,
    vehicleColor: trip.vehicle_color,
    vehiclePlate: trip.vehicle_plate,
    vehicleSeatsTotal: trip.vehicle_seats_total,
    acceptedPassengers: meta.acceptedPassengers,
    acceptedPackages: meta.acceptedPackages,
    seatsLeft: meta.seatsLeft,
    weightLeftKg: meta.weightLeftKg,
    myBookingStatus: meta.myBookingStatus,
  }
}


const POPULAR_ROUTES = [
  { from: 'Stockholm', to: 'Göteborg',  price: '149 kr', time: '~3h'     },
  { from: 'Malmö',     to: 'Stockholm', price: '219 kr', time: '~4.5h'   },
  { from: 'Uppsala',   to: 'Stockholm', price: '89 kr',  time: '~45 min' },
  { from: 'Göteborg',  to: 'Malmö',     price: '129 kr', time: '~3h'     },
]

const STEPS = [
  { key: 'chat',       label: 'Ditt paket',       desc: 'Information' },
  { key: 'review',     label: 'Granska',          desc: 'Kontrollera allt' },
  { key: 'submitting', label: 'Boka',               desc: 'Bekräfta bokningen' },
  { key: 'confirmed',  label: 'Klart',             desc: 'Följ paketet' },
] as const

const LIFT_STEPS = [
  { key: 'chat', label: 'Sök resa', desc: 'Rutt, datum och resenärer' },
  { key: 'matches', label: 'Välj transport', desc: 'Jämför passande resor' },
  { key: 'submitting', label: 'Bekräfta bokning', desc: 'Gonow skickar bokningen' },
  { key: 'confirmed', label: 'Klart', desc: 'Gonow följer upp resan' },
] as const

const SEND_JOURNEY_KEY = 'gonow_send_journey_v1'

export function SkickaPageContent({ onClose }: { onClose?: () => void } = {}) {
  const { userId, profile, loading: authLoading } = useAuth()
  const [step, setStep]                   = useState<Step>('chat')
  const [parsed, setParsed]               = useState<AIParseResult | null>(null)
  const [activeTrips, setActiveTrips]     = useState<MatchTrip[]>([])
  const [activeTripModal, setActiveTripModal] = useState<TripInfo | null>(null)
  const [activeTripModalMode, setActiveTripModalMode] = useState<'driver' | 'package'>('driver')
  const [trips, setTrips]                 = useState<MatchTrip[]>([])
  const [selectedTrip, setSelectedTrip]   = useState<MatchTrip | null>(null)
  const [bookings, setBookings]           = useState<BookingRequest[]>([])
  const [loading, setLoading]             = useState(false)
  const [showAuth, setShowAuth]           = useState(false)
  const [submitError, setSubmitError]     = useState<string | null>(null)
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null)
  const [createdPackageId, setCreatedPackageId] = useState<string | null>(null)
  const [createdPackage, setCreatedPackage] = useState<CreatedPackage | null>(null)
  const [createdPackageMatches, setCreatedPackageMatches] = useState<CreatedPackageMatch[]>([])
  const [createdPackageOrder, setCreatedPackageOrder] = useState<CreatedOrder | null>(null)
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null)
  const [viewProfileCarrierId, setViewProfileCarrierId] = useState<string | null>(null)
  const [aiMatch, setAiMatch] = useState<AIMatchResult | null>(null)
  const { result: routePrice, calculate } = useRoutePrice()

  // Tab mode — derived directly from URL, always in sync
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabMode = searchParams.get('tab') === 'lift' ? 'lift' : 'skicka'
  const presetTripId = searchParams.get('trip_id')
  const startInAiMode = searchParams.get('mode') === 'ai'
  const journeyStage = searchParams.get('stage')
  const journeyPackageId = searchParams.get('package_id')

  function switchTab(tab: 'skicka' | 'lift') {
    setAiMode(false)
    setPackageStage('intro')
    router.replace(tab === 'lift' ? '/skicka?tab=lift' : '/skicka', { scroll: false })
  }

  // Pre-select trip when coming from /resor with ?trip_id=
  useEffect(() => {
    if (!presetTripId) return
    fetch(`/api/trips?status=active`)
      .then(r => r.json())
      .then((data: { trips?: MatchTrip[] }) => {
        const trip = data.trips?.find((t: MatchTrip) => t.id === presetTripId)
        if (trip) jumpToTripMatches(trip)
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetTripId])

  // Simple form state (default Uber-like view)
  const [aiMode, setAiMode]       = useState(startInAiMode)
  const [packageStage, setPackageStage] = useState<'intro' | 'form'>('intro')
  const [showPackageModal, setShowPackageModal] = useState(false)
  const [simpleFrom, setSimpleFrom] = useState('')
  const [simpleTo, setSimpleTo]     = useState('')
  const [simpleWeight, setSimpleWeight] = useState(2)

  // Lift form state
  const [liftFrom, setLiftFrom]         = useState('')
  const [liftTo, setLiftTo]             = useState('')
  const [liftDate, setLiftDate]         = useState('')
  const [liftPassengers, setLiftPassengers] = useState(1)
  const [isMobile, setIsMobile]         = useState(false)
  const [mobileLiveTab, setMobileLiveTab] = useState(false)

  const [sender, setSender]       = useState<ContactInfo>({ name: '', phone: '', email: '' })
  const [recipient, setRecipient] = useState<ContactInfo>({ name: '', phone: '', email: '' })
  const [packageRequestId, setPackageRequestId] = useState(() => crypto.randomUUID())
  const [packageType, setPackageType] = useState<'package' | 'large' | 'pallet' | 'document'>('package')

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    setAiMode(tabMode === 'skicka' && startInAiMode)
  }, [startInAiMode, tabMode])

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SEND_JOURNEY_KEY) || 'null') as {
        parsed?: AIParseResult; sender?: ContactInfo; recipient?: ContactInfo; packageType?: 'package' | 'large' | 'pallet' | 'document'
      } | null
      if (saved?.parsed) setParsed(saved.parsed)
      if (saved?.sender) setSender(saved.sender)
      if (saved?.recipient) setRecipient(saved.recipient)
      if (saved?.packageType) setPackageType(saved.packageType)
      if (journeyStage === 'review' && saved?.parsed) setStep('review')
      if (journeyStage === 'confirmed' && journeyPackageId) {
        setCreatedPackageId(journeyPackageId)
        setStep('confirmed')
      }
      if (!journeyStage && !journeyPackageId) setStep('chat')
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyStage, journeyPackageId])

  useEffect(() => {
    if (!parsed) return
    sessionStorage.setItem(SEND_JOURNEY_KEY, JSON.stringify({ parsed, sender, recipient, packageType }))
  }, [parsed, sender, recipient, packageType])

  useEffect(() => {
    if (tabMode !== 'skicka') {
      setPackageStage('form')
      return
    }
    if (aiMode) return
    setPackageStage('intro')
  }, [aiMode, tabMode])

  useEffect(() => {
    if (!aiMode || tabMode !== 'skicka' || step !== 'chat') return
    const previousRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    const centerAiWorkspace = () => window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    centerAiWorkspace()
    const frame = window.requestAnimationFrame(centerAiWorkspace)
    const timer = window.setTimeout(centerAiWorkspace, 120)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      window.history.scrollRestoration = previousRestoration
    }
  }, [aiMode, tabMode, step])

  // Lock body scroll while package modal is open
  useEffect(() => {
    if (showPackageModal) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [showPackageModal])

  useEffect(() => {
    if (!profile) return
    setSender(c => ({
      name:  c.name  || profile.name  || '',
      phone: c.phone || profile.phone || '',
      email: c.email || profile.email || '',
    }))
  }, [profile])

  useEffect(() => {
    async function loadActiveTrips() {
      const merged = await loadSharedActiveTrips({ packagesOnly: true, limit: 6 })
      setActiveTrips(merged)
    }
    loadActiveTrips()
    window.addEventListener('gonow_trips_updated', loadActiveTrips)
    return () => window.removeEventListener('gonow_trips_updated', loadActiveTrips)
  }, [])

  useEffect(() => {
    async function refreshBookings() {
      const next = await loadAllBookings().catch(() => [])
      setBookings(next)
    }

    refreshBookings()
    window.addEventListener('gonow_booking_received', refreshBookings)
    return () => window.removeEventListener('gonow_booking_received', refreshBookings)
  }, [])

  useEffect(() => {
    if (step !== 'confirmed') return

    if (createdPackageId) {
      const refreshPackageJourney = async () => {
        try {
          const [pkgRes, matchesRes, ordersRes] = await Promise.all([
            authedFetch(`/api/packages/${createdPackageId}`),
            authedFetch(`/api/matches?package_id=${createdPackageId}`),
            authedFetch('/api/orders'),
          ])

          const pkgData = await pkgRes.json().catch(() => ({}))
          const matchesData = await matchesRes.json().catch(() => ({}))
          const ordersData = await ordersRes.json().catch(() => ({}))

          if (pkgRes.ok && pkgData.package) {
            setCreatedPackage(pkgData.package as CreatedPackage)
          }

          if (matchesRes.ok && Array.isArray(matchesData.matches)) {
            setCreatedPackageMatches(matchesData.matches as CreatedPackageMatch[])
          }

          if (ordersRes.ok && Array.isArray(ordersData.orders)) {
            const linkedOrder = (ordersData.orders as CreatedOrder[]).find(
              (order) => getPackageIdFromOrderMetadata(order.metadata) === createdPackageId
            ) ?? null
            setCreatedPackageOrder(linkedOrder)
          }
        } catch {
          // keep optimistic state if refresh fails
        }
      }

      refreshPackageJourney()
      const id = window.setInterval(refreshPackageJourney, 4000)
      return () => window.clearInterval(id)
    }

    if (!createdBookingId) return

    const id = window.setInterval(async () => {
      const next = await loadAllBookings().catch(() => [])
      setBookings(next)
    }, 4000)

    return () => window.clearInterval(id)
  }, [step, createdBookingId, createdPackageId])

  // A completed booking is terminal. Browser Back must not reopen a form that
  // could submit the same shipment again; users leave via Status or Mina paket.
  useEffect(() => {
    if (step !== 'confirmed' || !createdPackageId) return

    const confirmedUrl = `/skicka?stage=confirmed&package_id=${createdPackageId}`
    const keepCompletedBookingLocked = () => {
      window.history.pushState({ gonowCompletedBooking: createdPackageId }, '', confirmedUrl)
      setStep('confirmed')
      router.replace(confirmedUrl, { scroll: false })
    }

    window.addEventListener('popstate', keepCompletedBookingLocked)
    return () => window.removeEventListener('popstate', keepCompletedBookingLocked)
  }, [step, createdPackageId, router])

  const activeTripMeta = useMemo(() => {
    return Object.fromEntries(activeTrips.map((trip) => [trip.id, getTripMeta(trip, bookings, userId)]))
  }, [activeTrips, bookings, userId])

  const tripMeta = useMemo(() => {
    return Object.fromEntries(trips.map((trip) => [trip.id, getTripMeta(trip, bookings, userId)]))
  }, [trips, bookings, userId])

  const allKnownTrips = useMemo(() => {
    return [...activeTrips, ...trips.filter((trip) => !activeTrips.some((active) => active.id === trip.id))]
  }, [activeTrips, trips])

  const selectedTripStatus = selectedTrip ? tripMeta[selectedTrip.id]?.myBookingStatus ?? null : null
  const selectedTripVehicle = selectedTrip
    ? [selectedTrip.vehicle_make, selectedTrip.vehicle_model].filter(Boolean).join(' ')
    : ''

  const createdBooking = useMemo(
    () => (createdBookingId ? bookings.find((booking) => booking.id === createdBookingId) ?? null : null),
    [bookings, createdBookingId]
  )

  const createdBookingTrip = useMemo(
    () => (createdBooking ? allKnownTrips.find((trip) => trip.id === createdBooking.trip_id) ?? selectedTrip ?? null : selectedTrip ?? null),
    [allKnownTrips, createdBooking, selectedTrip]
  )

  const createdBookingMeta = useMemo(
    () => (createdBookingTrip ? getTripMeta(createdBookingTrip, bookings, userId) : null),
    [createdBookingTrip, bookings, userId]
  )

  const createdBookingStatus = createdBooking?.status ?? null
  const createdPackageStatus = createdPackage?.status ?? null
  const createdPackageMatch = useMemo(() => {
    if (createdPackageMatches.length === 0) return null
    return createdPackageMatches.find((match) => match.status === 'matched')
      ?? createdPackageMatches.find((match) => match.status === 'driver_pending_confirmation')
      ?? createdPackageMatches[0]
      ?? null
  }, [createdPackageMatches])

  const isPassengerFlow = parsed?.type === 'lift'
  const contactValid =
    sender.name.trim().length >= 2 && sender.phone.trim().length >= 7 &&
    (isPassengerFlow || (recipient.name.trim().length >= 2 && recipient.phone.trim().length >= 7))

  async function handleParsed(result: AIParseResult) {
    result = {
      ...result,
      description: result.description?.trim() || 'Paket via Gonow',
    }
    setParsed(result)
    setSubmitError(null)
    setAiMatch(null)
    if (result.confidence < 0.5) return

    if (result.type === 'package' || result.type === 'pickup' || result.type === 'return') {
      setSimpleFrom(result.from_city)
      setSimpleTo(result.to_city)
      setSimpleWeight(result.weight_kg || 1)
      await calculate(result.from_city, result.to_city, result.weight_kg || 1, result.urgency)
      setStep('review')
      router.push('/skicka?stage=review', { scroll: false })
      return
    }

    // Passenger/lift: customer browses matching trips in Resor-style list
    setLoading(true)
    try {
      const [matchRes] = await Promise.all([
        fetch('/api/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from_city: result.from_city, to_city: result.to_city,
            departure_date: result.departure_date || new Date().toISOString().split('T')[0],
            weight_kg: result.weight_kg || 1, type: result.type,
          }),
        }),
        calculate(result.from_city, result.to_city, result.weight_kg || 1, result.urgency),
      ])
      const data = await matchRes.json()
      const serverTrips = (data.trips || []) as MatchTrip[]
      const localTrips  = loadTrips()
        .filter(t => t.allows_packages && localTripMatches(t, result.from_city, result.to_city, result.departure_date))
        .map(localTripToMatchTrip)
      const unsyncedLocalTrips = localTrips.filter(t => !serverTrips.some(serverTrip => serverTrip.id === t.id))
      const merged = [...serverTrips, ...unsyncedLocalTrips]
      setTrips(merged)
      setSelectedTrip(null)
      setStep('matches')

      if (merged.length > 0) {
        fetch('/api/ai/match-trips', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trips:  merged.map(t => ({
              id:                  t.id,
              users:               t.users ?? null,
              departure_at:        t.departure_at ?? null,
              weight_capacity_kg:  t.weight_capacity_kg ?? null,
            })),
            parsed: {
              from_city:       result.from_city,
              to_city:         result.to_city,
              weight_kg:       result.weight_kg,
              departure_date:  result.departure_date,
            },
          }),
        })
          .then(r => r.ok ? r.json() : null)
          .then((match: AIMatchResult | null) => { if (match?.bestTripId) setAiMatch(match) })
          .catch(() => {})
      }
    } catch {
      setTrips([])
      setStep('matches')
    }
    setLoading(false)
  }

  async function handlePublishPackage() {
    if (!parsed || parsed.type === 'lift' || authLoading) return
    setSubmitError(null)
    const price = routePrice?.price || parsed.estimated_price_sek
    const bookingDescription = [parsed.description || 'Paket via Gonow', parsed.special_requirements ? `Instruktion: ${parsed.special_requirements}` : null].filter(Boolean).join(' · ').slice(0, 500)
    const draft = {
      request_id: packageRequestId,
      service_type: parsed.type === 'return' ? 'return' as const : 'package' as const,
      package_type: packageType,
      weight_kg: parsed.weight_kg || 1,
      description: bookingDescription,
      pickup_address: parsed.from_city,
      dropoff_address: parsed.to_city,
      sender_name: sender.name,
      sender_phone: sender.phone,
      sender_email: sender.email,
      recipient_name: recipient.name,
      recipient_phone: recipient.phone,
      recipient_email: recipient.email,
      status: 'pending' as const,
      price_est: price,
    }
    if (!userId) {
      savePendingBookingDraft(draft)
      setShowAuth(true)
      return
    }
    setStep('submitting')
    try {
      const res = await authedFetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': packageRequestId },
        body: JSON.stringify({
          service_type: draft.service_type,
          package_type: packageType,
          from_city: parsed.from_city,
          from_address: parsed.from_city,
          to_city: parsed.to_city,
          to_address: parsed.to_city,
          description: draft.description,
          weight_kg: draft.weight_kg,
          price_ceiling: price,
          deadline: parsed.urgency,
          receiver_name: recipient.name,
          receiver_phone: recipient.phone,
        }),
      })
      const data = await res.json().catch(() => ({})) as { package?: CreatedPackage; error?: string }
      if (!res.ok || !data.package) throw new Error(data.error || 'Kunde inte boka pakettransporten.')
      setCreatedBookingId(null)
      setCreatedPackageId(data.package.id)
      setCreatedPackage(data.package)
      setCreatedPackageMatches([])
      setCreatedPackageOrder(null)
      setStep('confirmed')
      router.replace(`/skicka?stage=confirmed&package_id=${data.package.id}`, { scroll: false })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Kunde inte boka pakettransporten.')
      setStep('review')
    }
  }

  function openTripFromActive(trip: MatchTrip) {
    setActiveTripModalMode('driver')
    setActiveTripModal(toTripInfo(trip, bookings, userId, routePrice?.price))
  }

  function openGenericPackageModal() {
    setActiveTripModalMode('package')
    setActiveTripModal({
      id: 'generic-package',
      from: simpleFrom.trim() || parsed?.from_city || 'Upphämtning',
      to: simpleTo.trim() || parsed?.to_city || 'Leverans',
      carrier: 'Gonow',
      price: routePrice?.price || parsed?.estimated_price_sek || 149,
      pricePerKg: 8,
    })
  }

  function jumpToTripMatches(trip: MatchTrip) {
    setParsed({
      type: 'package', from_city: trip.from_city, to_city: trip.to_city,
      description: 'Paket', weight_kg: 1,
      departure_date: trip.departure_at ? trip.departure_at.split('T')[0] : null,
      urgency: 'flexible', store_name: null, order_reference: null, passengers: null,
      special_requirements: null, estimated_price_sek: estimateTripPrice(trip), confidence: 1,
    })
    setTrips([trip])
    setSelectedTrip(trip)
    setStep('matches')
  }

  function handleSimpleSearch() {
    if (!simpleFrom.trim() || !simpleTo.trim()) return
    handleParsed({
      type: 'package',
      from_city: simpleFrom.trim(),
      to_city: simpleTo.trim(),
      description: 'Paket',
      weight_kg: simpleWeight,
      departure_date: null,
      urgency: 'flexible',
      store_name: null,
      order_reference: null,
      passengers: null,
      special_requirements: null,
      estimated_price_sek: 149,
      confidence: 0.9,
    })
  }

  function handleLiftSearch() {
    if (!liftFrom.trim() || !liftTo.trim()) return
    handleParsed({
      type: 'lift',
      from_city: liftFrom.trim(),
      to_city: liftTo.trim(),
      description: `Lift · ${liftPassengers} passagerare`,
      weight_kg: 0,
      departure_date: liftDate || null,
      urgency: 'flexible',
      store_name: null,
      order_reference: null,
      passengers: liftPassengers,
      special_requirements: null,
      estimated_price_sek: 149,
      confidence: 0.9,
    })
  }

  async function handleSubmitBooking() {
    if (!selectedTrip || !parsed || authLoading) return
    setSubmitError(null)
    if (!userId) { setShowAuth(true); return }
    setStep('submitting')

    // Trip-selected package flow → packages + package_matches system
    if (parsed.type !== 'lift') {
      try {
        const price = routePrice?.price || parsed.estimated_price_sek || 149
        const res = await authedFetch('/api/packages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': packageRequestId },
          body: JSON.stringify({
            from_city: parsed.from_city,
            from_address: parsed.from_city,
            to_city: parsed.to_city,
            to_address: parsed.to_city,
            description: parsed.description || 'Paket',
            weight_kg: parsed.weight_kg || 1,
            price_ceiling: price,
            trip_id: presetTripId || selectedTrip.id,
            service_type: 'package',
            package_type: packageType,
            receiver_name: recipient.name,
            receiver_phone: recipient.phone,
          }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          setSubmitError((d as { error?: string }).error || 'Kunde inte skicka förfrågan. Försök igen.')
          setStep('matches')
          return
        }
        const data = await res.json() as { package?: CreatedPackage }
        setCreatedBookingId(null)
        setCreatedPackageId(data.package?.id ?? null)
        setCreatedPackage(data.package ?? null)
        setCreatedPackageMatches([])
        setCreatedPackageOrder(null)
        setStep('confirmed')
        if (data.package?.id) {
          router.replace(`/skicka?stage=confirmed&package_id=${data.package.id}`, { scroll: false })
        }
      } catch {
        setSubmitError('Nätverksfel, försök igen.')
        setStep('matches')
      }
      return
    }

    // Original flow: booking_request via saveBooking
    try {
      const booking = await saveBooking({
        trip_id: selectedTrip.id, sender_id: userId,
        service_type: toBookingServiceType(parsed.type),
        seats_requested: parsed.type === 'lift' ? Math.max(1, parsed.passengers || 1) : undefined,
        weight_kg: parsed.type === 'lift' ? 0 : (parsed.weight_kg || 1),
        description: parsed.description || 'Paket',
        pickup_address: parsed.from_city, dropoff_address: parsed.to_city,
        sender_name: sender.name, sender_phone: sender.phone, sender_email: sender.email,
        recipient_name: parsed.type === 'lift' ? sender.name : recipient.name,
        recipient_phone: parsed.type === 'lift' ? sender.phone : recipient.phone,
        recipient_email: parsed.type === 'lift' ? sender.email : recipient.email,
        status: 'pending',
        price_est: routePrice ? routePrice.price : parsed.estimated_price_sek,
      })
      setCreatedPackageId(null)
      setCreatedPackage(null)
      setCreatedPackageMatches([])
      setCreatedPackageOrder(null)
      setCreatedBookingId(booking.id)
      setStep('confirmed')
    } catch (err) {
      const msg = err instanceof Error && err.message.toLowerCase().includes('timeout')
        ? 'Anslutningen tog för lång tid. Kontrollera din uppkoppling och försök igen.'
        : 'Kunde inte skicka bokningsförfrågan just nu. Försök igen.'
      setSubmitError(msg)
      setStep('matches')
    }
  }

  async function handleCheckout(orderId: string) {
    setPayingOrderId(orderId)
    setSubmitError(null)
    try {
        const res = await authedFetch(`/api/orders/${orderId}/checkout`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Betalningen kunde inte genomföras. Inga pengar har dragits.')
      if (data.url) {
        window.location.href = data.url
        return
      }
      throw new Error('Ingen checkout-länk kunde skapas.')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Betalningen kunde inte genomföras. Inga pengar har dragits.')
      setPayingOrderId(null)
    }
  }

  const activeSteps = tabMode === 'lift' ? LIFT_STEPS : STEPS
  const stepIdx = activeSteps.findIndex(s => s.key === step)

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div className="sk-shell" style={onClose ? { paddingTop: 0, minHeight: 'auto' } : undefined}>
      <div className="sk-parallax-bg" aria-hidden="true" />
      <div className="sk-glow-l" />
      <div className="sk-glow-r" />

      {showAuth && (
        <AuthModal
          reason="Du behöver ett konto för att skicka en bokningsförfrågan"
          defaultTab="login"
          onClose={() => setShowAuth(false)}
          onSuccess={() => setShowAuth(false)}
        />
      )}
      {activeTripModal && (
        <TripBookingModal
          trip={activeTripModal}
          onClose={() => {
            setActiveTripModal(null)
            setActiveTripModalMode('driver')
          }}
          initialType="package"
          lockType={true}
          entryMode={activeTripModalMode}
          createWithoutTrip={activeTripModalMode === 'package'}
        />
      )}
      {showPackageModal && (
        <TripBookingModal
          trip={{ id: 'gonow-package', from: simpleFrom || 'Sverige', to: simpleTo || 'Sverige', carrier: 'Gonow', price: 0 }}
          onClose={() => setShowPackageModal(false)}
          initialType="package"
          lockType={true}
          entryMode="package"
          createWithoutTrip={true}
          onSwitchToAI={() => setShowPackageModal(false)}
        />
      )}
      <CarrierProfileModal
        carrierId={viewProfileCarrierId}
        onClose={() => setViewProfileCarrierId(null)}
      />

      <div className={`sk-wrap ${(step === 'chat' && tabMode === 'skicka') || step === 'review' ? 'sk-wrap-enterprise' : ''}`}>

        {onClose && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button
              onClick={onClose}
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '8px 16px',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--muted)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ✕ Stäng
            </button>
          </div>
        )}

        {/* ── PROGRESS STEPPER ────────────────────────────────── */}
        {!((step === 'chat' && tabMode === 'skicka') || step === 'review') && <div className="sk-stepper">
          {activeSteps.map((s, i) => (
            <React.Fragment key={s.key}>
              <div className={`sk-step ${i === stepIdx ? 'sk-step-active' : ''} ${i < stepIdx ? 'sk-step-done' : ''}`}>
                <div className="sk-step-num">
                  {i < stepIdx ? '✓' : `0${i + 1}`}
                </div>
                <div className="sk-step-text">
                  <p className="sk-step-title">
                    {s.key === 'matches' && tabMode === 'lift' ? 'V\u00e4lj transport' : s.label}
                  </p>
                  <p className="sk-step-desc">{s.desc}</p>
                </div>
                <div className="sk-step-mobile-copy">
                  <div className="sk-step-mobile-label">
                    {s.key === 'matches' && tabMode === 'lift' ? 'V\u00e4lj transport' : s.label}
                  </div>
                  <div className="sk-step-mobile-desc">{s.desc}</div>
                </div>
              </div>
              {i < activeSteps.length - 1 && (
                <div className={`sk-step-line ${i < stepIdx ? 'sk-step-line-done' : ''}`} />
              )}
            </React.Fragment>
          ))}
        </div>}

        {/* ══ STEP: CHAT ══════════════════════════════════════════════════════ */}
        {step === 'chat' && tabMode === 'skicka' && !aiMode && (
          <EnterpriseSendForm requestId={packageRequestId} sender={sender} recipient={recipient} onContinue={(draft) => {
            const parsedDraft: AIParseResult = {
              type: draft.service_type === 'return' ? 'return' : 'package',
              from_city: draft.pickup_address,
              to_city: draft.dropoff_address,
              weight_kg: draft.weight_kg,
              description: draft.description,
              departure_date: null,
              confidence: 1,
              estimated_price_sek: draft.price_est ?? 0,
              urgency: draft.deadline ?? 'flexible',
              store_name: null,
              order_reference: null,
              passengers: null,
              special_requirements: draft.special_requirements ?? null,
            }
            setPackageType(draft.package_type === 'large' || draft.package_type === 'pallet' || draft.package_type === 'document' ? draft.package_type : 'package')
            setSender({ name: draft.sender_name, phone: draft.sender_phone, email: draft.sender_email })
            setRecipient({ name: draft.recipient_name, phone: draft.recipient_phone, email: draft.recipient_email })
            sessionStorage.setItem(SEND_JOURNEY_KEY, JSON.stringify({
              parsed: parsedDraft,
              sender: { name: draft.sender_name, phone: draft.sender_phone, email: draft.sender_email },
              recipient: { name: draft.recipient_name, phone: draft.recipient_phone, email: draft.recipient_email },
              packageType: draft.package_type,
            }))
            handleParsed(parsedDraft)
          }} onAI={() => { setAiMode(true); router.replace('/skicka?mode=ai', { scroll: false }) }} />
        )}

        {step === 'chat' && (tabMode !== 'skicka' || aiMode) && (
          <div className="sk-chat-grid">

            {/* ── Simple/AI card (area: ai) ── */}
            <div className="sk-card sk-ai-card sk-area-ai" style={{ position: 'relative' }}>
              {tabMode === 'skicka' && (
                <>
                  <div className="sk-ai-enterprise-bar"><div><span>GONOW SHIPPING</span><i/><strong>Ny sändning</strong></div><div><span>SE · SEK</span><b>LIVE</b></div></div>
                  <div className="sk-ai-progress">
                    {[
                      ['1', 'Ditt paket', 'Information'], ['2', 'Granska', 'Kontrollera allt'],
                      ['3', 'Boka', 'Bekräfta bokningen'], ['4', 'Klart', 'Följ paketet'],
                    ].map(([number, title, description], index) => (
                      <div className={index === 0 ? 'active' : ''} key={number}>
                        <b>{number}</b><span><strong>{title}</strong><small>{description}</small></span>{index < 3 && <i/>}
                      </div>
                    ))}
                    <button type="button" onClick={() => { setAiMode(false); router.replace('/skicka', { scroll: false }) }}>Steg för steg</button>
                  </div>
                </>
              )}


              {tabMode === 'lift' && !aiMode ? (
                <div style={{ padding: isMobile ? '14px 16px' : '22px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--gn-015)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Users size={14} style={{ color: 'var(--gn)' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gn)', margin: 0 }}>Direktresor</p>
                      <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', margin: 0 }}>Sök och boka lift med Gonow</p>
                    </div>
                  </div>
                  <AIChat onParsed={handleParsed} />
                </div>
              ) : (
                <div style={{ padding: isMobile ? '14px 16px' : '22px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: 12, flexDirection: isMobile ? 'column' : 'row' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--gn-015)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Zap size={14} style={{ color: 'var(--gn)' }} />
                      </div>
                      <div>
                        <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gn)', margin: 0 }}>Snabb bokning</p>
                        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', margin: 0 }}>Beskriv paketet – Gonow tar hand om resten</p>
                      </div>
                    </div>
                  </div>
                  <AIChat
                    onParsed={handleParsed}
                    sender={sender}
                    recipient={recipient}
                    onSenderChange={setSender}
                    onRecipientChange={setRecipient}
                    onNewPackage={() => {
                      setParsed(null)
                      setRecipient({ name: '', phone: '', email: '' })
                      setSimpleFrom('')
                      setSimpleTo('')
                      setSimpleWeight(2)
                      setSubmitError(null)
                      setPackageRequestId(crypto.randomUUID())
                      sessionStorage.removeItem(SEND_JOURNEY_KEY)
                      sessionStorage.removeItem('gonow_send_form_v1')
                      router.replace('/skicka?mode=ai', { scroll: false })
                    }}
                  />
                  {loading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>
                      <Loader2 size={13} style={{ animation: 'sk-spin 1s linear infinite', color: 'var(--gn)' }} />
                      Söker transport längs din rutt...
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Info row — 3 cards side by side ── */}
            <aside className={`sk-sidebar ${tabMode === 'skicka' ? 'sk-sidebar-hidden' : ''}`}>
              {tabMode === 'lift' ? (<>
                {/* Lift sidebar: popular routes */}
                <div className="sk-aside-card">
                  <p className="sk-aside-title">Populära rutter</p>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {POPULAR_ROUTES.map(r => (
                      <button key={`${r.from}-${r.to}`} className="sk-route-pill" onClick={() => { setLiftFrom(r.from); setLiftTo(r.to) }}>
                        {r.from} → {r.to}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Savings */}
                <div className="sk-aside-card">
                  <p className="sk-aside-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={12} style={{ color: 'var(--accent)' }} /> Upp till 60% billigare
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 14px' }}>
                    Jämfört med tåg och flyg. Dela kostnad med chauffören — alla vinner och miljön tackar er.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: 'Tåg Stockholm–Göteborg', saving: 'Spara ~280 kr' },
                      { label: 'Flyg Luleå–Stockholm',   saving: 'Spara ~650 kr' },
                      { label: 'Buss Uppsala–Stockholm',  saving: 'Spara ~60 kr'  },
                    ].map(({ label, saving }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{label}</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)' }}>{saving}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>) : (<>
                {/* Skicka sidebar: flow + price + trust */}
                <div className="sk-aside-card">
                  <p className="sk-aside-title">Rekommenderat flöde</p>
                  <div className="sk-flow-steps">
                    {[
                      { n: '01', title: 'Se live-rutter',    desc: 'Boka direkt om du ser en resa som redan passar.' },
                      { n: '02', title: 'Finjustera med AI', desc: 'Beskriv vikt, timing och rutt i klartext.'       },
                      { n: '03', title: 'Bekräfta bokning', desc: 'Gonow kontaktar rätt transport och återkommer med nästa steg.' },
                    ].map(item => (
                      <div key={item.n} className="sk-flow-item">
                        <span className="sk-flow-num">{item.n}</span>
                        <div>
                          <p className="sk-flow-title">{item.title}</p>
                          <p className="sk-flow-desc">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sk-aside-card">
                  <p className="sk-aside-title">Smart prisbild</p>
                  <div className="sk-price-guide">
                    {[
                      ['Stockholm → Göteborg', '149-220 kr'],
                      ['Stockholm → Malmö',    '189-280 kr'],
                      ['Göteborg → Malmö',     '99-150 kr'],
                      ['Uppsala → Stockholm',  '69-120 kr'],
                    ].map(([route, price]) => (
                      <div key={route} className="sk-price-row">
                        <span>{route}</span><strong>{price}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sk-aside-card sk-aside-card-trust">
                  <p className="sk-aside-title">Alltid inbyggt</p>
                  <div className="sk-trust-list">
                    {[
                      { icon: Shield,  text: 'BankID-verifierad transport' },
                      { icon: Zap,     text: '250 000 kr försäkring'    },
                      { icon: Clock,   text: 'Live-spårning'            },
                      { icon: Package, text: 'Escrow-betalning'         },
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className="sk-trust-item">
                        <Icon size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />
                        <span>{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>)}
            </aside>

          </div>
        )}

        {step === 'review' && parsed && parsed.type !== 'lift' && (
          <EnterpriseSendReview
            draft={parsed}
            packageType={packageType}
            sender={sender}
            recipient={recipient}
            price={routePrice?.price || parsed.estimated_price_sek || 0}
            loading={false}
            error={submitError}
            onSenderChange={setSender}
            onRecipientChange={setRecipient}
            onBack={() => {
              setSubmitError(null)
              setStep('chat')
              router.replace(aiMode ? '/skicka?mode=ai' : '/skicka', { scroll: false })
            }}
            onConfirm={handlePublishPackage}
          />
        )}

        {/* ══ STEP: MATCHES ══════════════════════════════════════════════════ */}
        {step === 'matches' && parsed && (
          <div className="sk-layout">
            <div className="sk-primary">
              <div className="sk-match-hero">
                <div className="sk-match-hero-copy">
                  <div className="sk-match-kicker-row">
                    <p className="sk-eyebrow" style={{ marginBottom: 0 }}>Matchade resor</p>
                    <span className="sk-operational-pill sk-match-operational-pill">Gonow väljer</span>
                  </div>
                  <h2 className="sk-match-hero-title">
                    {parsed.from_city.split(',')[0]} → {parsed.to_city.split(',')[0]}
                  </h2>
                  <p className="sk-match-hero-sub">
                    Här ser du bara transporter som faktiskt kan ta uppdraget nu. Jämför kapacitet, status och pris i ett tydligt flöde innan du skickar förfrågan.
                  </p>
                </div>
                <div className="sk-match-hero-stats">
                  <div className="sk-match-stat">
                    <span className="sk-match-stat-k">Matchningar</span>
                    <strong>{trips.length}</strong>
                    <small>aktiva resor på denna rutt</small>
                  </div>
                  <div className="sk-match-stat">
                    <span className="sk-match-stat-k">Startpris</span>
                    <strong>{routePrice ? routePrice.price : parsed.estimated_price_sek} kr</strong>
                    <small>pris innan betalning låses</small>
                  </div>
                  <div className="sk-match-stat">
                    <span className="sk-match-stat-k">Typ</span>
                    <strong>{parsed.type === 'lift' ? 'Lift' : parsed.type === 'return' ? 'Retur' : 'Paket'}</strong>
                    <small>resa, kapacitet och leveransläge</small>
                  </div>
                </div>
              </div>

              {/* Summary pills */}
              <div className="sk-summary-bar">
                <div className="sk-summary-group">
                  {[
                    { icon: MapPin, text: `${parsed.from_city.split(',')[0]} → ${parsed.to_city.split(',')[0]}` },
                    { icon: Package, text: parsed.description?.slice(0, 28) || 'Paket' },
                    ...(parsed.weight_kg ? [{ icon: Scale, text: `${parsed.weight_kg} kg` }] : []),
                    ...(routePrice ? [{ icon: Route, text: `${routePrice.distance_km} km` }] : []),
                    ...(parsed.departure_date ? [{ icon: Calendar, text: parsed.departure_date }] : []),
                  ].map(({ icon: Icon, text }) => (
                    <span key={text} className="sk-summary-pill">
                      <Icon size={12} style={{ color: 'var(--accent)' }} /> {text}
                    </span>
                  ))}
                </div>
                <div className="sk-summary-actions">
                  <span className="sk-summary-tip">Välj först en resa som känns rätt. Sedan öppnar Gonow samma bokningsflöde för just den transporten.</span>
                  <button onClick={() => setStep('chat')} className="sk-text-link">← Ändra sökning
                  </button>
                </div>
              </div>

              {trips.length === 0 ? (
                <div className="sk-card sk-empty-card">
                  <Package size={28} style={{ color: 'var(--muted)', marginBottom: 12 }} />
                  <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Ingen transport hittades just nu</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 20 }}>Vi kan meddela dig när Gonow hittar en transport på den rutten.</p>
                  <button onClick={() => setStep('chat')} className="sk-text-link">← Ändra sökning
                  </button>
                </div>
              ) : (
                <div className="sk-card sk-match-card">
                  <div className="sk-card-top" style={{ marginBottom: 16 }}>
                    <div>
                      <p className="sk-eyebrow">Matchade resor</p>
                      <h2 className="sk-card-title">{trips.length} transporter passar din rutt</h2>
                      <p className="sk-match-list-subtitle">Jämför kapacitet och leveransläge. Öppna sedan bokningen för den transport som känns tryggast.</p>
                    </div>
                  </div>
                  <div className="sk-match-list">
                    {/* AI / Engine best-match banner */}
                    {aiMatch && (() => {
                      const recommendedTrip = trips.find(t => t.id === aiMatch.bestTripId)
                      if (!recommendedTrip) return null
                      return (
                        <AIMatchBanner
                          trip={recommendedTrip}
                          price={routePrice ? routePrice.price : parsed.estimated_price_sek}
                          match={aiMatch}
                          selected={selectedTrip?.id === aiMatch.bestTripId}
                          onSelect={() => setSelectedTrip(recommendedTrip)}
                        />
                      )
                    })()}

                    {trips.map(trip => (
                      <TravelerCard
                        key={trip.id}
                        trip={trip}
                        price={routePrice ? routePrice.price : parsed.estimated_price_sek}
                        onSelect={() => setSelectedTrip(trip)}
                        onViewProfile={trip.carrier_id ? () => setViewProfileCarrierId(trip.carrier_id!) : undefined}
                        selected={selectedTrip?.id === trip.id}
                        bookingMeta={tripMeta[trip.id]}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Booking sidebar */}
            <aside>
                <div className="sk-booking-card" style={{ position: 'sticky', top: 88 }}>
                  {/* Price hero */}
                <div className="sk-price-hero" style={{ background: 'linear-gradient(135deg, var(--gn-010) 0%, var(--gn-004) 100%)', border: '1px solid var(--gn-020)', borderRadius: 16, padding: '18px 20px', marginBottom: 20, textAlign: 'center' }}>
                  <p style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 6 }}>Beräknat pris</p>
                  <p style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--gn)', letterSpacing: '-0.04em', lineHeight: 1, margin: 0 }}>
                    {routePrice ? routePrice.price : parsed.estimated_price_sek} <span style={{ fontSize: '1rem', fontWeight: 700 }}>kr</span>
                  </p>
                  {routePrice && (
                    <p style={{ fontSize: '0.64rem', color: 'var(--muted)', marginTop: 6 }}>
                      {routePrice.breakdown.base_fee} kr start + {routePrice.breakdown.km_fee} kr/km + {routePrice.breakdown.kg_fee} kr/kg
                    </p>
                  )}
                  <div className="sk-price-hero-stats">
                    <div className="sk-price-hero-stat">
                      <span>Distans</span>
                      <strong>{routePrice ? `${routePrice.distance_km} km` : '—'}</strong>
                    </div>
                    <div className="sk-price-hero-stat">
                      <span>Leverans</span>
                      <strong>{parsed.urgency === 'today' ? 'Idag' : parsed.urgency === 'tomorrow' ? 'Imorgon' : 'Flexibel'}</strong>
                    </div>
                  </div>
                </div>
                <p className="sk-aside-title">Bokningssammanfattning</p>

                <div className="sk-booking-rows">
                  {[
                    ['Tjänst', parsed.type === 'lift' ? 'Passagerare' : parsed.type === 'return' ? 'Retur' : 'Paket'],
                    ...(routePrice ? [
                      ['Avstånd', `${routePrice.distance_km} km`],
                      ['Tid (bil)', `${Math.floor(routePrice.duration_min / 60)}h ${routePrice.duration_min % 60}min`],
                    ] : []),
                    ['Leverans', parsed.urgency === 'today' ? 'Idag' : parsed.urgency === 'tomorrow' ? 'Imorgon' : 'Flexibelt'],
                    ['Från',     parsed.from_city],
                    ['Till',     parsed.to_city],
                  ].map(([k, v]) => (
                    <div key={k} className="sk-brow">
                      <span>{k}</span><strong>{v}</strong>
                    </div>
                  ))}
                  {selectedTrip && typeof tripMeta[selectedTrip.id]?.seatsLeft === 'number' && (
                    <div className="sk-brow">
                      <span>Lediga säten</span><strong>{tripMeta[selectedTrip.id].seatsLeft} kvar</strong>
                    </div>
                  )}
                  {selectedTrip && tripMeta[selectedTrip.id]?.acceptedPassengers > 0 && (
                    <div className="sk-brow">
                      <span>Bekräftade passagerare</span><strong>{tripMeta[selectedTrip.id].acceptedPassengers}</strong>
                    </div>
                  )}

                </div>

                {selectedTrip && (
                  <div style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                    <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 8 }}>
                      Status på denna resa
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      <span className="sk-summary-pill">
                        {selectedTripStatus === 'accepted'
                          ? 'Din förfrågan är accepterad'
                          : selectedTripStatus === 'pending'
                            ? 'Du väntar på svar'
                            : selectedTripStatus === 'declined'
                              ? 'Tidigare förfrågan avböjd'
                              : 'Ingen förfrågan skickad än'}
                      </span>
                      {typeof tripMeta[selectedTrip.id]?.seatsLeft === 'number' && (
                        <span className="sk-summary-pill">{tripMeta[selectedTrip.id].seatsLeft} säten kvar</span>
                      )}
                      {tripMeta[selectedTrip.id]?.acceptedPassengers > 0 && (
                        <span className="sk-summary-pill">{tripMeta[selectedTrip.id].acceptedPassengers} bekräftade passagerare</span>
                      )}
                      {tripMeta[selectedTrip.id]?.acceptedPackages > 0 && (
                        <span className="sk-summary-pill">{tripMeta[selectedTrip.id].acceptedPackages} accepterade paket</span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.76rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: selectedTripVehicle || selectedTrip.vehicle_plate ? 10 : 0 }}>
                      {selectedTripStatus === 'accepted'
                        ? 'Du är inne på resan. Nästa steg är betalning och sedan spårning.'
                        : selectedTripStatus === 'pending'
                          ? 'Föraren kan fortfarande acceptera fler bokningar så länge kapaciteten räcker.'
                          : 'Här ser du direkt hur full bilen är och om andra redan blivit bekräftade.'}
                    </p>
                    {(selectedTripVehicle || selectedTrip.vehicle_plate) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {selectedTripVehicle && <span className="sk-summary-pill">Fordon: {selectedTripVehicle}</span>}
                        {selectedTrip.vehicle_plate && <span className="sk-summary-pill">Regnr {selectedTrip.vehicle_plate}</span>}
                      </div>
                    )}
                  </div>
                )}

                {/* Contact forms */}
                <div className="sk-contact-block">
                  {([
                    ['Avsändare', sender, setSender],
                    ...(!isPassengerFlow ? [['Mottagare', recipient, setRecipient] as [string, ContactInfo, React.Dispatch<React.SetStateAction<ContactInfo>>]] : []),
                  ] as [string, ContactInfo, React.Dispatch<React.SetStateAction<ContactInfo>>][]).map(([label, state, set]) => (
                    <div key={label}>
                      <p className="sk-form-label">{label}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input
                          type="text" placeholder="Namn *"
                          value={state.name} onChange={e => set(s => ({ ...s, name: e.target.value }))}
                          style={inputStyle}
                          onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                          onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
                        />
                        <div style={{ position: 'relative' }}>
                          <Phone size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
                          <input type="tel" placeholder="Telefon *"
                            value={state.phone} onChange={e => set(s => ({ ...s, phone: e.target.value }))}
                            style={{ ...inputStyle, paddingLeft: 28 }}
                            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                            onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
                          />
                        </div>
                        <div style={{ position: 'relative' }}>
                          <Mail size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
                          <input type="email" placeholder="E-post (valfri)"
                            value={state.email} onChange={e => set(s => ({ ...s, email: e.target.value }))}
                            style={{ ...inputStyle, paddingLeft: 28 }}
                            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                            onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSubmitBooking}
                  disabled={!selectedTrip || !contactValid || authLoading}
                  className="sk-submit-btn"
                >
                  Skicka bokning <ArrowRight size={14} />
                </button>

                {!selectedTrip   && <p className="sk-hint">Välj en transport ovan för att fortsätta</p>}
                {selectedTrip && !contactValid && <p className="sk-hint">{isPassengerFlow ? 'Fyll i namn och telefon för passageraren' : 'Fyll i namn och telefon för båda'}</p>}
                {submitError     && <p className="sk-error">{submitError}</p>}
              </div>
            </aside>
          </div>
        )}

        {/* ══ STEP: SUBMITTING ══════════════════════════════════════════════ */}
        {step === 'submitting' && (
          <div className="sk-state-center">
            <div className="sk-spinner-ring">
              <Loader2 size={26} style={{ color: 'var(--accent)', animation: 'sk-spin 1s linear infinite' }} />
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginTop: 20 }}>Skickar bokning...</p>
          </div>
        )}

        {/* ══ STEP: CONFIRMED ════════════════════════════════════════════════ */}
        {step === 'confirmed' && (
          <div className={`sk-state-center ${createdPackage ? 'sk-confirmed-compact' : ''}`}>
            <div className="sk-confirm-hero">
            <div className="sk-success-ring">
              <CheckCircle2 size={32} style={{ color: 'var(--success)' }} />
            </div>
            <p className="sk-confirm-eyebrow">Bokning genomförd</p>
            <h2 className="sk-confirm-title">Klart — Gonow tar över härifrån.</h2>
            <p className="sk-confirm-sub">
              Gonow tar hand om transporten. Du kan följa paketets status härifrån.
            </p>
            {createdBookingId && (
              <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 4 }}>
                Referens: {createdBookingId.slice(0, 8).toUpperCase()}
              </p>
            )}
            {createdPackageId && (
              <>
                <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 4 }}>
                  Paket-ID: {createdPackageId.slice(0, 8).toUpperCase()}
                </p>
                <a
                  href={`/paket/${createdPackageId}`}
                  className="btn-primary"
                  style={{ marginTop: 16, padding: '12px 22px', textDecoration: 'none' }}
                >
                  Se paketets status <ArrowRight size={14} />
                </a>
              </>
            )}
            </div>
            {createdPackage && (
              <div className="sk-package-status-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div>
                    <p className="sk-form-label" style={{ marginBottom: 6 }}>Transportöversikt</p>
                    <h3 className="sk-status-heading">Gonow söker rätt transport</h3>
                  </div>
                  <span style={{
                    padding: '7px 12px',
                    borderRadius: 999,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: createdPackageStatus === 'matched'
                      ? 'var(--gn-012)'
                      : createdPackageStatus === 'open'
                        ? 'rgba(59,130,246,0.08)'
                        : 'rgba(148,163,184,0.12)',
                    color: createdPackageStatus === 'matched'
                      ? 'var(--gn-dk)'
                      : createdPackageStatus === 'open'
                        ? '#2563eb'
                        : 'var(--muted)',
                    border: `1px solid ${createdPackageStatus === 'matched'
                      ? 'var(--gn-022)'
                      : createdPackageStatus === 'open'
                        ? 'rgba(59,130,246,0.16)'
                        : 'var(--border)'}`,
                  }}>
                    {createdPackageStatus === 'matched'
                      ? 'Transport säkrad'
                      : createdPackageStatus === 'delivered'
                        ? 'Levererad'
                        : createdPackageStatus === 'confirmed'
                          ? 'Slutförd'
                          : 'Väntar på svar'}
                  </span>
                </div>

                <div className="sk-confirm-route">
                  <div className="sk-confirm-stop">
                    <span>Från</span>
                    <strong>{createdPackage.from_city}</strong>
                  </div>
                  <ArrowRight className="sk-confirm-route-arrow" size={20} />
                  <div className="sk-confirm-stop">
                    <span>Till</span>
                    <strong>{createdPackage.to_city}</strong>
                  </div>
                </div>

                <div className="sk-confirm-facts">
                  <div style={{ padding: 14, borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: 5 }}>Transportkontakt</p>
                    <strong style={{ color: 'var(--text)' }}>
                      {createdPackageMatch?.drivers?.name || selectedTrip?.users?.name || 'Gonow återkommer nu'}
                    </strong>
                  </div>
                  <div style={{ padding: 14, borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: 5 }}>Prisram</p>
                    <strong style={{ color: 'var(--text)' }}>
                      {(createdPackageOrder?.price ?? createdPackageMatch?.proposed_price ?? createdPackage.price_ceiling ?? routePrice?.price ?? parsed?.estimated_price_sek ?? 149)} kr
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {typeof createdPackage.weight_kg === 'number' && createdPackage.weight_kg > 0 && (
                    <span className="sk-summary-pill">{createdPackage.weight_kg} kg</span>
                  )}
                  {createdPackage.description && (
                    <span className="sk-summary-pill">{createdPackage.description}</span>
                  )}
                  {createdPackageStatus === 'matched' && isAwaitingPackagePayment(createdPackageOrder) && (
                    <span className="sk-summary-pill">Redo för betalning</span>
                  )}
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.65 }}>
                  {createdPackageStatus === 'matched'
                    ? 'Gonow har säkrat transporten. Nästa steg är att låsa bokningen med betalning.'
                    : 'Gonow bevakar nu denna transport och uppdaterar dig s\u00e5 snart den \u00e4r bekr\u00e4ftad.'}
                </p>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                  {createdPackageStatus === 'matched' && isAwaitingPackagePayment(createdPackageOrder) && createdPackageOrder && (
                    <button
                      onClick={() => handleCheckout(createdPackageOrder.id)}
                      className="btn-primary"
                      style={{ padding: '12px 18px' }}
                    >
                      {payingOrderId === createdPackageOrder.id ? <>Startar betalning...</> : <>Betala och lås transport</>}
                    </button>
                  )}
                  <a
                    href="/profil?tab=my_packages"
                    className="btn-secondary"
                    style={{ padding: '12px 18px', textDecoration: 'none' }}
                  >
                    Öppna mina paket
                  </a>
                </div>
              </div>
            )}
            {!createdPackage && createdBookingTrip && (
              <div style={{
                marginTop: 24,
                width: '100%',
                maxWidth: 560,
                padding: 22,
                borderRadius: 22,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.08)',
                textAlign: 'left',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div>
                    <p className="sk-form-label" style={{ marginBottom: 6 }}>Din resa just nu</p>
                    <h3 style={{ fontSize: '1.05rem', color: 'var(--text)', fontWeight: 800, letterSpacing: '-0.03em' }}>
                      {createdBookingTrip.from_city} → {createdBookingTrip.to_city}
                    </h3>
                  </div>
                  <span style={{
                    padding: '7px 12px',
                    borderRadius: 999,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: createdBookingStatus === 'accepted'
                      ? 'var(--gn-012)'
                      : createdBookingStatus === 'pending'
                        ? 'rgba(59,130,246,0.08)'
                        : 'rgba(148,163,184,0.12)',
                    color: createdBookingStatus === 'accepted'
                      ? 'var(--gn-dk)'
                      : createdBookingStatus === 'pending'
                        ? '#2563eb'
                        : 'var(--muted)',
                    border: `1px solid ${createdBookingStatus === 'accepted'
                      ? 'var(--gn-022)'
                      : createdBookingStatus === 'pending'
                        ? 'rgba(59,130,246,0.16)'
                        : 'var(--border)'}`,
                  }}>
                    {createdBookingStatus === 'accepted'
                      ? 'Accepterad'
                      : createdBookingStatus === 'declined'
                        ? 'Avböjd'
                        : 'Väntar på svar'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 16 }}>
                  <div style={{ padding: 14, borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: 5 }}>Förare</p>
                    <strong style={{ color: 'var(--text)' }}>{createdBookingTrip.users?.name || 'Gonow transport'}</strong>
                  </div>
                  <div style={{ padding: 14, borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: 5 }}>Fordon</p>
                    <strong style={{ color: 'var(--text)' }}>
                      {[createdBookingTrip.vehicle_make, createdBookingTrip.vehicle_model].filter(Boolean).join(' ') || createdBookingTrip.vehicle_type || 'Fordon saknas'}
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {typeof createdBookingMeta?.acceptedPassengers === 'number' && createdBookingMeta.acceptedPassengers > 0 && (
                    <span className="sk-summary-pill">{createdBookingMeta.acceptedPassengers} bekräftade passagerare</span>
                  )}
                  {typeof createdBookingMeta?.acceptedPackages === 'number' && createdBookingMeta.acceptedPackages > 0 && (
                    <span className="sk-summary-pill">{createdBookingMeta.acceptedPackages} accepterade paket</span>
                  )}
                  {typeof createdBookingMeta?.seatsLeft === 'number' && (
                    <span className="sk-summary-pill">{createdBookingMeta.seatsLeft} säten kvar</span>
                  )}
                  {createdBookingTrip.vehicle_plate && (
                    <span className="sk-summary-pill">Regnr {createdBookingTrip.vehicle_plate}</span>
                  )}
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.65 }}>
                  {createdBookingStatus === 'accepted'
                    ? 'Din plats eller leverans \u00e4r bekr\u00e4ftad.'
                    : 'Bokningen \u00e4r skickad - Gonow \u00e5terkommer med n\u00e4sta steg.'}
                </p>

                {createdBookingStatus === 'accepted' && createdBooking?.order_id && (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                    <button
                      onClick={() => handleCheckout(createdBooking.order_id!)}
                      className="btn-primary"
                      style={{ padding: '12px 18px' }}
                    >
                      {payingOrderId === createdBooking.order_id ? <>Startar betalning...</> : <>Betala nu</>}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>{/* /sk-wrap */}

      <style>{`
        @keyframes sk-spin { to { transform: rotate(360deg); } }

        .sk-shell {
          min-height: 100vh;
          padding-top: 88px;
          padding-bottom: 80px;
          position: relative;
          overflow: hidden;
        }

        .sk-parallax-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          background:
            linear-gradient(to bottom, rgba(0,0,0,.58) 0%, rgba(3,8,5,.87) 100%),
            url('/hero-city.jpg') center / cover no-repeat;
          pointer-events: none;
        }

        .sk-glow-l, .sk-glow-r {
          position: absolute;
          border-radius: 999px;
          filter: blur(80px);
          pointer-events: none;
          z-index: 1;
        }
        .sk-glow-l {
          width: 360px; height: 360px;
          top: 60px; left: -100px;
          background: radial-gradient(circle, var(--gn-009) 0%, transparent 70%);
        }
        .sk-glow-r {
          width: 420px; height: 420px;
          top: 280px; right: -130px;
          background: radial-gradient(circle, var(--gn-007) 0%, transparent 70%);
        }

        .sk-wrap {
          max-width: 1200px;
          margin: 0 auto;
          padding: 44px 24px 64px;
          position: relative;
          z-index: 2;
        }
        .sk-wrap-enterprise {
          max-width: 1240px;
          padding-top: 12px;
          padding-bottom: 20px;
        }

        /* ── Header ── */
        .sk-header {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 32px;
          align-items: end;
          margin-bottom: 28px;
        }

        .sk-kicker {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 12px;
        }

        .sk-title {
          font-size: clamp(2rem, 4.2vw, 3.1rem);
          font-weight: 800;
          letter-spacing: -0.045em;
          line-height: 1.03;
          color: var(--text);
          margin-bottom: 14px;
        }

        .sk-subtitle {
          font-size: 0.96rem;
          line-height: 1.7;
          color: var(--muted);
          max-width: 500px;
        }

        .sk-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .sk-stat {
          padding: 18px 16px;
          border: 1px solid var(--border);
          border-radius: 18px;
          background: var(--surface);
          box-shadow: 0 8px 24px rgba(0,0,0,0.04);
        }

        .sk-stat-accent {
          background: var(--accent-softer);
          border-color: var(--gn-025);
        }

        .sk-stat-val {
          display: block;
          font-size: 1.4rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--text);
          margin-bottom: 4px;
        }

        .sk-stat-accent .sk-stat-val { color: var(--accent); }

        .sk-stat-lbl {
          display: block;
          font-size: 0.68rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: var(--muted);
        }

        /* ── Stepper ── */
        .sk-stepper {
          display: flex;
          align-items: center;
          padding: 18px 22px;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 20px;
          background: rgba(0,0,0,0.08);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.10);
          margin-bottom: 40px;
          gap: 0;
        }

        .sk-step {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .sk-step-num {
          width: 36px; height: 36px;
          border-radius: 12px;
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          line-height: 1;
          font-size: 0.78rem; font-weight: 700;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--muted);
          transition: all 0.2s;
        }

        .sk-step-active .sk-step-num {
          background: var(--accent-soft);
          border-color: var(--gn-035);
          color: var(--accent);
        }

        .sk-step-done .sk-step-num {
          background: var(--gn-010);
          border-color: var(--gn-025);
          color: var(--success);
        }

        .sk-step-title {
          font-size: 0.82rem; font-weight: 700;
          color: var(--muted);
          margin-bottom: 2px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .sk-step-active .sk-step-title { color: var(--text); }
        .sk-step-done .sk-step-title   { color: var(--success); }

        .sk-step-desc {
          font-size: 0.7rem;
          color: var(--muted);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .sk-step-mobile-copy,
        .sk-step-mobile-label,
        .sk-step-mobile-desc {
          display: none;
        }

        .sk-match-kicker-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .sk-match-operational-pill {
          flex-shrink: 0;
        }

        .sk-step-line {
          width: 28px; height: 2px;
          background: var(--border);
          flex-shrink: 0;
          margin: 0 6px;
          border-radius: 2px;
          transition: background 0.2s;
        }
        .sk-step-line-done { background: var(--gn-040); }

        /* ── Tab switcher — absolutely centered over card, aligned with title ── */
        .sk-tab-row {
          position: absolute;
          top: 10%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          gap: 6px;
          z-index: 2;
        }
        .sk-tab {
          padding: 8px 20px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.22);
          background: rgba(0,0,0,0.35);
          color: rgba(255,255,255,0.55);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .sk-tab:hover { border-color: rgba(255,255,255,0.4); color: rgba(255,255,255,0.9); }
        .sk-tab-active {
          background: rgba(255,255,255,0.15) !important;
          border-color: rgba(255,255,255,0.4) !important;
          color: #ffffff !important;
          box-shadow: 0 2px 12px rgba(0,0,0,0.3);
        }

        /* ── Chat step grid ── */
        .sk-chat-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 52px;
        }

        /* ── Info row: 3 cards side by side ── */
        .sk-sidebar {
          display: grid !important;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          align-items: stretch;
        }
        .sk-sidebar-hidden { display: none !important; }

        /* ── Matches / generic 2-col layout ── */
        .sk-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 330px;
          gap: 24px;
          align-items: start;
        }

        .sk-primary {
          display: flex; flex-direction: column; gap: 16px;
        }

        /* ── Cards ── */
        .sk-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 26px;
          box-shadow: 0 12px 36px rgba(0,0,0,0.04);
        }

        .sk-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 20px;
        }

        .sk-eyebrow {
          font-size: 0.7rem; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--accent); margin-bottom: 8px;
        }

        .sk-card-title {
          font-size: clamp(1.1rem, 2vw, 1.4rem);
          font-weight: 750; letter-spacing: -0.03em;
          color: var(--text); line-height: 1.15;
        }

        /* ── Simple form (Uber-style) ── */
        .sk-simple-inner {
          display: grid;
          grid-template-columns: 1fr 272px;
          min-height: 280px;
          gap: 0;
        }

        .sk-simple-left {
          padding: 32px 30px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 16px;
          background: transparent;
        }

        .sk-simple-title {
          font-size: clamp(1.4rem, 3vw, 2rem);
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1.05;
          color: var(--text);
          text-wrap: balance;
        }

        .sk-simple-subtitle {
          max-width: 540px;
          font-size: 0.9rem;
          line-height: 1.72;
          color: rgba(255,255,255,0.72);
        }

        .sk-info-strip {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .sk-info-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.78);
          font-size: 0.76rem;
          font-weight: 600;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        /* Connected route fields */
        .sk-route-form {
          display: flex;
          gap: 12px;
          align-items: stretch;
          scroll-margin-top: 108px;
          overflow-anchor: none;
        }

        .sk-rf-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          padding: 14px 0;
          flex-shrink: 0;
        }

        .sk-rf-dot {
          width: 10px; height: 10px; border-radius: 50%;
          border: 2px solid var(--text);
          background: transparent;
          flex-shrink: 0;
        }

        .sk-rf-line {
          width: 2px;
          flex: 1;
          min-height: 20px;
          background: var(--border);
          margin: 4px 0;
        }

        .sk-rf-square {
          width: 10px; height: 10px;
          border-radius: 2px;
          background: var(--text);
          flex-shrink: 0;
        }

        .sk-rf-inputs {
          flex: 1;
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          background: var(--surface-2);
          min-width: 0;
        }

        .sk-rf-input {
          width: 100%;
          padding: 14px 16px;
          border: none;
          background: transparent;
          font-size: 0.9rem;
          color: var(--text);
          outline: none;
          font-family: inherit;
          box-sizing: border-box;
          min-width: 0;
        }

        .sk-rf-input::placeholder { color: var(--muted); }

        .sk-rf-divider {
          height: 1px;
          background: var(--border);
          margin: 0 16px;
        }

        .sk-lift-panel {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 14px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.12);
          background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        }

        .sk-lift-panel-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .sk-lift-panel-kicker {
          font-size: 0.64rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.55);
          margin-bottom: 4px;
        }

        .sk-lift-panel-title {
          font-size: 0.96rem;
          line-height: 1.35;
          font-weight: 700;
          color: #fff;
        }

        .sk-lift-panel-pills {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }

        .sk-lift-panel-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.78);
          font-size: 0.72rem;
          font-weight: 600;
        }

        .sk-lift-panel-note {
          font-size: 0.76rem;
          line-height: 1.55;
          color: rgba(255,255,255,0.62);
        }

        .sk-lift-controls {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
          gap: 10px;
        }

        .sk-lift-card {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 12px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06);
          min-width: 0;
        }

        .sk-lift-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: rgba(255,255,255,0.55);
        }

        .sk-lift-card-label {
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .sk-date-input {
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 12px;
          background: rgba(0,0,0,0.14);
          color: #fff;
          padding: 11px 12px;
          font-size: 0.84rem;
        }

        .sk-passenger-row {
          flex-wrap: nowrap;
          gap: 6px;
        }

        .sk-passenger-row .sk-weight-chip {
          flex: 1 1 0;
          text-align: center;
          justify-content: center;
          padding-left: 0;
          padding-right: 0;
        }

        /* Weight chips */
        .sk-weight-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sk-weight-chip {
          padding: 7px 14px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--muted-2);
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
        }

        .sk-weight-chip.active,
        .sk-weight-chip:hover {
          border-color: var(--text);
          background: var(--text);
          color: var(--bg);
        }

        .sk-find-btn {
          padding: 13px 22px;
          border-radius: 12px;
          border: none;
          background: var(--text);
          color: var(--bg);
          font-size: 0.9rem;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          align-self: flex-start;
          transition: opacity 0.15s;
        }

        .sk-find-btn:hover:not(:disabled) { opacity: 0.8; }
        .sk-find-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        .sk-ai-entry-btn {
          margin-top: 14px;
          border: 1px solid var(--gn-045);
          background: var(--gn-012);
          color: var(--gn-pl);
          border-radius: 12px;
          padding: 10px 16px;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.82rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          align-self: flex-start;
          transition: background 0.15s, border-color 0.15s, transform 0.15s;
        }

        .sk-mode-switch {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(14px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }

        .sk-mode-switch-btn {
          border: 0;
          border-radius: 999px;
          padding: 9px 14px;
          background: transparent;
          color: rgba(255,255,255,0.58);
          font-size: 0.76rem;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
          font-family: inherit;
        }

        .sk-mode-switch-btn:hover {
          color: rgba(255,255,255,0.88);
        }

        .sk-mode-switch-btn.active {
          background: linear-gradient(135deg, rgba(44, 202, 96, 0.24), rgba(44, 202, 96, 0.14));
          color: #f7fff9;
          box-shadow: inset 0 0 0 1px rgba(44, 202, 96, 0.34), 0 10px 24px rgba(34, 197, 94, 0.16);
        }

        .sk-ai-entry-btn:hover {
          background: var(--gn-016);
          border-color: var(--gn-056);
          transform: translateY(-1px);
        }

        .sk-simple-visual {
          background: rgba(0,0,0,0.30);
          border-radius: 18px;
          margin: 12px 12px 12px 0;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* ── Left panel dark-mode overrides (white text on black glass) ── */
        .sk-simple-left .sk-simple-title { color: #ffffff; }
        .sk-simple-left .sk-rf-dot { border-color: rgba(255,255,255,0.75); }
        .sk-simple-left .sk-rf-line { background: rgba(255,255,255,0.18); }
        .sk-simple-left .sk-rf-square { background: #ffffff; }
        .sk-simple-left .sk-rf-inputs {
          border-color: rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.08);
        }
        .sk-simple-left .sk-rf-input { color: #ffffff; }
        .sk-simple-left .sk-rf-input::placeholder { color: rgba(255,255,255,0.38); }
        .sk-simple-left .sk-rf-divider { background: rgba(255,255,255,0.1); }
        .sk-simple-left .sk-weight-chip {
          border-color: rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.65);
        }
        .sk-simple-left .sk-weight-chip.active,
        .sk-simple-left .sk-weight-chip:hover {
          border-color: #ffffff;
          background: #ffffff;
          color: #0a0a0a;
        }
        .sk-simple-left .sk-find-btn {
          background: var(--gn);
          color: #0a0a0a;
        }

        .sk-visual-label {
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.4);
        }

        .sk-visual-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
        }

        .sk-visual-counter {
          text-align: center;
          padding: 16px 0 10px;
          flex-shrink: 0;
        }

        .sk-visual-count {
          font-size: 3rem;
          font-weight: 900;
          letter-spacing: -0.06em;
          color: var(--gn);
          line-height: 1;
        }

        .sk-visual-sub {
          font-size: 0.76rem;
          color: rgba(255,255,255,0.45);
          margin-top: 4px;
        }

        .sk-visual-routes {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 0 14px;
          overflow: hidden;
        }

        .sk-visual-route {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 9px 12px;
          border-radius: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.07);
        }

        .sk-visual-route-btn {
          width: 100%;
          border: 1px solid rgba(255,255,255,0.07);
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          transition: background 0.15s, border-color 0.15s;
        }

        .sk-visual-route-btn:hover {
          background: var(--gn-008);
          border-color: var(--gn-020);
        }

        .sk-vr-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--gn);
          flex-shrink: 0;
        }

        .sk-vr-from  { font-size: 0.78rem; font-weight: 700; color: #fff; }
        .sk-vr-arrow { font-size: 0.7rem; color: rgba(255,255,255,0.3); flex-shrink: 0; }
        .sk-vr-to    { font-size: 0.78rem; color: rgba(255,255,255,0.55); flex: 1; }
        .sk-vr-price { font-size: 0.78rem; font-weight: 700; color: var(--gn); flex-shrink: 0; }

        .sk-visual-footer {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px 14px 4px;
          align-items: flex-start;
          flex-shrink: 0;
        }

        .sk-visual-book-btn {
          width: 100%;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.22);
          background: transparent;
          color: rgba(255,255,255,0.85);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: background 0.15s, border-color 0.15s;
        }

        .sk-visual-book-btn:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.4);
        }

        .sk-visual-footer .sk-text-link {
          color: var(--gn-lt2);
          font-size: 0.74rem !important;
          font-weight: 700;
        }

        .sk-visual-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 0 14px 14px;
          flex-shrink: 0;
        }

        .sk-visual-stats > div {
          padding: 10px 8px;
          border-radius: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.07);
          text-align: center;
        }

        .sk-visual-stats span {
          display: block;
          font-size: 1rem;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.02em;
          margin-bottom: 3px;
        }

        .sk-visual-stats p {
          font-size: 0.62rem;
          color: rgba(255,255,255,0.4);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        /* responsive simple form */
        @media (max-width: 900px) {
          .sk-confirmed-compact {
            grid-template-columns: 1fr;
            gap: 14px;
            padding: 18px 0;
          }
          .sk-confirm-hero {
            align-items: center;
            padding: 12px 8px;
            text-align: center;
          }
          .sk-confirmed-compact .sk-confirm-title,
          .sk-confirmed-compact .sk-confirm-sub {
            text-align: center;
          }
        }

        @media (max-width: 700px) {
          .sk-simple-inner { grid-template-columns: 1fr; }
          .sk-simple-visual {
            display: flex;
            margin: 0 14px 14px;
            border-radius: 18px;
            min-height: 0;
          }
          .sk-simple-left {
            padding: 24px 18px 18px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
          }
          .sk-simple-title {
            font-size: clamp(2rem, 10vw, 2.7rem);
          }
          .sk-simple-subtitle {
            font-size: 0.9rem;
            line-height: 1.65;
          }
          .sk-info-pill {
            font-size: 0.74rem;
            padding: 8px 11px;
          }
          .sk-route-form {
            gap: 10px;
            scroll-margin-top: 120px;
          }
          .sk-rf-input {
            padding: 16px 14px;
            font-size: 0.98rem;
          }
          .sk-weight-row {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
          }
          .sk-weight-chip {
            width: 100%;
            min-height: 42px;
            justify-content: center;
            text-align: center;
            font-size: 0.8rem;
          }
          .sk-find-btn,
          .sk-ai-entry-btn {
            width: 100%;
            justify-content: center;
          }
          .sk-lift-panel {
            padding: 12px;
            gap: 10px;
          }
          .sk-lift-panel-top {
            flex-direction: column;
            align-items: stretch;
          }
          .sk-lift-panel-pills {
            justify-content: flex-start;
          }
          .sk-lift-controls {
            grid-template-columns: 1fr;
          }
          .sk-passenger-row {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          .sk-visual-head {
            padding: 12px 14px;
          }
          .sk-visual-count {
            font-size: 2.35rem;
          }
          .sk-visual-sub {
            font-size: 0.72rem;
          }
          .sk-visual-routes {
            gap: 8px;
            padding: 0 12px;
          }
          .sk-visual-route {
            padding: 11px 12px;
            border-radius: 12px;
          }
          .sk-vr-from,
          .sk-vr-to,
          .sk-vr-price {
            font-size: 0.82rem;
          }
          .sk-visual-footer {
            padding: 12px;
          }
          .sk-visual-book-btn,
          .sk-live-expand-btn {
            width: 100%;
            justify-content: space-between;
            border-radius: 12px;
            padding: 11px 13px;
          }
          .sk-visual-stats {
            padding: 0 12px 12px;
          }
        }

        /* ── AI card — BCG two-column ── */
        .sk-ai-card {
          padding: 0;
          overflow: hidden;
          height: 570px;
          max-height: calc(100vh - 116px);
          background: rgba(8,14,11,0.85) !important;
          border: 1px solid rgba(255,255,255,0.09) !important;
          border-top: 2px solid rgba(34,197,94,0.7) !important;
          border-radius: 16px;
          box-shadow: 0 24px 70px rgba(0,0,0,0.42);
        }

        .sk-ai-enterprise-bar {
          height: 29px;
          margin: 0 20px;
          padding-top: 10px;
          padding-bottom: 8px;
          box-sizing: content-box;
          border-bottom: 1px solid rgba(255,255,255,0.09);
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #929895;
          font-size: 8px;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }
        .sk-ai-enterprise-bar > div { display: flex; align-items: center; gap: 8px; }
        .sk-ai-enterprise-bar > div:first-child > span { color: #1caf50; font-weight: 800; }
        .sk-ai-enterprise-bar i { width: 1px; height: 10px; background: #292f2d; }
        .sk-ai-enterprise-bar strong { color: #f5f7f6; font-weight: 650; }
        .sk-ai-enterprise-bar b { position: relative; color: #20a94e; font-size: 8px; padding-left: 9px; }
        .sk-ai-enterprise-bar b::before { content: ''; position: absolute; left: 0; top: 50%; width: 5px; height: 5px; border-radius: 50%; background: #2bd35d; transform: translateY(-50%); box-shadow: 0 0 0 3px rgba(43,211,93,.12); }

        .sk-ai-progress { display: flex; align-items: center; gap: 18px; margin: 0 20px 10px; min-height: 38px; }
        .sk-ai-progress > div { display: flex; align-items: center; flex: 1; min-width: 0; color: #929895; }
        .sk-ai-progress > div > b { display: grid; place-items: center; width: 30px; height: 30px; flex: none; border: 1px solid rgba(255,255,255,.13); border-radius: 50%; font-size: 10px; }
        .sk-ai-progress > div > span { padding-left: 8px; white-space: nowrap; }
        .sk-ai-progress strong,.sk-ai-progress small { display: block; }
        .sk-ai-progress strong { font-size: 10px; }
        .sk-ai-progress small { margin-top: 2px; font-size: 8px; }
        .sk-ai-progress > div > i { height: 1px; flex: 1; margin: 0 11px; background: #292f2d; }
        .sk-ai-progress > div.active { color: #f5f7f6; }
        .sk-ai-progress > div.active > b { color: #071009; border-color: #35d066; background: #35d066; box-shadow: 0 0 0 4px rgba(53,208,102,.1); }
        .sk-ai-progress > div.active > i { background: linear-gradient(90deg,#258d49,#292f2d); }
        .sk-ai-progress > button { display: flex; align-items: center; justify-content: center; flex: none; min-width: 112px; height: 34px; padding: 0 12px; border: 1px solid rgba(21,148,71,.35); border-radius: 8px; background: #173220; color: #35d066; font: inherit; font-size: 10px; font-weight: 750; cursor: pointer; }
        .sk-ai-progress > button:hover { border-color: #25b456; }

        .sk-ai-inner {
          display: grid;
          grid-template-columns: 300px 1fr;
        }

        .sk-ai-left {
          padding: 32px 28px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 14px;
          background: var(--gn-006);
          border-right: 1px solid var(--border);
        }

        .sk-ai-right {
          padding: 24px 26px;
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .sk-ai-desc {
          font-size: 0.82rem;
          line-height: 1.65;
          color: var(--muted);
        }

        .sk-ai-feats {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 4px;
        }

        .sk-ai-feat {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.76rem;
          font-weight: 600;
          color: var(--text);
        }

        .sk-ai-feat-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--accent);
          flex-shrink: 0;
        }

        /* dark mode AI left panel */
        :global(html.dark) .sk-ai-left {
          background: var(--gn-004);
        }

        @media (max-width: 700px) {
          .sk-ai-inner { grid-template-columns: 1fr; }
          .sk-ai-left { border-right: none; border-bottom: 1px solid var(--border); padding: 22px 20px; }
          .sk-ai-right { padding: 20px; }
        }

        .sk-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface-2);
          font-size: 0.72rem; font-weight: 600;
          color: var(--muted-2);
          white-space: nowrap;
        }

        .sk-badge-live {
          color: var(--gn-lt);
          border-color: var(--gn-022);
          background: var(--gn-008);
        }

        /* ── Live panel ── */
        .sk-live-panel {
          border-radius: 18px;
          overflow: hidden;
          background: linear-gradient(160deg, rgba(22,26,30,0.98) 0%, rgba(12,14,16,0.99) 100%);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .sk-live-panel-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 18px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          font-size: 0.84rem; font-weight: 700;
          color: rgba(255,255,255,0.92);
        }

        .sk-live-pulse {
          width: 9px; height: 9px; border-radius: 50%;
          background: var(--gn);
          box-shadow: 0 0 10px var(--gn)88;
          display: inline-block;
        }

        .sk-operational-pill {
          padding: 5px 11px; border-radius: 999px;
          border: 1px solid var(--gn-022);
          background: var(--gn-010);
          color: var(--gn-lt);
          font-size: 0.68rem; font-weight: 800;
          letter-spacing: 0.07em; text-transform: uppercase;
        }

        .sk-live-empty {
          padding: 36px 18px;
          text-align: center;
          color: rgba(255,255,255,0.5);
          font-size: 0.84rem;
          display: flex; flex-direction: column; align-items: center;
        }

        .sk-live-row {
          width: 100%; border: none; background: transparent;
          padding: 16px 18px;
          display: flex; align-items: center; justify-content: space-between; gap: 14px;
          cursor: pointer; font-family: inherit; text-align: left;
          transition: background 0.15s;
        }
        .sk-live-row:hover { background: var(--gn-004); }

        .sk-route-indicator {
          display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0;
        }
        .sk-route-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--gn-060);
        }
        .sk-route-dot.own { background: var(--gn-lt2); }
        .sk-route-line {
          width: 1px; height: 20px;
          background: linear-gradient(to bottom, var(--gn), var(--gn));
        }

        .sk-live-from {
          font-size: 0.94rem; font-weight: 700;
          color: #fff; line-height: 1.2; margin-bottom: 4px;
          display: flex; align-items: center; gap: 7px;
        }

        .sk-own-tag {
          font-size: 0.6rem; font-weight: 800;
          padding: 2px 7px; border-radius: 999px;
          border: 1px solid var(--gn-028);
          background: var(--gn-014);
          color: var(--gn-lt2);
        }

        .sk-live-to {
          font-size: 0.78rem; color: rgba(255,255,255,0.55);
        }

        .sk-live-carrier {
          min-width: 76px; text-align: center; flex-shrink: 0;
          font-size: 0.82rem; color: rgba(255,255,255,0.88); font-weight: 600;
        }

        .sk-new-carrier {
          font-size: 0.7rem; color: var(--gn-lt2); display: block; margin-top: 3px;
        }

        .sk-live-price-col {
          text-align: right; flex-shrink: 0;
        }
        .sk-live-price-col p {
          font-size: 1rem; font-weight: 800; color: #fff; margin-bottom: 3px;
        }
        .sk-live-price-col span {
          font-size: 0.72rem; color: rgba(255,255,255,0.5);
        }

        .sk-live-footer {
          width: 100%; border: none;
          border-top: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.88);
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 18px;
          font-size: 0.86rem; font-weight: 700;
          cursor: pointer; font-family: inherit;
          transition: background 0.15s;
        }
        .sk-live-footer:hover { background: rgba(255,255,255,0.08); }

        .sk-text-link {
          border: none; background: none; cursor: pointer; font-family: inherit;
          font-size: 0.8rem; font-weight: 600;
          color: var(--accent); padding: 0; display: inline-flex; align-items: center; gap: 4px;
        }

        /* ── Sidebar ── */
        .sk-sidebar {
          display: flex; flex-direction: column; gap: 14px;
        }

        .sk-aside-card {
          background: rgba(0,0,0,0.08);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 18px;
          padding: 28px 26px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.10);
        }

        .sk-aside-card-trust {
          background: rgba(0,0,0,0.10);
          border-color: var(--gn-025);
        }

        .sk-aside-title {
          font-size: 0.7rem; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--muted-2); margin-bottom: 14px;
        }

        /* Flow steps */
        .sk-flow-steps { display: flex; flex-direction: column; gap: 14px; }

        .sk-flow-item {
          display: flex; gap: 12px; align-items: flex-start;
        }

        .sk-flow-num {
          width: 28px; height: 28px; flex-shrink: 0; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.68rem; font-weight: 800;
          background: var(--accent-softer);
          border: 1px solid var(--gn-020);
          color: var(--accent);
        }

        .sk-flow-title { font-size: 0.8rem; font-weight: 700; color: var(--text); margin-bottom: 3px; }
        .sk-flow-desc  { font-size: 0.72rem; color: var(--muted); line-height: 1.5; }

        /* Price guide */
        .sk-price-guide { display: flex; flex-direction: column; gap: 10px; }
        .sk-price-row {
          display: flex; justify-content: space-between; align-items: center;
          font-size: 0.76rem; color: var(--muted);
          padding-bottom: 10px;
          border-bottom: 1px solid var(--border);
        }
        .sk-price-row:last-child { border-bottom: none; padding-bottom: 0; }
        .sk-price-row strong { color: var(--text); font-weight: 700; }

        /* Trust list */
        .sk-trust-list { display: flex; flex-direction: column; gap: 10px; }
        .sk-trust-item {
          display: flex; align-items: center; gap: 9px;
          font-size: 0.78rem; color: var(--muted);
        }

        /* ── Matches step ── */
        .sk-summary-bar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 18px;
          border: 1px solid var(--border);
          border-radius: 18px;
          background:
            linear-gradient(180deg, var(--gn-0035), transparent 80%),
            var(--surface);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .sk-summary-group {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .sk-summary-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
          flex-shrink: 0;
        }

        .sk-summary-tip {
          font-size: 0.72rem;
          color: var(--muted);
          max-width: 220px;
          text-align: right;
          line-height: 1.5;
        }

        .sk-summary-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 999px;
          border: 1px solid var(--gn-020);
          background: var(--gn-006);
          font-size: 0.74rem; font-weight: 600; color: var(--text);
        }

        .sk-match-hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px;
          padding: 22px 24px;
          border-radius: 22px;
          border: 1px solid var(--border);
          background:
            radial-gradient(circle at top right, var(--gn-012), transparent 34%),
            radial-gradient(circle at bottom left, rgba(255,255,255,0.08), transparent 24%),
            linear-gradient(180deg, var(--gn-004), var(--gn-0015)),
            var(--surface);
          box-shadow: 0 16px 40px rgba(0,0,0,0.06);
        }

        .sk-match-hero-copy {
          min-width: 0;
        }

        .sk-match-hero-title {
          font-size: clamp(1.55rem, 2.8vw, 2.2rem);
          font-weight: 800;
          letter-spacing: -0.04em;
          color: var(--text);
          margin-bottom: 10px;
          line-height: 1.02;
        }

        .sk-match-hero-sub {
          max-width: 620px;
          font-size: 0.9rem;
          line-height: 1.7;
          color: var(--muted);
        }

        .sk-match-hero-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          min-width: min(360px, 100%);
        }

        .sk-match-stat {
          padding: 14px;
          border-radius: 16px;
          border: 1px solid var(--gn-016);
          background: linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.52));
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.42);
        }

        .sk-match-stat-k {
          font-size: 0.66rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--muted);
        }

        .sk-match-stat strong {
          font-size: 1rem;
          font-weight: 800;
          color: var(--text);
          line-height: 1.2;
        }

        .sk-match-stat small {
          font-size: 0.68rem;
          line-height: 1.45;
          color: var(--muted);
        }

        .sk-match-card {
          padding-top: 20px;
          background:
            linear-gradient(180deg, var(--gn-0025), transparent 24%),
            var(--surface);
        }

        .sk-match-list-subtitle {
          margin-top: 6px;
          font-size: 0.8rem;
          line-height: 1.55;
          color: var(--muted);
          max-width: 540px;
        }

        .sk-match-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .sk-live-expand-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid var(--gn-020);
          background: var(--gn-008);
          color: var(--text);
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 0.74rem;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
        }

        .sk-live-expand-btn:hover {
          transform: translateY(-1px);
          border-color: var(--gn-035);
          background: var(--gn-010);
        }

        .sk-empty-card {
          display: flex; flex-direction: column; align-items: center;
          padding: 56px 24px; text-align: center;
        }

        /* ── Booking card ── */
        .sk-booking-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 22px;
          padding: 24px;
          box-shadow: 0 16px 48px rgba(0,0,0,0.07);
          overflow: hidden;
        }

        .sk-price-hero-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        .sk-price-hero-stat {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--gn-016);
          background: rgba(255,255,255,0.34);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sk-price-hero-stat span {
          font-size: 0.62rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
        }

        .sk-price-hero-stat strong {
          font-size: 0.84rem;
          font-weight: 800;
          color: var(--text);
        }

        .sk-booking-rows { display: flex; flex-direction: column; gap: 0; margin-bottom: 16px; }

        .sk-brow {
          display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
          font-size: 0.76rem; color: var(--muted);
          padding-bottom: 9px; border-bottom: 1px solid var(--border);
        }
        .sk-brow:last-of-type { border-bottom: none; padding-bottom: 0; }
        .sk-brow strong { color: var(--text); font-weight: 600; text-align: right; }

        .sk-price-breakdown {
          padding: 8px 10px; border-radius: 10px;
          background: var(--surface-2);
          color: var(--muted); font-size: 0.68rem;
        }

        .sk-total-row {
          display: flex; justify-content: space-between; align-items: center;
          padding-top: 12px; border-top: 2px solid var(--border);
          font-size: 0.9rem; font-weight: 700; color: var(--text);
        }
        .sk-total-row strong { color: var(--accent); font-size: 1.15rem; font-weight: 800; }

        .sk-contact-block {
          display: flex; flex-direction: column; gap: 14px;
          padding-top: 16px; margin-bottom: 16px;
          border-top: 1px solid var(--border);
        }

        .sk-form-label {
          font-size: 0.68rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.09em;
          color: var(--muted); margin-bottom: 7px;
        }

        .sk-submit-btn {
          width: 100%; padding: 13px; border-radius: 12px; border: none;
          background: var(--accent); color: #0a0a0a;
          font-size: 0.88rem; font-weight: 700; cursor: pointer; font-family: inherit;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: opacity 0.15s;
        }
        .sk-submit-btn:hover:not(:disabled) { opacity: 0.87; }
        .sk-submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .sk-hint  { margin-top: 10px; text-align: center; font-size: 0.74rem; color: var(--muted); }
        .sk-error { margin-top: 10px; text-align: center; font-size: 0.74rem; color: #ef4444; }

        /* ── State center (submitting / confirmed) ── */
        .sk-state-center {
          display: flex; flex-direction: column; align-items: center;
          padding: 100px 24px; text-align: center;
        }
        .sk-confirmed-compact {
          display: grid;
          grid-template-columns: minmax(300px, 0.76fr) minmax(500px, 1.24fr);
          align-items: center;
          gap: 22px;
          padding: 24px;
          text-align: left;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 26px;
          background: linear-gradient(135deg, rgba(7,18,14,0.96), rgba(11,20,17,0.92));
          box-shadow: 0 28px 80px rgba(0,0,0,0.3);
          backdrop-filter: blur(22px);
        }
        .sk-confirm-hero {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          padding: 18px 14px;
        }
        .sk-confirmed-compact .sk-confirm-title,
        .sk-confirmed-compact .sk-confirm-sub {
          text-align: left;
        }
        .sk-confirmed-compact .sk-confirm-sub {
          max-width: 420px;
          color: rgba(255,255,255,0.65);
        }
        .sk-confirmed-compact .sk-confirm-hero .btn-secondary {
          color: rgba(255,255,255,0.72);
          border-color: rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.05);
        }
        .sk-confirmed-compact .sk-package-status-card {
          margin-top: 0 !important;
          max-width: none !important;
          width: 100%;
          padding: 22px !important;
          border: 1px solid rgba(255,255,255,0.11);
          border-radius: 20px;
          background: rgba(255,255,255,0.055);
          box-shadow: none;
          text-align: left;
        }
        .sk-confirmed-compact .sk-success-ring {
          width: 62px;
          height: 62px;
          margin-bottom: 16px;
        }
        .sk-confirm-eyebrow {
          margin: 2px 0 8px;
          color: #32d875;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }
        .sk-confirmed-compact .sk-confirm-title {
          color: #fff;
          font-size: clamp(1.65rem, 2.2vw, 2.25rem);
          line-height: 1.05;
          margin-top: 0;
        }
        .sk-status-heading {
          color: #fff;
          font-size: 1.15rem;
          font-weight: 800;
          letter-spacing: -0.03em;
        }
        .sk-confirm-route {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          gap: 14px;
          margin-bottom: 16px;
          padding: 16px;
          border: 1px solid #dce3df;
          border-radius: 17px;
          background: rgba(255,255,255,0.055);
          border-color: rgba(255,255,255,0.1);
        }
        .sk-confirm-stop { min-width: 0; }
        .sk-confirm-stop span {
          display: block;
          margin-bottom: 4px;
          color: rgba(255,255,255,0.48);
          font-size: 0.66rem;
          font-weight: 800;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }
        .sk-confirm-stop strong {
          display: block;
          overflow: hidden;
          color: #fff;
          font-size: 0.86rem;
          line-height: 1.35;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sk-confirm-route-arrow { color: #19b957; }
        .sk-confirm-facts {
          display: grid;
          grid-template-columns: 1fr 0.7fr;
          gap: 10px;
          margin-bottom: 16px;
        }
        .sk-confirmed-compact .sk-package-status-card > div > div[style] {
          background: rgba(255,255,255,0.055) !important;
          border-color: rgba(255,255,255,0.1) !important;
        }
        .sk-confirmed-compact .sk-package-status-card strong,
        .sk-confirmed-compact .sk-package-status-card .sk-form-label {
          color: #fff !important;
        }
        .sk-confirmed-compact .sk-package-status-card p {
          color: rgba(255,255,255,0.58) !important;
        }
        .sk-confirmed-compact .sk-summary-pill {
          color: #dff9e8;
          border-color: rgba(49,216,117,0.22);
          background: rgba(49,216,117,0.1);
        }
        .sk-confirmed-compact .sk-package-status-card .btn-secondary {
          color: #fff;
          border-color: rgba(255,255,255,0.16);
          background: rgba(255,255,255,0.06);
        }

        .sk-spinner-ring {
          width: 64px; height: 64px; border-radius: 50%;
          border: 2px solid var(--gn-020);
          display: flex; align-items: center; justify-content: center;
        }

        .sk-success-ring {
          width: 72px; height: 72px; border-radius: 50%;
          background: var(--success-soft);
          border: 1px solid var(--gn-025);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 4px;
        }

        .sk-confirm-title {
          font-size: 1.75rem; font-weight: 800; letter-spacing: -0.04em;
          color: var(--text); margin-top: 20px; margin-bottom: 10px;
        }

        .sk-confirm-sub {
          font-size: 0.9rem; color: var(--muted); line-height: 1.65; max-width: 420px;
        }

        /* ── Light mode accent touches ── */
        html:not(.dark) .sk-stat {
          border-top: 2px solid var(--gn-018);
        }

        html:not(.dark) .sk-stat-accent {
          border-top: 2px solid var(--gn-065);
          background: linear-gradient(135deg, var(--gn-013) 0%, var(--gn-006) 100%);
          box-shadow: 0 6px 20px var(--gn-012);
        }

        html:not(.dark) .sk-card {
          border-top: 2px solid var(--gn-030);
        }

        html:not(.dark) .sk-stepper {
          border-left: 3px solid var(--gn-050);
        }

        html:not(.dark) .sk-aside-card:not(.sk-aside-card-trust) {
          border-left: 3px solid var(--gn-028);
        }

        html:not(.dark) .sk-aside-card-trust {
          border-left: 3px solid var(--gn-055);
        }

        html:not(.dark) .sk-price-row strong {
          color: var(--gn-dk);
        }

        html:not(.dark) .sk-total-row strong {
          color: var(--gn-dk);
        }

        html:not(.dark) .sk-booking-card {
          border-top: 2px solid var(--gn-030);
        }

        html:not(.dark) .sk-summary-bar {
          border-top: 2px solid var(--gn-028);
          background: linear-gradient(to bottom, var(--gn-004) 0%, var(--surface) 100%);
        }

        html:not(.dark) .sk-eyebrow,
        html:not(.dark) .sk-visual-count,
        html:not(.dark) .sk-operational-pill,
        html:not(.dark) .sk-step-active .sk-step-num {
          color: var(--gn-dk);
        }

        html:not(.dark) .sk-operational-pill,
        html:not(.dark) .sk-step-active .sk-step-num {
          border-color: var(--gn-028);
          background: var(--gn-012);
        }

        html:not(.dark) .sk-summary-pill,
        html:not(.dark) .sk-match-stat {
          border-color: var(--gn-016);
          background: var(--gn-008);
        }

        html:not(.dark) .sk-flow-num {
          background: var(--gn-018);
          border-color: var(--gn-035);
        }

        /* ── Dark mode overrides ── */
        :global(html.dark) .sk-card,
        :global(html.dark) .sk-aside-card,
        :global(html.dark) .sk-stat,
        :global(html.dark) .sk-stepper,
        :global(html.dark) .sk-booking-card,
        :global(html.dark) .sk-summary-bar {
          background: rgba(255,255,255,0.025);
          box-shadow: none;
        }

        :global(html.dark) .sk-match-stat {
          background: linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }

        /* ── Responsive ── */
        @media (max-width: 1080px) {
          .sk-header, .sk-layout { grid-template-columns: 1fr; }
          .sk-stats { grid-template-columns: repeat(3, 1fr); }
          .sk-sidebar { grid-template-columns: 1fr !important; }
        }

        @media (max-width: 860px) {
          .sk-sidebar { grid-template-columns: 1fr 1fr !important; }
        }

        @media (max-width: 700px) {
          .sk-ai-card { height: auto; max-height: none; }
          .sk-ai-enterprise-bar { margin-left: 0; margin-right: 0; }
          .sk-ai-progress { margin-left: 0; margin-right: 0; }
          .sk-ai-progress > div > span,.sk-ai-progress > div > i { display: none; }
          .sk-ai-progress > button { min-width: 100px; }
          .sk-shell {
            padding-top: 56px;
            padding-bottom: 44px;
          }
          .sk-wrap {
            padding: 10px 16px 40px;
          }
          .sk-chat-grid,
          .sk-layout,
          .sk-simple-inner {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .sk-stepper {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            padding: 12px;
            scrollbar-width: none;
            border-radius: 20px;
            margin-bottom: 14px;
          }
          .sk-stepper::-webkit-scrollbar { display: none; }
          .sk-step {
            min-width: 0;
            flex-direction: column;
            align-items: flex-start;
            justify-content: flex-start;
            gap: 10px;
            min-height: 92px;
            padding: 12px 11px;
            border-radius: 16px;
            background: rgba(255,255,255,0.56);
            border: 1px solid rgba(0,0,0,0.06);
          }
          .sk-step-num {
            width: 30px;
            height: 30px;
            border-radius: 8px;
            font-size: 0.64rem;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .sk-step-active,
          .sk-step-done {
            background: rgba(255,255,255,0.86);
          }
          .sk-step-mobile-copy {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 5px;
            max-width: none;
            min-width: 0;
          }
          .sk-step-mobile-label {
            display: block;
            font-size: 0.72rem;
            font-weight: 800;
            color: var(--muted);
            text-align: left;
            line-height: 1.24;
            overflow-wrap: anywhere;
          }
          .sk-step-mobile-desc {
            display: block;
            font-size: 0.62rem;
            line-height: 1.38;
            color: color-mix(in srgb, var(--muted) 88%, transparent);
            overflow-wrap: anywhere;
          }
          .sk-step-active .sk-step-mobile-label { color: var(--text); }
          .sk-step-active .sk-step-mobile-desc { color: var(--text); opacity: 0.8; }
          .sk-step-done .sk-step-mobile-label { color: var(--gn-dk); }
          .sk-step-done .sk-step-mobile-desc { color: var(--gn-dk); opacity: 0.82; }
          .sk-tab-row {
            position: static;
            top: auto;
            left: auto;
            transform: none;
            width: 100%;
            justify-content: stretch;
            margin-top: 12px;
            margin-bottom: 12px;
          }
          .sk-tab {
            flex: 1 1 0;
            text-align: center;
            min-height: 42px;
            padding: 9px 10px;
            border-radius: 10px;
            font-size: 0.78rem;
            background: rgba(0,0,0,0.42);
          }
          .sk-tab-active {
            box-shadow: 0 8px 24px rgba(0,0,0,0.22);
          }
          .sk-stats { grid-template-columns: repeat(3, 1fr); gap: 8px; }
          .sk-step-line { display: none; }
          .sk-step-text { display: none; }
          .sk-match-hero {
            grid-template-columns: 1fr;
            gap: 16px;
            padding: 20px 16px;
            border-radius: 20px;
          }
          .sk-match-kicker-row {
            align-items: flex-start;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 10px;
          }
          .sk-match-hero-title {
            font-size: clamp(1.5rem, 7vw, 2rem);
            line-height: 1.02;
          }
          .sk-match-hero-sub {
            font-size: 0.86rem;
            line-height: 1.62;
          }
          .sk-match-hero-stats {
            grid-template-columns: 1fr;
            min-width: 0;
          }
          .sk-match-stat {
            padding: 13px 12px;
            border-radius: 14px;
          }
          .sk-match-stat strong {
            font-size: 0.98rem;
          }
          .sk-match-stat small {
            font-size: 0.72rem;
            line-height: 1.35;
          }
          .sk-match-list {
            gap: 12px;
          }
          .sk-summary-bar {
            padding: 12px 14px;
            border-radius: 16px;
            gap: 10px;
            flex-direction: column;
            align-items: stretch;
          }
          .sk-summary-group {
            gap: 8px;
          }
          .sk-summary-actions {
            align-items: flex-start;
            gap: 6px;
          }
          .sk-summary-tip {
            max-width: none;
            text-align: left;
            font-size: 0.7rem;
          }
          .sk-summary-pill {
            font-size: 0.7rem;
            padding: 7px 10px;
          }
          .sk-match-list-subtitle {
            font-size: 0.76rem;
            line-height: 1.5;
          }
          .sk-card-top { flex-direction: column; }
          .sk-live-carrier { display: none; }
          .sk-ai-card,
          .sk-aside-card,
          .sk-booking-card,
          .sk-card {
            border-radius: 18px !important;
          }
          .sk-ai-card,
          .sk-booking-card,
          .sk-aside-card,
          .sk-card,
          .sk-empty-card {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }
          .sk-simple-left,
          .sk-ai-left,
          .sk-ai-right {
            padding-left: 18px !important;
            padding-right: 18px !important;
          }
          .sk-simple-left {
            gap: 12px;
            justify-content: flex-start;
            padding-top: 20px !important;
            padding-bottom: 18px !important;
          }
          .sk-simple-inner {
            min-height: auto;
          }
          .sk-simple-title {
            font-size: clamp(1.65rem, 7.2vw, 2.2rem);
            line-height: 1.04;
          }
          .sk-simple-subtitle {
            display: none;
          }
          .sk-lift-panel {
            padding: 12px;
            border-radius: 16px;
            gap: 10px;
          }
          .sk-lift-panel-top {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }
          .sk-lift-panel-title {
            font-size: 0.88rem;
            line-height: 1.35;
          }
          .sk-lift-panel-pills {
            justify-content: flex-start;
            gap: 6px;
          }
          .sk-lift-panel-pill {
            font-size: 0.69rem;
            padding: 7px 9px;
          }
          .sk-lift-panel-note {
            font-size: 0.72rem;
            line-height: 1.5;
          }
          .sk-info-strip {
            flex-wrap: nowrap;
            overflow-x: auto;
            padding-bottom: 2px;
            scrollbar-width: none;
          }
          .sk-info-strip::-webkit-scrollbar { display: none; }
          .sk-info-pill {
            flex: 0 0 auto;
            padding: 8px 11px;
            font-size: 0.72rem;
          }
          .sk-visual-head {
            padding: 12px 14px;
          }
          .sk-visual-counter {
            padding: 14px 0 8px;
          }
          .sk-visual-count {
            font-size: 2.3rem;
          }
          .sk-visual-routes {
            padding: 0 12px;
          }
          .sk-visual-stats {
            padding: 0 12px 12px;
          }
          .sk-live-row {
            align-items: flex-start;
            padding: 14px 14px;
            gap: 12px;
          }
          .sk-live-price-col p {
            font-size: 0.95rem;
          }
          .sk-price-hero-stats {
            grid-template-columns: 1fr;
          }
          .sk-live-footer {
            padding: 16px 14px;
            font-size: 0.82rem;
            gap: 8px;
          }
          .sk-live-expand-btn {
            width: 100%;
            justify-content: center;
            min-height: 42px;
            font-size: 0.72rem;
            padding: 10px 12px;
          }
          .sk-route-form {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 12px !important;
            align-items: stretch !important;
            scroll-margin-top: 126px;
          }
          .sk-rf-indicator { display: none !important; }
          .sk-rf-inputs {
            min-width: 0;
            border-radius: 16px;
            padding: 4px 0;
            background: rgba(255,255,255,0.1);
            box-shadow: 0 10px 28px rgba(0,0,0,0.16);
          }
          .sk-rf-input {
            font-size: 16px !important;
            min-height: 50px;
            padding-top: 14px;
            padding-bottom: 14px;
          }
          .sk-simple-title,
          .sk-card-title,
          .sk-confirm-title {
            overflow-wrap: anywhere;
          }
          .sk-weight-row:not(.sk-passenger-row) {
            display: none;
          }
          .sk-weight-row {
            overflow-x: auto;
            flex-wrap: nowrap !important;
            padding-bottom: 2px;
            scrollbar-width: none;
          }
          .sk-weight-row::-webkit-scrollbar { display: none; }
          .sk-weight-chip {
            flex: 0 0 auto;
          }
          .sk-lift-controls {
            grid-template-columns: 1fr;
            gap: 10px;
            align-items: stretch;
          }
          .sk-lift-card {
            padding: 12px;
            border-radius: 15px;
            gap: 8px;
            min-height: 0;
          }
          .sk-lift-card-head {
            margin-bottom: 2px;
          }
          .sk-lift-card-label {
            font-size: 0.67rem;
          }
          .sk-passenger-row .sk-weight-chip {
            min-width: 52px;
            min-height: 42px;
          }
          .sk-date-input {
            min-height: 40px;
            font-size: 16px !important;
            padding-top: 9px;
            padding-bottom: 9px;
          }
          .sk-find-btn {
            min-height: 52px;
            border-radius: 14px;
            font-size: 0.88rem;
            box-shadow: 0 12px 28px var(--gn-018);
          }
          .sk-ai-entry-btn {
            width: 100%;
            justify-content: center;
            min-height: 48px;
            border-radius: 14px;
            padding: 11px 14px;
            font-size: 0.8rem;
          }
          .sk-visual-route {
            grid-template-columns: 1fr auto !important;
          }
          .sk-brow {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
          .sk-brow strong {
            text-align: left;
          }
          .sk-contact-block {
            gap: 12px;
          }
          .sk-find-btn,
          .sk-submit-btn {
            width: 100%;
            justify-content: center;
          }
          .sk-confirmed-compact {
            display: grid;
            grid-template-columns: 1fr;
            gap: 0;
            padding: 14px;
            border-radius: 20px;
          }
          .sk-confirm-hero {
            align-items: flex-start;
            padding: 24px 20px;
            border-right: 0;
            text-align: left;
          }
          .sk-confirmed-compact .sk-confirm-title,
          .sk-confirmed-compact .sk-confirm-sub {
            text-align: left;
          }
          .sk-confirmed-compact .sk-package-status-card {
            padding: 20px !important;
          }
          .sk-confirm-route {
            grid-template-columns: 1fr;
            gap: 10px;
          }
          .sk-confirm-route-arrow {
            transform: rotate(90deg);
          }
          .sk-confirm-stop strong {
            white-space: normal;
          }
          .sk-confirm-facts {
            grid-template-columns: 1fr;
          }
          .sk-state-center {
            padding: 60px 16px;
          }
          .sk-confirm-sub {
            font-size: 0.84rem;
          }
          .sk-booking-card[style*='sticky'] {
            position: static !important;
            top: auto !important;
          }
        }

        @media (max-width: 380px) {
          .sk-rf-input {
            min-height: 48px;
          }
          .sk-passenger-row {
            gap: 5px;
          }
          .sk-passenger-row .sk-weight-chip {
            min-width: 46px;
          }
        }
      `}</style>
    </div>
  )
}

export default function SkickaPage() {
  return (
    <Suspense fallback={null}>
      <SkickaPageContent />
    </Suspense>
  )
}
