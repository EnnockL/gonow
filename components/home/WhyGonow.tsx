'use client'

import Link from 'next/link'
import { ArrowRight, Zap, Star, Leaf, ShieldCheck } from 'lucide-react'

const PILLARS = [
  {
    icon: Zap,
    label: 'Effektivitet',
    quote: 'Mindre väntan. Färre onödiga transporter. Smartare planering.',
  },
  {
    icon: Star,
    label: 'Kvalitet',
    quote: 'Vi arbetar för att varje paket ska komma fram i gott skick.',
  },
  {
    icon: Leaf,
    label: 'Hållbarhet',
    quote: 'Effektivare transporter innebär bättre användning av befintlig kapacitet och minskad miljöpåverkan.',
  },
  {
    icon: ShieldCheck,
    label: 'Trygghet',
    quote: 'BankID, försäkring och digital spårning genom hela leveransen.',
  },
]

export default function WhyGonow() {
  return (
    <section
      className="gn-feature-section"
      style={{
        background: 'linear-gradient(180deg, var(--bg) 0%, var(--accent-softer) 28%, var(--accent-softer) 72%, var(--bg) 100%)',
      }}
    >
      <div
        className="mobile-stack"
        style={{
          maxWidth: 1260,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1.15fr',
          gap: 80,
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
              fontSize: '1rem',
              color: 'var(--muted)',
              lineHeight: 1.8,
              maxWidth: 380,
              marginBottom: 36,
            }}
          >
            Vi tror att transport ska vara snabb, trygg och tillgänglig för alla — utan kompromisser på kvalitet eller hållbarhet.
          </p>

          <Link
            href="/varfor-gonow"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--text)',
              color: 'var(--bg)',
              padding: '12px 24px',
              borderRadius: 10,
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.82' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
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
              width: 280,
              height: 280,
              borderRadius: '50%',
              background: 'var(--gn-022)',
              filter: 'blur(56px)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {PILLARS.map(({ icon: Icon, label, quote }) => (
              <div
                key={label}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 18,
                  padding: '20px 22px',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--gn-045)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
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
                  <p style={{ fontSize: '0.88rem', color: 'var(--text)', lineHeight: 1.55, fontStyle: 'italic' }}>
                    &quot;{quote}&quot;
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
                padding: '16px 22px',
                borderRadius: 18,
                background: 'var(--accent-softer)',
                border: '1px solid var(--service-card-border)',
                textDecoration: 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--secondary-soft)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-softer)' }}
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
