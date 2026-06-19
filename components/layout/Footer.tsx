'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Globe, MessageCircle, Rss } from 'lucide-react'
import { createClient } from '@/lib/supabase'

const COLS = [
  {
    title: 'Tjänster',
    links: [
      ['Skicka paket', '/skicka'],
      ['Butiksupphämtning', '/hamta'],
      ['Returnera', '/retur'],
      ['Samåkning', '/lift'],
      ['Kör & tjäna', '/kor'],
    ],
  },
  {
    title: 'För bärare',
    links: [
      ['Bli bärare', '/kor'],
      ['Hur det fungerar', '#how'],
      ['Betalningar & utbet.', '#'],
      ['Krav & behörighet', '#'],
      ['Bärare-FAQ', '#'],
    ],
  },
  {
    title: 'Företag',
    links: [
      ['Om Gonow', '#'],
      ['Karriär', '#'],
      ['Press & media', '#'],
      ['Investerare', '#'],
      ['API & partner', '#'],
    ],
  },
  {
    title: 'Support',
    links: [
      ['Hjälpcenter', '#'],
      ['Kontakta oss', '#'],
      ['Integritetspolicy', '#'],
      ['Användarvillkor', '#'],
      ['Cookie-inställningar', '#'],
    ],
  },
]

const CITIES = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Sundsvall', 'Örebro']

export default function Footer() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  async function handleSub(e: React.FormEvent) {
    e.preventDefault()
    setState('loading')
    try {
      const supabase = createClient()
      await supabase.from('waitlist').insert({ email, role: 'sender', city: '' })
    } catch {}
    setState('done')
  }

  return (
    <footer style={{ background: 'var(--footer-bg)', borderTop: '1px solid var(--footer-border)' }}>
      <div style={{ borderBottom: '1px solid var(--footer-divider)', padding: isMobile ? '40px 20px' : '60px 24px' }}>
        <div style={{ maxWidth: 1260, margin: '0 auto', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 28 : 64, alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--footer-kicker)', textTransform: 'uppercase', marginBottom: 14 }}>
              Tidigt tillträde
            </p>
            <h3 style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: 10 }}>
              Få tillgång innan
              <br />
              allmän lansering.
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.7, maxWidth: 380 }}>
              Gå med på väntelistan, vi meddelar dig direkt när Gonow lanserar i din stad. Inga spam.
            </p>
          </div>

          <div>
            {state === 'done' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: 'var(--success)', fontSize: '1.1rem', fontWeight: 700 }}>✓</span>
                </div>
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Du är med på listan!</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Vi hör av oss vid lansering i din stad.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSub} style={{ display: 'flex', gap: 8, flexDirection: isMobile ? 'column' : 'row' }}>
                <input
                  type="email"
                  required
                  placeholder="din@email.se"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'var(--footer-input-bg)',
                    border: '1px solid var(--footer-divider)',
                    borderRadius: 10,
                    padding: '12px 16px',
                    fontSize: '0.875rem',
                    color: 'var(--text)',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                    fontFamily: 'inherit',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent)' }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
                />
                <button
                  type="submit"
                  disabled={state === 'loading'}
                  style={{
                    background: 'var(--accent)',
                    color: '#0a0a0a',
                    border: 'none',
                    borderRadius: 10,
                    padding: '12px 22px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontFamily: 'inherit',
                    transition: 'opacity 0.15s',
                    opacity: state === 'loading' ? 0.6 : 1,
                    width: isMobile ? '100%' : 'auto',
                  }}
                >
                  {state === 'loading' ? '...' : 'Anmäl mig →'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: isMobile ? '40px 20px 36px' : '64px 24px 56px' }}>
        <div style={{ maxWidth: 1260, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 1fr 1fr', gap: isMobile ? 24 : 32 }}>
            <div style={{ background: 'var(--footer-panel-bg)', border: '1px solid var(--footer-divider)', borderRadius: 20, padding: 24 }}>
              <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, marginBottom: 18, textDecoration: 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: 11, background: '#0a0a0a', border: '1.5px solid rgba(146, 255, 99, 0.45)', boxShadow: '0 0 18px rgba(146,255,99,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Image src="/logo-mark.png" alt="Gonow logo" width={66} height={66} style={{ width: 66, height: 66, minWidth: 66, minHeight: 66, objectFit: 'contain', flexShrink: 0, display: 'block' }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.025em', color: 'var(--text)' }}>Gonow</span>
              </Link>

              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.75, marginBottom: 24, maxWidth: 230 }}>
                P2P-logistik i Sverige. Vi kopplar samman avsändare och resenärer som ändå åker samma väg.
              </p>

              <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 10 }}>
                Tillgängligt i
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 28 }}>
                {CITIES.map((c) => (
                  <span key={c} style={{ fontSize: '0.7rem', color: 'var(--muted)', background: 'var(--footer-chip-bg)', padding: '3px 10px', borderRadius: 100, border: '1px solid var(--footer-divider)' }}>
                    {c}
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { Icon: Globe, label: 'Webb' },
                  { Icon: MessageCircle, label: 'Community' },
                  { Icon: Rss, label: 'Nyheter' },
                ].map(({ Icon, label }) => (
                  <a
                    key={label}
                    href="#"
                    aria-label={label}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      border: '1px solid var(--footer-divider)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--muted)',
                      transition: 'color 0.15s, border-color 0.15s, background 0.15s',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement
                      el.style.color = 'var(--text)'
                      el.style.borderColor = 'var(--footer-border)'
                      el.style.background = 'var(--footer-chip-hover)'
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement
                      el.style.color = 'var(--muted)'
                      el.style.borderColor = 'var(--footer-divider)'
                      el.style.background = 'transparent'
                    }}
                  >
                    <Icon size={14} />
                  </a>
                ))}
              </div>
            </div>

            {COLS.map((col) => (
              <div key={col.title}>
                <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 18 }}>
                  {col.title}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {col.links.map(([label, href]) => (
                    <Link
                      key={label}
                      href={href}
                      style={{ fontSize: '0.82rem', color: 'var(--muted)', transition: 'color 0.15s', textDecoration: 'none', lineHeight: 1.4 }}
                      onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'var(--text)' }}
                      onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'var(--muted)' }}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--footer-divider)', padding: '18px 24px' }}>
        <div style={{ maxWidth: 1260, margin: '0 auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>© 2026 Gonow AB</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)', opacity: 0.5 }}>·</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Org.nr 556XXX-XXXX</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)', opacity: 0.5 }}>·</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Sverige</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', color: 'var(--muted)', border: '1px solid var(--footer-divider)', background: 'var(--footer-chip-hover)', padding: '4px 12px', borderRadius: 100 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
              BankID-verifierat
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--muted)', border: '1px solid var(--footer-divider)', background: 'var(--footer-chip-hover)', padding: '4px 12px', borderRadius: 100 }}>
              Trygg-Hansa 250 000 kr
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
