'use client'

import Link from 'next/link'
import { ArrowRight, Shield, Star, Package, MapPin } from 'lucide-react'

const LIVE_TRIPS = [
  { from: 'Stockholm', to: 'Göteborg', carrier: 'Erik L.', rating: 4.9, price: 149, eta: '2h' },
  { from: 'Malmö', to: 'Stockholm', carrier: 'Sara J.', rating: 4.7, price: 219, eta: '5h' },
  { from: 'Uppsala', to: 'Stockholm', carrier: 'Mikael B.', rating: 5.0, price: 89, eta: '45 min' },
]

export default function Hero() {
  return (
    <section
      className="dot-grid"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        paddingTop: 72,
        position: 'relative',
        overflow: 'hidden',
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

      <div style={{ maxWidth: 1152, margin: '0 auto', width: '100%', padding: '80px 0 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.02fr 0.98fr', gap: 64, alignItems: 'center' }}>
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                marginBottom: 28,
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
                marginBottom: 24,
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
                marginBottom: 40,
                maxWidth: 500,
              }}
            >
              Skicka paket, hämta butiksorders och dela resor med vanliga människor som ändå är på väg dit.
              <strong style={{ color: 'var(--muted-2)', fontWeight: 500 }}> 60% billigare än DHL.</strong>
            </p>

            <div style={{ display: 'flex', gap: 12, marginBottom: 52, flexWrap: 'wrap' }}>
              <Link
                href="/skicka"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--accent)',
                  color: '#0a0a0a',
                  padding: '14px 28px',
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
                  padding: '13px 28px',
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap' }}>
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
                        margin: '0 16px',
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
                minHeight: 640,
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
                    'linear-gradient(135deg, rgba(146,255,99,0.1) 0%, transparent 35%, rgba(10,10,10,0.05) 100%)',
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
                  padding: 28,
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
                      maxWidth: 180,
                      padding: '12px 14px',
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
                    width: 'min(100%, 420px)',
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
                      padding: '16px 20px',
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

                  {LIVE_TRIPS.map((trip, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '16px 20px',
                        borderBottom: i < LIVE_TRIPS.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#92ff63', display: 'block' }} />
                          <span style={{ width: 1, height: 16, background: 'linear-gradient(to bottom, #92ff63, #22c55e)', display: 'block' }} />
                          <MapPin size={8} style={{ color: '#86efac' }} />
                        </div>
                        <div>
                          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff', lineHeight: 1.3 }}>{trip.from}</p>
                          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.68)' }}>→ {trip.to}</p>
                        </div>
                      </div>

                      <div style={{ textAlign: 'center', flexShrink: 0 }}>
                        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.92)', fontWeight: 500 }}>{trip.carrier}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center' }}>
                          <Star size={9} style={{ color: '#fbbf24', fill: '#fbbf24' }} />
                          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.68)' }}>{trip.rating}</span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{trip.price} kr</p>
                        <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.68)' }}>om {trip.eta}</p>
                      </div>
                    </div>
                  ))}

                  <div
                    style={{
                      padding: '13px 20px',
                      background: 'rgba(255,255,255,0.06)',
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <Link
                      href="/skicka"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.78rem',
                        color: '#ffffff',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      Boka en av dessa <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: -18,
                left: -20,
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
    </section>
  )
}
