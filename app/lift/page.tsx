'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Users, Package as PkgIcon, Star, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import AuthModal from '@/components/auth/AuthModal'

interface LiftRequest {
  id: string
  passenger_id: string | null
  from_city: string
  to_city: string
  travel_date: string
  flexibility: 'exact' | 'day' | 'week'
  passengers: number
  has_luggage: boolean
  luggage_kg: number | null
  note: string | null
  max_price: number | null
  status: string
  users?: { name: string; rating_avg: number; avatar_url: string | null }
}

const FILTERS = ['Alla', 'Idag', 'Imorgon', 'Stockholm', 'Göteborg', 'Flexibelt'] as const
type Filter = typeof FILTERS[number]

const FLEXIBILITY_LABELS: Record<string, string> = {
  exact: 'Exakt datum',
  day: '± 1 dag',
  week: 'Denna vecka',
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  if (d.getTime() === today.getTime()) return 'Idag'
  if (d.getTime() === tomorrow.getTime()) return 'Imorgon'
  return d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ─── PublishLiftModal ────────────────────────────────────────────────────────

function PublishLiftModal({ onClose, onSuccess }: {
  onClose: () => void
  onSuccess: (lift: LiftRequest) => void
}) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [date, setDate] = useState('')
  const [flexibility, setFlexibility] = useState<'exact' | 'day' | 'week'>('exact')
  const [passengers, setPassengers] = useState(1)
  const [hasLuggage, setHasLuggage] = useState(false)
  const [luggageKg, setLuggageKg] = useState('')
  const [note, setNote] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/lift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_city: from,
          to_city: to,
          travel_date: date,
          flexibility,
          passengers,
          has_luggage: hasLuggage,
          luggage_kg: hasLuggage && luggageKg ? parseFloat(luggageKg) : null,
          note: note || null,
          max_price: maxPrice ? parseInt(maxPrice) : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Något gick fel.'); return }
      onSuccess(json.lift_request)
    } catch {
      setError('Nätverksfel. Försök igen.')
    } finally {
      setSubmitting(false)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px 12px',
    fontSize: '0.85rem', color: 'var(--text)', fontFamily: 'inherit', outline: 'none',
  }
  const lbl: React.CSSProperties = {
    fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)',
    textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6,
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10001, width: '100%', maxWidth: 460, padding: '0 16px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '24px 22px', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Publicera reseförfrågan</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex' }}><X size={18} /></button>
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: '0.82rem', color: '#dc2626' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={lbl}>Varifrån</label>
                <input value={from} onChange={e => setFrom(e.target.value)} placeholder="Stockholm" required style={inp}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
              </div>
              <div>
                <label style={lbl}>Vart</label>
                <input value={to} onChange={e => setTo(e.target.value)} placeholder="Göteborg" required style={inp}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
              </div>
            </div>

            <div>
              <label style={lbl}>Datum</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={inp}
                min={new Date().toISOString().split('T')[0]}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
            </div>

            <div>
              <label style={lbl}>Flexibilitet</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['exact', 'day', 'week'] as const).map(f => (
                  <button key={f} type="button" onClick={() => setFlexibility(f)} style={{
                    flex: 1, padding: '7px 4px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600,
                    border: '1px solid', cursor: 'pointer', fontFamily: 'inherit',
                    background: flexibility === f ? 'var(--accent)' : 'var(--surface-2)',
                    color: flexibility === f ? '#0a0a0a' : 'var(--muted)',
                    borderColor: flexibility === f ? 'var(--accent)' : 'var(--border)',
                  }}>
                    {FLEXIBILITY_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={lbl}>Antal passagerare</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4].map(n => (
                  <button key={n} type="button" onClick={() => setPassengers(n)} style={{
                    flex: 1, padding: '9px 0', borderRadius: 10, fontSize: '0.88rem', fontWeight: 700,
                    border: '1px solid', cursor: 'pointer', fontFamily: 'inherit',
                    background: passengers === n ? 'var(--accent)' : 'var(--surface-2)',
                    color: passengers === n ? '#0a0a0a' : 'var(--muted)',
                    borderColor: passengers === n ? 'var(--accent)' : 'var(--border)',
                  }}>
                    {n}{n === 4 ? '+' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: hasLuggage ? 10 : 0 }}>
                <button type="button" onClick={() => setHasLuggage(v => !v)} style={{
                  width: 36, height: 20, borderRadius: 999, border: 'none', cursor: 'pointer',
                  background: hasLuggage ? 'var(--accent)' : 'var(--border)', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}>
                  <span style={{ position: 'absolute', top: 2, left: hasLuggage ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
                </button>
                <span style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 500 }}>Jag har bagage</span>
              </div>
              {hasLuggage && (
                <div style={{ position: 'relative' }}>
                  <input type="number" min="0" step="0.5" value={luggageKg} onChange={e => setLuggageKg(e.target.value)}
                    placeholder="Vikt i kg" style={{ ...inp, paddingRight: 36 }}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '0.82rem', color: 'var(--muted)' }}>kg</span>
                </div>
              )}
            </div>

            <div>
              <label style={lbl}>Meddelande <span style={{ fontWeight: 400, textTransform: 'none' }}>(valfri)</span></label>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Berätta mer om din resa eller önskemål..." rows={2}
                style={{ ...inp, resize: 'vertical' }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
            </div>

            <div>
              <label style={lbl}>Maxpris <span style={{ fontWeight: 400, textTransform: 'none' }}>(valfri)</span></label>
              <div style={{ position: 'relative' }}>
                <input type="number" min="0" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="t.ex. 150"
                  style={{ ...inp, paddingRight: 36 }}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')} />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '0.82rem', color: 'var(--muted)' }}>kr</span>
              </div>
            </div>

            <button type="submit" disabled={submitting} style={{
              minHeight: 46, marginTop: 4, background: 'var(--accent)', color: '#0a0a0a',
              border: 'none', borderRadius: 12, fontSize: '0.9rem', fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              opacity: submitting ? 0.7 : 1, transition: 'opacity 0.15s',
            }}>
              {submitting ? 'Publicerar...' : 'Publicera reseförfrågan'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

// ─── LiftCard ────────────────────────────────────────────────────────────────

function LiftCard({ lift, isDriver, onOffer }: { lift: LiftRequest; isDriver: boolean; onOffer: (id: string) => void }) {
  const userName = lift.users?.name ?? 'Passagerare'
  const rating = lift.users?.rating_avg ?? 5.0
  const avatar = lift.users?.avatar_url

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 18px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>{lift.from_city}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '2px 0 0', fontWeight: 500 }}>→ {lift.to_city}</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{formatDate(lift.travel_date)}</p>
          <p style={{ fontSize: '0.68rem', color: 'var(--muted)', margin: '2px 0 0' }}>{FLEXIBILITY_LABELS[lift.flexibility]}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--muted)' }}>
          <Users size={12} /> {lift.passengers} person{lift.passengers > 1 ? 'er' : ''}
        </span>
        {lift.has_luggage && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--muted)' }}>
            <PkgIcon size={12} /> Bagage{lift.luggage_kg ? ` · ${lift.luggage_kg} kg` : ''}
          </span>
        )}
        {lift.max_price && (
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Max {lift.max_price} kr</span>
        )}
      </div>

      {lift.note && (
        <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0, fontStyle: 'italic', lineHeight: 1.5 }}>"{lift.note}"</p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
        {avatar
          ? <img src={avatar} alt={userName} style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />
          : <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#0a0a0a' }}>{userName[0]}</div>
        }
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>{userName}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', color: '#f59e0b', marginLeft: 2 }}>
          <Star size={11} fill="#f59e0b" /> {rating.toFixed(1)}
        </span>
      </div>

      {isDriver && (
        <button onClick={() => onOffer(lift.id)} style={{
          minHeight: 40, background: 'var(--accent)', color: '#0a0a0a', border: 'none', borderRadius: 10,
          fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          Erbjud plats →
        </button>
      )}
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function LiftPage() {
  const { userId } = useAuth()
  const [tab, setTab] = useState<'passenger' | 'driver'>('passenger')
  const [lifts, setLifts] = useState<LiftRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('Alla')
  const [showPublish, setShowPublish] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  function handlePublishClick() {
    if (!userId) {
      setShowAuth(true)
    } else {
      setShowPublish(true)
    }
  }

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    fetch('/api/lift')
      .then(r => r.json())
      .then(d => setLifts(d.lift_requests ?? []))
      .catch(() => setLifts([]))
      .finally(() => setLoading(false))
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const filtered = useMemo(() => {
    let r = lifts
    switch (filter) {
      case 'Idag':      r = r.filter(l => l.travel_date === today); break
      case 'Imorgon':   r = r.filter(l => l.travel_date === tomorrow); break
      case 'Stockholm': r = r.filter(l => l.from_city.includes('Stockholm') || l.to_city.includes('Stockholm')); break
      case 'Göteborg':  r = r.filter(l => l.from_city.includes('Göteborg') || l.to_city.includes('Göteborg')); break
      case 'Flexibelt': r = r.filter(l => l.flexibility !== 'exact'); break
    }
    return r
  }, [lifts, filter, today, tomorrow])

  async function handleOffer(liftId: string) {
    if (!userId) {
      setShowAuth(true)
      return
    }
    const res = await fetch(`/api/lift/${liftId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'matched' }),
    })
    if (res.ok) {
      setLifts(prev => prev.filter(l => l.id !== liftId))
      showToast('Platserbjudande skickat!')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-gradient)', paddingTop: 88, paddingBottom: 80 }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 20000, background: '#0a0a0a', color: '#fff', padding: '12px 22px', borderRadius: 999, fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <span style={{ color: '#22c55e' }}>✓</span> {toast}
        </div>
      )}

      <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '0 16px' : '0 24px' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: isMobile ? '1.6rem' : '2rem', fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em', lineHeight: 1.1 }}>Liftbräda</h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginTop: 6, marginBottom: 0, lineHeight: 1.6 }}>Passagerare publicerar resor — förare längs vägen erbjuder plats.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 4 }}>
            {(['passenger', 'driver'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: '0.82rem', fontWeight: 700,
                background: tab === t ? 'var(--accent)' : 'transparent',
                color: tab === t ? '#0a0a0a' : 'var(--muted)',
                transition: 'all 0.15s',
              }}>
                {t === 'passenger' ? '👥 Passagerare' : '🚗 Förare'}
              </button>
            ))}
          </div>
          {tab === 'passenger' && (
            <button onClick={handlePublishClick} style={{
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              background: 'var(--accent)', color: '#0a0a0a', border: 'none', borderRadius: 999,
              padding: isMobile ? '9px 14px' : '10px 20px', fontSize: isMobile ? '0.78rem' : '0.85rem', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}>
              <Plus size={15} /> Publicera din resa
            </button>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          {tab === 'passenger' ? (
            <>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>Behöver skjuts?</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: 0 }}>Publicera din resa — förare längs vägen ser den och erbjuder dig plats.</p>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>Passagerare längs din rutt</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: 0 }}>Öppna liftförfrågningar som du kan ta med på din resa.</p>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', marginBottom: 20 }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              flexShrink: 0, padding: '7px 14px', borderRadius: 999, border: '1px solid',
              fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              background: filter === f ? 'var(--accent)' : 'var(--surface)',
              color: filter === f ? '#0a0a0a' : 'var(--muted)',
              borderColor: filter === f ? 'var(--accent)' : 'var(--border)',
              transition: 'all 0.15s',
            }}>
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
            <p style={{ fontSize: '0.88rem' }}>Hämtar förfrågningar...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Inga förfrågningar hittades</p>
            {tab === 'passenger' && (
              <button onClick={handlePublishClick} style={{ marginTop: 8, background: 'var(--accent)', color: '#0a0a0a', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                + Publicera din resa
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {filtered.map(lift => (
              <LiftCard key={lift.id} lift={lift} isDriver={tab === 'driver'} onOffer={handleOffer} />
            ))}
          </div>
        )}
      </div>

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={() => { setShowAuth(false); setShowPublish(true) }}
          reason="Logga in för att publicera en reseförfrågan"
        />
      )}
      {showPublish && (
        <PublishLiftModal
          onClose={() => setShowPublish(false)}
          onSuccess={lift => {
            setLifts(prev => [lift, ...prev])
            setShowPublish(false)
            showToast('Reseförfrågan publicerad!')
          }}
        />
      )}
    </div>
  )
}
