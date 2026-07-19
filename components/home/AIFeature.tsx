import { ArrowRight, Package, Shield, Zap } from 'lucide-react'
import OpenTripsButton from './OpenTripsButton'

const PROMISES = [
  {
    icon: Zap,
    emoji: '⚡',
    title: 'Mindre väntan',
    desc: 'Vi arbetar för att ditt paket ska komma iväg så snabbt som möjligt utan onödiga stopp och terminalköer.',
  },
  {
    icon: Shield,
    emoji: '🛡️',
    title: 'Trygg transport',
    desc: 'Digital spårning, försäkring och säker identifiering genom hela transporten.',
  },
  {
    icon: Package,
    emoji: '📦',
    title: 'Gonow tar ansvar',
    desc: 'Från bokning till leverans ansvarar vi för hela transportkedjan. Du behöver inte tänka på vad som händer efter att du bokat.',
  },
]

const COMPARISON = [
  { label: 'Avlämning', traditional: 'Kör till ombud', gonow: 'Boka hemifrån' },
  { label: 'Avgång', traditional: 'Väntar på terminal', gonow: 'Vi strävar efter snabb avgång' },
  { label: 'Insyn', traditional: 'Begränsad', gonow: 'Realtidsspårning' },
  { label: 'Ansvar', traditional: 'Flera aktörer', gonow: 'Ett ansvar - Gonow' },
]

export default function AIFeature() {
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
          <p className="label" style={{ marginBottom: 16, color: 'var(--secondary-strong)' }}>
            Vad Gonow ger dig
          </p>

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
            Tre löften.
            <br />
            Inte mer.
          </h2>

          <p
            style={{
              fontSize: '1rem',
              color: 'var(--muted)',
              lineHeight: 1.8,
              maxWidth: 440,
              marginBottom: 36,
            }}
          >
            Du bryr dig om fyra saker: hur enkelt det är, om du kan lita på oss, hur snabbt det går och vad det kostar. Startsidan ska besvara dem, inte förklara hur tekniken fungerar.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 36 }}>
            {PROMISES.map(({ emoji, title, desc }) => (
              <div
                key={title}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  padding: '16px 18px',
                  borderRadius: 16,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 11,
                    background: 'var(--accent-softer)',
                    border: '1px solid var(--service-card-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: '1.1rem',
                  }}
                >
                  {emoji}
                </div>
                <div>
                  <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{title}</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.6 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <OpenTripsButton
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
              transition: 'opacity 0.15s',
            }}
          >
            📦 Skicka paket <ArrowRight size={14} />
          </OpenTripsButton>
        </div>

        <div style={{ position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: -60,
              right: -60,
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: 'var(--gn-028)',
              filter: 'blur(60px)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -40,
              left: -40,
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: 'var(--gn-018)',
              filter: 'blur(40px)',
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              position: 'relative',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 24,
              overflow: 'hidden',
              boxShadow: '0 28px 64px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.06)',
            }}
          >
            <div
              style={{
                padding: '20px 24px 16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface-2)',
              }}
            >
              <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                Varför Gonow
              </p>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                Gonow jämfört med traditionell frakt
              </h3>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}></th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Traditionell frakt</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--secondary-strong)', fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', background: 'var(--accent-softer)' }}>Gonow</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={row.label} style={{ borderBottom: i < COMPARISON.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{row.label}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--muted)' }}>{row.traditional}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--secondary-strong)', fontWeight: 600, background: 'var(--accent-softer)' }}>
                        ✓ {row.gonow}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border)',
                background: 'var(--accent-softer)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--secondary-strong)', margin: 0 }}>
                Du bokar. Vi tar ansvar. Ditt paket kommer fram.
              </p>
              <OpenTripsButton
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--secondary-strong)',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  background: 'transparent',
                  padding: 0,
                }}
              >
                Kom igång <ArrowRight size={12} />
              </OpenTripsButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
