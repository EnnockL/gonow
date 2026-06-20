'use client'

import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRight, Calendar, CheckCircle2, ChevronRight, Loader2, Mail,
  MapPin, Package, Phone, Route, Scale, Users, Zap, Shield, Clock,
} from 'lucide-react'
import AuthModal from '@/components/auth/AuthModal'
import AIChat from '@/components/booking/AIChat'
import TripBookingModal, { type TripInfo } from '@/components/booking/TripBookingModal'
import TravelerCard from '@/components/booking/TravelerCard'
import CarrierProfileModal from '@/components/carrier/CarrierProfileModal'
import { useAuth } from '@/hooks/useAuth'
import { useRoutePrice } from '@/lib/hooks/useRoutePrice'
import { loadAllBookings, saveBooking, type BookingRequest } from '@/lib/bookings'
import { getMyTripBooking, getTripCapacitySnapshot } from '@/lib/trip-capacity'
import { AIParseResult, ContactInfo, Trip } from '@/lib/types'
import { loadTrips, type SavedTrip } from '@/components/driver/MyTrips'
import { loadSharedActiveTrips, localTripToActiveTrip, type ActiveTripRecord } from '@/lib/active-trips'

type Step = 'chat' | 'matches' | 'submitting' | 'confirmed'
type MatchTrip = ActiveTripRecord & {
  users?: { name: string; rating_avg: number; rating_count: number }
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

function estimateTripPrice(trip: MatchTrip) {
  return trip.price_per_kg ? Math.max(149, Math.round(99 + trip.price_per_kg * 5)) : 149
}

function keepSearchFormVisible(target: HTMLElement) {
  if (typeof window === 'undefined') return
  if (!window.matchMedia('(max-width: 820px)').matches) return

  const form = target.closest('.sk-route-form') as HTMLElement | null
  const formSection = target.closest('.sk-simple-left') as HTMLElement | null
  const anchor = formSection ?? form ?? target

  const scrollToAnchor = () => {
    anchor.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' })
  }

  window.setTimeout(scrollToAnchor, 120)
  window.setTimeout(() => {
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight
    const rect = target.getBoundingClientRect()
    if (rect.top < 88 || rect.bottom > viewportHeight - 72) {
      scrollToAnchor()
    }
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

function toTripInfo(trip: MatchTrip, bookings: BookingRequest[], userId?: string | null): TripInfo {
  const meta = getTripMeta(trip, bookings, userId)
  return {
    id: trip.id,
    from: trip.from_city,
    to: trip.to_city,
    carrier: trip.users?.name || 'Bärare',
    carrier_id: trip.carrier_id,
    price: estimateTripPrice(trip),
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
  { key: 'chat',       label: 'Utforska',        desc: 'Live-resor & AI-matchning' },
  { key: 'matches',   label: 'Välj bärare',     desc: 'Jämför matchade resor'     },
  { key: 'submitting', label: 'Skicka förfrågan', desc: 'Bekräftar bokning'         },
  { key: 'confirmed',  label: 'Klart',            desc: 'Förfrågan skickad'         },
] as const

function SkickaPageContent() {
  const { userId, profile, loading: authLoading } = useAuth()
  const [step, setStep]                   = useState<Step>('chat')
  const [parsed, setParsed]               = useState<AIParseResult | null>(null)
  const [activeTrips, setActiveTrips]     = useState<MatchTrip[]>([])
  const [activeTripModal, setActiveTripModal] = useState<TripInfo | null>(null)
  const [trips, setTrips]                 = useState<MatchTrip[]>([])
  const [selectedTrip, setSelectedTrip]   = useState<MatchTrip | null>(null)
  const [bookings, setBookings]           = useState<BookingRequest[]>([])
  const [loading, setLoading]             = useState(false)
  const [showAuth, setShowAuth]           = useState(false)
  const [submitError, setSubmitError]     = useState<string | null>(null)
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null)
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null)
  const [viewProfileCarrierId, setViewProfileCarrierId] = useState<string | null>(null)
  const { result: routePrice, calculate } = useRoutePrice()

  // Tab mode — derived directly from URL, always in sync
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabMode = searchParams.get('tab') === 'lift' ? 'lift' : 'skicka'

  function switchTab(tab: 'skicka' | 'lift') {
    setAiMode(false)
    router.replace(tab === 'lift' ? '/skicka?tab=lift' : '/skicka', { scroll: false })
  }

  // Simple form state (default Uber-like view)
  const [aiMode, setAiMode]       = useState(false)
  const [simpleFrom, setSimpleFrom] = useState('')
  const [simpleTo, setSimpleTo]     = useState('')
  const [simpleWeight, setSimpleWeight] = useState(1)

  // Lift form state
  const [liftFrom, setLiftFrom]         = useState('')
  const [liftTo, setLiftTo]             = useState('')
  const [liftDate, setLiftDate]         = useState('')
  const [liftPassengers, setLiftPassengers] = useState(1)
  const [isMobile, setIsMobile]         = useState(false)

  const [sender, setSender]       = useState<ContactInfo>({ name: '', phone: '', email: '' })
  const [recipient, setRecipient] = useState<ContactInfo>({ name: '', phone: '', email: '' })

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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
    if (step !== 'confirmed' || !createdBookingId) return

    const id = window.setInterval(async () => {
      const next = await loadAllBookings().catch(() => [])
      setBookings(next)
    }, 4000)

    return () => window.clearInterval(id)
  }, [step, createdBookingId])

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

  const isPassengerFlow = parsed?.type === 'lift'
  const contactValid =
    sender.name.trim().length >= 2 && sender.phone.trim().length >= 7 &&
    (isPassengerFlow || (recipient.name.trim().length >= 2 && recipient.phone.trim().length >= 7))

  async function handleParsed(result: AIParseResult) {
    setParsed(result)
    setSubmitError(null)
    if (result.confidence < 0.5) return
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
        calculate(result.from_city, result.to_city, result.weight_kg || 1),
      ])
      const data = await matchRes.json()
      const serverTrips = (data.trips || []) as MatchTrip[]
      const localTrips  = loadTrips()
        .filter(t => t.allows_packages && localTripMatches(t, result.from_city, result.to_city, result.departure_date))
        .map(localTripToMatchTrip)
      const merged = [...localTrips, ...serverTrips.filter(t => !localTrips.some(l => l.id === t.id))]
      setTrips(merged)
      setSelectedTrip(null)
      setStep('matches')
    } catch {
      setTrips([])
      setStep('matches')
    }
    setLoading(false)
  }

  function openTripFromActive(trip: MatchTrip) {
    setActiveTripModal(toTripInfo(trip, bookings, userId))
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
      setCreatedBookingId(booking.id)
      setStep('confirmed')
    } catch {
      setSubmitError('Kunde inte skicka bokningsförfrågan just nu. Försök igen.')
      setStep('matches')
    }
  }

  async function handleCheckout(orderId: string) {
    setPayingOrderId(orderId)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/checkout`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Kunde inte starta betalning.')
      if (data.url) {
        window.location.href = data.url
        return
      }
      throw new Error('Ingen checkout-länk kunde skapas.')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Betalning kunde inte startas.')
      setPayingOrderId(null)
    }
  }

  const stepIdx = STEPS.findIndex(s => s.key === step)

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div className="sk-shell">
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
          onClose={() => setActiveTripModal(null)}
          initialType="package"
        />
      )}
      <CarrierProfileModal
        carrierId={viewProfileCarrierId}
        onClose={() => setViewProfileCarrierId(null)}
      />

      <div className="sk-wrap">


        {/* ── PROGRESS STEPPER ────────────────────────────────── */}
        <div className="sk-stepper">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.key}>
              <div className={`sk-step ${i === stepIdx ? 'sk-step-active' : ''} ${i < stepIdx ? 'sk-step-done' : ''}`}>
                <div className="sk-step-num">
                  {i < stepIdx ? '✓' : `0${i + 1}`}
                </div>
                <div className="sk-step-text">
                  <p className="sk-step-title">
                    {s.key === 'matches' && tabMode === 'lift' ? 'Välj förare' : s.label}
                  </p>
                  <p className="sk-step-desc">{s.desc}</p>
                </div>
                <div className="sk-step-mobile-copy">
                  <div className="sk-step-mobile-label">{s.label}</div>
                  <div className="sk-step-mobile-desc">{s.desc}</div>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`sk-step-line ${i < stepIdx ? 'sk-step-line-done' : ''}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ══ STEP: CHAT ══════════════════════════════════════════════════════ */}
        {step === 'chat' && (
          <div className="sk-chat-grid">

            {/* ── Simple/AI card (area: ai) ── */}
            <div className="sk-card sk-ai-card sk-area-ai" style={{ position: 'relative' }}>

              {/* Tab switcher — centered, same height as title */}
              {!aiMode && (
                <div className="sk-tab-row">
                  {([['skicka', 'Skicka paket'], ['lift', 'Boka lift']] as const).map(([key, label]) => (
                    <button
                      key={key}
                      className={`sk-tab ${tabMode === key ? 'sk-tab-active' : ''}`}
                      onClick={() => switchTab(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {!aiMode ? (
                /* ── Simple form ── */
                <div className="sk-simple-inner">

                  {/* Left: form */}
                  <div className="sk-simple-left">

                    <p className="sk-eyebrow">{tabMode === 'lift' ? 'Samåkning' : 'Skicka paket'}</p>
                    <h2 className="sk-simple-title">
                      {tabMode === 'lift'
                        ? <>Hitta din<br />nästa resa</>
                        : <>Hitta rätt bärare<br />för din leverans</>
                      }
                    </h2>
                    <p className="sk-simple-subtitle">
                      {tabMode === 'lift'
                        ? 'SÃ¶k efter resor med lugn, tydlig planering. VÃ¤lj datum, antal passagerare och boka utan att tappa Ã¶verblicken.'
                        : 'BÃ¶rja med en enkel rutt. Gonow visar aktiva bÃ¤rare direkt och lÃ¥ter AI:n ta Ã¶ver nÃ¤r du behÃ¶ver mer precision.'}
                    </p>
                    <div className="sk-info-strip">
                      {(tabMode === 'lift'
                        ? [
                            { icon: <Calendar size={13} />, label: liftDate ? new Date(liftDate).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) : 'Flexibelt datum' },
                            { icon: <Users size={13} />, label: `${liftPassengers} pass.` },
                            { icon: <Shield size={13} />, label: 'Verifierade resor' },
                          ]
                        : [
                            { icon: <Package size={13} />, label: simpleWeight < 20 ? `${simpleWeight} kg` : '20+ kg' },
                            { icon: <Clock size={13} />, label: 'Snabb matchning' },
                            { icon: <Shield size={13} />, label: 'BankID-nÃ¤tverk' },
                          ]).map((item) => (
                        <div key={item.label} className="sk-info-pill">
                          {item.icon}
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Connected from/to fields */}
                    <div className="sk-route-form">
                      <div className="sk-rf-indicator">
                        <span className="sk-rf-dot" />
                        <span className="sk-rf-line" />
                        <span className="sk-rf-square" />
                      </div>
                      <div className="sk-rf-inputs">
                        <input
                          className="sk-rf-input"
                          placeholder="Varifrån?"
                          value={tabMode === 'lift' ? liftFrom : simpleFrom}
                          onChange={e => tabMode === 'lift' ? setLiftFrom(e.target.value) : setSimpleFrom(e.target.value)}
                          onFocus={e => keepSearchFormVisible(e.currentTarget)}
                          onKeyDown={e => e.key === 'Enter' && (tabMode === 'lift' ? handleLiftSearch() : handleSimpleSearch())}
                        />
                        <div className="sk-rf-divider" />
                        <input
                          className="sk-rf-input"
                          placeholder={tabMode === 'lift' ? 'Vart?' : 'Vart ska det?'}
                          value={tabMode === 'lift' ? liftTo : simpleTo}
                          onChange={e => tabMode === 'lift' ? setLiftTo(e.target.value) : setSimpleTo(e.target.value)}
                          onFocus={e => keepSearchFormVisible(e.currentTarget)}
                          onKeyDown={e => e.key === 'Enter' && (tabMode === 'lift' ? handleLiftSearch() : handleSimpleSearch())}
                        />
                      </div>
                    </div>

                    {/* Lift: date + passengers — desktop only */}
                    {tabMode === 'lift' && !isMobile && (
                      <div className="sk-lift-controls">
                        <div className="sk-lift-card">
                          <div className="sk-lift-card-head">
                            <span className="sk-lift-card-label">Datum</span>
                            <Calendar size={14} />
                          </div>
                          <input
                            type="date"
                            className="sk-rf-input sk-date-input"
                            value={liftDate}
                            onChange={e => setLiftDate(e.target.value)}
                            onFocus={e => keepSearchFormVisible(e.currentTarget)}
                          />
                        </div>
                        <div className="sk-lift-card">
                          <div className="sk-lift-card-head">
                            <span className="sk-lift-card-label">Platser</span>
                            <Users size={14} />
                          </div>
                          <div className="sk-weight-row sk-passenger-row">
                            {[1, 2, 3, 4].map(n => (
                              <button key={n} className={`sk-weight-chip ${liftPassengers === n ? 'active' : ''}`} onClick={() => setLiftPassengers(n)}>
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Skicka: weight chips */}
                    {tabMode !== 'lift' && (
                      <div className="sk-weight-row">
                        {[1, 2, 5, 10, 20].map(w => (
                          <button
                            key={w}
                            className={`sk-weight-chip ${simpleWeight === w ? 'active' : ''}`}
                            onClick={() => setSimpleWeight(w)}
                          >
                            {w < 20 ? `${w} kg` : '20+ kg'}
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      className="sk-find-btn"
                      onClick={tabMode === 'lift' ? handleLiftSearch : handleSimpleSearch}
                      disabled={tabMode === 'lift' ? (!liftFrom.trim() || !liftTo.trim() || loading) : (!simpleFrom.trim() || !simpleTo.trim() || loading)}
                    >
                      {loading
                        ? <><Loader2 size={14} style={{ animation: 'sk-spin 1s linear infinite' }} /> Söker...</>
                        : tabMode === 'lift'
                          ? <>Hitta lift <ArrowRight size={14} /></>
                          : <>Hitta bärare <ArrowRight size={14} /></>
                      }
                    </button>

                    <button onClick={() => setAiMode(true)} style={{
                      marginTop: 14, border: '1px solid rgba(34,197,94,0.45)',
                      background: 'rgba(34,197,94,0.12)', color: '#d9ffc8',
                      borderRadius: 10, padding: '9px 16px', cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.15)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.08)')}
                    >
                      <Zap size={13} /> AI-matchning — beskriv fritt
                    </button>
                  </div>

                  {/* Right: live trips panel */}
                  <div className="sk-simple-visual">
                    {/* Header */}
                    <div className="sk-visual-head">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="sk-live-pulse" />
                        <span className="sk-visual-label" style={{ margin: 0 }}>Live-resor</span>
                      </div>
                      <span className="sk-operational-pill">I DRIFT</span>
                    </div>

                    {/* Counter */}
                    <div className="sk-visual-counter">
                      <p className="sk-visual-count">{activeTrips.length}</p>
                      <p className="sk-visual-sub">{activeTrips.length === 1 ? 'aktiv bärare' : 'aktiva bärare'}</p>
                    </div>

                    {/* Clickable trip rows */}
                    <div className="sk-visual-routes">
                      {activeTrips.length === 0 ? (
                        <div style={{ padding: '12px 0', textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '0.76rem' }}>
                          Inga resor just nu
                        </div>
                      ) : activeTrips.slice(0, 3).map(t => (
                        <button
                          key={t.id}
                          className="sk-visual-route sk-visual-route-btn"
                          onClick={() => openTripFromActive(t)}
                          style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                            <span className="sk-vr-dot" />
                            <span className="sk-vr-from">{t.from_city.split(',')[0]}</span>
                            <span className="sk-vr-arrow">→</span>
                            <span className="sk-vr-to">{t.to_city.split(',')[0]}</span>
                            <span className="sk-vr-price" style={{ marginLeft: 'auto' }}>{estimateTripPrice(t)} kr</span>
                          </div>
                          {(activeTripMeta[t.id]?.myBookingStatus || typeof activeTripMeta[t.id]?.seatsLeft === 'number') && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 14 }}>
                              {activeTripMeta[t.id]?.myBookingStatus && (
                                <span style={{ fontSize: '0.66rem', color: activeTripMeta[t.id].myBookingStatus === 'accepted' ? '#86efac' : '#93c5fd' }}>
                                  {activeTripMeta[t.id].myBookingStatus === 'accepted' ? 'accepterad' : 'väntar'}
                                </span>
                              )}
                              {typeof activeTripMeta[t.id]?.seatsLeft === 'number' && (
                                <span style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.45)' }}>
                                  {activeTripMeta[t.id].seatsLeft} säten kvar
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Footer actions */}
                    <div className="sk-visual-footer">
                      {activeTrips.length > 0 && (
                        <button className="sk-visual-book-btn" onClick={() => openTripFromActive(activeTrips[0])}>
                          Öppna snabb-bokning <ArrowRight size={12} />
                        </button>
                      )}
                      {activeTrips.length > 0 && (
                        <button className="sk-text-link" style={{ fontSize: '0.72rem' }} onClick={() => jumpToTripMatches(activeTrips[0])}>
                          Full matchningsvy →
                        </button>
                      )}
                    </div>

                    {/* Bottom stats */}
                    <div className="sk-visual-stats">
                      <div><span>49 kr</span><p>från</p></div>
                      <div><span>2–8h</span><p>leverans</p></div>
                    </div>
                  </div>

                </div>
              ) : (
                /* ── AI mode — clean chatbox ── */
                <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Zap size={14} style={{ color: '#22c55e' }} />
                      </div>
                      <div>
                        <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#22c55e', margin: 0 }}>AI-matchning</p>
                        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', margin: 0 }}>Beskriv fritt — AI:n hittar rätt bärare</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setAiMode(false)}
                      style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit', fontWeight: 500 }}
                    >
                      ← Enkel form
                    </button>
                  </div>

                  {/* Chat */}
                  <AIChat onParsed={handleParsed} />

                  {loading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>
                      <Loader2 size={13} style={{ animation: 'sk-spin 1s linear infinite', color: '#22c55e' }} />
                      Söker bärare längs din rutt...
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* ── Info row — 3 cards side by side ── */}
            <aside className="sk-sidebar">
              {tabMode === 'lift' ? (<>
                {/* Lift sidebar: popular routes */}
                <div className="sk-aside-card">
                  <p className="sk-aside-title">Populära rutter</p>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {POPULAR_ROUTES.map(r => (
                      <button
                        key={`${r.from}-${r.to}`}
                        onClick={() => { setLiftFrom(r.from); setLiftTo(r.to) }}
                        style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '9px 0', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', transition: 'opacity 0.15s', fontFamily: 'inherit' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.65')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                      >
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 2px' }}>{r.from} → {r.to}</p>
                          <p style={{ fontSize: '0.68rem', color: 'var(--muted)', margin: 0 }}>{r.time}</p>
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', marginRight: 4 }}>{r.price}</span>
                        <ChevronRight size={12} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* BankID card */}
                <div className="sk-aside-card sk-aside-card-trust">
                  <p className="sk-aside-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Shield size={12} style={{ color: 'var(--success)' }} /> BankID-verifierat
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 14px' }}>
                    Alla chaufförer är verifierade med BankID innan de får köra på plattformen. Du vet alltid vem som hämtar upp dig.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { icon: Shield,       text: 'Identitetsverifierad förare' },
                      { icon: Package,      text: 'Bokning direkt till föraren' },
                      { icon: Clock,        text: 'Betalning när resan är klar' },
                      { icon: CheckCircle2, text: 'Skyddad escrow-betalning' },
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon size={12} style={{ color: 'var(--success)', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.73rem', color: 'var(--muted)' }}>{text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Savings card */}
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
                      { n: '03', title: 'Skicka förfrågan',  desc: 'Välj bärare och skicka förfrågan — bäraren svarar.' },
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
                      ['Stockholm → Göteborg', '149–220 kr'],
                      ['Stockholm → Malmö',    '189–280 kr'],
                      ['Göteborg → Malmö',     '99–150 kr'],
                      ['Uppsala → Stockholm',  '69–120 kr'],
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
                      { icon: Shield,  text: 'BankID-verifierad bärare' },
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

        {/* ══ STEP: MATCHES ══════════════════════════════════════════════════ */}
        {step === 'matches' && parsed && (
          <div className="sk-layout">
            <div className="sk-primary">
              <div className="sk-match-hero">
                <div className="sk-match-hero-copy">
                  <p className="sk-eyebrow">Matchade resor</p>
                  <h2 className="sk-match-hero-title">
                    {parsed.from_city.split(',')[0]} → {parsed.to_city.split(',')[0]}
                  </h2>
                  <p className="sk-match-hero-sub">
                    Välj en resa med rätt kapacitet, tydlig status och rätt pris direkt. Här ser du vilka bärare som
                    faktiskt kan ta din leverans just nu, innan du skickar förfrågan.
                  </p>
                </div>
                <div className="sk-match-hero-stats">
                  <div className="sk-match-stat">
                    <span className="sk-match-stat-k">Matchningar</span>
                    <strong>{trips.length}</strong>
                    <small>aktiva val på denna rutt</small>
                  </div>
                  <div className="sk-match-stat">
                    <span className="sk-match-stat-k">Startpris</span>
                    <strong>{routePrice ? routePrice.price : parsed.estimated_price_sek} kr</strong>
                    <small>estimat innan checkout</small>
                  </div>
                  <div className="sk-match-stat">
                    <span className="sk-match-stat-k">Typ</span>
                    <strong>{parsed.type === 'lift' ? 'Lift' : parsed.type === 'return' ? 'Retur' : 'Paket'}</strong>
                    <small>flöde och kapacitet</small>
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
                  <span className="sk-summary-tip">Välj ett kort för att låsa bokningen till rätt bärare.</span>
                  <button onClick={() => setStep('chat')} className="sk-text-link">
                    ← Ändra sökning
                  </button>
                </div>
              </div>

              {trips.length === 0 ? (
                <div className="sk-card sk-empty-card">
                  <Package size={28} style={{ color: 'var(--muted)', marginBottom: 12 }} />
                  <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Inga bärare hittades just nu</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 20 }}>Vi kan meddela dig när någon kör den rutten.</p>
                  <button onClick={() => setStep('chat')} className="sk-text-link">
                    ← Ändra sökning
                  </button>
                </div>
              ) : (
                <div className="sk-card sk-match-card">
                  <div className="sk-card-top" style={{ marginBottom: 16 }}>
                    <div>
                      <p className="sk-eyebrow">Matchade resor</p>
                      <h2 className="sk-card-title">{trips.length} bärare passar din rutt</h2>
                      <p className="sk-match-list-subtitle">Jämför först kapacitet och status. Öppna sedan bokningen med den bärare som känns tryggast.</p>
                    </div>
                  </div>
                  <div className="sk-match-list">
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
                <div className="sk-price-hero" style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.04) 100%)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 16, padding: '18px 20px', marginBottom: 20, textAlign: 'center' }}>
                  <p style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 6 }}>Beräknat pris</p>
                  <p style={{ fontSize: '2.2rem', fontWeight: 900, color: '#22c55e', letterSpacing: '-0.04em', lineHeight: 1, margin: 0 }}>
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
                  Skicka bokningsförfrågan <ArrowRight size={14} />
                </button>

                {!selectedTrip   && <p className="sk-hint">Välj en bärare ovan för att fortsätta</p>}
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
            <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginTop: 20 }}>Skickar bokningsförfrågan...</p>
          </div>
        )}

        {/* ══ STEP: CONFIRMED ════════════════════════════════════════════════ */}
        {step === 'confirmed' && (
          <div className="sk-state-center">
            <div className="sk-success-ring">
              <CheckCircle2 size={32} style={{ color: 'var(--success)' }} />
            </div>
            <h2 className="sk-confirm-title">Förfrågan skickad!</h2>
            <p className="sk-confirm-sub">
              Bäraren har fått din bokningsförfrågan. När den accepteras
              går vi vidare med betalning och spårning.
            </p>
            {createdBookingId && (
              <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 4 }}>
                Referens: {createdBookingId.slice(0, 8).toUpperCase()}
              </p>
            )}
            {createdBookingTrip && (
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
                      ? 'rgba(34,197,94,0.12)'
                      : createdBookingStatus === 'pending'
                        ? 'rgba(59,130,246,0.08)'
                        : 'rgba(148,163,184,0.12)',
                    color: createdBookingStatus === 'accepted'
                      ? '#15803d'
                      : createdBookingStatus === 'pending'
                        ? '#2563eb'
                        : 'var(--muted)',
                    border: `1px solid ${createdBookingStatus === 'accepted'
                      ? 'rgba(34,197,94,0.22)'
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
                    <strong style={{ color: 'var(--text)' }}>{createdBookingTrip.users?.name || 'Bärare'}</strong>
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
                    ? 'Din plats eller leverans är bekräftad.'
                    : 'Förfrågan är skickad — bäraren hör av sig.'}
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

        .sk-glow-l, .sk-glow-r {
          position: absolute;
          border-radius: 999px;
          filter: blur(80px);
          pointer-events: none;
        }
        .sk-glow-l {
          width: 360px; height: 360px;
          top: 60px; left: -100px;
          background: radial-gradient(circle, rgba(34,197,94,0.09) 0%, transparent 70%);
        }
        .sk-glow-r {
          width: 420px; height: 420px;
          top: 280px; right: -130px;
          background: radial-gradient(circle, rgba(34,197,94,0.07) 0%, transparent 70%);
        }

        .sk-wrap {
          max-width: 1200px;
          margin: 0 auto;
          padding: 44px 24px 64px;
          position: relative;
          z-index: 1;
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
          border-color: rgba(34,197,94,0.25);
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
          font-size: 0.78rem; font-weight: 700;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--muted);
          transition: all 0.2s;
        }

        .sk-step-active .sk-step-num {
          background: var(--accent-soft);
          border-color: rgba(34,197,94,0.35);
          color: var(--accent);
        }

        .sk-step-done .sk-step-num {
          background: rgba(34,197,94,0.1);
          border-color: rgba(34,197,94,0.25);
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

        .sk-step-line {
          width: 28px; height: 2px;
          background: var(--border);
          flex-shrink: 0;
          margin: 0 6px;
          border-radius: 2px;
          transition: background 0.2s;
        }
        .sk-step-line-done { background: rgba(34,197,94,0.4); }

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
          background: #22c55e;
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
          color: #22c55e;
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
          background: rgba(34,197,94,0.08);
          border-color: rgba(34,197,94,0.2);
        }

        .sk-vr-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #22c55e;
          flex-shrink: 0;
        }

        .sk-vr-from  { font-size: 0.78rem; font-weight: 700; color: #fff; }
        .sk-vr-arrow { font-size: 0.7rem; color: rgba(255,255,255,0.3); flex-shrink: 0; }
        .sk-vr-to    { font-size: 0.78rem; color: rgba(255,255,255,0.55); flex: 1; }
        .sk-vr-price { font-size: 0.78rem; font-weight: 700; color: #22c55e; flex-shrink: 0; }

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
          color: rgba(190,242,100,0.92);
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
        @media (max-width: 700px) {
          .sk-simple-inner { grid-template-columns: 1fr; }
          .sk-simple-visual {
            display: flex;
            margin: 0 18px 18px;
            border-radius: 18px;
            min-height: 0;
          }
          .sk-simple-left {
            padding: 22px 20px 18px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
          }
        }

        /* ── AI card — BCG two-column ── */
        .sk-ai-card {
          padding: 0;
          overflow: hidden;
          background:
            linear-gradient(rgba(0,0,0,0.80), rgba(0,0,0,0.80)),
            url('/hero-city.jpg') center / cover no-repeat !important;
          border: none !important;
        }

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
          background: rgba(34,197,94,0.06);
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
          background: rgba(34,197,94,0.04);
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
          color: #86efac;
          border-color: rgba(34,197,94,0.22);
          background: rgba(34,197,94,0.08);
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
          background: #22c55e;
          box-shadow: 0 0 10px #22c55e88;
          display: inline-block;
        }

        .sk-operational-pill {
          padding: 5px 11px; border-radius: 999px;
          border: 1px solid rgba(134,239,172,0.22);
          background: rgba(34,197,94,0.1);
          color: #86efac;
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
        .sk-live-row:hover { background: rgba(34,197,94,0.04); }

        .sk-route-indicator {
          display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0;
        }
        .sk-route-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: rgba(34,197,94,0.6);
        }
        .sk-route-dot.own { background: #bef264; }
        .sk-route-line {
          width: 1px; height: 20px;
          background: linear-gradient(to bottom, #22c55e, #22c55e);
        }

        .sk-live-from {
          font-size: 0.94rem; font-weight: 700;
          color: #fff; line-height: 1.2; margin-bottom: 4px;
          display: flex; align-items: center; gap: 7px;
        }

        .sk-own-tag {
          font-size: 0.6rem; font-weight: 800;
          padding: 2px 7px; border-radius: 999px;
          border: 1px solid rgba(190,242,100,0.28);
          background: rgba(190,242,100,0.14);
          color: #bef264;
        }

        .sk-live-to {
          font-size: 0.78rem; color: rgba(255,255,255,0.55);
        }

        .sk-live-carrier {
          min-width: 76px; text-align: center; flex-shrink: 0;
          font-size: 0.82rem; color: rgba(255,255,255,0.88); font-weight: 600;
        }

        .sk-new-carrier {
          font-size: 0.7rem; color: #bef264; display: block; margin-top: 3px;
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
          border-color: rgba(34,197,94,0.25);
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
          border: 1px solid rgba(34,197,94,0.2);
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
            linear-gradient(180deg, rgba(34,197,94,0.035), transparent 80%),
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
          border: 1px solid rgba(34,197,94,0.2);
          background: rgba(34,197,94,0.06);
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
            radial-gradient(circle at top right, rgba(34,197,94,0.12), transparent 34%),
            linear-gradient(180deg, rgba(34,197,94,0.04), rgba(34,197,94,0.015)),
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
          border: 1px solid rgba(34,197,94,0.16);
          background: rgba(34,197,94,0.08);
          display: flex;
          flex-direction: column;
          gap: 6px;
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
            linear-gradient(180deg, rgba(34,197,94,0.025), transparent 24%),
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
          border: 1px solid rgba(34,197,94,0.16);
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

        .sk-spinner-ring {
          width: 64px; height: 64px; border-radius: 50%;
          border: 2px solid rgba(34,197,94,0.2);
          display: flex; align-items: center; justify-content: center;
        }

        .sk-success-ring {
          width: 72px; height: 72px; border-radius: 50%;
          background: var(--success-soft);
          border: 1px solid rgba(34,197,94,0.25);
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
          border-top: 2px solid rgba(34,197,94,0.18);
        }

        html:not(.dark) .sk-stat-accent {
          border-top: 2px solid rgba(34,197,94,0.65);
          background: linear-gradient(135deg, rgba(34,197,94,0.13) 0%, rgba(34,197,94,0.06) 100%);
          box-shadow: 0 6px 20px rgba(34,197,94,0.12);
        }

        html:not(.dark) .sk-card {
          border-top: 2px solid rgba(34,197,94,0.3);
        }

        html:not(.dark) .sk-stepper {
          border-left: 3px solid rgba(34,197,94,0.5);
        }

        html:not(.dark) .sk-aside-card:not(.sk-aside-card-trust) {
          border-left: 3px solid rgba(34,197,94,0.28);
        }

        html:not(.dark) .sk-aside-card-trust {
          border-left: 3px solid rgba(34,197,94,0.55);
        }

        html:not(.dark) .sk-price-row strong {
          color: #15803d;
        }

        html:not(.dark) .sk-total-row strong {
          color: #15803d;
        }

        html:not(.dark) .sk-booking-card {
          border-top: 2px solid rgba(34,197,94,0.3);
        }

        html:not(.dark) .sk-summary-bar {
          border-top: 2px solid rgba(34,197,94,0.28);
          background: linear-gradient(to bottom, rgba(34,197,94,0.04) 0%, var(--surface) 100%);
        }

        html:not(.dark) .sk-eyebrow,
        html:not(.dark) .sk-visual-count,
        html:not(.dark) .sk-operational-pill,
        html:not(.dark) .sk-step-active .sk-step-num {
          color: #15803d;
        }

        html:not(.dark) .sk-operational-pill,
        html:not(.dark) .sk-step-active .sk-step-num {
          border-color: rgba(22,163,74,0.28);
          background: rgba(22,163,74,0.12);
        }

        html:not(.dark) .sk-summary-pill,
        html:not(.dark) .sk-match-stat {
          border-color: rgba(22,163,74,0.16);
          background: rgba(22,163,74,0.08);
        }

        html:not(.dark) .sk-flow-num {
          background: rgba(34,197,94,0.18);
          border-color: rgba(34,197,94,0.35);
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
          .sk-shell {
            padding-top: 68px;
            padding-bottom: 44px;
          }
          .sk-wrap {
            padding: 18px 16px 40px;
          }
          .sk-chat-grid,
          .sk-layout,
          .sk-simple-inner {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .sk-stepper {
            flex-wrap: nowrap;
            overflow-x: auto;
            gap: 10px;
            padding: 14px 14px 6px;
            scrollbar-width: none;
            border-radius: 18px;
          }
          .sk-stepper::-webkit-scrollbar { display: none; }
          .sk-step {
            flex: 0 0 auto;
            min-width: 76px;
            flex-direction: column;
            align-items: center;
            gap: 8px;
          }
          .sk-step-num {
            width: 44px;
            height: 44px;
            border-radius: 14px;
          }
          .sk-step-mobile-copy {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 3px;
            max-width: 88px;
          }
          .sk-step-mobile-label {
            display: block;
            font-size: 0.7rem;
            font-weight: 800;
            color: var(--muted);
            text-align: center;
            line-height: 1.2;
          }
          .sk-step-mobile-desc {
            display: block;
            font-size: 0.58rem;
            line-height: 1.25;
            text-align: center;
            color: var(--muted-2);
          }
          .sk-step-active .sk-step-mobile-label { color: var(--text); }
          .sk-step-active .sk-step-mobile-desc { color: var(--muted); }
          .sk-step-done .sk-step-mobile-label { color: #15803d; }
          .sk-step-done .sk-step-mobile-desc { color: #15803d; }
          .sk-tab-row {
            position: static;
            top: auto;
            left: auto;
            transform: none;
            width: 100%;
            justify-content: stretch;
            margin-bottom: 18px;
          }
          .sk-tab {
            flex: 1 1 0;
            text-align: center;
            padding: 10px 12px;
            border-radius: 12px;
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
            gap: 14px;
            padding: 18px 16px;
            border-radius: 18px;
          }
          .sk-match-hero-title {
            font-size: clamp(1.35rem, 6.8vw, 1.9rem);
            line-height: 1.05;
          }
          .sk-match-hero-sub {
            font-size: 0.82rem;
            line-height: 1.58;
          }
          .sk-match-hero-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            min-width: 0;
          }
          .sk-match-stat {
            padding: 12px 10px;
            border-radius: 14px;
          }
          .sk-match-stat strong {
            font-size: 0.88rem;
          }
          .sk-match-stat small {
            font-size: 0.62rem;
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
            font-size: 0.84rem;
            line-height: 1.62;
            max-width: none;
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
            grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
            gap: 10px;
            align-items: stretch;
          }
          .sk-lift-card {
            padding: 11px 12px;
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
            min-width: 48px;
            min-height: 40px;
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
            box-shadow: 0 12px 28px rgba(34,197,94,0.18);
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
          .sk-lift-controls {
            grid-template-columns: 1fr !important;
          }
          .sk-rf-input {
            min-height: 48px;
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
