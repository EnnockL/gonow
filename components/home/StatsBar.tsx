import { ArrowRight, ShieldCheck, Zap, Shield, TrendingUp } from 'lucide-react'

export default function StatsBar() {
  return (
    <section
      style={{
        background: 'var(--surface)',
      }}
    >
      <div style={{ maxWidth: 1260, margin: '0 auto', padding: '0 24px' }}>
        <div
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
                background:
                  'linear-gradient(90deg, rgba(34,197,94,0.22) 0%, transparent 28%, transparent 100%)',
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
                  Från väg till värde
                </p>
                <h2
                  style={{
                    fontSize: 'clamp(2.4rem, 4.6vw, 4rem)',
                    lineHeight: 0.96,
                    letterSpacing: '-0.05em',
                    color: '#ffffff',
                    fontWeight: 700,
                    maxWidth: 460,
                  }}
                >
                  60% billigare
                  <br />
                  än traditionell frakt
                </h2>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  gap: 20,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ maxWidth: 300 }}>
                  <p style={{ fontSize: '0.98rem', color: 'rgba(255,255,255,0.88)', fontWeight: 600, marginBottom: 8 }}>
                    P2P-logistik som använder resor som redan sker.
                  </p>
                  <p style={{ fontSize: '0.82rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.68)' }}>
                    Lägre pris, kortare väntan och bättre kapacitetsutnyttjande i samma nätverk.
                  </p>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '14px 18px',
                    borderRadius: 999,
                    background: '#92ff63',
                    color: '#0a0a0a',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    boxShadow: '0 14px 30px rgba(146,255,99,0.18)',
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
                border: '1px solid rgba(54, 255, 164, 0.16)',
                boxShadow: '0 18px 44px rgba(0,0,0,0.16)',
                background:
                  'radial-gradient(circle at 62% 36%, rgba(120,255,164,0.42) 0%, rgba(120,255,164,0.08) 18%, transparent 36%), linear-gradient(135deg, #050706 0%, #0c1510 50%, #0a0d0b 100%)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'repeating-linear-gradient(90deg, transparent 0 26px, rgba(120,255,164,0.06) 26px 27px)',
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
                    Bygg snabbare
                  </p>
                  <h3
                    style={{
                      fontSize: 'clamp(2rem, 3.2vw, 3.2rem)',
                      lineHeight: 0.95,
                      letterSpacing: '-0.05em',
                      color: '#ffffff',
                      fontWeight: 700,
                      marginBottom: 10,
                    }}
                  >
                    3×
                    <br />
                    snabbare
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                    Jämfört med traditionella flöden och upphämtning via ombud.
                  </p>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    color: '#92ff63',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                  }}
                >
                  <Zap size={16} />
                  Samma dag i fler flöden
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
                background:
                  'linear-gradient(135deg, rgba(13,17,24,0.98) 0%, rgba(18,26,36,0.98) 100%)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(120deg, transparent 0%, transparent 46%, rgba(146,255,99,0.28) 46.5%, transparent 48%, transparent 63%, rgba(146,255,99,0.22) 63.5%, transparent 65%, transparent 78%, rgba(146,255,99,0.16) 78.5%, transparent 80%)',
                  opacity: 0.95,
                }}
              />
              <div
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
                    <ShieldCheck size={18} style={{ color: '#92ff63' }} />
                  </div>
                  <p style={{ fontSize: '2.55rem', fontWeight: 800, letterSpacing: '-0.05em', color: '#92ff63', lineHeight: 1 }}>
                    100%
                  </p>
                  <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', marginTop: 8, marginBottom: 6 }}>
                    BankID-verifierade
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                    Alla bärare är kontrollerade.
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
                    <Shield size={18} style={{ color: '#92ff63' }} />
                  </div>
                  <p style={{ fontSize: '2.55rem', fontWeight: 800, letterSpacing: '-0.05em', color: '#92ff63', lineHeight: 1 }}>
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
