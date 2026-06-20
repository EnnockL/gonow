'use client'

import { useEffect, useState } from 'react'
import { MessageSquare, Route, MapPin } from 'lucide-react'

const steps = [
  {
    icon: MessageSquare,
    num: '01',
    title: 'Berätta vart det ska',
    desc: 'Skriv fritt vad du vill skicka, varifrån och vart. Vår AI förstår naturligt språk, inga formulär att fylla i.',
  },
  {
    icon: Route,
    num: '02',
    title: 'Vi matchar med en bärare',
    desc: 'Systemet hittar BankID-verifierade bärare som redan kör din rutt. Du väljer, betalar och är klar.',
  },
  {
    icon: MapPin,
    num: '03',
    title: 'Spåra live tills det är framme',
    desc: 'Realtidsspårning på kartan. Mottagaren bekräftar med QR-kod och betalning frigörs först vid leverans.',
  },
]

export default function HowItWorks() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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
            borderRadius: isMobile ? 24 : 32,
            boxShadow: 'var(--service-card-shadow)',
            padding: isMobile ? '32px 16px 16px' : '56px 24px 28px',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 28 : 56 }}>
            <p className="label" style={{ marginBottom: 10, color: 'var(--secondary-strong)' }}>
              Hur det fungerar
            </p>
            <h2
              style={{
                fontSize: 'clamp(1.8rem, 3vw, 2.5rem)',
                fontWeight: 700,
                letterSpacing: '-0.025em',
                color: 'var(--secondary-strong)',
              }}
            >
              Tre steg. Det är allt.
            </h2>
          </div>

          <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? 10 : 2 }}>
            {steps.map((step, index) => (
              <div
                key={step.num}
                style={{
                  padding: isMobile ? '22px 18px' : '32px 28px',
                  background: 'linear-gradient(180deg, #6EEF78 0%, #4ADE55 100%)',
                  border: '1px solid rgba(10,10,10,0.08)',
                  borderRadius: isMobile ? 18 : 16,
                  marginLeft: !isMobile && index > 0 ? -1 : 0,
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
                  el.style.background = 'linear-gradient(180deg, #6EEF78 0%, #4ADE55 100%)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div
                    style={{
                      width: isMobile ? 40 : 44,
                      height: isMobile ? 40 : 44,
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.28)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <step.icon size={isMobile ? 18 : 20} style={{ color: '#0a0a0a' }} />
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
                    fontSize: isMobile ? '0.94rem' : '1rem',
                    fontWeight: 600,
                    color: '#0a0a0a',
                    marginBottom: 10,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {step.title}
                </h3>
                <p style={{ fontSize: isMobile ? '0.8rem' : '0.83rem', lineHeight: 1.65, color: 'rgba(10,10,10,0.72)' }}>
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
