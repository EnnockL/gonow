'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { Menu, Truck, X, Moon, Sun } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { signOut } from '@/lib/auth'
import AuthModal from '@/components/auth/AuthModal'
import NotificationBell from '@/components/layout/NotificationBell'

const DARK_VARS: Record<string, string> = {
  '--bg': '#0a0a0a', '--surface': '#111111', '--surface-2': '#181818', '--surface-3': '#232323',
  '--border': 'rgba(255,255,255,0.08)', '--border-strong': 'rgba(255,255,255,0.16)',
  '--text': '#fafafa', '--muted': '#a3a3a3', '--muted-2': '#d4d4d4',
  '--accent': 'var(--gn)', '--accent-dark': 'var(--gn-pl)', '--secondary': 'var(--gn)',
  '--secondary-strong': 'var(--gn-pl)', '--secondary-soft': 'var(--gn-016)',
  '--secondary-softer': 'var(--gn-010)', '--accent-soft': 'var(--gn-018)',
  '--accent-softer': 'var(--gn-010)',
  '--page-gradient': 'linear-gradient(180deg,#0a0a0a 0%,#111111 100%)',
  '--hero-glow': 'radial-gradient(ellipse 80% 60% at 60% 20%,var(--gn-018) 0%,transparent 70%)',
  '--section-glow': 'radial-gradient(ellipse 60% 50% at 50% 100%,var(--gn-012) 0%,transparent 70%)',
  '--dot-color': 'var(--gn-008)',
  '--shadow-lg': '0 24px 64px rgba(0,0,0,0.45)', '--shadow-md': '0 16px 40px rgba(0,0,0,0.35)',
  '--nav-bg': 'rgba(10,10,10,0.88)', '--nav-bg-strong': 'rgba(10,10,10,0.96)',
  '--nav-shadow': '0 10px 28px rgba(0,0,0,0.28)', '--nav-shadow-strong': '0 18px 40px rgba(0,0,0,0.34)',
  '--footer-bg': 'linear-gradient(180deg,rgba(21,26,36,0.96) 0%,rgba(10,10,10,1) 100%)',
  '--footer-border': 'var(--gn-016)', '--footer-divider': 'var(--gn-012)',
  '--footer-panel-bg': 'linear-gradient(180deg,var(--gn-012) 0%,var(--gn-005) 100%)',
  '--footer-chip-bg': 'rgba(255,255,255,0.06)', '--footer-chip-hover': 'var(--gn-012)',
  '--footer-input-bg': 'rgba(255,255,255,0.08)', '--footer-kicker': 'var(--gn-pl)',
  '--enterprise-panel-bg': 'linear-gradient(135deg,rgba(18,22,29,0.96) 0%,rgba(28,33,42,0.98) 55%,var(--gn-016) 100%)',
  '--enterprise-panel-border': 'var(--gn-016)', '--enterprise-panel-chip-bg': 'rgba(255,255,255,0.08)',
  '--enterprise-panel-header-bg': 'linear-gradient(180deg,var(--gn-012) 0%,var(--gn-005) 100%)',
  '--enterprise-panel-soft-bg': 'linear-gradient(180deg,rgba(18,22,29,0.98) 0%,var(--gn-008) 100%)',
  '--enterprise-panel-glow': 'radial-gradient(circle,var(--gn-020) 0%,transparent 72%)',
  '--service-card-bg': 'linear-gradient(180deg,rgba(17,22,30,0.98) 0%,rgba(22,28,37,0.98) 100%)',
  '--service-card-hover-bg': 'linear-gradient(180deg,rgba(20,26,35,1) 0%,rgba(26,33,44,1) 100%)',
  '--service-card-border': 'var(--gn-018)', '--service-card-icon-bg': 'rgba(255,255,255,0.06)',
  '--service-card-tag-bg': 'rgba(255,255,255,0.06)',
  '--service-card-shadow': '0 18px 40px var(--gn-008)',
  '--service-card-shadow-hover': '0 24px 54px var(--gn-014)',
  '--stats-panel-bg': 'linear-gradient(135deg,rgba(17,22,30,0.98) 0%,rgba(27,33,42,0.98) 52%,rgba(36,43,54,0.98) 100%)',
  '--stats-panel-border': 'var(--gn-018)', '--stats-panel-divider': 'var(--gn-012)',
  '--stats-panel-shadow': '0 18px 44px var(--gn-008)',
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

const links: { href: string; label: string; soon?: boolean }[] = [
  { href: '/skicka',      label: 'Skicka' },
  { href: '/lift',        label: 'Lift' },
  { href: '/resor',       label: 'Resor' },
  { href: '/uppdrag',     label: 'Uppdrag' },
  { href: '/kor',         label: 'Kör & tjäna' },
  { href: '/meddelanden', label: 'Chat', soon: true },
]

const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'

// ─── Accent themes ────────────────────────────────────────────────────────────

const ACCENT_THEMES = {
  green: {
    // ── brand color tokens ──────────────────────────────────────────────
    '--gn':     '#22c55e',
    '--gn-dk':  '#16a34a',
    '--gn-lt':  '#86efac',
    '--gn-lt2': '#4ade80',
    '--gn-pl':  '#c8ffb3',
    '--gn-003': 'rgba(34,197,94,0.03)',  '--gn-004': 'rgba(34,197,94,0.04)',
    '--gn-005': 'rgba(34,197,94,0.05)',  '--gn-006': 'rgba(34,197,94,0.06)',
    '--gn-007': 'rgba(34,197,94,0.07)',  '--gn-008': 'rgba(34,197,94,0.08)',
    '--gn-010': 'rgba(34,197,94,0.1)',   '--gn-012': 'rgba(34,197,94,0.12)',
    '--gn-014': 'rgba(34,197,94,0.14)',  '--gn-015': 'rgba(34,197,94,0.15)',
    '--gn-016': 'rgba(34,197,94,0.16)',  '--gn-018': 'rgba(34,197,94,0.18)',
    '--gn-020': 'rgba(34,197,94,0.2)',   '--gn-022': 'rgba(34,197,94,0.22)',
    '--gn-025': 'rgba(34,197,94,0.25)',  '--gn-030': 'rgba(34,197,94,0.3)',
    '--gn-035': 'rgba(34,197,94,0.35)',  '--gn-040': 'rgba(34,197,94,0.4)',
    '--gn-045': 'rgba(34,197,94,0.45)',  '--gn-050': 'rgba(34,197,94,0.5)',
    '--gn-055': 'rgba(34,197,94,0.55)',  '--gn-060': 'rgba(34,197,94,0.6)',
    '--gn-002':  'rgba(34,197,94,0.02)',   '--gn-009':  'rgba(34,197,94,0.09)',
    '--gn-011':  'rgba(34,197,94,0.11)',   '--gn-013':  'rgba(34,197,94,0.13)',
    '--gn-028':  'rgba(34,197,94,0.28)',   '--gn-038':  'rgba(34,197,94,0.38)',
    '--gn-056':  'rgba(34,197,94,0.56)',   '--gn-065':  'rgba(34,197,94,0.65)',
    '--gn-075':  'rgba(34,197,94,0.75)',   '--gn-080':  'rgba(34,197,94,0.8)',
    '--gn-0015': 'rgba(34,197,94,0.015)',  '--gn-0025': 'rgba(34,197,94,0.025)',
    '--gn-0035': 'rgba(34,197,94,0.035)',
    '--gn-bg1':    '#f0fdf4',
    '--gn-bg2':    '#dcfce7',
    '--gn-bg3':    '#d1fae5',
    '--gn-bg4':    '#bbf7d0',
    '--gn-bg1-84': 'rgba(240,253,244,0.84)',
    '--gn-bg1-88': 'rgba(240,253,244,0.88)',
    '--gn-bg1-96': 'rgba(240,253,244,0.96)',
    '--gn-bg1-98': 'rgba(240,253,244,0.98)',
    '--gn-dk1': '#050706', '--gn-dk2': '#0c1510', '--gn-dk3': '#0a0d0b',
    // ── semantic layer ──────────────────────────────────────────────────
    '--accent':             'var(--gn)',
    '--accent-dark':        'var(--gn-pl)',
    '--secondary':          'var(--gn)',
    '--secondary-strong':   'var(--gn-pl)',
    '--secondary-soft':     'var(--gn-016)',
    '--secondary-softer':   'var(--gn-010)',
    '--accent-soft':        'var(--gn-018)',
    '--accent-softer':      'var(--gn-010)',
    '--dot-color':          'var(--gn-008)',
    '--hero-glow':          'radial-gradient(ellipse 80% 60% at 60% 20%,var(--gn-018) 0%,transparent 70%)',
    '--section-glow':       'radial-gradient(ellipse 60% 50% at 50% 100%,var(--gn-012) 0%,transparent 70%)',
    '--footer-border':      'var(--gn-016)',
    '--footer-divider':     'var(--gn-012)',
    '--footer-kicker':      'var(--gn-pl)',
    '--footer-chip-hover':  'var(--gn-012)',
    '--service-card-border':       'var(--gn-018)',
    '--service-card-shadow':       '0 18px 40px var(--gn-008)',
    '--service-card-shadow-hover': '0 24px 54px var(--gn-014)',
    '--stats-panel-border':  'var(--gn-018)',
    '--stats-panel-divider': 'var(--gn-012)',
    '--stats-panel-shadow':  '0 18px 44px var(--gn-008)',
    '--enterprise-panel-border': 'var(--gn-016)',
  },
  blue: {
    // ── brand color tokens ──────────────────────────────────────────────
    '--gn':     '#3B82F6',
    '--gn-dk':  '#1D4ED8',
    '--gn-lt':  '#93C5FD',
    '--gn-lt2': '#60A5FA',
    '--gn-pl':  '#BFDBFE',
    '--gn-003': 'rgba(59,130,246,0.03)',  '--gn-004': 'rgba(59,130,246,0.04)',
    '--gn-005': 'rgba(59,130,246,0.05)',  '--gn-006': 'rgba(59,130,246,0.06)',
    '--gn-007': 'rgba(59,130,246,0.07)',  '--gn-008': 'rgba(59,130,246,0.08)',
    '--gn-010': 'rgba(59,130,246,0.1)',   '--gn-012': 'rgba(59,130,246,0.12)',
    '--gn-014': 'rgba(59,130,246,0.14)',  '--gn-015': 'rgba(59,130,246,0.15)',
    '--gn-016': 'rgba(59,130,246,0.16)',  '--gn-018': 'rgba(59,130,246,0.18)',
    '--gn-020': 'rgba(59,130,246,0.2)',   '--gn-022': 'rgba(59,130,246,0.22)',
    '--gn-025': 'rgba(59,130,246,0.25)',  '--gn-030': 'rgba(59,130,246,0.3)',
    '--gn-035': 'rgba(59,130,246,0.35)',  '--gn-040': 'rgba(59,130,246,0.4)',
    '--gn-045': 'rgba(59,130,246,0.45)',  '--gn-050': 'rgba(59,130,246,0.5)',
    '--gn-055': 'rgba(59,130,246,0.55)',  '--gn-060': 'rgba(59,130,246,0.6)',
    '--gn-002':  'rgba(59,130,246,0.02)',   '--gn-009':  'rgba(59,130,246,0.09)',
    '--gn-011':  'rgba(59,130,246,0.11)',   '--gn-013':  'rgba(59,130,246,0.13)',
    '--gn-028':  'rgba(59,130,246,0.28)',   '--gn-038':  'rgba(59,130,246,0.38)',
    '--gn-056':  'rgba(59,130,246,0.56)',   '--gn-065':  'rgba(59,130,246,0.65)',
    '--gn-075':  'rgba(59,130,246,0.75)',   '--gn-080':  'rgba(59,130,246,0.8)',
    '--gn-0015': 'rgba(59,130,246,0.015)',  '--gn-0025': 'rgba(59,130,246,0.025)',
    '--gn-0035': 'rgba(59,130,246,0.035)',
    '--gn-bg1':    '#eff6ff',
    '--gn-bg2':    '#dbeafe',
    '--gn-bg3':    '#dbeafe',
    '--gn-bg4':    '#bfdbfe',
    '--gn-bg1-84': 'rgba(239,246,255,0.84)',
    '--gn-bg1-88': 'rgba(239,246,255,0.88)',
    '--gn-bg1-96': 'rgba(239,246,255,0.96)',
    '--gn-bg1-98': 'rgba(239,246,255,0.98)',
    '--gn-dk1': '#050709', '--gn-dk2': '#0c1018', '--gn-dk3': '#0a0b0f',
    // ── semantic layer ──────────────────────────────────────────────────
    '--accent':             '#3B82F6',
    '--accent-dark':        '#93C5FD',
    '--secondary':          '#3B82F6',
    '--secondary-strong':   '#93C5FD',
    '--secondary-soft':     'rgba(59,130,246,0.16)',
    '--secondary-softer':   'rgba(59,130,246,0.1)',
    '--accent-soft':        'rgba(59,130,246,0.18)',
    '--accent-softer':      'rgba(59,130,246,0.1)',
    '--dot-color':          'rgba(59,130,246,0.08)',
    '--hero-glow':          'radial-gradient(ellipse 80% 60% at 60% 20%,rgba(59,130,246,0.18) 0%,transparent 70%)',
    '--section-glow':       'radial-gradient(ellipse 60% 50% at 50% 100%,rgba(59,130,246,0.12) 0%,transparent 70%)',
    '--footer-border':      'rgba(59,130,246,0.16)',
    '--footer-divider':     'rgba(59,130,246,0.12)',
    '--footer-kicker':      '#93C5FD',
    '--footer-chip-hover':  'rgba(59,130,246,0.12)',
    '--service-card-border':       'rgba(59,130,246,0.18)',
    '--service-card-shadow':       '0 18px 40px rgba(59,130,246,0.08)',
    '--service-card-shadow-hover': '0 24px 54px rgba(59,130,246,0.14)',
    '--stats-panel-border':  'rgba(59,130,246,0.18)',
    '--stats-panel-divider': 'rgba(59,130,246,0.12)',
    '--stats-panel-shadow':  '0 18px 44px rgba(59,130,246,0.08)',
    '--enterprise-panel-border': 'rgba(59,130,246,0.16)',
  },
} as const

type AccentKey = keyof typeof ACCENT_THEMES

function applyAccent(key: AccentKey, isDark: boolean) {
  const root    = document.documentElement
  const vibrant = ACCENT_THEMES[key]['--gn']
  Object.entries(ACCENT_THEMES[key]).forEach(([k, v]) => root.style.setProperty(k, v))
  // In light mode --accent-dark / --secondary-strong are used for text, keep them vibrant
  if (!isDark) {
    root.style.setProperty('--accent-dark',      vibrant)
    root.style.setProperty('--secondary-strong', vibrant)
    root.style.setProperty('--footer-kicker',    vibrant)
  }
}

export default function Navbar() {
  const [open, setOpen]           = useState(false)
  const [isDesktop, setIsDesktop] = useState(true)
  const [theme, setTheme]         = useState<'light' | 'dark'>('light')
  const [accent, setAccent]       = useState<AccentKey>('green')
  const [scrolled, setScrolled]   = useState(false)
  const [visible, setVisible]     = useState(true)
  const [showAuth, setShowAuth]   = useState(false)
  const lastY = useRef(0)
  const path        = usePathname()
  const searchParams = useSearchParams()
  const { userId, profile } = useAuth()

  function isActive(href: string) {
    const [linkPath, linkQuery] = href.split('?')
    if (path !== linkPath) return false
    if (!linkQuery) {
      // "Skicka" should NOT be active when ?tab=lift is set
      return linkPath !== '/skicka' || searchParams.get('tab') !== 'lift'
    }
    const lp = new URLSearchParams(linkQuery)
    return [...lp.entries()].every(([k, v]) => searchParams.get(k) === v)
  }

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

    const savedAccent = (() => { try { return localStorage.getItem('accent-theme') } catch { return null } })()
    const accentKey: AccentKey = savedAccent === 'blue' ? 'blue' : 'green'
    setAccent(accentKey)
    applyAccent(accentKey, isDark)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    const nextDark = next === 'dark'
    setTheme(next)
    applyTheme(nextDark)
    applyAccent(accent, nextDark)
    try { localStorage.setItem('theme', next) } catch {}
  }

  function switchAccent(key: AccentKey) {
    setAccent(key)
    applyAccent(key, dark)
    try { localStorage.setItem('accent-theme', key) } catch {}
  }

  const dark = theme === 'dark'

  // Hide navbar entirely on admin pages — sidebar takes over
  if (path.startsWith('/admin')) {
    return null
  }

  function openSendPackageFlow() {
    window.dispatchEvent(new CustomEvent('gonow_open_package_booking'))
    setOpen(false)
  }

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
      padding: isDesktop
        ? (scrolled ? '12px 20px' : '10px 20px')
        : (scrolled ? '8px 12px' : '8px 12px'),
      transform: visible ? 'translateY(0)' : 'translateY(-120%)',
      transition: `padding 0.45s ${EASE}, transform 0.4s ${EASE}`,
    }}>
      {/* Main bar / pill */}
      <div style={{
        margin: '0 auto',
        maxWidth: scrolled ? 900 : 1300,
        borderRadius: 999,
        background: scrolled ? pillBg : 'var(--nav-bg)',
        backdropFilter: 'blur(22px)',
        WebkitBackdropFilter: 'blur(22px)',
        boxShadow: scrolled ? pillShadow : barShadow,
        padding: isDesktop
          ? (scrolled ? '0 18px' : '0 32px')
          : (scrolled ? '0 14px' : '0 14px'),
        height: isDesktop ? (scrolled ? 52 : 72) : 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: `max-width 0.45s ${EASE}, background 0.35s ${EASE}, box-shadow 0.35s ${EASE}, padding 0.45s ${EASE}, height 0.45s ${EASE}`,
        overflow: 'visible',
      }}>

        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, textDecoration: 'none' }}>
          <div style={{
            width: isDesktop ? (scrolled ? 28 : 36) : 34,
            height: isDesktop ? (scrolled ? 28 : 36) : 34,
            borderRadius: isDesktop ? (scrolled ? 8 : 11) : 10,
            background: '#0a0a0a',
            border: '1.5px solid var(--gn-045)',
            boxShadow: '0 0 14px var(--gn-015)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, overflow: 'hidden',
            transition: `width 0.45s ${EASE}, height 0.45s ${EASE}, border-radius 0.45s ${EASE}`,
          }}>
            <Image src={accent === 'blue' ? '/logo-mark-blue.png' : '/logo-mark.png'} alt="Gonow logo" width={66} height={66}
              style={{ width: 66, height: 66, minWidth: 66, minHeight: 66, objectFit: 'contain', flexShrink: 0, display: 'block' }} />
          </div>
          <span style={{
            fontWeight: 700,
            fontSize: isDesktop ? (scrolled ? '0.9rem' : '1rem') : '0.96rem',
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
            const active = isActive(l.href)
            return (
              <Link key={l.href} href={l.href} style={{
                fontSize: scrolled ? '0.79rem' : '0.82rem',
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--text)' : 'var(--muted)',
                padding: scrolled ? '5px 11px' : '6px 14px',
                borderRadius: 6, position: 'relative',
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
                transition: `color 0.15s, font-size 0.45s ${EASE}, padding 0.45s ${EASE}`,
              }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--muted-2)' }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--muted)' }}
              >
                {l.label}
                {l.soon && (
                  <span style={{
                    fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.04em',
                    background: 'var(--accent-soft)', color: 'var(--accent)',
                    borderRadius: 4, padding: '1px 4px', lineHeight: 1.4,
                  }}>
                    NY
                  </span>
                )}
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

          {/* Accent colour switcher — admin only */}
          <div style={{ display: profile?.role === 'admin' ? 'flex' : 'none', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface)' }}>
            {(['green', 'blue'] as AccentKey[]).map(key => (
              <button
                key={key}
                onClick={() => switchAccent(key)}
                title={key === 'green' ? 'Grön tema' : 'Blå tema'}
                style={{
                  width: 14, height: 14, borderRadius: '50%', border: 'none', padding: 0,
                  background: key === 'green' ? '#22c55e' : '#3B82F6',
                  cursor: 'pointer', flexShrink: 0,
                  outline: accent === key ? `2px solid ${key === 'green' ? '#22c55e' : '#3B82F6'}` : '2px solid transparent',
                  outlineOffset: 2,
                  transition: 'outline-color 0.15s',
                }}
              />
            ))}
          </div>

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

          {/* Admin links — only for role=admin */}
          {profile?.role === 'admin' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Link href="/admin/dashboard" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', background: 'var(--gn-010)', border: '1px solid var(--gn-025)', borderRadius: 8, padding: '4px 10px', textDecoration: 'none', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Admin
              </Link>
              <Link href="/admin/logistics" style={{ fontSize: '0.72rem', fontWeight: 700, color: '#d97706', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: 8, padding: '4px 10px', textDecoration: 'none', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Logistik
              </Link>
              <Link href="/forecast" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gn-dk)', background: 'var(--gn-010)', border: '1px solid var(--gn-025)', borderRadius: 8, padding: '4px 10px', textDecoration: 'none', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Forecast
              </Link>
              <Link href="/admin/dispatcher" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gn-dk)', background: 'var(--gn-010)', border: '1px solid var(--gn-025)', borderRadius: 8, padding: '4px 10px', textDecoration: 'none', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gn)' }} />
                Dispatcher
              </Link>
            </div>
          )}


          {/* Notification bell — only when logged in */}
          {userId && <NotificationBell userId={userId} />}

          {/* Avatar / Login */}
          {userId ? (
            <Link href="/profil" style={{
              display: 'flex', alignItems: 'center', gap: 8,
              textDecoration: 'none',
              padding: scrolled ? '4px 10px 4px 4px' : '5px 12px 5px 5px',
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              transition: `padding 0.45s ${EASE}, background 0.15s`,
            }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
            >
              <div style={{
                width: scrolled ? 26 : 30, height: scrolled ? 26 : 30,
                borderRadius: '50%',
                background: 'var(--text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: scrolled ? '0.6rem' : '0.65rem', fontWeight: 800, color: 'var(--bg)',
                flexShrink: 0,
                letterSpacing: '0.02em',
                transition: `width 0.45s ${EASE}, height 0.45s ${EASE}`,
              }}>
                {(profile?.name ?? '')
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map(n => n[0].toUpperCase())
                  .join('')
                || 'A'}
              </div>
              <span style={{
                fontSize: scrolled ? '0.78rem' : '0.82rem',
                fontWeight: 500,
                color: 'var(--text)',
                maxWidth: 100,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                transition: `font-size 0.45s ${EASE}`,
              }}>
                {profile?.name?.split(' ')[0] ?? 'Konto'}
              </span>
            </Link>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              style={{
                fontSize: scrolled ? '0.79rem' : '0.82rem',
                fontWeight: 500,
                color: 'var(--muted)',
                background: 'none', border: 'none',
                cursor: 'pointer', padding: '6px 4px',
                fontFamily: 'inherit',
                transition: `color 0.15s, font-size 0.45s ${EASE}`,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)' }}
            >
              Logga in
            </button>
          )}

          {/* CTA */}
          <button
            type="button"
            onClick={openSendPackageFlow}
            style={{
            fontSize: scrolled ? '0.79rem' : '0.82rem',
            fontWeight: 600,
            background: 'var(--accent)',
            color: '#0a0a0a',
            padding: scrolled ? '7px 16px' : '8px 18px',
            borderRadius: 999,
            textDecoration: 'none', whiteSpace: 'nowrap',
            transition: `opacity 0.15s, padding 0.45s ${EASE}, font-size 0.45s ${EASE}`,
            display: 'inline-block',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
          >
            Skicka nu
          </button>
        </div>

        {/* Mobile hamburger */}
        <button style={{
          display: isDesktop ? 'none' : 'flex',
          color: 'var(--muted)', background: 'none',
          border: 'none', cursor: 'pointer', padding: 6, alignItems: 'center',
        }} onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu - floats as card below pill */}
      {open && !isDesktop && (
        <div style={{
          margin: '8px 12px 0',
          background: pillBg,
          boxShadow: pillShadow,
          borderRadius: 22,
          padding: '14px 14px 16px',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '4px 4px 12px',
              marginBottom: 6,
              borderBottom: '1px solid var(--border)',
            }}>
              <div>
                <p style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                  Gonow meny
                </p>
                <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em' }}>
                  Snabb navigation
                </p>
              </div>
              <div style={{
                padding: '7px 10px',
                borderRadius: 999,
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                fontSize: '0.68rem',
                fontWeight: 800,
              }}>
                LIVE
              </div>
            </div>
            <button type="button" onClick={toggleTheme} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '12px 14px', marginBottom: 8,
              borderRadius: 14, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)',
              fontSize: '0.875rem', fontFamily: 'inherit', cursor: 'pointer',
            }}>
              <span>{dark ? 'Ljust läge' : 'Mörkt läge'}</span>
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} style={{
                fontSize: '0.92rem', color: path === l.href ? 'var(--text)' : 'var(--muted)',
                fontWeight: path === l.href ? 700 : 500,
                padding: '12px 14px',
                borderRadius: 14,
                display: 'block',
                textDecoration: 'none',
                background: path === l.href ? 'var(--accent-soft)' : 'transparent',
                border: `1px solid ${path === l.href ? 'var(--gn-022)' : 'transparent'}`,
              }}>
                {l.label}
              </Link>
            ))}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {userId && profile ? (
                <>
                  <Link href="/profil" onClick={() => setOpen(false)} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 10,
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    textDecoration: 'none',
                  }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--text)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 700 }}>
                      {profile.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>{profile.name?.split(' ')[0]}</span>
                  </Link>
                  <button onClick={async () => { await signOut(); setOpen(false) }} style={{
                    width: '100%', padding: '10px', borderRadius: 10,
                    border: '1px solid var(--border)', background: 'none',
                    color: 'var(--muted)', fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    Logga ut
                  </button>
                </>
              ) : (
                <button onClick={() => { setShowAuth(true); setOpen(false) }} style={{
                  width: '100%', padding: '10px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text)', fontSize: '0.875rem', fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  Logga in / Skapa konto
                </button>
              )}
              <button
                type="button"
                onClick={openSendPackageFlow}
                style={{
                display: 'block', textAlign: 'center',
                background: 'var(--accent)', color: '#0a0a0a',
                padding: '11px 0', borderRadius: 999,
                fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                width: '100%',
              }}>
                Skicka nu
              </button>
            </div>
          </div>
        </div>
      )}
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={() => setShowAuth(false)}
          redirectTo="/profil"
        />
      )}
    </nav>
  )
}
