'use client'

import { Star, MapPin, Clock, Bot, Cpu, CheckCircle2, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { calculateGonowScore } from '@/lib/gonow-score'
import { GonowScoreBadgeCompact } from '@/components/GonowScoreBadge'
import type { AIMatchResult } from '@/lib/ai/types'

type TripLike = {
  id:                  string
  from_city:           string
  to_city:             string
  departure_at?:       string | null
  weight_capacity_kg?: number | null
  users?: {
    name:         string
    rating_avg:   number
    rating_count: number
    avatar_url?:  string | null
  } | null
}

type Props = {
  trip:     TripLike
  price:    number
  match:    AIMatchResult
  selected: boolean
  onSelect: () => void
}

export default function AIMatchBanner({ trip, price, match, selected, onSelect }: Props) {
  const carrier  = trip.users
  const name     = carrier?.name ?? 'Bärare'
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const rating   = carrier?.rating_avg?.toFixed(1) ?? '5.0'
  const count    = carrier?.rating_count ?? 0

  const gonowScore = calculateGonowScore({
    rating_avg:        carrier?.rating_avg   ?? 0,
    rating_count:      carrier?.rating_count ?? 0,
    bankid_verified:   true,
  })

  const isAI   = match.source === 'claude'
  const accent = selected ? 'var(--gn)' : isAI ? '#6366f1' : 'var(--accent)'
  const bg     = selected
    ? 'linear-gradient(135deg, var(--gn-010) 0%, var(--gn-004) 100%)'
    : isAI
      ? 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, var(--gn-006) 100%)'
      : 'linear-gradient(135deg, var(--gn-008) 0%, transparent 100%)'

  return (
    <div
      style={{
        background:   bg,
        border:       `1.5px solid ${selected ? 'var(--gn)' : isAI ? 'rgba(99,102,241,0.35)' : 'var(--gn-035)'}`,
        borderRadius: 20,
        overflow:     'hidden',
        boxShadow:    selected
          ? '0 0 0 3px var(--gn-012)'
          : '0 4px 20px rgba(0,0,0,0.06)',
      }}
    >
      {/* Header badge */}
      <div
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          8,
          padding:      '10px 18px',
          borderBottom: `1px solid ${isAI ? 'rgba(99,102,241,0.15)' : 'var(--gn-015)'}`,
          background:   isAI ? 'rgba(99,102,241,0.06)' : 'var(--gn-006)',
        }}
      >
        {isAI
          ? <Bot size={13} style={{ color: '#6366f1', flexShrink: 0 }} />
          : <Cpu size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        }
        <span
          style={{
            fontSize:      '0.65rem',
            fontWeight:    800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color:         isAI ? '#6366f1' : 'var(--accent)',
          }}
        >
          {isAI ? 'Claude AI — bästa matchning' : 'Prismotor — bästa matchning'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--muted)' }}>
          Gonow Score {gonowScore.score}
        </span>
      </div>

      {/* Main content */}
      <div style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {/* Avatar */}
        <div
          style={{
            width:          48,
            height:         48,
            borderRadius:   14,
            flexShrink:     0,
            background:     `linear-gradient(135deg, ${selected ? 'var(--gn-030)' : isAI ? 'rgba(99,102,241,0.25)' : 'var(--gn-020)'}, var(--gn-008))`,
            border:         `1.5px solid ${accent}44`,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       '0.95rem',
            fontWeight:     800,
            color:          accent,
          }}
        >
          {initials}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '0.97rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
                {name}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.77rem', color: 'var(--muted)' }}>
                  <Star size={11} style={{ color: '#f59e0b', fill: '#f59e0b', flexShrink: 0 }} />
                  <strong style={{ color: 'var(--text)' }}>{rating}</strong>
                  <span>({count} resor)</span>
                </span>
                <GonowScoreBadgeCompact result={gonowScore} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', color: 'var(--muted)' }}>
                  <MapPin size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  {trip.from_city.split(',')[0]} → {trip.to_city.split(',')[0]}
                </span>
                {trip.departure_at && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', color: 'var(--muted)' }}>
                    <Clock size={11} style={{ flexShrink: 0 }} />
                    {format(new Date(trip.departure_at), 'EEE d MMM HH:mm', { locale: sv })}
                  </span>
                )}
              </div>
            </div>

            {/* Price */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent)', margin: 0, letterSpacing: '-0.04em', lineHeight: 1 }}>
                {price} <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>kr</span>
              </p>
              <p style={{ fontSize: '0.6rem', color: 'var(--muted)', margin: '3px 0 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                uppskattat
              </p>
            </div>
          </div>

          {/* Reasons */}
          <div
            style={{
              marginTop:    12,
              padding:      '10px 12px',
              borderRadius: 10,
              background:   isAI ? 'rgba(99,102,241,0.06)' : 'var(--surface)',
              border:       `1px solid ${isAI ? 'rgba(99,102,241,0.14)' : 'var(--border)'}`,
            }}
          >
            {match.reasons.length === 1 ? (
              <p style={{ fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.55, margin: 0 }}>
                {match.reasons[0]}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {match.reasons.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.77rem', color: 'var(--text)' }}>{r}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CTA */}
          <button
            onClick={onSelect}
            style={{
              marginTop:      10,
              width:          '100%',
              padding:        '10px 16px',
              borderRadius:   10,
              border:         `1.5px solid ${selected ? 'var(--gn)' : accent}`,
              background:     selected ? 'var(--gn)' : 'transparent',
              color:          selected ? '#fff' : accent,
              fontSize:       '0.82rem',
              fontWeight:     700,
              cursor:         'pointer',
              fontFamily:     'inherit',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            6,
              transition:     'all 0.15s',
            }}
          >
            {selected
              ? <><CheckCircle2 size={14} /> Vald</>
              : <>Välj denna bärare <ArrowRight size={13} /></>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
