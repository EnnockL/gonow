'use client'

import { Package as PkgIcon, MapPin, Tag, Clock } from 'lucide-react'

export interface UppdragPackage {
  id: string
  route: string
  from: string
  to: string
  payout: number
  type: string
  weight: string
  pickup: string
  tags: string[]
  deadline: 'today' | 'tomorrow' | 'flexible'
  created_at?: string
  status?: string
}

interface PackageCardProps {
  pkg: UppdragPackage
  recommended?: boolean
  onErbjud: (pkg: UppdragPackage) => void
}

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  'Idag':        { bg: 'var(--gn-012)',  color: 'var(--gn-dk)' },
  'Bråttom':     { bg: 'rgba(239,68,68,0.12)',  color: '#dc2626' },
  'Express':     { bg: 'rgba(249,115,22,0.12)', color: '#ea580c' },
  'Kyl':         { bg: 'rgba(59,130,246,0.12)', color: '#2563eb' },
  'Ömtåligt':    { bg: 'rgba(168,85,247,0.12)', color: '#9333ea' },
  'Försäkrad':   { bg: 'var(--gn-012)',  color: 'var(--gn-dk)' },
  'Stort':       { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' },
  'Imorgon':     { bg: 'rgba(251,191,36,0.12)', color: '#d97706' },
  'Flexibel tid':{ bg: 'rgba(107,114,128,0.1)', color: '#6b7280' },
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'just nu'
  if (mins < 60)  return `${mins} min sedan`
  if (hours < 24) return `${hours} tim sedan`
  if (days < 7)   return `${days} dag${days > 1 ? 'ar' : ''} sedan`
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

export default function PackageCard({ pkg, recommended, onErbjud }: PackageCardProps) {
  const isUrgent = pkg.deadline === 'today'
  const timeAgo  = pkg.created_at ? relativeTime(pkg.created_at) : null

  return (
    <div style={{
      background: 'var(--surface)',
      border: recommended
        ? '2px solid var(--gn-060)'
        : '1px solid var(--border)',
      borderRadius: 16,
      padding: '18px 18px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      position: 'relative',
      boxShadow: recommended
        ? '0 0 0 4px var(--gn-008), 0 4px 20px rgba(0,0,0,0.06)'
        : '0 2px 12px rgba(0,0,0,0.04)',
      transition: 'box-shadow 0.2s, border-color 0.2s',
    }}>
      {/* Bråttom badge */}
      {isUrgent && pkg.tags.includes('Bråttom') && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: '#dc2626', color: '#fff',
          fontSize: '0.62rem', fontWeight: 700,
          padding: '3px 8px', borderRadius: 999,
          letterSpacing: '0.04em',
        }}>
          BRÅTTOM
        </div>
      )}

      {/* Rekommenderad badge */}
      {recommended && (
        <div style={{
          position: 'absolute', top: -10, left: 14,
          background: 'var(--gn)', color: '#0a0a0a',
          fontSize: '0.6rem', fontWeight: 800,
          padding: '2px 10px', borderRadius: 999,
          letterSpacing: '0.06em',
        }}>
          REKOMMENDERAD
        </div>
      )}

      {/* Route + payout */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {pkg.from}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '2px 0 0', fontWeight: 500 }}>
            → {pkg.to}
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--gn)', margin: 0, lineHeight: 1, letterSpacing: '-0.03em' }}>
            upp till {pkg.payout} kr
          </p>
          <p style={{ fontSize: '0.62rem', color: 'var(--muted)', margin: '2px 0 0' }}>pristak</p>
        </div>
      </div>

      {/* Package info + tid */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--muted)' }}>
            <PkgIcon size={12} /> {pkg.type} · {pkg.weight}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--muted)' }}>
            <MapPin size={12} /> {pkg.pickup}
          </span>
        </div>
        {timeAgo && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.68rem', color: 'var(--muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
            <Clock size={10} /> {timeAgo}
          </span>
        )}
      </div>

      {/* Tags */}
      {pkg.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {pkg.tags.map(tag => {
            const style = TAG_COLORS[tag] ?? { bg: 'rgba(107,114,128,0.1)', color: '#6b7280' }
            return (
              <span key={tag} style={{
                fontSize: '0.65rem', fontWeight: 600,
                padding: '3px 8px', borderRadius: 999,
                background: style.bg, color: style.color,
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                <Tag size={9} /> {tag}
              </span>
            )
          })}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={() => onErbjud(pkg)}
        style={{
          minHeight: 44,
          background: 'var(--accent)',
          color: '#0a0a0a',
          border: 'none',
          borderRadius: 10,
          fontSize: '0.85rem',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        Erbjud körning →
      </button>
    </div>
  )
}
