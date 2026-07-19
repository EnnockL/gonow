'use client'

import { MessageSquare, Route, MapPin } from 'lucide-react'

const steps = [
  {
    icon: MessageSquare,
    num: '01',
    title: 'Boka paketet.',
    desc: 'Ange vart paketet ska, varifrån och när. Klart på några sekunder — utan krångel.',
  },
  {
    icon: Route,
    num: '02',
    title: 'Gonow planerar transporten.',
    desc: 'Gonow Intelligent System tar över och planerar den bästa transporten för ditt paket. Du behöver inte tänka på mer.',
  },
  {
    icon: MapPin,
    num: '03',
    title: 'Följ paketet tills det är framme.',
    desc: 'Realtidsspårning hela vägen. Mottagaren bekräftar leveransen och du ser när paketet är framme.',
  },
]

export default function HowItWorks() {
  return (
    <section
      className="section"
      style={{
        background: 'transparent',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ maxWidth: 1260, margin: '0 auto' }}>
        <div
          style={{
            background: 'var(--service-card-bg)',
            border: '1px solid var(--service-card-border)',
            borderRadius: 32,
            boxShadow: 'var(--service-card-shadow)',
            padding: '56px 24px 28px',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p className="label" style={{ marginBottom: 10, color: 'var(--secondary-strong)' }}>
              Hur enkelt är det?
            </p>
            <h2
              style={{
                fontSize: 'clamp(1.8rem, 3vw, 2.5rem)',
                fontWeight: 700,
                letterSpacing: '-0.025em',
                color: 'var(--secondary-strong)',
              }}
            >
              Tre steg. Inte mer.
            </h2>
          </div>

          <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            {steps.map((step, index) => (
              <div
                key={step.num}
                style={{
                  padding: '32px 28px',
                  background: 'linear-gradient(180deg, var(--gn-lt2) 0%, var(--gn) 100%)',
                  border: '1px solid rgba(10,10,10,0.08)',
                  borderRadius: 16,
                  marginLeft: index > 0 ? -1 : 0,
                  position: 'relative',
                  zIndex: 0,
                  transition: 'z-index 0s, background 0.15s, border-color 0.15s',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement
                  el.style.zIndex = '1'
                  el.style.borderColor = 'rgba(10,10,10,0.14)'
                  el.style.background = 'linear-gradient(180deg, #c7ffad 0%, #a0ff76 100%)'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement
                  el.style.zIndex = '0'
                  el.style.borderColor = 'rgba(10,10,10,0.08)'
                  el.style.background = 'linear-gradient(180deg, var(--gn-lt2) 0%, var(--gn) 100%)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.28)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <step.icon size={20} style={{ color: '#0a0a0a' }} />
                  </div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      color: 'rgba(10,10,10,0.68)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {step.num}
                  </span>
                </div>
                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: '#0a0a0a',
                    marginBottom: 10,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {step.title}
                </h3>
                <p style={{ fontSize: '0.83rem', lineHeight: 1.65, color: 'rgba(10,10,10,0.72)' }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
