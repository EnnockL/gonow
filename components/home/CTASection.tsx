'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function CTASection() {
  return (
    <section style={{
      padding: '120px 24px',
      borderTop: '1px solid var(--border)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'var(--section-glow)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
        <p style={{
          fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.14em',
          color: 'var(--secondary-strong)', textTransform: 'uppercase', marginBottom: 20,
        }}>
          Kom igång idag
        </p>
        <h2 style={{
          fontSize: 'clamp(2.2rem, 5vw, 3.75rem)',
          fontWeight: 800,
          letterSpacing: '-0.04em',
          lineHeight: 1.08,
          color: 'var(--text)',
          marginBottom: 20,
        }}>
          Vad väntar du på?<br />Någon kör redan din väg.
        </h2>
        <p style={{
          fontSize: '1rem', lineHeight: 1.7, color: 'var(--muted)',
          maxWidth: 480, margin: '0 auto 40px',
        }}>
          Skicka ditt första paket på under 2 minuter. BankID-verifierade bärare. Betalning frigörs vid leverans.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/skicka"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--accent)', color: '#0a0a0a',
              padding: '14px 32px', borderRadius: 10,
              fontSize: '0.9rem', fontWeight: 700,
              textDecoration: 'none',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.88' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
          >
            Skicka ett paket <ArrowRight size={16} />
          </Link>
          <Link
            href="/kor"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'transparent', color: 'var(--text)',
              padding: '13px 32px', borderRadius: 10,
              border: '1px solid var(--border-strong)',
              fontSize: '0.9rem', fontWeight: 500,
              textDecoration: 'none',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)' }}
          >
            Kör & tjäna pengar
          </Link>
        </div>
      </div>
    </section>
  )
}
