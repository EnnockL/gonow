import { ArrowRight, ShieldCheck, Zap, Shield } from 'lucide-react'

export default function StatsBar() {
  return (
    <section style={{ background: 'var(--surface)' }}>
      <div style={{ maxWidth: 1260, margin: '0 auto', padding: '0 24px' }}>
        <div
          className="mobile-stack"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.08fr 1fr',
            gap: 20,
            alignItems: 'stretch',
          }}
        >
          <div
            style={{
              minHeight: 420,
              borderRadius: 28,
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid var(--stats-panel-border)',
              boxShadow: 'var(--stats-panel-shadow)',
              backgroundColor: '#101418',
              backgroundImage:
                "linear-gradient(180deg, rgba(6,10,14,0.08) 0%, rgba(6,10,14,0.36) 50%, rgba(6,10,14,0.82) 100%), url('/hero-stockholm.jpg')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, var(--gn-022) 0%, transparent 28%, transparent 100%)',
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
              <div>
                <p
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.92)',
                    marginBottom: 14,
                  }}
                >
                  Snabbare än traditionellt
                </p>
                <h2
                  style={{
                    fontSize: 'clamp(2.2rem, 8vw, 4rem)',
                    lineHeight: 0.96,
                    letterSpacing: '-0.05em',
                    color: '#ffffff',
                    fontWeight: 700,
                    maxWidth: 460,
                  }}
                >
                  3× snabbare
                  <br />
                  än traditionell frakt
                </h2>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ maxWidth: 300 }}>
                  <p style={{ fontSize: '0.98rem', color: 'rgba(255,255,255,0.88)', fontWeight: 600, marginBottom: 8 }}>
                    Ingen väntan på terminalavgång.
                  </p>
                  <p style={{ fontSize: '0.82rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.68)' }}>
                    Vi arbetar för att ditt paket ska komma iväg direkt — inte stå och vänta tills nästa rutt avgår.
                  </p>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '14px 18px',
                    borderRadius: 999,
                    background: 'var(--gn)',
                    color: '#0a0a0a',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    boxShadow: '0 14px 30px var(--gn-018)',
                  }}
                >
                  Utforska nätverket <ArrowRight size={18} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 20 }}>
            <div
              style={{
                minHeight: 200,
                borderRadius: 28,
                overflow: 'hidden',
                position: 'relative',
                border: '1px solid var(--gn-016)',
                boxShadow: '0 18px 44px rgba(0,0,0,0.16)',
                background:
                  'radial-gradient(circle at 62% 36%, var(--gn-040) 0%, var(--gn-008) 18%, transparent 36%), linear-gradient(135deg, var(--gn-dk1) 0%, var(--gn-dk2) 50%, var(--gn-dk3) 100%)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'repeating-linear-gradient(90deg, transparent 0 26px, var(--gn-006) 26px 27px)',
                  opacity: 0.55,
                }}
              />
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  height: '100%',
                  padding: 28,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.92)',
                      marginBottom: 12,
                    }}
                  >
                    Avgång samma dag
                  </p>
                  <h3
                    style={{
                      fontSize: 'clamp(2rem, 8vw, 3.2rem)',
                      lineHeight: 0.95,
                      letterSpacing: '-0.05em',
                      color: '#ffffff',
                      fontWeight: 700,
                      marginBottom: 10,
                    }}
                  >
                    Samma
                    <br />
                    dag
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                    Vi strävar efter att ditt paket ska avgå samma dag som du bokar — inte stå och vänta i terminal.
                  </p>
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--gn)', fontSize: '0.84rem', fontWeight: 700 }}>
                  <Zap size={16} />
                  I fler och fler flöden
                </div>
              </div>
            </div>

            <div
              style={{
                minHeight: 200,
                borderRadius: 28,
                overflow: 'hidden',
                position: 'relative',
                border: '1px solid var(--stats-panel-border)',
                boxShadow: 'var(--stats-panel-shadow)',
                background: 'linear-gradient(135deg, rgba(13,17,24,0.98) 0%, rgba(18,26,36,0.98) 100%)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(120deg, transparent 0%, transparent 46%, var(--gn-028) 46.5%, transparent 48%, transparent 63%, var(--gn-022) 63.5%, transparent 65%, transparent 78%, var(--gn-016) 78.5%, transparent 80%)',
                  opacity: 0.95,
                }}
              />
              <div
                className="mobile-2col"
                style={{
                  position: 'relative',
                  zIndex: 1,
                  height: '100%',
                  padding: 28,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 20,
                  alignItems: 'end',
                }}
              >
                <div>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 18,
                    }}
                  >
                    <ShieldCheck size={18} style={{ color: 'var(--gn)' }} />
                  </div>
                  <p style={{ fontSize: '2.55rem', fontWeight: 800, letterSpacing: '-0.05em', color: 'var(--gn)', lineHeight: 1 }}>
                    100%
                  </p>
                  <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', marginTop: 8, marginBottom: 6 }}>
                    Trygg transport
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                    Identifiering, digital kvittens och försäkring från start till mål.
                  </p>
                </div>

                <div>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 18,
                    }}
                  >
                    <Shield size={18} style={{ color: 'var(--gn)' }} />
                  </div>
                  <p style={{ fontSize: '2.55rem', fontWeight: 800, letterSpacing: '-0.05em', color: 'var(--gn)', lineHeight: 1 }}>
                    250k
                  </p>
                  <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', marginTop: 8, marginBottom: 6 }}>
                    Försäkring
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                    SEK per resa via Trygg-Hansa.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
