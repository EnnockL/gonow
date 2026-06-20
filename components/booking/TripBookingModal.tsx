'use client'

import { useState, useEffect } from 'react'
import { X, Package, Users, RotateCcw, MapPin, Phone, User, ChevronLeft } from 'lucide-react'
import { saveBooking } from '@/lib/bookings'
import { useAuth } from '@/hooks/useAuth'
import AuthModal from '@/components/auth/AuthModal'
import CarrierProfile from '@/components/driver/CarrierProfile'
import {
  clearPendingBookingDraft,
  loadPendingBookingDraft,
  savePendingBookingDraft,
  type PendingBookingDraft,
} from '@/lib/pending-booking'

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
}

const SERVICE_TYPES = [
  { key: 'package' as const, icon: Package, label: 'Paket', desc: 'Skicka ett paket med föraren' },
  { key: 'passenger' as const, icon: Users, label: 'Passagerare', desc: 'Boka en plats i bilen' },
  { key: 'return' as const, icon: RotateCcw, label: 'Retur', desc: 'Hämta upp något på vägen' },
]

const WEIGHT_PRESETS = [1, 2, 5, 10, 20]

type StepKey = 'profile' | 'type' | 'details' | 'addresses' | 'contact' | 'confirm'

function getSteps(type: string, lockType: boolean): StepKey[] {
  const steps: StepKey[] = ['profile']
  if (!lockType) steps.push('type')
  steps.push('details', 'addresses', 'contact', 'confirm')
  return steps
}

const STEP_META: Record<StepKey, { emoji: string; title: (type: string) => string; sub: (type: string) => string }> = {
  profile:   { emoji: '👋', title: () => 'Din förare',               sub: () => 'Se profil, betyg och chatta innan du bokar' },
  type:      { emoji: '🚚', title: () => 'Vad vill du göra?',        sub: () => 'Välj typ av uppdrag för denna resa' },
  details:   { emoji: '📦', title: t => t === 'passenger' ? 'Hur många åker?' : 'Hur tungt är det?', sub: t => t === 'passenger' ? 'Välj antal platser du behöver' : 'Välj vikt för ditt paket' },
  addresses: { emoji: '📍', title: () => 'Var ska det hämtas?',      sub: () => 'Ange adresser för upphämtning och avlämning' },
  contact:   { emoji: '👤', title: t => t === 'passenger' ? 'Dina uppgifter' : 'Avsändare & mottagare', sub: t => t === 'passenger' ? 'Så föraren kan nå dig' : 'Kontaktuppgifter för båda parter' },
  confirm:   { emoji: '✅', title: () => 'Allt ser bra ut!',         sub: () => 'Granska och skicka din bokningsförfrågan' },
}

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px 12px 38px', borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)',
  color: '#ffffff', fontSize: '16px', fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box', transition: 'border-color 0.15s',
}

function InputField({ icon: Icon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ElementType }) {
  return (
    <div style={{ position: 'relative' }}>
      <Icon size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
      <input {...props} style={fieldStyle}
        onFocus={e => (e.target.style.borderColor = '#22c55e')}
        onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')} />
    </div>
  )
}

export default function TripBookingModal({ trip, onClose, initialType = 'package', lockType = false }: Props) {
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

  const steps = getSteps(type, lockType)
  const [stepIdx, setStepIdx] = useState(0)
  const currentStep = steps[stepIdx]
  const isPassenger = type === 'passenger'

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (profile) {
      setSName(n => n || profile.name || '')
      setSPhone(p => p || profile.phone || '')
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
  }, [userId, pendingSubmit])

  function calcPrice() {
    if (isPassenger) return (trip.pricePerSeat ?? trip.price ?? 0) * (seats || 1)
    return trip.price ?? 0
  }

  function buildDraft(): PendingBookingDraft {
    return {
      trip_id: trip.id,
      service_type: type,
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
    await saveBooking({ ...draft, sender_id: uid })
    clearPendingBookingDraft()
    setDone(true)
  }

  function canProceed(): boolean {
    switch (currentStep) {
      case 'profile': return true
      case 'type': return true
      case 'details': return true
      case 'addresses': return pickup.trim().length > 0 && dropoff.trim().length > 0
      case 'contact': return sName.trim().length > 0 && sPhone.trim().length > 0 && (isPassenger || (rName.trim().length > 0 && rPhone.trim().length > 0))
      case 'confirm': return true
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
      await doSaveBooking(userId)
      setSubmitting(false)
      return
    }
    if (canProceed()) setStepIdx(i => i + 1)
  }

  function handleBack() {
    if (stepIdx > 0) setStepIdx(i => i - 1)
  }

  const price = calcPrice()
  const meta = STEP_META[currentStep]

  const chipBtn = (active: boolean, disabled = false): React.CSSProperties => ({
    padding: '10px 16px', borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
    border: `1.5px solid ${active ? '#22c55e' : 'rgba(255,255,255,0.12)'}`,
    background: active ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
    color: disabled ? 'rgba(255,255,255,0.25)' : active ? '#22c55e' : 'rgba(255,255,255,0.65)',
    fontSize: '0.9rem', fontWeight: 700, fontFamily: 'inherit',
    transition: 'all 0.15s', opacity: disabled ? 0.5 : 1,
  })

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
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 10 : 20 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(10,10,10,0.97)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: isMobile ? 20 : 24, width: '100%', maxWidth: 480, boxShadow: '0 32px 72px rgba(0,0,0,0.65)', display: 'flex', flexDirection: 'column', maxHeight: isMobile ? '96vh' : '92vh', overflow: 'hidden' }}>

          {/* Sticky header */}
          <div style={{ padding: isMobile ? '14px 16px' : '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)', margin: '0 0 2px' }}>Boka med {trip.carrier}</p>
              <p style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>{trip.from} → {trip.to}</p>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={13} />
            </button>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 16px 24px' : '24px 22px 28px' }}>
            {done ? (
              <div style={{ textAlign: 'center', paddingTop: 20 }}>
                <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff', marginBottom: 8 }}>Förfrågan skickad!</h3>
                <p style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 24 }}>
                  {trip.carrier} ser din bokning och svarar snart.
                </p>
                {userId && (
                  <a href="/profil" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 10, background: '#22c55e', color: '#0a0a0a', fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none' }}>
                    Följ din bokning →
                  </a>
                )}
              </div>
            ) : (
              <>
                {/* Progress dots */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 28 }}>
                  {steps.map((s, i) => (
                    <div key={s} style={{ width: i === stepIdx ? 20 : 6, height: 6, borderRadius: 99, background: i === stepIdx ? '#22c55e' : i < stepIdx ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.15)', transition: 'all 0.25s' }} />
                  ))}
                </div>

                {/* Step header */}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                  <div style={{ fontSize: '2.2rem', marginBottom: 10 }}>{meta.emoji}</div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>{meta.title(type)}</h2>
                  <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', margin: 0 }}>{meta.sub(type)}</p>
                </div>

                {/* ── Step: Profile ─────────────────────────────────── */}
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
                        <span style={{ padding: '5px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', fontWeight: 600 }}>
                          {trip.vehicleType === 'car' ? '🚗 Bil' : trip.vehicleType === 'train' ? '🚆 Tåg' : trip.vehicleType === 'bus' ? '🚌 Buss' : trip.vehicleType}
                        </span>
                      )}
                      {typeof trip.seatsLeft === 'number' && (
                        <span style={{ padding: '5px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', fontWeight: 600 }}>
                          {trip.seatsLeft} platser kvar
                        </span>
                      )}
                      {typeof trip.weightLeftKg === 'number' && (
                        <span style={{ padding: '5px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', fontWeight: 600 }}>
                          {trip.weightLeftKg} kg utrymme
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Step: Type ─────────────────────────────────────── */}
                {currentStep === 'type' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {SERVICE_TYPES.map(({ key, icon: Icon, label, desc: d }) => (
                      <button key={key} type="button" onClick={() => setType(key)} style={{
                        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                        borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                        border: `1.5px solid ${type === key ? '#22c55e' : 'rgba(255,255,255,0.1)'}`,
                        background: type === key ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
                        transition: 'all 0.15s',
                      }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${type === key ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`, background: type === key ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: type === key ? '#22c55e' : 'rgba(255,255,255,0.5)' }}>
                          <Icon size={18} />
                        </div>
                        <div>
                          <p style={{ fontSize: '0.92rem', fontWeight: 700, color: type === key ? '#22c55e' : '#fff', margin: '0 0 2px' }}>{label}</p>
                          <p style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.4)', margin: 0 }}>{d}</p>
                        </div>
                        {type === key && <div style={{ marginLeft: 'auto', width: 18, height: 18, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.65rem', color: '#0a0a0a', fontWeight: 900 }}>✓</div>}
                      </button>
                    ))}
                  </div>
                )}

                {/* ── Step: Details (weight / seats) ─────────────────── */}
                {currentStep === 'details' && !isPassenger && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                      {WEIGHT_PRESETS.map(w => (
                        <button key={w} type="button" onClick={() => setWeight(w)} style={{ ...chipBtn(weight === w), minWidth: 70, textAlign: 'center' }}>
                          {w < 20 ? `${w} kg` : '20+ kg'}
                        </button>
                      ))}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Beskrivning (valfritt)</label>
                      <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="T.ex. kläder, elektronik, böcker..." rows={2}
                        style={{ ...fieldStyle, paddingLeft: 14, resize: 'none', lineHeight: 1.5 }}
                        onFocus={e => (e.target.style.borderColor = '#22c55e')}
                        onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')} />
                    </div>
                  </div>
                )}

                {currentStep === 'details' && isPassenger && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                    {[1, 2, 3, 4].map(n => {
                      const disabled = typeof trip.seatsLeft === 'number' && n > trip.seatsLeft
                      return (
                        <button key={n} type="button" disabled={disabled} onClick={() => !disabled && setSeats(n)}
                          style={{ ...chipBtn(seats === n, disabled), minWidth: 80, textAlign: 'center', fontSize: '1.1rem' }}>
                          {n} st
                        </button>
                      )
                    })}
                    {typeof trip.seatsLeft === 'number' && (
                      <p style={{ width: '100%', textAlign: 'center', fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>
                        {trip.seatsLeft} lediga platser kvar
                      </p>
                    )}
                  </div>
                )}

                {/* ── Step: Addresses ────────────────────────────────── */}
                {currentStep === 'addresses' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Upphämtning</label>
                      <InputField icon={MapPin} value={pickup} onChange={e => setPickup(e.target.value)} placeholder={`Adress i ${trip.from}`} autoFocus />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Avlämning</label>
                      <InputField icon={MapPin} value={dropoff} onChange={e => setDropoff(e.target.value)} placeholder={`Adress i ${trip.to}`} />
                    </div>
                  </div>
                )}

                {/* ── Step: Contact ──────────────────────────────────── */}
                {currentStep === 'contact' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                        {isPassenger ? 'Dina uppgifter' : 'Avsändare'}
                      </p>
                      <InputField icon={User} value={sName} onChange={e => setSName(e.target.value)} placeholder="Namn" autoFocus />
                      <InputField icon={Phone} value={sPhone} onChange={e => setSPhone(e.target.value)} placeholder="Telefon" type="tel" />
                    </div>
                    {!isPassenger && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Mottagare</p>
                        <InputField icon={User} value={rName} onChange={e => setRName(e.target.value)} placeholder="Namn" />
                        <InputField icon={Phone} value={rPhone} onChange={e => setRPhone(e.target.value)} placeholder="Telefon" type="tel" />
                      </div>
                    )}
                  </div>
                )}

                {/* ── Step: Confirm ──────────────────────────────────── */}
                {currentStep === 'confirm' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <CarrierProfile name={trip.carrier} carrierId={trip.carrier_id} tripId={trip.id} variant="light" tripFrom={trip.from} tripTo={trip.to} />
                    {[
                      { label: 'Typ', value: SERVICE_TYPES.find(s => s.key === type)?.label ?? type },
                      isPassenger
                        ? { label: 'Passagerare', value: `${seats} st` }
                        : { label: 'Vikt', value: `${weight} kg` },
                      { label: 'Upphämtning', value: pickup },
                      { label: 'Avlämning', value: dropoff },
                      { label: isPassenger ? 'Passagerare' : 'Avsändare', value: `${sName} · ${sPhone}` },
                      ...(!isPassenger ? [{ label: 'Mottagare', value: `${rName} · ${rPhone}` }] : []),
                      { label: 'Pris', value: `${price} kr` },
                    ].map(row => (
                      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        <span style={{ fontSize: '0.75rem', color: row.label === 'Pris' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.4)', fontWeight: 600, flexShrink: 0 }}>{row.label}</span>
                        <span style={{ fontSize: row.label === 'Pris' ? '1.1rem' : '0.82rem', color: row.label === 'Pris' ? '#22c55e' : '#fff', fontWeight: row.label === 'Pris' ? 900 : 600, textAlign: 'right' }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sticky footer — back/next */}
          {!done && (
            <div style={{ padding: isMobile ? '12px 16px 20px' : '14px 22px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 10, flexShrink: 0 }}>
              {stepIdx > 0 && (
                <button type="button" onClick={handleBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 600, flexShrink: 0 }}>
                  <ChevronLeft size={15} /> Tillbaka
                </button>
              )}
              <button type="button" onClick={handleNext} disabled={!canProceed() || submitting} style={{
                flex: 1, padding: '13px', borderRadius: 10, border: 'none',
                background: canProceed() && !submitting ? '#22c55e' : 'rgba(34,197,94,0.3)',
                color: canProceed() && !submitting ? '#0a0a0a' : 'rgba(255,255,255,0.3)',
                fontSize: '0.92rem', fontWeight: 800, cursor: canProceed() && !submitting ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', transition: 'all 0.15s',
              }}>
                {submitting ? 'Skickar...' : currentStep === 'confirm' ? 'Skicka bokningsförfrågan →' : currentStep === 'profile' ? `Boka med ${trip.carrier.split(' ')[0]} →` : 'Nästa →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
