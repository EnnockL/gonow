'use client'

import Link from 'next/link'
import { ArrowRight, Zap, MapPin, Package, CheckCircle2, Clock } from 'lucide-react'

export default function AIFeature() {
  return (
    <section style={{
      background: 'linear-gradient(180deg, var(--bg) 0%, var(--accent-softer) 28%, var(--accent-softer) 72%, var(--bg) 100%)',
      padding: '140px 24px',
      overflow: 'hidden',
    }}>
      <div style={{
        maxWidth: 1260,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '1fr 1.15fr',
        gap: 80,
        alignItems: 'center',
      }}>

        {/* Left: text */}
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 22 }}>
            <Zap size={13} fill="currentColor" style={{ color: 'var(--accent-dark)' }} />
            <span style={{
              fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.13em',
              textTransform: 'uppercase', color: 'var(--accent-dark)',
            }}>
              NY AI-DRIVEN FUNKTION
            </span>
          </div>

          <h2 style={{
            fontSize: 'clamp(2rem, 3.5vw, 3rem)',
            fontWeight: 700,
            letterSpacing: '-0.035em',
            color: 'var(--text)',
            lineHeight: 1.1,
            marginBottom: 20,
          }}>
            Rätt bärare.<br />Rätt rutt.<br />På sekunder.
          </h2>

          <p style={{
            fontSize: '1rem', color: 'var(--muted)', lineHeight: 1.8,
            maxWidth: 400, marginBottom: 36,
          }}>
            Gonow AI analyserar tusentals aktiva rutter i realtid och matchar ditt paket med
            den bärare som ändå kör din väg — ingen omväg, ingen extra kostnad.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/skicka" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--text)', color: 'var(--bg)',
              padding: '12px 24px', borderRadius: 10,
              fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none',
              transition: 'opacity 0.15s',
            }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
            >
              Skicka något nu <ArrowRight size={14} />
            </Link>
            <Link href="/kor" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              color: 'var(--text)', padding: '12px 24px', borderRadius: 10,
              fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none',
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              transition: 'border-color 0.15s',
            }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)' }}
            >
              Bli bärare
            </Link>
          </div>
        </div>

        {/* Right: UI mockup card */}
        <div style={{ position: 'relative' }}>
          {/* Decorative glow blobs */}
          <div style={{
            position: 'absolute', top: -60, right: -60,
            width: 300, height: 300, borderRadius: '50%',
            background: 'rgba(146,255,99,0.28)', filter: 'blur(60px)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -40, left: -40,
            width: 180, height: 180, borderRadius: '50%',
            background: 'rgba(146,255,99,0.18)', filter: 'blur(40px)',
            pointerEvents: 'none',
          }} />

          {/* Card */}
          <div style={{
            position: 'relative',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 24,
            padding: 28,
            boxShadow: '0 28px 64px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.06)',
          }}>
            {/* Card header */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                AI-matchning
              </p>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                Bärare hittad på &lt;30 sek
              </h3>
            </div>

            {/* Route */}
            <div style={{
              background: 'var(--accent-softer)',
              border: '1px solid var(--service-card-border)',
              borderRadius: 14, padding: '16px 18px', marginBottom: 14,
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, paddingTop: 3, flexShrink: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#92ff63', border: '2px solid var(--text)' }} />
                  <div style={{ width: 1.5, height: 26, background: 'rgba(146,255,99,0.5)' }} />
                  <MapPin size={9} fill="currentColor" style={{ color: 'var(--text)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Göteborg C
                  </p>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Stockholm Centralstation
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>149 kr</p>
                  <p style={{ fontSize: '0.65rem', color: 'var(--secondary-strong)', marginTop: 2, fontWeight: 600 }}>60% billigare</p>
                </div>
              </div>
            </div>

            {/* Driver chip */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 14px', background: 'var(--surface-2)',
              borderRadius: 12, marginBottom: 14,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'linear-gradient(135deg,#92ff63,#68db43)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.9rem', fontWeight: 700, color: '#0a0a0a', flexShrink: 0,
              }}>
                M
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>Marcus L.</p>
                <p style={{ fontSize: '0.67rem', color: 'var(--muted)' }}>BankID-verifierad · 4.97 ★</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <Clock size={11} style={{ color: 'var(--muted)' }} />
                <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 500 }}>09:15</span>
              </div>
            </div>

            {/* Badges */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                { icon: CheckCircle2, text: 'BankID' },
                { icon: Package, text: 'Max 20 kg' },
                { icon: Zap, text: 'Express' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 5,
                  background: 'var(--accent-softer)',
                  border: '1px solid var(--service-card-border)',
                  borderRadius: 8, padding: '7px 8px',
                }}>
                  <Icon size={11} style={{ color: 'var(--secondary-strong)', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.62rem', color: 'var(--muted)', fontWeight: 500, lineHeight: 1.3 }}>{text}</span>
                </div>
              ))}
            </div>

            {/* CTA button in card */}
            <div style={{
              width: '100%', background: '#92ff63',
              borderRadius: 10, padding: '13px 0',
              fontSize: '0.875rem', fontWeight: 700, color: '#0a0a0a',
              textAlign: 'center', cursor: 'default',
            }}>
              Bekräfta bokning →
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
