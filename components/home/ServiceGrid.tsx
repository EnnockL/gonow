'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Package, ShoppingBag, RotateCcw, Users, Car, ArrowRight, ArrowUpRight } from 'lucide-react'

const services = [
  { icon: Package, title: 'Skicka paket', description: 'AI matchar dig med en verifierad bärare som kör din rutt.', href: '/skicka', tag: 'Populärast', stat: '470+ km täckning' },
  { icon: ShoppingBag, title: 'Butiksupphämtning', description: 'Beställ från IKEA eller var som helst, en resenär levererar hem till dig.', href: '/hamta', tag: null, stat: '200+ butiker' },
  { icon: RotateCcw, title: 'Retur', description: 'Foto, AI-kontroll och en resenär som lämnar in returen åt dig.', href: '/retur', tag: null, stat: 'AI-kontroll' },
  { icon: Users, title: 'Lift med mig', description: 'Dela bilresa och kostnad med någon som ändå kör dit.', href: '/skicka?tab=lift', tag: null, stat: '150+ rutter' },
]

export default function ServiceGrid() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <section style={{ padding: isMobile ? '64px 18px' : '96px 24px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1260, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'flex-end', justifyContent: 'space-between', marginBottom: isMobile ? 28 : 48, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p className="label" style={{ marginBottom: 10 }}>Allt på ett ställe</p>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text)', lineHeight: 1.1 }}>
              Fem sätt att använda Gonow
            </h2>
          </div>
          <Link href="/skicka" className="btn-outline" style={{ fontSize: '0.8rem', padding: '8px 18px', flexShrink: 0, width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}>
            Kom igång gratis <ArrowRight size={13} />
          </Link>
        </div>

        <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gridTemplateRows: 'auto auto', gap: 14 }}>
          <div
            style={{
              gridRow: '1 / 3',
              borderRadius: 28,
              overflow: 'hidden',
              position: 'relative',
              minHeight: isMobile ? 440 : 540,
              border: '1px solid var(--service-card-border)',
              boxShadow: 'var(--service-card-shadow)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: "url('/highway.jpg')",
                backgroundSize: 'cover',
                backgroundPosition: 'center 40%',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(160deg, rgba(6,10,14,0.18) 0%, rgba(6,10,14,0.55) 45%, rgba(6,10,14,0.92) 100%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, transparent 50%)',
                pointerEvents: 'none',
              }}
            />

            <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: isMobile ? 22 : 36 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 999,
                  background: 'rgba(34,197,94,0.15)',
                  border: '1px solid rgba(34,197,94,0.3)',
                  backdropFilter: 'blur(12px)',
                  alignSelf: 'flex-start',
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#fff', letterSpacing: '0.04em' }}>Sverige, live-nätverk</span>
              </div>

              <div>
                <div style={{ display: 'flex', gap: isMobile ? 16 : 24, marginBottom: 24, flexWrap: 'wrap' }}>
                  {[
                    { val: '470+', label: 'km täckning' },
                    { val: '60%', label: 'billigare än DHL' },
                    { val: '2 400+', label: 'på väntelistan' },
                  ].map(({ val, label }) => (
                    <div key={label}>
                      <p style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, color: '#22c55e', letterSpacing: '-0.04em', lineHeight: 1 }}>{val}</p>
                      <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)', marginTop: 4, fontWeight: 500 }}>{label}</p>
                    </div>
                  ))}
                </div>

                <h3 style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2.1rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 12, maxWidth: 400 }}>
                  Logistiknätverket som använder resor som redan sker.
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, maxWidth: 380, marginBottom: 24 }}>
                  Vanliga människor kör redan din väg. Vi kopplar samman dem med avsändare, utan tomma bilar och utan onödig frakt.
                </p>

                <Link href="/skicka" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#22c55e', color: '#0a0a0a', padding: '12px 22px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none' }}>
                  Skicka något nu <ArrowUpRight size={15} />
                </Link>
              </div>
            </div>
          </div>

          <div className="mobile-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {services.slice(0, 2).map((s) => <ServiceCard key={s.href} service={s} />)}
          </div>

          <div className="mobile-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {services.slice(2, 4).map((s) => <ServiceCard key={s.href} service={s} />)}
          </div>
        </div>

        <Link
          href="/kor"
          style={{
            display: 'flex',
            alignItems: isMobile ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            flexDirection: isMobile ? 'column' : 'row',
            gap: 24,
            marginTop: 14,
            padding: isMobile ? '22px 20px' : '28px 36px',
            borderRadius: 24,
            textDecoration: 'none',
            background: 'linear-gradient(135deg, var(--service-card-bg))',
            border: '1px solid var(--service-card-border)',
            boxShadow: 'var(--service-card-shadow)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, width: '100%' }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--service-card-icon-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(34,197,94,0.16)' }}>
              <Car size={22} style={{ color: 'var(--secondary-strong)' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Kör & tjäna</h3>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--secondary-strong)', background: 'var(--service-card-tag-bg)', border: '1px solid var(--service-card-border)', padding: '3px 10px', borderRadius: 999 }}>För bärare</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.5, maxWidth: 560 }}>
                Registrera din resa. Gonow fyller bilen automatiskt med optimal mix av passagerare, paket och returer. Upp till 85% utbetalning.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 18 : 32, flexShrink: 0, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-start' }}>
            {[['1 964 kr', 'snitt/rutt'], ['85%', 'utbetalning'], ['< 4 min', 'matchningstid']].map(([val, label]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--secondary-strong)', letterSpacing: '-0.03em', lineHeight: 1 }}>{val}</p>
                <p style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: 3, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--secondary-strong)', fontWeight: 600, fontSize: '0.85rem' }}>
              Börja köra <ArrowUpRight size={15} />
            </div>
          </div>
        </Link>
      </div>
    </section>
  )
}

function ServiceCard({ service }: { service: typeof services[0] }) {
  return (
    <Link
      href={service.href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        textDecoration: 'none',
        padding: 24,
        borderRadius: 22,
        background: 'var(--service-card-bg)',
        border: '1px solid var(--service-card-border)',
        boxShadow: 'var(--service-card-shadow)',
        minHeight: 200,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--service-card-icon-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(34,197,94,0.16)' }}>
          <service.icon size={18} style={{ color: 'var(--secondary-strong)' }} />
        </div>
        {service.tag && (
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--secondary-strong)', background: 'var(--service-card-tag-bg)', border: '1px solid var(--service-card-border)', padding: '4px 10px', borderRadius: 999 }}>
            {service.tag}
          </span>
        )}
      </div>

      <div style={{ flex: 1 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 6 }}>{service.title}</h3>
        <p style={{ fontSize: '0.78rem', lineHeight: 1.6, color: 'var(--muted)' }}>{service.description}</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--service-card-border)' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 500 }}>{service.stat}</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--secondary-strong)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          Öppna <ArrowRight size={12} />
        </span>
      </div>
    </Link>
  )
}
