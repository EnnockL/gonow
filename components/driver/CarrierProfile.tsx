'use client'

import { Shield, Star, MessageCircle } from 'lucide-react'

interface Props {
  name: string
  variant: 'full' | 'light'
  tripFrom: string
  tripTo: string
  mutedBadge?: boolean
}

const AVATAR_COLORS = ['#4f6ef7', '#7c5cbf', '#0d9488', '#c05621', '#1a6b6a', '#9333ea']
const TAG_SETS = [
  ['🎵 Spotify-mix i bilen', '💬 Pratglad', '🐾 Husdjursvänlig', '🚭 Rökfritt'],
  ['🎵 Podcast-lyssnare', '🤫 Tyst i bilen', '🚭 Rökfritt', '❄️ Frisk luft'],
  ['🎵 Radio P3', '💬 Lagom pratglad', '☀️ Solig stämning', '🚭 Rökfritt'],
]

function seed(name: string) {
  return (name.charCodeAt(0) + (name.charCodeAt(1) || 0) + (name.charCodeAt(2) || 0)) % 3
}

function initials(name: string) {
  return name.trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

export default function CarrierProfile({ name, variant, tripFrom, tripTo, mutedBadge }: Props) {
  const s = seed(name)
  const avatarColor = AVATAR_COLORS[s % AVATAR_COLORS.length]
  const rating = [4.7, 4.9, 5.0][s]
  const trips  = [67, 89, 124][s]
  const since  = ['jan 2025', 'mars 2026', 'sep 2024'][s]
  const years  = ['1', '2', '3'][s]
  const tags   = TAG_SETS[s]
  const upcoming = [
    [{ from: tripFrom, to: tripTo, date: 'Imorgon 06:00' }, { from: tripTo, to: tripFrom, date: 'Fre 18:00' }],
    [{ from: tripFrom, to: tripTo, date: 'Imorgon 08:30' }, { from: 'Göteborg', to: 'Malmö', date: 'Lör 10:00' }],
    [{ from: tripFrom, to: tripTo, date: 'Imorgon 07:00' }, { from: tripTo, to: 'Sundsvall', date: 'Sön 12:00' }],
  ][s]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Avatar + name box */}
      <div style={{
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 13,
      }}>
        <div style={{
          width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
          background: 'var(--text)', color: 'var(--bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.88rem', fontWeight: 700,
        }}>
          {initials(name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
            <p style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>{name}</p>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px',
              borderRadius: 100,
              background: mutedBadge ? 'var(--text)' : 'rgba(34,197,94,0.1)',
              color: mutedBadge ? 'var(--bg)' : '#22c55e',
              border: mutedBadge ? '1px solid var(--text)' : '1px solid rgba(34,197,94,0.22)',
            }}>
              <Shield size={8} /> BankID
            </span>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
            Medlem sedan {since} · {years} år på Gonow
          </p>
        </div>
      </div>

      {/* Stats: 3 separate boxes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          { label: 'Snittbetyg', value: rating, star: true },
          { label: 'Resor',      value: trips,  star: false },
          { label: 'År på Gonow', value: years, star: false },
        ].map(({ label, value, star }) => (
          <div key={label} style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '11px 8px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
            <p style={{
              fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)',
              letterSpacing: '-0.02em', lineHeight: 1,
              display: 'flex', alignItems: 'center', gap: 3,
            }}>
              {star && <Star size={12} style={{ color: '#fbbf24', fill: '#fbbf24' }} />}
              {value}
            </p>
            <p style={{ fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Full-only: tags box */}
      {variant === 'full' && (
        <>
          <div style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '13px 16px',
          }}>
            <p style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 9 }}>Om resan med mig</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {tags.map(tag => (
                <span key={tag} style={{
                  fontSize: '0.75rem', padding: '5px 11px', borderRadius: 100,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Full-only: upcoming trips box */}
          <div style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '13px 16px',
          }}>
            <p style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 9 }}>Kommande resor</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {upcoming.map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{t.from} → {t.to}</span>
                  <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>{t.date}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Full-only: ask button box */}
          <button
            type="button"
            style={{
              width: '100%', padding: '11px', borderRadius: 12,
              border: '1px solid var(--border)', background: 'var(--surface-2)',
              color: 'var(--text)', fontSize: '0.82rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'var(--surface-3)'
              el.style.borderColor = 'var(--border-strong)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'var(--surface-2)'
              el.style.borderColor = 'var(--border)'
            }}
          >
            <MessageCircle size={14} /> Fråga om resan
          </button>
        </>
      )}
    </div>
  )
}
