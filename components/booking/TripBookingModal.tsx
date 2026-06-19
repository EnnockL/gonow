'use client'

import { useState, useEffect } from 'react'
import { X, Package, Users, RotateCcw, MapPin, Phone, Mail, User } from 'lucide-react'
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
  { key: 'package' as const, icon: Package, label: 'Paket' },
  { key: 'passenger' as const, icon: Users, label: 'Passagerare' },
  { key: 'return' as const, icon: RotateCcw, label: 'Retur' },
]

const WEIGHT_PRESETS = [1, 2, 5, 10, 20]

const inp: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px 10px 34px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.07)',
  color: '#ffffff',
  fontSize: '0.85rem',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

function Field({ icon: Icon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ElementType }) {
  return (
    <div style={{ position: 'relative' }}>
      <Icon size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }} />
      <input
        {...props}
        style={inp}
        onFocus={e => (e.target.style.borderColor = '#92ff63')}
        onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
      />
    </div>
  )
}

export default function TripBookingModal({
  trip,
  onClose,
  initialType = 'package',
  lockType = false,
}: Props) {
  const { userId, profile } = useAuth()
  const vehicleLabel = [trip.vehicleMake, trip.vehicleModel].filter(Boolean).join(' ') || trip.vehicleType || ''

  const [type, setType] = useState<'package' | 'passenger' | 'return'>(initialType)
  const [weight, setWeight] = useState(2)
  const [passengerSeats, setPassengerSeats] = useState(1)
  const [desc, setDesc] = useState('')
  const [pickup, setPickup] = useState('')
  const [dropoff, setDropoff] = useState('')
  const [sName, setSName] = useState('')
  const [sPhone, setSPhone] = useState('')
  const [sEmail, setSEmail] = useState('')

  useEffect(() => {
    if (profile) {
      setSName(n => n || profile.name || '')
      setSPhone(p => p || profile.phone || '')
      setSEmail(e => e || profile.email || '')
    }
  }, [profile])
  const [rName, setRName] = useState('')
  const [rPhone, setRPhone] = useState('')
  const [rEmail, setREmail] = useState('')
  const [done, setDone] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [pendingSubmit, setPendingSubmit] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const isPassenger = type === 'passenger'
  const tooManySeats = isPassenger && typeof trip.seatsLeft === 'number' && passengerSeats > trip.seatsLeft

  // Auto-submit after login if user logged in on the same tab (not via email confirmation in new tab)
  useEffect(() => {
    if (pendingSubmit && userId && !done) {
      setPendingSubmit(false)
      const draft = loadPendingBookingDraft()
      // If draft is gone, /auth/callback already submitted it — don't double-submit
      if (!draft || draft.trip_id !== trip.id) return
      doSaveBooking(userId, draft)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, pendingSubmit])

  function calcPriceEst(): number {
    if (isPassenger) {
      return (trip.pricePerSeat ?? trip.price ?? 0) * (passengerSeats || 1)
    }
    if (trip.pricePerKg && weight > 0) return Math.round(trip.pricePerKg * weight * 100) / 100
    return trip.price ?? 0
  }

  function buildDraft(): PendingBookingDraft {
    return {
      trip_id: trip.id,
      service_type: type,
      seats_requested: isPassenger ? passengerSeats : undefined,
      weight_kg: isPassenger ? 0 : weight,
      description: desc,
      pickup_address: pickup,
      dropoff_address: dropoff,
      sender_name: sName,
      sender_phone: sPhone,
      sender_email: sEmail,
      recipient_name: isPassenger ? sName : rName,
      recipient_phone: isPassenger ? sPhone : rPhone,
      recipient_email: isPassenger ? sEmail : rEmail,
      status: 'pending',
      price_est: calcPriceEst(),
    }
  }

  async function doSaveBooking(uid: string, draftOverride?: PendingBookingDraft) {
    const draft = draftOverride ?? buildDraft()
    await saveBooking({
      ...draft,
      sender_id: uid,
    })
    clearPendingBookingDraft()
    setDone(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (tooManySeats) return
    if (!userId) {
      savePendingBookingDraft(buildDraft())
      setPendingSubmit(true)
      setShowAuth(true)
      return
    }
    await doSaveBooking(userId)
  }

  return (
    <>
      {showAuth && (
        <AuthModal
          reason="Du behöver logga in för att skicka en bokningsförfrågan"
          defaultTab="login"
          onClose={() => setShowAuth(false)}
          onSuccess={() => setShowAuth(false)}
        />
      )}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: isMobile ? 10 : 20,
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: 'rgba(10,10,10,0.95)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: isMobile ? 18 : 24,
            width: '100%',
            maxWidth: 500,
            maxHeight: isMobile ? '94vh' : '92vh',
            overflowY: 'auto',
            boxShadow: '0 32px 72px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <div style={{
            padding: isMobile ? '16px 16px 14px' : '20px 24px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
            position: 'sticky', top: 0,
            background: 'rgba(10,10,10,0.95)',
            borderRadius: isMobile ? '18px 18px 0 0' : '24px 24px 0 0',
            zIndex: 1,
          }}>
            <div>
              <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.48)', marginBottom: 3 }}>Boka resa med {trip.carrier}</p>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
                {trip.from} → {trip.to}
              </h2>
            </div>
            <button
              onClick={onClose}
              style={{ width: 32, height: 32, borderRadius: 999, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <X size={14} />
            </button>
          </div>

          {done ? (
              <div style={{ padding: isMobile ? '32px 16px' : '48px 24px', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid rgba(146,255,99,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '1.5rem' }}>
                ✓
              </div>
              <h3 style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)', marginBottom: 8 }}>Förfrågan skickad!</h3>
              <p style={{ fontSize: '0.83rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
                {trip.carrier} ser din bokning och väljer om de vill ta uppdraget.
              </p>
              {userId && (
                <a href="/profil" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, background: '#92ff63', color: '#0a0a0a', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}>
                  Följ din bokning →
                </a>
              )}
            </div>
          ) : (
            <form onSubmit={submit} style={{ padding: isMobile ? '16px 16px 18px' : '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <CarrierProfile
                name={trip.carrier}
                carrierId={trip.carrier_id}
                tripId={trip.id}
                variant={isPassenger ? 'full' : 'light'}
                tripFrom={trip.from}
                tripTo={trip.to}
              />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {vehicleLabel && (
                  <span style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#ffffff', fontSize: '0.72rem', fontWeight: 700 }}>
                    {vehicleLabel}
                  </span>
                )}
                {trip.vehiclePlate && (
                  <span style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#ffffff', fontSize: '0.72rem', fontWeight: 700 }}>
                    Regnr {trip.vehiclePlate}
                  </span>
                )}
                {typeof trip.acceptedPassengers === 'number' && trip.acceptedPassengers > 0 && (
                  <span style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(146,255,99,0.28)', background: 'rgba(146,255,99,0.12)', color: '#92ff63', fontSize: '0.72rem', fontWeight: 700 }}>
                    {trip.acceptedPassengers} passagerare redan bekräftade
                  </span>
                )}
                {typeof trip.seatsLeft === 'number' && (
                  <span style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#ffffff', fontSize: '0.72rem', fontWeight: 700 }}>
                    {trip.seatsLeft} säten kvar
                  </span>
                )}
                {typeof trip.vehicleSeatsTotal === 'number' && (
                  <span style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#ffffff', fontSize: '0.72rem', fontWeight: 700 }}>
                    {trip.vehicleSeatsTotal} totalt i bilen
                  </span>
                )}
                {trip.myBookingStatus && (
                  <span style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(59,130,246,0.16)', background: 'rgba(59,130,246,0.08)', color: '#93c5fd', fontSize: '0.72rem', fontWeight: 700 }}>
                    {trip.myBookingStatus === 'accepted' ? 'Din förfrågan är accepterad' : trip.myBookingStatus === 'pending' ? 'Du väntar på svar' : 'Tidigare svar finns'}
                  </span>
                )}
              </div>

              <div>
                <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.48)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Typ av uppdrag</p>
                {lockType ? (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1px solid rgba(146,255,99,0.28)',
                      background: 'rgba(146,255,99,0.12)',
                      color: '#92ff63',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                    }}
                  >
                    {SERVICE_TYPES.find((item) => item.key === type)?.label ?? 'Passagerare'}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 8 }}>
                    {SERVICE_TYPES.map(({ key, icon: Icon, label }) => (
                      <button key={key} type="button" onClick={() => setType(key)} style={{
                        padding: '10px 6px', borderRadius: 10,
                        border: `1px solid ${type === key ? '#92ff63' : 'rgba(255,255,255,0.1)'}`,
                        background: type === key ? 'rgba(146,255,99,0.15)' : 'rgba(255,255,255,0.06)',
                        color: type === key ? '#92ff63' : 'rgba(255,255,255,0.55)',
                        cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 500,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                        transition: 'all 0.15s',
                      }}>
                        <Icon size={14} /> {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {!isPassenger && (
                <div>
                  <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.48)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Vikt</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {WEIGHT_PRESETS.map(w => (
                      <button key={w} type="button" onClick={() => setWeight(w)} style={{
                        padding: '7px 14px', borderRadius: 8,
                        border: `1px solid ${weight === w ? '#92ff63' : 'rgba(255,255,255,0.1)'}`,
                        background: weight === w ? 'rgba(146,255,99,0.15)' : 'rgba(255,255,255,0.06)',
                        color: weight === w ? '#92ff63' : 'rgba(255,255,255,0.55)',
                        fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                      }}>
                        {w < 20 ? `${w} kg` : '20+ kg'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isPassenger && (
                <div>
                  <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.48)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Antal personer</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[1, 2, 3, 4].map((count) => {
                      const disabled = typeof trip.seatsLeft === 'number' && count > trip.seatsLeft
                      return (
                        <button key={count} type="button" disabled={disabled} onClick={() => setPassengerSeats(count)} style={{
                          padding: '7px 14px', borderRadius: 8,
                          border: `1px solid ${passengerSeats === count ? '#92ff63' : 'rgba(255,255,255,0.1)'}`,
                          background: passengerSeats === count ? 'rgba(146,255,99,0.15)' : 'rgba(255,255,255,0.06)',
                          color: disabled ? 'rgba(255,255,255,0.22)' : passengerSeats === count ? '#92ff63' : 'rgba(255,255,255,0.55)',
                          fontSize: '0.8rem', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', opacity: disabled ? 0.55 : 1,
                        }}>
                          {count} st
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Adresser</p>
                <div style={{ position: 'relative' }}>
                  <MapPin size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
                  <input value={pickup} onChange={e => setPickup(e.target.value)} placeholder={`Upphämtning i ${trip.from}`} required style={inp} onFocus={e => (e.target.style.borderColor = '#92ff63')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                </div>
                <div style={{ position: 'relative' }}>
                  <MapPin size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
                  <input value={dropoff} onChange={e => setDropoff(e.target.value)} placeholder={`Avlämning i ${trip.to}`} required style={inp} onFocus={e => (e.target.style.borderColor = '#92ff63')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                </div>
              </div>

              <div>
                <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.48)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Beskrivning (valfritt)</p>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Beskriv kort vad som ska skickas..." rows={2}
                  style={{ ...inp, paddingLeft: 12, resize: 'none', lineHeight: 1.5, color: '#ffffff' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {isPassenger ? 'Passagerare' : 'Avsändare'}
                </p>
                <Field icon={User} value={sName} onChange={e => setSName(e.target.value)} placeholder="Namn" required />
                <Field icon={Phone} value={sPhone} onChange={e => setSPhone(e.target.value)} placeholder="Telefon *" type="tel" required />
                <Field icon={Mail} value={sEmail} onChange={e => setSEmail(e.target.value)} placeholder="E-post (valfritt)" type="email" />
              </div>

              {!isPassenger && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Mottagare</p>
                  <Field icon={User} value={rName} onChange={e => setRName(e.target.value)} placeholder="Namn" required />
                  <Field icon={Phone} value={rPhone} onChange={e => setRPhone(e.target.value)} placeholder="Telefon *" type="tel" required />
                  <Field icon={Mail} value={rEmail} onChange={e => setREmail(e.target.value)} placeholder="E-post (valfritt)" type="email" />
                </div>
              )}

              {tooManySeats && (
                <p style={{ fontSize: '0.74rem', color: '#fca5a5' }}>
                  Det finns inte tillräckligt många lediga säten kvar för den här förfrågan.
                </p>
              )}

              <button
                type="submit"
                disabled={tooManySeats}
                style={{
                  width: '100%', padding: '13px', borderRadius: 10, border: 'none',
                  background: 'var(--accent)', color: '#0a0a0a',
                  fontSize: '0.9rem', fontWeight: 700, cursor: tooManySeats ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  transition: 'opacity 0.15s', opacity: tooManySeats ? 0.45 : 1,
                }}
                onMouseEnter={e => { if (!tooManySeats) (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
                onMouseLeave={e => { if (!tooManySeats) (e.currentTarget as HTMLElement).style.opacity = '1' }}
              >
                Skicka bokningsförfrågan →
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
