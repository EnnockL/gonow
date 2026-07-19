'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function CTASection() {
  return (
    <section
      className="gn-cta-section"
      style={{
        borderTop: '1px solid var(--border)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--section-glow)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
        <p
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: 'var(--secondary-strong)',
            textTransform: 'uppercase',
            marginBottom: 20,
          }}
        >
          Kom igång idag
        </p>
        <h2
          style={{
            fontSize: 'clamp(2.2rem, 5vw, 3.75rem)',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1.08,
            color: 'var(--text)',
            marginBottom: 20,
          }}
        >
          Du bokar.
          <br />
          <span style={{ color: 'var(--accent-dark)' }}>Vi tar ansvar.</span>
          <br />
          Ditt paket kommer fram.
        </h2>
        <p
          style={{
            fontSize: '1rem',
            lineHeight: 1.7,
            color: 'var(--muted)',
            maxWidth: 480,
            margin: '0 auto 40px',
          }}
        >
          Skicka på några sekunder. Gonow tar ansvar för hela transporten från den stunden.
        </p>
        <div className="gn-btn-row" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('gonow_open_package_booking'))}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: 'var(--accent)',
              color: '#0a0a0a',
              padding: '14px 32px',
              borderRadius: 10,
              fontSize: '0.9rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.88' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
          >
            Skicka ett paket <ArrowRight size={16} />
          </button>
          <Link
            href="/varfor-gonow"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: 'transparent',
              color: 'var(--text)',
              padding: '13px 32px',
              borderRadius: 10,
              border: '1px solid var(--border-strong)',
              fontSize: '0.9rem',
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)' }}
          >
            Läs hur det fungerar
          </Link>
        </div>
      </div>
    </section>
  )
}
