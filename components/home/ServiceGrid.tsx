import Link from 'next/link'
import { Package, ShoppingBag, RotateCcw, Users, Car, ArrowRight, ArrowUpRight } from 'lucide-react'
import OpenTripsButton from './OpenTripsButton'

const services = [
  { icon: Package, title: 'Skicka paket', description: 'Gonow Intelligent System planerar den bästa transporten för ditt paket.', href: '/skicka', modal: true, tag: 'Populärast', stat: '470+ km täckning' },
  { icon: ShoppingBag, title: 'Butiksupphämtning', description: 'Beställ från IKEA eller var som helst — vi levererar hem till dig.', href: '/hamta', tag: null, stat: '200+ butiker' },
  { icon: RotateCcw, title: 'Retur', description: 'Foto, kontroll och inlämning av din retur — smidigt och enkelt.', href: '/retur', tag: null, stat: 'Enkel retur' },
  { icon: Users, title: 'Spåra paket', description: 'Realtidsspårning hela vägen. Du ser exakt var ditt paket befinner sig.', href: '/paket', tag: null, stat: 'Realtidsspårning' },
]

export default function ServiceGrid() {
  return (
    <section className="section" style={{ background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1260, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 48, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p className="label" style={{ marginBottom: 10 }}>Allt på ett ställe</p>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text)', lineHeight: 1.1 }}>
              Allt du behöver för att skicka paket
            </h2>
          </div>
          <OpenTripsButton className="btn-outline" style={{ fontSize: '0.8rem', padding: '8px 18px', flexShrink: 0 }}>
            Kom igång gratis <ArrowRight size={13} />
          </OpenTripsButton>
        </div>

        <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gridTemplateRows: 'auto auto', gap: 14 }}>
          <div
            style={{
              gridRow: '1 / 3',
              borderRadius: 28,
              overflow: 'hidden',
              position: 'relative',
              minHeight: 540,
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
                background: 'linear-gradient(135deg, var(--gn-012) 0%, transparent 50%)',
                pointerEvents: 'none',
              }}
            />

            <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 36 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 999,
                  background: 'var(--gn-015)',
                  border: '1px solid var(--gn-030)',
                  backdropFilter: 'blur(12px)',
                  alignSelf: 'flex-start',
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gn)', boxShadow: '0 0 8px var(--gn)' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#fff', letterSpacing: '0.04em' }}>Sverige, live-nätverk</span>
              </div>

              <div>
                <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
                  {[
                    { val: '470+', label: 'km täckning' },
                    { val: '60%', label: 'billigare än DHL' },
                    { val: '2 400+', label: 'på väntelistan' },
                  ].map(({ val, label }) => (
                    <div key={label}>
                      <p style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800, color: 'var(--gn)', letterSpacing: '-0.04em', lineHeight: 1 }}>{val}</p>
                      <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)', marginTop: 4, fontWeight: 500 }}>{label}</p>
                    </div>
                  ))}
                </div>

                <h3 style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2.1rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 12, maxWidth: 400 }}>
                  Snabb, trygg och effektiv transport — varje gång.
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, maxWidth: 380, marginBottom: 24 }}>
                  Gonow Intelligent System hittar den bästa transporten för ditt paket och säkerställer att det kommer fram snabbt, säkert och i gott skick.
                </p>

                <OpenTripsButton style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--gn)', color: '#0a0a0a', padding: '12px 22px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700 }}>
                  Skicka något nu <ArrowUpRight size={15} />
                </OpenTripsButton>
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
            alignItems: 'center',
            justifyContent: 'space-between',
            flexDirection: 'row',
            gap: 24,
            marginTop: 14,
            padding: '28px 36px',
            borderRadius: 24,
            textDecoration: 'none',
            background: 'linear-gradient(135deg, var(--service-card-bg))',
            border: '1px solid var(--service-card-border)',
            boxShadow: 'var(--service-card-shadow)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, width: '100%' }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--service-card-icon-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--gn-016)' }}>
              <Car size={22} style={{ color: 'var(--secondary-strong)' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Kör & tjäna</h3>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.5, maxWidth: 560 }}>
                Registrera din resa. Gonow Intelligent System fyller bilen med paket och returer längs din rutt. Upp till 85% utbetalning.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexShrink: 0, flexWrap: 'wrap' }}>
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
  if (service.modal) {
    return (
      <OpenTripsButton
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
          width: '100%',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--service-card-icon-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--gn-016)' }}>
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
      </OpenTripsButton>
    )
  }

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
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--service-card-icon-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--gn-016)' }}>
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
