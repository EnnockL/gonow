'use client'

import { GonowScoreResult, NextLevelRequirement, TIERS } from '@/lib/gonow-score'
import { Shield, Star, CheckCircle2, Lock } from 'lucide-react'

export function GonowScoreBadgeCompact({ result }: { result: GonowScoreResult }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 999,
      background: result.tier.bg,
      border: `1px solid ${result.tier.color}44`,
      fontSize: '0.7rem', fontWeight: 700, color: result.tier.color,
      whiteSpace: 'nowrap',
    }}>
      {result.tier.emoji} Gonow Score {result.score}
    </span>
  )
}

interface GonowScoreCardProps {
  result: GonowScoreResult
  ratingAvg: number
  ratingCount: number
  bankidVerified: boolean
  completedTrips: number
  nextRequirements: NextLevelRequirement[]
  isDark?: boolean
  mobile?: boolean
}

export function GonowScoreCard({
  result, ratingAvg, ratingCount, bankidVerified, completedTrips, nextRequirements, isDark = false, mobile = false,
}: GonowScoreCardProps) {
  const { tier, nextTier, score, progressToNext, breakdown } = result

  // Light+mobile = white card with dark text. Light+desktop = dark gray card (#909090) with white text.
  const lightDark = !isDark && !mobile
  const txt     = (isDark || lightDark) ? (isDark ? 'var(--text)' : '#ffffff')   : 'var(--text)'
  const muted   = (isDark || lightDark) ? (isDark ? 'var(--muted)' : 'rgba(255,255,255,0.8)') : 'var(--muted)'
  const divider = isDark ? 'rgba(0,0,0,0.06)' : (lightDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.08)')
  const track   = isDark ? 'rgba(0,0,0,0.08)' : (lightDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.06)')
  const chipBg  = isDark ? 'rgba(0,0,0,0.05)' : (lightDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.04)')
  const chipBd  = isDark ? 'rgba(0,0,0,0.08)' : (lightDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.1)')
  const badgeBg = isDark ? 'var(--surface)' : (lightDark ? 'rgba(255,255,255,0.18)' : 'var(--surface-2)')
  const badgeBd = isDark ? 'var(--border)'  : (lightDark ? 'rgba(255,255,255,0.3)' : 'var(--border)')
  const vDiv    = isDark ? 'rgba(0,0,0,0.1)' : (lightDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.1)')
  const conn    = isDark ? 'rgba(0,0,0,0.12)' : (lightDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.12)')
  const dotBd   = isDark ? 'rgba(0,0,0,0.08)' : (lightDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)')

  const bars = [
    { label: 'Omdömen',    pts: breakdown.rating.pts,      max: breakdown.rating.max,      color: '#f59e0b', icon: '⭐' },
    { label: 'Genomförda', pts: breakdown.completion.pts,  max: breakdown.completion.max,  color: '#a78bfa', icon: '📦' },
    { label: 'Resor',      pts: breakdown.trips.pts,        max: breakdown.trips.max,        color: '#60a5fa', icon: '🚗' },
    { label: 'BankID',     pts: breakdown.bankid.pts,       max: breakdown.bankid.max,       color: '#34d399', icon: '🆔' },
    { label: 'Punktlighet',pts: breakdown.punctuality.pts,  max: breakdown.punctuality.max,  color: '#f472b6', icon: '⏱', locked: true },
    { label: 'Svarstid',   pts: breakdown.response.pts,     max: breakdown.response.max,     color: '#fb923c', icon: '💬', locked: true },
  ] as const

  return (
    <div style={{
      background: isDark ? tier.bg : (mobile ? '#ffffff' : '#909090'),
      border: isDark ? `1.5px solid ${tier.color}44` : (mobile ? `1.5px solid ${tier.color}33` : '1.5px solid rgba(0,0,0,0.18)'),
      borderRadius: 20,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>

      {/* Row 1: Score + tier badge + tier dots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 10 : 16, flexWrap: mobile ? 'wrap' : 'nowrap' }}>
        {/* Score */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: '2.2rem', fontWeight: 900, color: tier.color, lineHeight: 1, letterSpacing: '-0.04em' }}>{score}</span>
          <span style={{ fontSize: '0.72rem', color: muted, fontWeight: 500 }}>/100</span>
        </div>

        <div style={{ width: 1, height: 28, background: vDiv, flexShrink: 0 }} />

        {/* Current tier badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: `${tier.color}22`, border: `1px solid ${tier.color}44`, flexShrink: 0 }}>
          <span style={{ fontSize: '0.82rem' }}>{tier.emoji}</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: tier.color }}>{tier.label}</span>
        </div>

        {/* Tier progression dots — hidden on mobile */}
        {!mobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '0.6rem', color: muted, marginRight: 6, whiteSpace: 'nowrap', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gonow Score™</span>
            {TIERS.map((t, i) => {
              const isPassed  = score >= t.max
              const isCurrent = t.key === tier.key
              return (
                <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, background: isPassed || isCurrent ? `${t.color}20` : 'transparent', border: `1px solid ${isPassed || isCurrent ? t.color + '55' : dotBd}` }}>
                    <span style={{ fontSize: '0.7rem' }}>{t.emoji}</span>
                    {isCurrent && <span style={{ fontSize: '0.62rem', fontWeight: 700, color: t.color }}>{t.label}</span>}
                  </div>
                  {i < TIERS.length - 1 && (
                    <div style={{ width: 12, height: 1, background: conn }} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Row 2: Progress bar */}
      {nextTier && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.68rem', color: muted, whiteSpace: 'nowrap', flexShrink: 0 }}>
            Mot <span style={{ color: nextTier.color, fontWeight: 600 }}>{nextTier.emoji} {nextTier.label}</span>
          </span>
          <div style={{ flex: 1, height: 5, borderRadius: 999, background: track, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 999, width: `${progressToNext * 100}%`, background: `linear-gradient(90deg, ${tier.color}, ${nextTier.color})`, transition: 'width 0.8s ease' }} />
          </div>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: txt, flexShrink: 0 }}>{score}/{nextTier.min}p</span>
        </div>
      )}

      <div style={{ height: 1, background: divider }} />

      {/* Row 3: Breakdown chips */}
      <div>
        <p style={{ fontSize: '0.6rem', color: muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Poängfördelning</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {bars.map(bar => (
            <div key={bar.label} style={{ display: 'flex', flexDirection: 'column', gap: 5, opacity: (bar as { locked?: boolean }).locked ? 0.4 : 1, minWidth: 72, flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: muted, display: 'flex', alignItems: 'center', gap: 3 }}>
                  {bar.icon} {bar.label}
                  {(bar as { locked?: boolean }).locked && <Lock size={8} style={{ opacity: 0.5 }} />}
                </span>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: txt }}>{bar.pts}/{bar.max}</span>
              </div>
              <div style={{ height: 3, borderRadius: 999, background: track, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 999, width: `${(bar.pts / bar.max) * 100}%`, background: bar.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 4: Next level requirements */}
      {nextTier && nextRequirements.length > 0 && (
        <>
          <div style={{ height: 1, background: divider }} />
          <div>
            <p style={{ fontSize: '0.6rem', color: muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Vad krävs för <span style={{ color: nextTier.color }}>{nextTier.label}</span>?
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {nextRequirements.map(req => (
                <div key={req.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, background: req.done ? 'rgba(34,197,94,0.15)' : chipBg, border: `1px solid ${req.done ? 'rgba(34,197,94,0.35)' : chipBd}` }}>
                  <span style={{ fontSize: '0.78rem' }}>{req.done ? '✅' : req.icon}</span>
                  <div>
                    <p style={{ fontSize: '0.68rem', fontWeight: 600, color: req.done ? muted : txt, textDecoration: req.done ? 'line-through' : 'none', margin: 0 }}>{req.label}</p>
                    {!req.done && req.target > 1 && (
                      <p style={{ fontSize: '0.62rem', color: muted, margin: '2px 0 0' }}>{req.current}/{req.target}{req.unit ? ' ' + req.unit : ''}</p>
                    )}
                    {!req.done && req.target === 1 && req.unit === '' && (
                      <p style={{ fontSize: '0.62rem', color: muted, margin: '2px 0 0' }}>Krävs</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Footer badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 2 }}>
        {ratingCount > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: badgeBg, border: `1px solid ${badgeBd}`, fontSize: '0.68rem', fontWeight: 600, color: txt }}>
            <Star size={10} style={{ color: '#f59e0b', fill: '#f59e0b' }} /> {ratingAvg.toFixed(1)} · {ratingCount} rec
          </span>
        )}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: badgeBg, border: `1px solid ${badgeBd}`, fontSize: '0.68rem', fontWeight: 600, color: txt }}>
          <CheckCircle2 size={10} style={{ color: '#34d399' }} /> {completedTrips} genomförda
        </span>
        {bankidVerified && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.4)', fontSize: '0.68rem', fontWeight: 600, color: isDark ? '#059669' : '#34d399' }}>
            <Shield size={10} /> BankID
          </span>
        )}
      </div>
    </div>
  )
}
