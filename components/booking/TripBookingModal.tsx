'use client'

import { useEffect, useState } from 'react'
import { X, Package, Users, RotateCcw, MapPin, Phone, User, ChevronLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import AuthModal from '@/components/auth/AuthModal'
import AIChat from '@/components/booking/AIChat'
import CarrierProfile from '@/components/driver/CarrierProfile'
import { authedFetch } from '@/lib/auth/authed-fetch'
import {
  clearPendingBookingDraft,
  loadPendingBookingDraft,
  savePendingBookingDraft,
  type PendingBookingDraft,
} from '@/lib/pending-booking'
import type { AIParseResult } from '@/lib/types'

export interface TripInfo {
  id: string
  from: string
  to: string
  carrier: string
  carrier_id?: string
  price: number
  pricePerKg?: number
  pricePerSeat?: number
  vehicleType?: string
  vehicleMake?: string
  vehicleModel?: string
  vehicleColor?: string
  vehiclePlate?: string
  vehicleSeatsTotal?: number
  acceptedPassengers?: number
  acceptedPackages?: number
  seatsLeft?: number | null
  weightLeftKg?: number | null
  myBookingStatus?: string | null
}

interface Props {
  trip: TripInfo
  onClose: () => void
  initialType?: 'package' | 'passenger' | 'return'
  lockType?: boolean
  entryMode?: 'driver' | 'package'
  createWithoutTrip?: boolean
  onSwitchToAI?: () => void
}

const SERVICE_TYPES = [
  { key: 'package' as const, icon: Package, label: 'Paket', desc: 'Skicka ett paket med föraren' },
  { key: 'passenger' as const, icon: Users, label: 'Passagerare', desc: 'Boka en plats i bilen' },
  { key: 'return' as const, icon: RotateCcw, label: 'Retur', desc: 'Hämta upp något på vägen' },
]

const WEIGHT_PRESETS = [1, 2, 5, 10, 20]

type StepKey = 'package' | 'profile' | 'type' | 'details' | 'addresses' | 'contact' | 'confirm'

function getSteps(type: string, lockType: boolean, entryMode: 'driver' | 'package'): StepKey[] {
  const steps: StepKey[] = [entryMode === 'package' ? 'package' : 'profile']
  if (!lockType) steps.push('type')
  steps.push('details', 'addresses', 'contact', 'confirm')
  return steps
}

const STEP_META: Record<
  StepKey,
  {
    emoji: string
    title: (type: string, generic: boolean) => string
    sub: (type: string, generic: boolean) => string
  }
> = {
  package: {
    emoji: '📦',
    title: (_type, generic) => (generic ? 'Ditt paket' : 'Din transport'),
    sub: (_type, generic) =>
      generic
        ? 'Gonow leder bokningen steg för steg och matchar rätt transport efter din information.'
        : 'Gonow håller ihop bokning, betalning och leverans på den valda rutten.',
  },
  profile: {
    emoji: '👋',
    title: () => 'Din förare',
    sub: () => 'Se profil, betyg och chatta innan du bokar',
  },
  type: {
    emoji: '🚚',
    title: () => 'Vad vill du göra?',
    sub: () => 'Välj typ av uppdrag för denna resa',
  },
  details: {
    emoji: '📦',
    title: (type) => (type === 'passenger' ? 'Hur många åker?' : 'Hur tungt är det?'),
    sub: (type) =>
      type === 'passenger' ? 'Välj antal platser du behöver' : 'Välj vikt för ditt paket',
  },
  addresses: {
    emoji: '📍',
    title: (_type, generic) => (generic ? 'Var ska paketet gå?' : 'Var ska det hämtas?'),
    sub: (_type, generic) =>
      generic ? 'Ange upphämtning och leverans så matchar Gonow rätt transport.' : 'Ange adresser för upphämtning och avlämning',
  },
  contact: {
    emoji: '👤',
    title: (type) => (type === 'passenger' ? 'Dina uppgifter' : 'Avsändare och mottagare'),
    sub: (type) =>
      type === 'passenger' ? 'Så föraren kan nå dig' : 'Kontaktuppgifter för båda parter',
  },
  confirm: {
    emoji: '✅',
    title: () => 'Allt ser bra ut!',
    sub: () => 'Granska och skicka din bokningsförfrågan',
  },
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px 12px 38px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: '#ffffff',
  fontSize: '16px',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

function InputField({
  icon: Icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ElementType }) {

  return (
    <div style={{ position: 'relative' }}>
      <Icon
        size={14}
        style={{
          position: 'absolute',
          left: 13,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'rgba(255,255,255,0.35)',
          pointerEvents: 'none',
        }}
      />
      <input
        {...props}
        style={fieldStyle}
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--gn)'
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'rgba(255,255,255,0.12)'
        }}
      />
    </div>
  )
}

function inferCity(address: string, fallback: string) {
  const value = address.trim()
  if (!value) return fallback
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean)
  return parts.at(-1) || value
}

export default function TripBookingModal({
  trip,
  onClose,
  initialType = 'package',
  lockType = false,
  entryMode = 'driver',
  createWithoutTrip = false,
  onSwitchToAI,
}: Props) {
  const { userId, profile } = useAuth()

  const [type, setType] = useState<'package' | 'passenger' | 'return'>(initialType)
  const [weight, setWeight] = useState(2)
  const [seats, setSeats] = useState(1)
  const [desc, setDesc] = useState('')
  const [pickup, setPickup] = useState('')
  const [dropoff, setDropoff] = useState('')
  const [sName, setSName] = useState('')
  const [sPhone, setSPhone] = useState('')
  const [rName, setRName] = useState('')
  const [rPhone, setRPhone] = useState('')
  const [done, setDone] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [pendingSubmit, setPendingSubmit] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [aiAssist, setAiAssist] = useState(false)
  const [aiPreview, setAiPreview] = useState<AIParseResult | null>(null)
  const [submittedPackageId, setSubmittedPackageId] = useState<string | null>(null)
  const [requestId] = useState(() => crypto.randomUUID())
  const [transitionDirection, setTransitionDirection] = useState<'forward' | 'backward'>('forward')
  const [transitionTick, setTransitionTick] = useState(0)

  const steps = getSteps(type, lockType, entryMode)
  const [stepIdx, setStepIdx] = useState(0)
  const currentStep = steps[stepIdx]
  const isPassenger = type === 'passenger'
  const isGenericPackageFlow = entryMode === 'package' && createWithoutTrip

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (profile) {
      setSName((name) => name || profile.name || '')
      setSPhone((phone) => phone || profile.phone || '')
    }
  }, [profile])

  useEffect(() => {
    if (pendingSubmit && userId && !done) {
      setPendingSubmit(false)
      const draft = loadPendingBookingDraft()
      if (!draft || draft.trip_id !== trip.id) return
      doSaveBooking(userId, draft)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, pendingSubmit, done, trip.id])

  function calcPrice() {
    if (isPassenger) return (trip.pricePerSeat ?? trip.price ?? 0) * (seats || 1)
    return trip.price ?? 0
  }

  function buildDraft(): PendingBookingDraft {
    return {
      request_id: requestId,
      trip_id: trip.id,
      trip_from_city: trip.from,
      trip_to_city: trip.to,
      service_type: type,
      package_type: type === 'return' ? 'return' : 'package',
      seats_requested: isPassenger ? seats : undefined,
      weight_kg: isPassenger ? 0 : weight,
      description: desc,
      pickup_address: pickup,
      dropoff_address: dropoff,
      sender_name: sName,
      sender_phone: sPhone,
      sender_email: '',
      recipient_name: isPassenger ? sName : rName,
      recipient_phone: isPassenger ? sPhone : rPhone,
      recipient_email: '',
      status: 'pending',
      price_est: calcPrice(),
    }
  }

  async function doSaveBooking(uid: string, draftOverride?: PendingBookingDraft) {
    const draft = draftOverride ?? buildDraft()
    const fromCity = createWithoutTrip ? inferCity(draft.pickup_address, 'Upphämtning') : trip.from
    const toCity = createWithoutTrip ? inferCity(draft.dropoff_address, 'Leverans') : trip.to
    let verifiedPrice = draft.price_est ?? calcPrice()
    if (verifiedPrice <= 0) {
      const distanceResponse = await fetch(`/api/distance?from=${encodeURIComponent(draft.pickup_address)}&to=${encodeURIComponent(draft.dropoff_address)}`)
      const distancePayload = await distanceResponse.json().catch(() => ({}))
      if (!distanceResponse.ok || !distancePayload.distance_km) {
        throw new Error(distancePayload.error || 'Kunde inte beräkna rutten. Kontrollera adresserna.')
      }
      const priceResponse = await fetch(`/api/price?distance_km=${distancePayload.distance_km}&weight_kg=${draft.weight_kg}&urgency=flexible`)
      const pricePayload = await priceResponse.json().catch(() => ({}))
      if (!priceResponse.ok || !pricePayload.price) {
        throw new Error(pricePayload.error || 'Kunde inte beräkna priset.')
      }
      verifiedPrice = pricePayload.price
    }
    const response = await authedFetch('/api/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': draft.request_id },
      body: JSON.stringify({
        ...(createWithoutTrip ? {} : { trip_id: trip.id }),
        service_type: draft.service_type,
        from_city: fromCity,
        from_address: draft.pickup_address,
        to_city: toCity,
        to_address: draft.dropoff_address,
        description:
          draft.description.trim() ||
          (draft.service_type === 'return'
            ? 'Returuppdrag via Gonow'
            : draft.service_type === 'passenger'
              ? 'Passagerarförfrågan via Gonow'
              : 'Paket via Gonow'),
        weight_kg: draft.service_type === 'passenger' ? 0 : draft.weight_kg,
        price_ceiling: verifiedPrice,
        receiver_name: draft.recipient_name,
        receiver_phone: draft.recipient_phone,
        package_type: draft.service_type,
        deadline: 'flexible',
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload.error || 'Kunde inte skicka bokningen.')
    }
    setSubmittedPackageId(payload.package?.id ?? null)
    clearPendingBookingDraft()
    setDone(true)
  }

  function canProceed(): boolean {
    switch (currentStep) {
      case 'package':
      case 'profile':
      case 'type':
      case 'details':
      case 'confirm':
        return true
      case 'addresses':
        return pickup.trim().length >= 3 && dropoff.trim().length >= 3
      case 'contact':
        return (
          sName.trim().length >= 2 &&
          sPhone.trim().length >= 7 &&
          (isPassenger || (rName.trim().length >= 2 && rPhone.trim().length >= 7))
        )
      default:
        return false
    }
  }

  async function handleNext() {
    if (currentStep === 'confirm') {
      if (!userId) {
        savePendingBookingDraft(buildDraft())
        setPendingSubmit(true)
        setShowAuth(true)
        return
      }
      setSubmitting(true)
      try {
        await doSaveBooking(userId)
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Kunde inte skicka bokningen.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (canProceed()) {
      setTransitionDirection('forward')
      setTransitionTick((tick) => tick + 1)
      setStepIdx((index) => index + 1)
    }
  }

  function handleBack() {
    if (stepIdx > 0) {
      setTransitionDirection('backward')
      setTransitionTick((tick) => tick + 1)
      setStepIdx((index) => index - 1)
    }
  }

  const meta = STEP_META[currentStep]
  const price = calcPrice()
  const compactVehicle = [trip.vehicleMake, trip.vehicleModel].filter(Boolean).join(' ')
  const routeCapacity =
    typeof trip.weightLeftKg === 'number' ? `${trip.weightLeftKg} kg ledigt` : `${trip.price} kr start`

  const chipBtn = (active: boolean, disabled = false): React.CSSProperties => ({
    padding: '10px 16px',
    borderRadius: 10,
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: `1.5px solid ${active ? 'var(--gn)' : 'rgba(255,255,255,0.12)'}`,
    background: active ? 'var(--gn-015)' : 'rgba(255,255,255,0.06)',
    color: disabled ? 'rgba(255,255,255,0.25)' : active ? 'var(--gn)' : 'rgba(255,255,255,0.65)',
    fontSize: '0.9rem',
    fontWeight: 700,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    opacity: disabled ? 0.5 : 1,
  })

  const headerEyebrow = isGenericPackageFlow ? 'Skicka med Gonow' : entryMode === 'package' ? 'Vald transport' : `Boka med ${trip.carrier}`
  const headerTitle = isGenericPackageFlow ? 'Paketbokning' : `${trip.from} → ${trip.to}`
  const headerSubtext = isGenericPackageFlow
    ? 'Gonow matchar rätt transport efter paketets vikt, adresser och timing.'
    : null
  const stepProgress = steps.length > 1 ? Math.round((stepIdx / (steps.length - 1)) * 100) : 100

  const genericStatRows = [
    { label: 'Ansvar', value: 'Gonow håller ihop allt' },
    { label: 'Betalning', value: 'Escrow före upphämtning' },
    { label: 'Nästa steg', value: 'Paketinformation' },
    { label: 'Leverans', value: 'Sparning och bekräftelse' },
  ]
  const summaryRows = [
    { label: 'Typ', value: SERVICE_TYPES.find((service) => service.key === type)?.label ?? type },
    isPassenger ? { label: 'Passagerare', value: `${seats} st` } : { label: 'Vikt', value: `${weight} kg` },
    { label: 'Upphamtning', value: pickup },
    { label: 'Avlamning', value: dropoff },
    { label: isPassenger ? 'Passagerare' : 'Avsandare', value: `${sName} · ${sPhone}` },
    ...(!isPassenger ? [{ label: 'Mottagare', value: `${rName} · ${rPhone}` }] : []),
    { label: 'Pris', value: `${price} kr` },
  ]
  const trustPillStyle: React.CSSProperties = {
    padding: '7px 11px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.72)',
    fontSize: '0.72rem',
    fontWeight: 700,
    lineHeight: 1.1,
  }

  function openAiAssist() {
    setAiPreview(null)
    setAiAssist(true)
  }

  function closeAiAssist() {
    setAiPreview(null)
    setAiAssist(false)
  }

  function handleAiPreview(result: AIParseResult) {
    setAiPreview(result)
  }

  function handleAiParsed(result: AIParseResult) {
    const nextType = result.type === 'return' ? 'return' : result.type === 'lift' ? 'passenger' : 'package'
    const nextSteps = getSteps(nextType, lockType, entryMode)
    const targetStep = result.weight_kg ? 'addresses' : 'details'
    const targetIndex = Math.max(nextSteps.indexOf(targetStep), 0)

    setType(nextType)
    setDesc(result.description || '')
    setWeight(result.weight_kg ?? 2)
    setPickup(result.from_city || '')
    setDropoff(result.to_city || '')
    setAiAssist(false)
    setTransitionDirection('forward')
    setTransitionTick((tick) => tick + 1)
    setStepIdx(targetIndex)
  }


  return (
    <>
      {showAuth && (
        <AuthModal
          reason="Logga in för att skicka bokningsförfrågan"
          defaultTab="login"
          onClose={() => setShowAuth(false)}
          onSuccess={() => setShowAuth(false)}
        />
      )}

      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 300,
          background: 'rgba(0,0,0,0.6)',

          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isMobile ? 10 : 20,
        }}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            background:
              'radial-gradient(circle at top, rgba(41,214,92,0.14) 0%, rgba(41,214,92,0.04) 18%, rgba(10,10,10,0.97) 45%), rgba(10,10,10,0.97)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: isMobile ? 20 : 24,
            width: '100%',
            maxWidth: 480,
            boxShadow: '0 32px 72px rgba(0,0,0,0.65)',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: isMobile ? '96vh' : '92vh',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <style>{`
            @keyframes gnModalFloatIn {
              from { opacity: 0; transform: translateY(18px) scale(0.985); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes gnStepForward {
              from { opacity: 0; transform: translateX(24px) translateY(4px) scale(0.992); filter: blur(4px); }
              to { opacity: 1; transform: translateX(0) translateY(0) scale(1); filter: blur(0); }
            }
            @keyframes gnStepBackward {
              from { opacity: 0; transform: translateX(-24px) translateY(4px) scale(0.992); filter: blur(4px); }
              to { opacity: 1; transform: translateX(0) translateY(0) scale(1); filter: blur(0); }
            }
            @keyframes gnPulseSoft {
              0%, 100% { transform: scale(1); opacity: 0.72; }
              50% { transform: scale(1.08); opacity: 1; }
            }
            @keyframes gnGlowSweep {
              0% { transform: translateX(-45%) rotate(0deg); opacity: 0.18; }
              50% { opacity: 0.34; }
              100% { transform: translateX(40%) rotate(8deg); opacity: 0.18; }
            }
          `}</style>
          <div
            style={{
              position: 'absolute',
              inset: 'auto auto 0 -18%',
              width: 240,
              height: 240,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(41,214,92,0.14) 0%, rgba(41,214,92,0.06) 36%, transparent 72%)',
              filter: 'blur(10px)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: -80,
              right: -80,
              width: 220,
              height: 220,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.03) 40%, transparent 72%)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              padding: isMobile ? '14px 16px' : '18px 22px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)', margin: 0 }}>{headerEyebrow}</p>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 9px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.56)',
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--gn)',
                      boxShadow: '0 0 12px rgba(41,214,92,0.85)',
                      animation: 'gnPulseSoft 1.9s ease-in-out infinite',
                    }}
                  />
                  Steg {stepIdx + 1} av {steps.length}
                </span>
              </div>
              <p style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>{headerTitle}</p>
              {headerSubtext && (
                <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.46)', margin: '6px 0 0' }}>{headerSubtext}</p>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {onSwitchToAI && (
                <button
                  onClick={onSwitchToAI}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 11px',
                    borderRadius: 999,
                    border: '1px solid rgba(41,214,92,0.3)',
                    background: 'rgba(41,214,92,0.08)',
                    color: 'var(--gn)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    letterSpacing: '0.02em',
                  }}
                >
                  ✨ AI
                </button>
              )}
              <button
                onClick={onClose}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.07)',
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          <div style={{ position: 'relative', height: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${stepProgress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, rgba(41,214,92,0.55) 0%, var(--gn) 48%, rgba(148,255,194,0.9) 100%)',
                boxShadow: '0 0 18px rgba(41,214,92,0.42)',
                transition: 'width 0.34s cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: -8,
                left: `${Math.max(0, stepProgress - 16)}%`,
                width: 72,
                height: 20,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.26), transparent)',
                filter: 'blur(6px)',
                animation: 'gnGlowSweep 2.5s ease-in-out infinite',
                pointerEvents: 'none',
              }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 16px 24px' : '24px 22px 28px', position: 'relative', zIndex: 1 }}>
            {done ? (
              <div style={{ textAlign: 'center', paddingTop: 20, animation: 'gnModalFloatIn 0.34s cubic-bezier(0.22, 1, 0.36, 1)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff', marginBottom: 8 }}>Paketet är bokat!</h3>
                <p style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 24 }}>
                  {isGenericPackageFlow
                    ? 'Gonow matchar nu rätt transport och uppdaterar dig så snart paketet går vidare.'
                    : `${trip.carrier} ser din bokning och svarar snart.`}
                </p>
                {userId && (
                  <a
                    href={submittedPackageId ? `/paket/${submittedPackageId}` : '/profil?tab=my_packages'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '11px 22px',
                      borderRadius: 10,
                      background: 'var(--gn)',
                      color: '#0a0a0a',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      textDecoration: 'none',
                    }}
                  >
                    Se paketets status →
                  </a>
                )}
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
                  {steps.map((step, index) => (
                    <div
                      key={step}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          width: index === stepIdx ? 24 : 8,
                          height: 8,
                          borderRadius: 99,
                          background:
                            index === stepIdx ? 'linear-gradient(90deg, var(--gn) 0%, rgba(148,255,194,0.92) 100%)' : index < stepIdx ? 'var(--gn-040)' : 'rgba(255,255,255,0.15)',
                          boxShadow: index === stepIdx ? '0 0 16px rgba(41,214,92,0.42)' : 'none',
                          transition: 'all 0.25s',
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div
                  key={`${currentStep}-${transitionTick}`}
                  style={{
                    animation:
                      transitionDirection === 'forward'
                        ? 'gnStepForward 0.32s cubic-bezier(0.22, 1, 0.36, 1)'
                        : 'gnStepBackward 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                  <div
                    style={{
                      width: 78,
                      height: 78,
                      margin: '0 auto 14px',
                      borderRadius: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 20px 40px rgba(0,0,0,0.18)',
                    }}
                  >
                    <div style={{ fontSize: '2rem' }}>{meta.emoji}</div>
                  </div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                    {meta.title(type, isGenericPackageFlow)}
                  </h2>
                  <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                    {meta.sub(type, isGenericPackageFlow)}
                  </p>
                </div>

                {currentStep === 'package' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {isGenericPackageFlow && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                          gap: 8,
                          padding: '6px',
                          borderRadius: 18,
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(255,255,255,0.035)',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={closeAiAssist}
                          style={{
                            width: '100%',
                            padding: '14px 14px 15px',
                            borderRadius: 14,
                            border: aiAssist ? '1px solid transparent' : '1px solid rgba(41,214,92,0.22)',
                            background: aiAssist
                              ? 'transparent'
                              : 'linear-gradient(180deg, rgba(41,214,92,0.12), rgba(41,214,92,0.05))',
                            color: '#ebfff1',
                            fontFamily: 'inherit',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 5,
                            textAlign: 'left',
                            boxShadow: aiAssist ? 'none' : '0 12px 24px rgba(41,214,92,0.08)',
                            transition: 'all 0.18s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fff' }}>Steg for steg</span>
                            {!aiAssist && (
                              <span
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 999,
                                  background: 'rgba(41,214,92,0.12)',
                                  border: '1px solid rgba(41,214,92,0.22)',
                                  color: 'var(--gn)',
                                  fontSize: '0.64rem',
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.06em',
                                }}
                              >
                                Aktiv
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.62)', lineHeight: 1.5 }}>
                            Tydlig paketresa med vikt, adresser och kontaktuppgifter.
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={openAiAssist}
                          style={{
                            width: '100%',
                            padding: '14px 14px 15px',
                            borderRadius: 14,
                            border: aiAssist ? '1px solid rgba(41,214,92,0.22)' : '1px solid transparent',
                            background: aiAssist
                              ? 'linear-gradient(180deg, rgba(41,214,92,0.12), rgba(41,214,92,0.05))'
                              : 'transparent',
                            color: '#ebfff1',
                            fontFamily: 'inherit',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 5,
                            textAlign: 'left',
                            boxShadow: aiAssist ? '0 12px 24px rgba(41,214,92,0.08)' : 'none',
                            transition: 'all 0.18s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fff' }}>Beskriv till Gonow</span>
                            {aiAssist && (
                              <span
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 999,
                                  background: 'rgba(41,214,92,0.12)',
                                  border: '1px solid rgba(41,214,92,0.22)',
                                  color: 'var(--gn)',
                                  fontSize: '0.64rem',
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.06em',
                                }}
                              >
                                Aktiv
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.62)', lineHeight: 1.5 }}>
                            Skriv fritt sa fyller GIS bokningen och hoppar till ratt steg.
                          </span>
                        </button>
                      </div>
                    )}
                    <div
                      style={{
                        padding: '16px',
                        borderRadius: 18,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(255,255,255,0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <p
                            style={{
                              margin: '0 0 4px',
                              fontSize: '0.72rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              color: 'rgba(255,255,255,0.42)',
                              fontWeight: 700,
                            }}
                          >
                            {isGenericPackageFlow ? 'Paketresa' : 'Vald transport'}
                          </p>
                          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                            {isGenericPackageFlow ? 'Gonow organiserar transporten' : `${trip.from} → ${trip.to}`}
                          </p>
                        </div>
                        <span
                          style={{
                            padding: '7px 10px',
                            borderRadius: 999,
                            background: 'var(--gn-015)',
                            border: '1px solid var(--gn-040)',
                            color: 'var(--gn)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                          }}
                        >
                          {isGenericPackageFlow ? 'Paket forst' : `${trip.price} kr`}
                        </span>
                      </div>
                      <p style={{ margin: 0, color: 'rgba(255,255,255,0.62)', fontSize: '0.82rem', lineHeight: 1.6 }}>
                        {isGenericPackageFlow
                          ? 'Börja med vikt, adresser och kontaktuppgifter. Gonow matchar sedan rätt transport, håller betalningen och följer paketet hela vägen.'
                          : 'Börja med paketets vikt, adresser och kontaktuppgifter. Gonow håller ihop bokning, betalning, upphämtning och leverans i samma resa.'}
                      </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                      {(isGenericPackageFlow
                        ? genericStatRows
                        : [
                            { label: 'Transport', value: compactVehicle || 'Verifierad rutt' },
                            { label: 'Kapacitet', value: routeCapacity },
                            { label: 'Betalning', value: 'Hålls av Gonow' },
                            { label: 'Nästa steg', value: 'Paketinfo' },
                          ]
                      ).map((item) => (
                        <div
                          key={item.label}
                          style={{
                            padding: '12px',
                            borderRadius: 14,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.04)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.66rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              color: 'rgba(255,255,255,0.38)',
                              fontWeight: 700,
                            }}
                          >
                            {item.label}
                          </span>
                          <strong style={{ fontSize: '0.84rem', color: '#fff', fontWeight: 800 }}>{item.value}</strong>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <span style={trustPillStyle}>Gonow verifierar flodet</span>
                      <span style={trustPillStyle}>Betalning halls sakert</span>
                      <span style={trustPillStyle}>Sparning aktiveras automatiskt</span>
                    </div>
                    {isGenericPackageFlow && aiAssist && (
                      <div
                        style={{
                          borderRadius: 18,
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))',
                          padding: isMobile ? '14px' : '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <div>
                            <p
                              style={{
                                margin: '0 0 4px',
                                fontSize: '0.72rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                color: 'var(--gn)',
                                fontWeight: 800,
                              }}
                            >
                              AI-assistans
                            </p>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.62)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                              Beskriv leveransen naturligt. Gonow fyller resten av bokningen at dig.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={closeAiAssist}
                            style={{
                              border: '1px solid rgba(255,255,255,0.12)',
                              background: 'rgba(255,255,255,0.05)',
                              color: 'rgba(255,255,255,0.72)',
                              borderRadius: 999,
                              padding: '8px 12px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              flexShrink: 0,
                            }}
                          >
                            Snabb start
                          </button>
                        </div>
                        {aiPreview && (
                          <div
                            style={{
                              padding: '14px 15px',
                              borderRadius: 16,
                              border: '1px solid rgba(41,214,92,0.2)',
                              background: 'linear-gradient(180deg, rgba(41,214,92,0.12), rgba(41,214,92,0.04))',
                              boxShadow: '0 18px 36px rgba(41,214,92,0.08)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.08em',
                                  color: 'var(--gn)',
                                  fontWeight: 800,
                                }}
                              >
                                Gonow forstod detta
                              </span>
                              <span
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: 999,
                                  background: 'rgba(255,255,255,0.08)',
                                  color: '#ecfff1',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                }}
                              >
                                {aiPreview.estimated_price_sek} kr
                              </span>
                            </div>
                            <strong style={{ fontSize: '1rem', color: '#fff', fontWeight: 800 }}>
                              {aiPreview.from_city} → {aiPreview.to_city}
                            </strong>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              <span style={trustPillStyle}>{aiPreview.type === 'return' ? 'Retur' : aiPreview.type === 'lift' ? 'Lift' : 'Paket'}</span>
                              {typeof aiPreview.weight_kg === 'number' && <span style={trustPillStyle}>{aiPreview.weight_kg} kg</span>}
                              {aiPreview.urgency && <span style={trustPillStyle}>{aiPreview.urgency}</span>}
                            </div>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: '0.78rem', lineHeight: 1.55 }}>
                              GIS fyller nu bokningen och hoppar dig vidare till ratt steg.
                            </p>
                          </div>
                        )}
                        <AIChat onParsed={handleAiParsed} onPreview={handleAiPreview} />
                      </div>
                    )}
                  </div>
                )}

                {currentStep === 'profile' && (
                  <div>
                    <CarrierProfile
                      name={trip.carrier}
                      carrierId={trip.carrier_id}
                      tripId={trip.id}
                      variant="full"
                      tripFrom={trip.from}
                      tripTo={trip.to}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                      {trip.vehicleType && (
                        <span
                          style={{
                            padding: '5px 10px',
                            borderRadius: 999,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.05)',
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                          }}
                        >
                          {trip.vehicleType === 'car'
                            ? 'Bil'
                            : trip.vehicleType === 'train'
                              ? 'Tåg'
                              : trip.vehicleType === 'bus'
                                ? 'Buss'
                                : trip.vehicleType}
                        </span>
                      )}
                      {typeof trip.seatsLeft === 'number' && (
                        <span
                          style={{
                            padding: '5px 10px',
                            borderRadius: 999,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.05)',
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                          }}
                        >
                          {trip.seatsLeft} platser kvar
                        </span>
                      )}
                      {typeof trip.weightLeftKg === 'number' && (
                        <span
                          style={{
                            padding: '5px 10px',
                            borderRadius: 999,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.05)',
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                          }}
                        >
                          {trip.weightLeftKg} kg utrymme
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {currentStep === 'type' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {SERVICE_TYPES.map(({ key, icon: Icon, label, desc: description }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setType(key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          padding: '14px 16px',
                          borderRadius: 14,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          textAlign: 'left',
                          border: `1.5px solid ${type === key ? 'var(--gn)' : 'rgba(255,255,255,0.1)'}`,
                          background: type === key ? 'var(--gn-012)' : 'rgba(255,255,255,0.05)',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            border: `1px solid ${type === key ? 'var(--gn-040)' : 'rgba(255,255,255,0.1)'}`,
                            background: type === key ? 'var(--gn-015)' : 'rgba(255,255,255,0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            color: type === key ? 'var(--gn)' : 'rgba(255,255,255,0.5)',
                          }}
                        >
                          <Icon size={18} />
                        </div>
                        <div>
                          <p style={{ fontSize: '0.92rem', fontWeight: 700, color: type === key ? 'var(--gn)' : '#fff', margin: '0 0 2px' }}>{label}</p>
                          <p style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.4)', margin: 0 }}>{description}</p>
                        </div>
                        {type === key && (
                          <div
                            style={{
                              marginLeft: 'auto',
                              width: 18,
                              height: 18,
                              borderRadius: '50%',
                              background: 'var(--gn)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              fontSize: '0.65rem',
                              color: '#0a0a0a',
                              fontWeight: 900,
                            }}
                          >
                            âœ“
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {currentStep === 'details' && !isPassenger && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div
                      style={{
                        padding: '16px',
                        borderRadius: 18,
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div>
                          <p style={{ margin: '0 0 4px', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                            Paketprofil
                          </p>
                          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#fff' }}>{weight < 20 ? `${weight} kg valt` : '20+ kg valt'}</p>
                        </div>
                        <div
                          style={{
                            padding: '8px 10px',
                            borderRadius: 999,
                            background: 'var(--gn-015)',
                            border: '1px solid var(--gn-040)',
                            color: 'var(--gn)',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                          }}
                        >
                          ca {price} kr
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                        {WEIGHT_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setWeight(preset)}
                            style={{ ...chipBtn(weight === preset), minWidth: 70, textAlign: 'center' }}
                          >
                            {preset < 20 ? `${preset} kg` : '20+ kg'}
                          </button>
                        ))}
                        <span style={trustPillStyle}>Pris låses innan upphämtning</span>
                        <span style={trustPillStyle}>Gonow matchar rätt kapacitet</span>
                      </div>
                    </div>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: 'rgba(255,255,255,0.4)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          marginBottom: 8,
                        }}
                      >
                        Beskrivning (valfritt)
                      </label>
                      <textarea
                        value={desc}
                        onChange={(event) => setDesc(event.target.value)}
                        placeholder="T.ex. kläder, elektronik, böcker..."
                        rows={2}
                        style={{ ...fieldStyle, paddingLeft: 14, resize: 'none', lineHeight: 1.5 }}
                        onFocus={(event) => {
                          event.target.style.borderColor = 'var(--gn)'
                        }}
                        onBlur={(event) => {
                          event.target.style.borderColor = 'rgba(255,255,255,0.12)'
                        }}
                      />
                    </div>
                  </div>
                )}

                {currentStep === 'details' && isPassenger && (
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: 18,
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ margin: '0 0 4px', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                          Platsbehov
                        </p>
                        <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#fff' }}>{seats} plats{seats > 1 ? 'er' : ''} vald</p>
                      </div>
                      <div
                        style={{
                          padding: '8px 10px',
                          borderRadius: 999,
                          background: 'var(--gn-015)',
                          border: '1px solid var(--gn-040)',
                          color: 'var(--gn)',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                        }}
                      >
                        {price} kr totalt
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                      {[1, 2, 3, 4].map((count) => {
                        const disabled = typeof trip.seatsLeft === 'number' && count > trip.seatsLeft
                        return (
                          <button
                            key={count}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              if (!disabled) setSeats(count)
                            }}
                            style={{ ...chipBtn(seats === count, disabled), minWidth: 80, textAlign: 'center', fontSize: '1.1rem' }}
                          >
                            {count} st
                          </button>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {typeof trip.seatsLeft === 'number' && <span style={trustPillStyle}>{trip.seatsLeft} lediga platser kvar</span>}
                      <span style={trustPillStyle}>Gonow laser platsen efter betalning</span>
                    </div>
                  </div>
                )}

                {currentStep === 'addresses' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: 'rgba(255,255,255,0.4)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          marginBottom: 8,
                        }}
                      >
                        Upphämtning
                      </label>
                      <InputField
                        icon={MapPin}
                        value={pickup}
                        onChange={(event) => setPickup(event.target.value)}
                        placeholder={isGenericPackageFlow ? 'Upphämtningsadress' : `Adress i ${trip.from}`}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: 'rgba(255,255,255,0.4)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          marginBottom: 8,
                        }}
                      >
                        Avlämning
                      </label>
                      <InputField
                        icon={MapPin}
                        value={dropoff}
                        onChange={(event) => setDropoff(event.target.value)}
                        placeholder={isGenericPackageFlow ? 'Leveransadress' : `Adress i ${trip.to}`}
                      />
                    </div>
                  </div>
                )}

                {currentStep === 'contact' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <p
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: 'rgba(255,255,255,0.4)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          margin: 0,
                        }}
                      >
                        {isPassenger ? 'Dina uppgifter' : 'Avsändare'}
                      </p>
                      <InputField icon={User} value={sName} onChange={(event) => setSName(event.target.value)} placeholder="Namn" autoFocus />
                      <InputField icon={Phone} value={sPhone} onChange={(event) => setSPhone(event.target.value)} placeholder="Telefon" type="tel" />
                    </div>
                    {!isPassenger && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <p
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: 'rgba(255,255,255,0.4)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            margin: 0,
                          }}
                        >
                          Mottagare
                        </p>
                        <InputField icon={User} value={rName} onChange={(event) => setRName(event.target.value)} placeholder="Namn" />
                        <InputField icon={Phone} value={rPhone} onChange={(event) => setRPhone(event.target.value)} placeholder="Telefon" type="tel" />
                      </div>
                    )}
                  </div>
                )}

                {currentStep === 'confirm' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {entryMode === 'driver' ? (
                      <CarrierProfile
                        name={trip.carrier}
                        carrierId={trip.carrier_id}
                        tripId={trip.id}
                        variant="light"
                        tripFrom={trip.from}
                        tripTo={trip.to}
                      />
                    ) : (
                      <div
                        style={{
                          padding: '14px 16px',
                          borderRadius: 16,
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(255,255,255,0.04)',
                        }}
                      >
                        <p
                          style={{
                            margin: '0 0 6px',
                            fontSize: '0.72rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            color: 'rgba(255,255,255,0.42)',
                            fontWeight: 700,
                          }}
                        >
                          {isGenericPackageFlow ? 'Gonow tar över härifrån' : 'Gonow bokar vald transport'}
                        </p>
                        <p style={{ margin: '0 0 8px', fontSize: '0.96rem', fontWeight: 800, color: '#fff' }}>
                          {isGenericPackageFlow ? 'Paketets resa startar nu' : `${trip.from} → ${trip.to}`}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.55 }}>
                          {isGenericPackageFlow
                            ? 'Efter att du skickat förfrågan matchar Gonow rätt transport, håller betalningen säkert, följer paketet under resan och frigör utbetalning efter bekräftad leverans.'
                            : 'Din bokning går in i samma paketresa: betalning hålls, upphämtning bekräftas, paketet spåras och utbetalning sker efter leverans.'}
                        </p>
                      </div>
                    )}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: 10,
                        marginBottom: 6,
                      }}
                    >
                      {[
                        { label: 'Flöde', value: isGenericPackageFlow ? 'GIS matchar' : 'Vald resa' },
                        { label: 'Betalning', value: 'Escrow' },
                        { label: 'Efter leverans', value: 'Payout frigörs' },
                      ].map((item) => (
                        <div
                          key={item.label}
                          style={{
                            padding: '12px',
                            borderRadius: 14,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.04)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 5,
                          }}
                        >
                          <span style={{ fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.38)', fontWeight: 700 }}>
                            {item.label}
                          </span>
                          <strong style={{ fontSize: '0.84rem', color: '#fff', fontWeight: 800 }}>{item.value}</strong>
                        </div>
                      ))}
                    </div>
                    {summaryRows.map((row) => (
                      <div
                        key={row.label}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 12,
                          padding: '10px 0',
                          borderBottom: '1px solid rgba(255,255,255,0.07)',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: row.label === 'Pris' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.4)',
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {row.label}
                        </span>
                        <span
                          style={{
                            fontSize: row.label === 'Pris' ? '1.1rem' : '0.82rem',
                            color: row.label === 'Pris' ? 'var(--gn)' : '#fff',
                            fontWeight: row.label === 'Pris' ? 900 : 600,
                            textAlign: 'right',
                          }}
                        >
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                </div>
              </>
            )}
          </div>

          {!done && (
            <div
              style={{
                padding: isMobile ? '12px 16px 20px' : '14px 22px 20px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                gap: 10,
                flexShrink: 0,
              }}
            >
              {stepIdx > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '12px 16px',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.6)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    flexShrink: 0,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <ChevronLeft size={15} /> Tillbaka
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                disabled={!canProceed() || submitting}
                style={{
                  flex: 1,
                  padding: '13px',
                  borderRadius: 10,
                  border: 'none',
                  background: canProceed() && !submitting ? 'var(--gn)' : 'var(--gn-030)',
                  color: canProceed() && !submitting ? '#0a0a0a' : 'rgba(255,255,255,0.3)',
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  cursor: canProceed() && !submitting ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease, background 0.18s ease',
                  boxShadow: canProceed() && !submitting ? '0 18px 32px rgba(41,214,92,0.22)' : 'none',
                }}
                onMouseEnter={(event) => {
                  if (!canProceed() || submitting) return
                  event.currentTarget.style.transform = 'translateY(-1px) scale(1.01)'
                  event.currentTarget.style.boxShadow = '0 22px 40px rgba(41,214,92,0.28)'
                  event.currentTarget.style.filter = 'brightness(1.03)'
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.transform = 'translateY(0) scale(1)'
                  event.currentTarget.style.boxShadow = canProceed() && !submitting ? '0 18px 32px rgba(41,214,92,0.22)' : 'none'
                  event.currentTarget.style.filter = 'none'
                }}
              >
                {submitting
                  ? 'Skickar...'
                  : currentStep === 'confirm'
                    ? 'Skicka bokningsförfrågan →'
                    : currentStep === 'profile'
                      ? `Boka med ${trip.carrier.split(' ')[0]} →`
                      : 'Nästa →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

