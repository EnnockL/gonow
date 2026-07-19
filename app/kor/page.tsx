'use client'

import { useEffect, useState } from 'react'
import TripRegistration from '@/components/driver/TripRegistration'
import EarningsWidget from '@/components/driver/EarningsWidget'
import MyTrips from '@/components/driver/MyTrips'
import DemoDataPanel from '@/components/dev/DemoDataPanel'
import TripOptimizer from '@/components/carrier/TripOptimizer'
import { TrendingUp, Clock, Shield, Cpu, ArrowUpRight, Route, Wallet, Sparkles } from 'lucide-react'

const perks = [
  { icon: TrendingUp, title: 'Upp till 85%', desc: 'Gonow tar 15% och resten är ditt.' },
  { icon: Clock, title: 'Egna tider', desc: 'Inga scheman. Kör när det passar.' },
  { icon: Shield, title: 'Försäkrat', desc: '250 000 kr via Trygg-Hansa per resa.' },
  { icon: Cpu, title: 'Smart matchning', desc: 'Gonow fyller din resa med rätt uppdrag automatiskt.' },
]

const metrics = [
  { label: 'Snittutbetalning / rutt', value: '1 964 kr', icon: Wallet },
  { label: 'Matchningstid', value: '< 4 min', icon: Sparkles },
  { label: 'Aktiva förare', value: '420+', icon: Route },
]

export default function KorPage() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        paddingTop: isMobile ? 68 : 80,
        paddingBottom: isMobile ? 48 : 96,
        background: 'linear-gradient(180deg, transparent 0%, var(--gn-005) 100%)',
      }}
    >
      <div style={{ maxWidth: 1260, margin: '0 auto', padding: isMobile ? '0 14px' : '0 24px' }}>
        <div style={{ paddingTop: isMobile ? 22 : 40, paddingBottom: isMobile ? 24 : 40 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 0.9fr', gap: isMobile ? 16 : 28, alignItems: 'stretch' }}>
            <div
              style={{
                background: 'var(--enterprise-panel-bg)',
                border: '1px solid var(--enterprise-panel-border)',
                borderRadius: isMobile ? 22 : 28,
                padding: isMobile ? '24px 18px 22px' : '34px 34px 30px',
                boxShadow: isMobile ? 'var(--shadow-md)' : 'var(--shadow-lg)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  right: -40,
                  top: -40,
                  width: 220,
                  height: 220,
                  borderRadius: '50%',
                  background: 'var(--enterprise-panel-glow)',
                  pointerEvents: 'none',
                }}
              />
              <p className="label" style={{ marginBottom: 14, color: 'var(--secondary-strong)' }}>
                Kör & tjäna
              </p>
              <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', fontWeight: 800, letterSpacing: '-0.05em', color: 'var(--text)', marginBottom: 16, lineHeight: 0.98, maxWidth: 680 }}>
                Din resa.
                <br />
                Dina regler.
                <br />
                Dina pengar.
              </h1>
              <p style={{ fontSize: '1rem', color: 'var(--muted-2)', maxWidth: 580, lineHeight: 1.65, marginBottom: isMobile ? 18 : 26 }}>
                Registrera vart du ska och när. Gonow matchar automatiskt paket, returer och passagerare längs rutten med hög trygghet, snabb payout och smart planering.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: isMobile ? 2 : 0 }}>
                {['Smart fyllnadsgrad', 'BankID-verifierade uppdrag', 'Utbetalning efter avslutad resa'].map((item) => (
                  <span
                    key={item}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 14px',
                      borderRadius: 999,
                      border: '1px solid var(--enterprise-panel-border)',
                      background: 'var(--enterprise-panel-chip-bg)',
                      fontSize: '0.78rem',
                      fontWeight: 500,
                      color: 'var(--text)',
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--secondary-strong)', display: 'inline-block' }} />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--enterprise-panel-border)',
                    borderRadius: isMobile ? 20 : 22,
                    padding: isMobile ? '18px 18px 18px' : '22px 22px 18px',
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{metric.label}</p>
                      <p style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.04em' }}>{metric.value}</p>
                    </div>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                      <metric.icon size={18} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 410px', gap: isMobile ? 18 : 24, alignItems: 'start' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: isMobile ? 18 : 26, boxShadow: isMobile ? 'var(--shadow-md)' : 'var(--shadow-lg)' }}>
            <div
              style={{
                padding: isMobile ? '18px 18px 16px' : '24px 28px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--enterprise-panel-header-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 20,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
                Registrera din resa
                </p>
                <p style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Ange rutt, kapacitet och vilka uppdrag du accepterar, vi sköter matchningen.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: isMobile ? 'nowrap' : 'wrap' }} className={isMobile ? 'mobile-scroll-x' : ''}>
                {['Rutt', 'Kapacitet', 'Prissättning', 'Tillåtelser'].map((item) => (
                  <span key={item} style={{ fontSize: '0.74rem', color: 'var(--muted-2)', border: '1px solid var(--border)', background: 'var(--surface)', padding: '7px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ padding: isMobile ? 18 : 28 }}>
              <TripRegistration />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: isMobile ? 'static' : 'sticky', top: 96 }}>
            <TripOptimizer />
            <DemoDataPanel />
            <div>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Mina resor</p>
              <MyTrips />
            </div>
            <EarningsWidget />

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
              {perks.map((p) => (
                <div key={p.title} className="card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 10, borderRadius: 18, padding: 18, boxShadow: 'var(--shadow-md)' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p.icon size={15} style={{ color: 'var(--accent)' }} />
                  </div>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>{p.title}</p>
                  <p style={{ fontSize: '0.73rem', color: 'var(--muted)', lineHeight: 1.5 }}>{p.desc}</p>
                </div>
              ))}
            </div>

            <div className="card-sm" style={{ borderRadius: 20, padding: 20, background: 'var(--enterprise-panel-soft-bg)', borderColor: 'var(--enterprise-panel-border)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Operativt tips</p>
                  <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>Mest lönsamt är att kombinera 1 passagerare med 2-3 paket.</p>
                </div>
                <div style={{ width: 38, height: 38, borderRadius: 999, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                  <ArrowUpRight size={18} />
                </div>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                Vår matchningsmotor prioriterar rutter med hög fyllnadsgrad, kort omväg och förutsägbara stopptider, vilket ger snabbare accept och stabilare utbetalning.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
