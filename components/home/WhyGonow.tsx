'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Leaf, Users, ShieldCheck } from 'lucide-react'

const PILLARS = [
  {
    icon: Users,
    label: 'Gemenskap',
    quote: 'Förr knackade man på grannens dörr. Nu finns appen för det.',
  },
  {
    icon: Leaf,
    label: 'Hållbarhet',
    quote: 'Det grönaste paketet är det som redan var på väg.',
  },
  {
    icon: ShieldCheck,
    label: 'Trygghet',
    quote: 'BankID-verifierad. Försäkrad. Betygsatt. Trygg.',
  },
]

export default function WhyGonow() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <section
      style={{
        background: 'linear-gradient(180deg, var(--bg) 0%, var(--accent-softer) 28%, var(--accent-softer) 72%, var(--bg) 100%)',
        padding: isMobile ? '72px 16px' : '140px 24px',
        overflow: 'hidden',
      }}
    >
      <div
        className="mobile-stack"
        style={{
          maxWidth: 1260,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1.15fr',
          gap: isMobile ? 28 : 80,
          alignItems: 'center',
        }}
      >
        <div>
          <p className="label" style={{ marginBottom: 16 }}>Vår filosofi</p>

          <h2
            style={{
              fontSize: 'clamp(2rem, 3.5vw, 3rem)',
              fontWeight: 700,
              letterSpacing: '-0.035em',
              color: 'var(--text)',
              lineHeight: 1.1,
              marginBottom: 20,
            }}
          >
            Varför
            <br />
            Gonow?
          </h2>

          <p
            style={{
              fontSize: isMobile ? '0.95rem' : '1rem',
              color: 'var(--muted)',
              lineHeight: 1.8,
              maxWidth: 380,
              marginBottom: 36,
            }}
          >
            Vi byggde inte en budfirma. Vi byggde ett sätt att hjälpa varandra och göra
            varje resa i Sverige lite mer värd.
          </p>

          <Link
            href="/varfor-gonow"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--text)',
              color: 'var(--bg)',
              padding: isMobile ? '12px 18px' : '12px 24px',
              borderRadius: 10,
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.opacity = '0.82'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.opacity = '1'
            }}
          >
            Läs vår historia <ArrowRight size={14} />
          </Link>
        </div>

        <div style={{ position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: -50,
              right: -50,
              width: isMobile ? 180 : 280,
              height: isMobile ? 180 : 280,
              borderRadius: '50%',
              background: 'rgba(34,197,94,0.22)',
              filter: 'blur(56px)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 12 }}>
            {PILLARS.map(({ icon: Icon, label, quote }) => (
              <div
                key={label}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: isMobile ? 16 : 18,
                  padding: isMobile ? '16px' : '20px 22px',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(34,197,94,0.45)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                }}
              >
                <div
                  style={{
                    width: isMobile ? 38 : 40,
                    height: isMobile ? 38 : 40,
                    borderRadius: 11,
                    flexShrink: 0,
                    background: 'var(--accent-softer)',
                    border: '1px solid var(--service-card-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={16} style={{ color: 'var(--secondary-strong)' }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--secondary-strong)', marginBottom: 5 }}>
                    {label}
                  </p>
                  <p style={{ fontSize: isMobile ? '0.82rem' : '0.88rem', color: 'var(--text)', lineHeight: 1.55, fontStyle: 'italic' }}>
                    "{quote}"
                  </p>
                </div>
              </div>
            ))}

            <Link
              href="/varfor-gonow"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: isMobile ? '14px 16px' : '16px 22px',
                borderRadius: isMobile ? 16 : 18,
                background: 'var(--accent-softer)',
                border: '1px solid var(--service-card-border)',
                textDecoration: 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'var(--secondary-soft)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'var(--accent-softer)'
              }}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                Se alla budskap & vår filosofi
              </span>
              <ArrowRight size={15} style={{ color: 'var(--secondary-strong)', flexShrink: 0 }} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
