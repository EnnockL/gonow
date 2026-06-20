'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight, Shield, Star, Package, MapPin } from 'lucide-react'
import TripBookingModal, { type TripInfo } from '@/components/booking/TripBookingModal'
import AllTripsModal from '@/components/booking/AllTripsModal'
import { loadSharedActiveTrips, type ActiveTripRecord } from '@/lib/active-trips'

const DEMO_TRIPS = [
  { id: 'demo-0', from: 'Stockholm', to: 'Göteborg', carrier: 'Erik L.', rating: 4.9 as number | null, price: 149, eta: '2h', isReal: false },
  { id: 'demo-1', from: 'Malmö', to: 'Stockholm', carrier: 'Sara J.', rating: 4.7 as number | null, price: 219, eta: '5h', isReal: false },
  { id: 'demo-2', from: 'Uppsala', to: 'Stockholm', carrier: 'Mikael B.', rating: 5.0 as number | null, price: 89, eta: '45 min', isReal: false },
]

function realTripToDisplay(trip: ActiveTripRecord) {
  const depMs = new Date(trip.departure_at).getTime()
  const diffMin = Math.max(0, Math.round((depMs - Date.now()) / 60000))
  const eta = diffMin < 60
    ? `${diffMin} min`
    : diffMin < 1440
      ? `${Math.floor(diffMin / 60)} h`
      : `${Math.floor(diffMin / 1440)} dag`
  const price = (trip.price_per_seat && trip.price_per_seat > 0)
    ? trip.price_per_seat
    : Math.round((trip.price_per_kg || 0) * 5) || 149
  return {
    id: trip.id,
    from: trip.from_city.split(',')[0].trim(),
    to: trip.to_city.split(',')[0].trim(),
    carrier: trip.users?.name || 'Bärare',
    rating: trip.users?.rating_count ? Number(trip.users.rating_avg || 0) : null as number | null,
    price,
    eta,
    isReal: true,
  }
}

export default function Hero() {
  const [liveTrips, setLiveTrips] = useState(DEMO_TRIPS)
  const [booking, setBooking] = useState<TripInfo | null>(null)
  const [showAllTrips, setShowAllTrips] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    async function refresh() {
      const realTrips = await loadSharedActiveTrips({ packagesOnly: true, limit: 3 })
      const real = realTrips.map(realTripToDisplay)
      const fill = DEMO_TRIPS.slice(0, Math.max(0, 3 - real.length))
      setLiveTrips(real.length > 0 ? [...real, ...fill] : DEMO_TRIPS)
    }
    refresh()
    window.addEventListener('gonow_trips_updated', refresh)
    return () => window.removeEventListener('gonow_trips_updated', refresh)
  }, [])

  return (
    <section
      className="dot-grid"
      style={{
        minHeight: isMobile ? 'auto' : '100vh',
        display: 'flex',
        alignItems: 'center',
        padding: isMobile ? '0 16px' : '0 24px',
        paddingTop: isMobile ? 64 : 72,
        position: 'relative',
        overflow: 'hidden',
        maxWidth: '100vw',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '30%',
          right: 0,
          height: '70%',
          background: 'var(--hero-glow)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ maxWidth: 1260, margin: '0 auto', width: '100%', padding: isMobile ? '28px 0 24px' : '80px 0 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.02fr 0.98fr', gap: isMobile ? 32 : 64, alignItems: 'center' }}>
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                marginBottom: isMobile ? 18 : 28,
                padding: '6px 14px',
                borderRadius: 100,
                border: '1px solid var(--secondary-soft)',
                background: 'var(--secondary-softer)',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--secondary-strong)',
                  display: 'inline-block',
                  boxShadow: '0 0 10px var(--secondary-strong)',
                }}
              />
              <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--muted-2)', letterSpacing: '0.02em' }}>
                Nu öppnar vi för tidiga användare
              </span>
            </div>

            <h1
              style={{
                fontSize: 'clamp(3rem, 6vw, 4.75rem)',
                fontWeight: 800,
                letterSpacing: '-0.04em',
                lineHeight: 1.04,
                color: 'var(--text)',
                marginBottom: isMobile ? 18 : 24,
              }}
            >
              Någon kör redan
              <br />
              <span style={{ color: 'var(--accent-dark)' }}>din väg.</span>
            </h1>

            <p
              style={{
                fontSize: 'clamp(1rem, 1.5vw, 1.1rem)',
                lineHeight: 1.7,
                color: 'var(--muted)',
                marginBottom: isMobile ? 28 : 40,
                maxWidth: 500,
              }}
            >
              Skicka paket, hämta butiksorders och dela resor med vanliga människor som ändå är på väg dit.
              <strong style={{ color: 'var(--muted-2)', fontWeight: 500 }}> 60% billigare än DHL.</strong>
            </p>

            <div style={{ display: 'flex', gap: 12, marginBottom: isMobile ? 28 : 52, flexWrap: 'wrap' }}>
              <Link
                href="/skicka"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--accent)',
                  color: '#0a0a0a',
                  padding: isMobile ? '14px 18px' : '14px 28px',
                  width: isMobile ? '100%' : 'auto',
                  justifyContent: 'center',
                  borderRadius: 10,
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.opacity = '0.88'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.opacity = '1'
                }}
              >
                Skicka något <ArrowRight size={16} />
              </Link>
              <Link
                href="/kor"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'transparent',
                  color: 'var(--text)',
                  padding: isMobile ? '13px 18px' : '13px 28px',
                  width: isMobile ? '100%' : 'auto',
                  justifyContent: 'center',
                  borderRadius: 10,
                  border: '1px solid var(--border-strong)',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'
                }}
              >
                Tjäna på din resa
              </Link>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 0, flexWrap: 'wrap' }}>
              {[
                { icon: Shield, color: 'var(--success)', text: 'BankID-verifierat' },
                { icon: Star, color: 'var(--warning)', text: '4.8 snittbetyg', fill: true },
                { icon: Package, color: 'var(--secondary-strong)', text: '2 400+ på väntelistan' },
              ].map(({ icon: Icon, color, text, fill }, i) => (
                <span key={text} style={{ display: 'flex', alignItems: 'center' }}>
                  {i > 0 && (
                    <span
                      style={{
                        width: 1,
                        height: 14,
                        background: 'var(--border)',
                        margin: isMobile ? '0 6px' : '0 16px',
                        display: 'inline-block',
                      }}
                    />
                  )}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.77rem', color: 'var(--muted)' }}>
                    <Icon size={12} style={{ color, ...(fill ? { fill: color } : {}) }} />
                    {text}
                  </span>
                </span>
              ))}
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <div
              style={{
                position: 'relative',
                minHeight: isMobile ? 520 : 640,
                borderRadius: 28,
                overflow: 'hidden',
                border: '1px solid var(--service-card-border)',
                boxShadow: 'var(--shadow-lg)',
                background: 'var(--service-card-bg)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage:
                    "linear-gradient(180deg, rgba(8,12,18,0.12) 0%, rgba(8,12,18,0.3) 38%, rgba(8,12,18,0.82) 100%), url('/hero-city.jpg')",
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />

              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, transparent 35%, rgba(10,10,10,0.05) 100%)',
                  pointerEvents: 'none',
                }}
              />

              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: isMobile ? 18 : 28,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.14)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 10px #22c55e' }} />
                    <span style={{ fontSize: '0.76rem', color: '#ffffff', fontWeight: 600 }}>Stockholm live</span>
                  </div>

                  <div
                    style={{
                      maxWidth: isMobile ? 150 : 180,
                      padding: isMobile ? '10px 12px' : '12px 14px',
                      borderRadius: 18,
                      background: 'rgba(10,10,10,0.38)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                    }}
                  >
                    <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                      Stad till stad
                    </p>
                    <p style={{ fontSize: '0.92rem', color: '#fff', lineHeight: 1.45 }}>
                      Perfekt för paket, retur och samåkning på samma rutt.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    alignSelf: 'flex-end',
                    width: isMobile ? '100%' : 'min(100%, 420px)',
                    borderRadius: 24,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(10,10,10,0.55)',
                    overflow: 'hidden',
                    boxShadow: '0 24px 54px rgba(0,0,0,0.25)',
                    backdropFilter: 'blur(18px)',
                    WebkitBackdropFilter: 'blur(18px)',
                  }}
                >
                  <div
                    style={{
                      padding: isMobile ? '14px 16px' : '16px 20px',
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 6px #22c55e' }} />
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>Aktiva resor just nu</span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        color: '#86efac',
                        background: 'rgba(34,197,94,0.12)',
                        padding: '3px 10px',
                        borderRadius: 100,
                        border: '1px solid rgba(34,197,94,0.22)',
                      }}
                    >
                      LIVE
                    </span>
                  </div>

                  {liveTrips.map((trip, i) => (
                    <div
                      key={i}
                      onClick={() => setBooking({ id: trip.id, from: trip.from, to: trip.to, carrier: trip.carrier, price: trip.price })}
                      style={{
                        padding: isMobile ? '14px 16px' : '16px 20px',
                        borderBottom: i < liveTrips.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.07)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: trip.isReal ? '#22c55e' : 'rgba(34,197,94,0.55)', display: 'block' }} />
                          <span style={{ width: 1, height: 16, background: 'linear-gradient(to bottom, #22c55e, #22c55e)', display: 'block' }} />
                          <MapPin size={8} style={{ color: '#86efac' }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: isMobile ? '0.8rem' : '0.85rem', fontWeight: 600, color: '#ffffff', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'normal' : 'nowrap' }}>{trip.from}</span>
                            {trip.isReal && (
                              <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '1px 6px', borderRadius: 100, background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', flexShrink: 0 }}>DIN</span>
                            )}
                          </p>
                          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.68)' }}>→ {trip.to}</p>
                        </div>
                      </div>

                      <div style={{ textAlign: 'center', flexShrink: 0 }}>
                        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.92)', fontWeight: 500 }}>{trip.carrier}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center' }}>
                          {trip.rating !== null ? (
                            <>
                              <Star size={9} style={{ color: '#fbbf24', fill: '#fbbf24' }} />
                              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.68)' }}>{trip.rating}</span>
                            </>
                          ) : (
                            <span style={{ fontSize: '0.62rem', color: 'rgba(34,197,94,0.8)' }}>Ny bärare</span>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: isMobile ? '0.92rem' : '1rem', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{trip.price} kr</p>
                        <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.68)' }}>om {trip.eta}</p>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => setShowAllTrips(true)}
                    style={{
                      width: '100%',
                      padding: '13px 20px',
                      background: 'rgba(255,255,255,0.06)',
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      fontSize: '0.78rem', color: '#ffffff', fontWeight: 600,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)')}
                  >
                    Boka en av dessa <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            </div>

            <div
              style={{
                position: isMobile ? 'relative' : 'absolute',
                bottom: isMobile ? 'auto' : -18,
                left: isMobile ? 'auto' : -20,
                marginTop: isMobile ? 14 : 0,
                background: 'var(--surface)',
                border: '1px solid var(--service-card-border)',
                borderRadius: 14,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: 'var(--success-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Package size={15} style={{ color: 'var(--success)' }} />
              </div>
              <div>
                <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1, letterSpacing: '-0.02em' }}>60%</p>
                <p style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 2 }}>billigare än DHL</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showAllTrips && (
        <AllTripsModal
          trips={liveTrips}
          onBook={trip => setBooking(trip)}
          onClose={() => setShowAllTrips(false)}
        />
      )}
      {booking && <TripBookingModal trip={booking} onClose={() => setBooking(null)} />}
    </section>
  )
}
