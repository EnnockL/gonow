'use client'

import { useState } from 'react'
import { Sparkles, Package, Users, MapPin, ArrowRight, Cpu, Bot, ChevronRight } from 'lucide-react'
import type { TripOptimizationResult } from '@/lib/ai/types'

function StatPill({
  icon: Icon,
  value,
  label,
  accent,
}: {
  icon: React.ElementType
  value: string | number
  label: string
  accent?: boolean
}) {
  return (
    <div
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        gap:            4,
        padding:        '10px 8px',
        borderRadius:   12,
        background:     accent ? 'var(--accent-soft)' : 'var(--surface)',
        border:         `1px solid ${accent ? 'var(--gn-025)' : 'var(--border)'}`,
        flex:           1,
        minWidth:       0,
      }}
    >
      <Icon size={14} style={{ color: accent ? 'var(--accent)' : 'var(--muted)' }} />
      <span style={{ fontSize: '1rem', fontWeight: 800, color: accent ? 'var(--accent)' : 'var(--text)', letterSpacing: '-0.03em' }}>
        {value}
      </span>
      <span style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
    </div>
  )
}

export default function TripOptimizer() {
  const [fromCity, setFromCity] = useState('')
  const [toCity,   setToCity]   = useState('')
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<TripOptimizationResult | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  async function handleOptimize() {
    const from = fromCity.trim()
    const to   = toCity.trim()
    if (!from || !to) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res  = await fetch('/api/ai/optimize-trip', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ fromCity: from, toCity: to }),
      })
      const data = await res.json() as TripOptimizationResult & { error?: string }

      if (!res.ok || data.error) {
        setError(data.error ?? 'Något gick fel')
      } else {
        setResult(data)
      }
    } catch {
      setError('Nätverksfel — försök igen')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = fromCity.trim().length > 1 && toCity.trim().length > 1 && !loading

  return (
    <div
      className="card-sm"
      style={{ borderRadius: 20, padding: 0, overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}
    >
      {/* Header */}
      <div
        style={{
          padding:        '13px 16px',
          borderBottom:   '1px solid var(--border)',
          background:     'var(--enterprise-panel-header-bg)',
          display:        'flex',
          alignItems:     'center',
          gap:            8,
        }}
      >
        <div
          style={{
            width:          28,
            height:         28,
            borderRadius:   8,
            background:     'var(--accent-soft)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
          }}
        >
          <Sparkles size={14} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
            Optimera min resa
          </p>
          <p style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>
            Se potentialen längs din rutt
          </p>
        </div>
      </div>

      {/* Inputs */}
      <div style={{ padding: '14px 16px 12px' }}>
        <div
          style={{
            display:             'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems:          'center',
            gap:                 8,
            marginBottom:        10,
          }}
        >
          <input
            type="text"
            placeholder="Från (stad)"
            value={fromCity}
            onChange={(e) => setFromCity(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleOptimize()}
            style={{
              width:        '100%',
              padding:      '9px 12px',
              borderRadius: 10,
              border:       '1px solid var(--border)',
              background:   'var(--surface)',
              color:        'var(--text)',
              fontSize:     '0.82rem',
              outline:      'none',
              boxSizing:    'border-box',
            }}
          />
          <ArrowRight size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Till (stad)"
            value={toCity}
            onChange={(e) => setToCity(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleOptimize()}
            style={{
              width:        '100%',
              padding:      '9px 12px',
              borderRadius: 10,
              border:       '1px solid var(--border)',
              background:   'var(--surface)',
              color:        'var(--text)',
              fontSize:     '0.82rem',
              outline:      'none',
              boxSizing:    'border-box',
            }}
          />
        </div>

        <button
          onClick={handleOptimize}
          disabled={!canSubmit}
          style={{
            width:          '100%',
            padding:        '10px 16px',
            borderRadius:   10,
            border:         'none',
            background:     canSubmit ? 'var(--accent)' : 'var(--border)',
            color:          canSubmit ? '#fff' : 'var(--muted)',
            fontSize:       '0.82rem',
            fontWeight:     700,
            cursor:         canSubmit ? 'pointer' : 'default',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            6,
            transition:     'background 0.15s, opacity 0.15s',
            opacity:        loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <>
              <span
                style={{
                  width:        12,
                  height:       12,
                  borderRadius: '50%',
                  border:       '2px solid rgba(255,255,255,0.3)',
                  borderTop:    '2px solid #fff',
                  animation:    'spin 0.7s linear infinite',
                  display:      'inline-block',
                }}
              />
              Beräknar…
            </>
          ) : (
            <>
              <Sparkles size={13} />
              Beräkna potential
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            margin:       '0 16px 14px',
            padding:      '10px 12px',
            borderRadius: 10,
            background:   'rgba(239,68,68,0.08)',
            border:       '1px solid rgba(239,68,68,0.2)',
            color:        'var(--error, #ef4444)',
            fontSize:     '0.78rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {/* Hero payout number */}
          <div
            style={{
              textAlign:  'center',
              padding:    '20px 16px 16px',
              background: 'linear-gradient(180deg, var(--accent-soft) 0%, transparent 100%)',
            }}
          >
            <p style={{ fontSize: '0.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>
              Potentiell utbetalning
            </p>
            <p
              style={{
                fontSize:      '2.6rem',
                fontWeight:    800,
                color:         'var(--accent)',
                letterSpacing: '-0.05em',
                lineHeight:    1,
                marginBottom:  6,
              }}
            >
              {result.carrierPayout.toLocaleString('sv-SE')} kr
            </p>
            <p style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
              {result.km} km &middot; 80% av {result.potentialEarnings.toLocaleString('sv-SE')} kr brutto
            </p>
          </div>

          {/* Stat pills */}
          <div
            style={{
              display: 'flex',
              gap:     8,
              padding: '0 16px 14px',
            }}
          >
            <StatPill
              icon={Package}
              value={result.packages.length}
              label="Paket"
              accent={result.packages.length > 0}
            />
            <StatPill
              icon={Users}
              value={result.lifts.length}
              label="Lift"
              accent={result.lifts.length > 0}
            />
            <StatPill
              icon={MapPin}
              value={result.extraKm === 0 ? '0 km' : `+${result.extraKm} km`}
              label="Omväg"
            />
          </div>

          {/* Breakdown (if there are earnings) */}
          {result.potentialEarnings > 0 && (
            <div
              style={{
                margin:       '0 16px 14px',
                padding:      '10px 12px',
                borderRadius: 10,
                background:   'var(--surface)',
                border:       '1px solid var(--border)',
                display:      'flex',
                gap:          12,
                flexWrap:     'wrap',
              }}
            >
              {result.breakdown.packageEarnings > 0 && (
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                  📦 Paket: <strong style={{ color: 'var(--text)' }}>{result.breakdown.packageEarnings} kr</strong>
                </span>
              )}
              {result.breakdown.liftEarnings > 0 && (
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                  👤 Lift: <strong style={{ color: 'var(--text)' }}>{result.breakdown.liftEarnings} kr</strong>
                </span>
              )}
              {result.breakdown.gonowFee > 0 && (
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                  Gonow: <strong style={{ color: 'var(--text)' }}>{result.breakdown.gonowFee} kr</strong>
                </span>
              )}
            </div>
          )}

          {/* AI / Engine insight */}
          <div
            style={{
              margin:       '0 16px 14px',
              padding:      '10px 12px',
              borderRadius: 10,
              background:   result.source === 'claude'
                ? 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, var(--gn-006) 100%)'
                : 'var(--surface)',
              border:       `1px solid ${result.source === 'claude' ? 'rgba(99,102,241,0.2)' : 'var(--border)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              {result.source === 'claude'
                ? <Bot size={12} style={{ color: '#6366f1' }} />
                : <Cpu size={12} style={{ color: 'var(--muted)' }} />
              }
              <span
                style={{
                  fontSize:      '0.62rem',
                  fontWeight:    700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color:         result.source === 'claude' ? '#6366f1' : 'var(--muted)',
                }}
              >
                {result.source === 'claude' ? 'Claude AI' : 'Prismotor'}
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.55 }}>
              {result.insight}
            </p>
          </div>

          {/* CTA */}
          <div style={{ padding: '0 16px 16px' }}>
            <a
              href="/profil?tab=my_trips"
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                padding:        '11px 14px',
                borderRadius:   10,
                background:     'var(--enterprise-panel-header-bg)',
                border:         '1px solid var(--enterprise-panel-border)',
                textDecoration: 'none',
                color:          'var(--text)',
              }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                Registrera resan och börja tjäna
              </span>
              <ChevronRight size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            </a>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
