'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { Menu, X, Moon, Sun } from 'lucide-react'

const DARK_VARS: Record<string, string> = {
  '--bg': '#0a0a0a', '--surface': '#111111', '--surface-2': '#181818', '--surface-3': '#232323',
  '--border': 'rgba(255,255,255,0.08)', '--border-strong': 'rgba(255,255,255,0.16)',
  '--text': '#fafafa', '--muted': '#a3a3a3', '--muted-2': '#d4d4d4',
  '--accent': '#92ff63', '--accent-dark': '#c8ffb3', '--secondary': '#92ff63',
  '--secondary-strong': '#c8ffb3', '--secondary-soft': 'rgba(146,255,99,0.16)',
  '--secondary-softer': 'rgba(146,255,99,0.1)', '--accent-soft': 'rgba(146,255,99,0.18)',
  '--accent-softer': 'rgba(146,255,99,0.1)',
  '--page-gradient': 'linear-gradient(180deg,#0a0a0a 0%,#111111 100%)',
  '--hero-glow': 'radial-gradient(ellipse 80% 60% at 60% 20%,rgba(146,255,99,0.18) 0%,transparent 70%)',
  '--section-glow': 'radial-gradient(ellipse 60% 50% at 50% 100%,rgba(146,255,99,0.12) 0%,transparent 70%)',
  '--dot-color': 'rgba(146,255,99,0.08)',
  '--shadow-lg': '0 24px 64px rgba(0,0,0,0.45)', '--shadow-md': '0 16px 40px rgba(0,0,0,0.35)',
  '--nav-bg': 'rgba(10,10,10,0.88)', '--nav-bg-strong': 'rgba(10,10,10,0.96)',
  '--nav-shadow': '0 10px 28px rgba(0,0,0,0.28)', '--nav-shadow-strong': '0 18px 40px rgba(0,0,0,0.34)',
  '--footer-bg': 'linear-gradient(180deg,rgba(21,26,36,0.96) 0%,rgba(10,10,10,1) 100%)',
  '--footer-border': 'rgba(146,255,99,0.16)', '--footer-divider': 'rgba(146,255,99,0.12)',
  '--footer-panel-bg': 'linear-gradient(180deg,rgba(146,255,99,0.12) 0%,rgba(146,255,99,0.05) 100%)',
  '--footer-chip-bg': 'rgba(255,255,255,0.06)', '--footer-chip-hover': 'rgba(146,255,99,0.12)',
  '--footer-input-bg': 'rgba(255,255,255,0.08)', '--footer-kicker': '#c8ffb3',
  '--enterprise-panel-bg': 'linear-gradient(135deg,rgba(18,22,29,0.96) 0%,rgba(28,33,42,0.98) 55%,rgba(146,255,99,0.16) 100%)',
  '--enterprise-panel-border': 'rgba(146,255,99,0.16)', '--enterprise-panel-chip-bg': 'rgba(255,255,255,0.08)',
  '--enterprise-panel-header-bg': 'linear-gradient(180deg,rgba(146,255,99,0.12) 0%,rgba(146,255,99,0.05) 100%)',
  '--enterprise-panel-soft-bg': 'linear-gradient(180deg,rgba(18,22,29,0.98) 0%,rgba(146,255,99,0.08) 100%)',
  '--enterprise-panel-glow': 'radial-gradient(circle,rgba(146,255,99,0.2) 0%,transparent 72%)',
  '--service-card-bg': 'linear-gradient(180deg,rgba(17,22,30,0.98) 0%,rgba(22,28,37,0.98) 100%)',
  '--service-card-hover-bg': 'linear-gradient(180deg,rgba(20,26,35,1) 0%,rgba(26,33,44,1) 100%)',
  '--service-card-border': 'rgba(146,255,99,0.18)', '--service-card-icon-bg': 'rgba(255,255,255,0.06)',
  '--service-card-tag-bg': 'rgba(255,255,255,0.06)',
  '--service-card-shadow': '0 18px 40px rgba(146,255,99,0.08)',
  '--service-card-shadow-hover': '0 24px 54px rgba(146,255,99,0.14)',
  '--stats-panel-bg': 'linear-gradient(135deg,rgba(17,22,30,0.98) 0%,rgba(27,33,42,0.98) 52%,rgba(36,43,54,0.98) 100%)',
  '--stats-panel-border': 'rgba(146,255,99,0.18)', '--stats-panel-divider': 'rgba(146,255,99,0.12)',
  '--stats-panel-shadow': '0 18px 44px rgba(146,255,99,0.08)',
}

function applyTheme(dark: boolean) {
  const root = document.documentElement
  if (dark) {
    root.classList.add('dark')
    Object.entries(DARK_VARS).forEach(([k, v]) => root.style.setProperty(k, v))
  } else {
    root.classList.remove('dark')
    Object.keys(DARK_VARS).forEach(k => root.style.removeProperty(k))
  }
}

const links = [
  { href: '/skicka', label: 'Skicka' },
  { href: '/hamta', label: 'Hämta' },
  { href: '/retur', label: 'Retur' },
  { href: '/lift', label: 'Lift' },
  { href: '/kor', label: 'Kör & tjäna' },
]

const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(true)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [scrolled, setScrolled] = useState(false)
  const [visible, setVisible] = useState(true)
  const lastY = useRef(0)
  const path = usePathname()

  useEffect(() => {
    function onResize() { setIsDesktop(window.innerWidth >= 768) }
    function onScroll() {
      const y = window.scrollY
      const isScrolled = y > 64
      setScrolled(isScrolled)
      if (!isScrolled) {
        setVisible(true)
      } else {
        // scrolling up → show, scrolling down → hide
        setVisible(y <= lastY.current)
      }
      lastY.current = y
    }
    onResize()
    onScroll()
    const saved = (() => { try { return localStorage.getItem('theme') } catch { return null } })()
    const isDark = saved === 'dark'
    setTheme(isDark ? 'dark' : 'light')
    applyTheme(isDark)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next === 'dark')
    try { localStorage.setItem('theme', next) } catch {}
  }

  const dark = theme === 'dark'

  /* ── pill background colours ── */
  const pillBg = dark
    ? 'rgba(13,13,13,0.97)'
    : 'rgba(255,255,255,0.97)'

  /* ── box-shadow: outline + drop-shadow ── */
  const pillShadow = dark
    ? '0 0 0 1px rgba(255,255,255,0.09), 0 12px 40px rgba(0,0,0,0.45)'
    : '0 0 0 1px rgba(0,0,0,0.07), 0 12px 36px rgba(0,0,0,0.10)'

  const barShadow = dark
    ? 'inset 0 -1px 0 rgba(255,255,255,0.07)'
    : 'inset 0 -1px 0 rgba(0,0,0,0.06)'

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      padding: scrolled ? '12px 20px' : '10px 20px',
      transform: visible ? 'translateY(0)' : 'translateY(-120%)',
      transition: `padding 0.45s ${EASE}, transform 0.4s ${EASE}`,
    }}>
      {/* ── Main bar / pill ── */}
      <div style={{
        margin: '0 auto',
        maxWidth: scrolled ? 860 : 1200,
        borderRadius: 999,
        background: scrolled ? pillBg : 'var(--nav-bg)',
        backdropFilter: 'blur(22px)',
        WebkitBackdropFilter: 'blur(22px)',
        boxShadow: scrolled ? pillShadow : barShadow,
        padding: scrolled ? '0 18px' : '0 32px',
        height: scrolled ? 52 : 72,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: `max-width 0.45s ${EASE}, background 0.35s ${EASE}, box-shadow 0.35s ${EASE}, padding 0.45s ${EASE}, height 0.45s ${EASE}`,
        overflow: 'hidden',
      }}>

        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, textDecoration: 'none' }}>
          <div style={{
            width: scrolled ? 28 : 36,
            height: scrolled ? 28 : 36,
            borderRadius: scrolled ? 8 : 11,
            background: '#0a0a0a',
            border: '1.5px solid rgba(146,255,99,0.45)',
            boxShadow: '0 0 14px rgba(146,255,99,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, overflow: 'hidden',
            transition: `width 0.45s ${EASE}, height 0.45s ${EASE}, border-radius 0.45s ${EASE}`,
          }}>
            <Image src="/logo-mark.png" alt="Gonow logo" width={66} height={66}
              style={{ width: 66, height: 66, minWidth: 66, minHeight: 66, objectFit: 'contain', flexShrink: 0, display: 'block' }} />
          </div>
          <span style={{
            fontWeight: 700,
            fontSize: scrolled ? '0.9rem' : '1rem',
            letterSpacing: '-0.025em',
            color: 'var(--text)',
            transition: `font-size 0.45s ${EASE}`,
          }}>
            Gonow
          </span>
        </Link>

        {/* Center links */}
        <div style={{ display: isDesktop ? 'flex' : 'none', alignItems: 'center' }}>
          {links.map((l) => {
            const active = path === l.href
            return (
              <Link key={l.href} href={l.href} style={{
                fontSize: scrolled ? '0.79rem' : '0.82rem',
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--text)' : 'var(--muted)',
                padding: scrolled ? '5px 11px' : '6px 14px',
                borderRadius: 6, position: 'relative',
                textDecoration: 'none',
                transition: `color 0.15s, font-size 0.45s ${EASE}, padding 0.45s ${EASE}`,
              }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--muted-2)' }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--muted)' }}
              >
                {l.label}
                {active && (
                  <span style={{
                    position: 'absolute', bottom: -1, left: '50%',
                    transform: 'translateX(-50%)', width: 14, height: 2,
                    borderRadius: 2, background: 'var(--accent)',
                  }} />
                )}
              </Link>
            )
          })}
        </div>

        {/* Right actions */}
        <div style={{ display: isDesktop ? 'flex' : 'none', alignItems: 'center', gap: scrolled ? 8 : 14, flexShrink: 0 }}>
          {/* Dark mode toggle */}
          <button type="button"
            aria-label={dark ? 'Ljust läge' : 'Mörkt läge'}
            onClick={toggleTheme}
            style={{
              width: 32, height: 32, borderRadius: 999,
              border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)',
              cursor: 'pointer', padding: 0, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'var(--surface-2)'
              el.style.borderColor = 'var(--border-strong)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'var(--surface)'
              el.style.borderColor = 'var(--border)'
            }}
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Logga in — hidden when pill */}
          <Link href="/profil" style={{
            fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 400,
            textDecoration: 'none', transition: 'color 0.15s',
            display: scrolled ? 'none' : 'inline',
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)' }}
          >
            Logga in
          </Link>

          {/* CTA */}
          <Link href="/skicka" style={{
            fontSize: scrolled ? '0.79rem' : '0.82rem',
            fontWeight: 600,
            background: 'var(--accent)',
            color: '#0a0a0a',
            padding: scrolled ? '7px 16px' : '8px 18px',
            borderRadius: 999,
            textDecoration: 'none', whiteSpace: 'nowrap',
            transition: `opacity 0.15s, padding 0.45s ${EASE}, font-size 0.45s ${EASE}`,
            display: 'inline-block',
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
          >
            Skicka nu
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button style={{
          display: isDesktop ? 'none' : 'flex',
          color: 'var(--muted)', background: 'none',
          border: 'none', cursor: 'pointer', padding: 4, alignItems: 'center',
        }} onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu — floats as card below pill */}
      {open && !isDesktop && (
        <div style={{
          margin: '8px 20px 0',
          background: pillBg,
          boxShadow: pillShadow,
          borderRadius: 20,
          padding: '14px 18px 18px',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button type="button" onClick={toggleTheme} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '10px 12px', marginBottom: 6,
              borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)',
              fontSize: '0.875rem', fontFamily: 'inherit', cursor: 'pointer',
            }}>
              <span>{dark ? 'Light mode' : 'Dark mode'}</span>
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} style={{
                fontSize: '0.9rem', color: path === l.href ? 'var(--text)' : 'var(--muted)',
                fontWeight: path === l.href ? 500 : 400,
                padding: '10px 12px', borderRadius: 8, display: 'block', textDecoration: 'none',
              }}>
                {l.label}
              </Link>
            ))}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <Link href="/skicka" onClick={() => setOpen(false)} style={{
                display: 'block', textAlign: 'center',
                background: 'var(--accent)', color: '#0a0a0a',
                padding: '11px 0', borderRadius: 999,
                fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none',
              }}>
                Skicka nu
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
