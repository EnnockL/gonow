'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Users, Package as PkgIcon, Star, X, Loader2, Info, Phone, Navigation } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import AuthModal from '@/components/auth/AuthModal'
import CarrierProfileModal from '@/components/carrier/CarrierProfileModal'
import LiftChat from '@/components/lift/LiftChat'
import { LiftCardSkeleton } from '@/components/ui/Skeleton'

interface LiftRequest {
  id: string
  passenger_id: string | null
  carrier_id: string | null
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
  users?: { name: string; rating_avg: number; avatar_url: string | null; phone?: string | null }
  carrier?: { name: string; avatar_url: string | null; rating_avg: number; phone?: string | null }
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

interface LiftPricingResult {
  distanceKm: number
  recommendedPrice: number
  maxPrice: number
  carrierPayout: number
  split: { gonowCommission: number; insurancePool: number }
}

function PublishLiftModal({ onClose, onSuccess }: {
  onClose: () => void
  onSuccess: (lift: LiftRequest) => void
}) {
  const { userId } = useAuth()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [date, setDate] = useState('')
  const [flexibility, setFlexibility] = useState<'exact' | 'day' | 'week'>('exact')
  const [passengers, setPassengers] = useState(1)
  const [hasLuggage, setHasLuggage] = useState(false)
  const [luggageKg, setLuggageKg] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pricing, setPricing] = useState<LiftPricingResult | null>(null)
  const [pricingLoading, setPricingLoading] = useState(false)

  const fetchPricing = useCallback(async (f: string, t: string, p: number) => {
    if (!f.trim() || !t.trim() || f.length < 2 || t.length < 2) return
    setPricingLoading(true)
    try {
      const res = await fetch(
        `/api/price-ceiling?type=lift&from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}&passengers=${p}&urgency=standard`
      )
      if (res.ok) setPricing(await res.json() as LiftPricingResult)
    } catch { /* ignore */ } finally {
      setPricingLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => fetchPricing(from, to, passengers), 900)
    return () => clearTimeout(timer)
  }, [from, to, passengers, fetchPricing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/lift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passenger_id: userId ?? null,
          from_city: from,
          to_city: to,
          travel_date: date,
          flexibility,
          passengers,
          has_luggage: hasLuggage,
          luggage_kg: hasLuggage && luggageKg ? parseFloat(luggageKg) : null,
          note: note || null,
          max_price: pricing?.maxPrice ?? null,
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

            {/* Pricing box */}
            <LiftPricingBox pricing={pricing} loading={pricingLoading} hasRoute={from.length >= 2 && to.length >= 2} />

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

// ─── LiftPricingBox ──────────────────────────────────────────────────────────

function LiftPricingBox({ pricing, loading, hasRoute }: {
  pricing: LiftPricingResult | null
  loading: boolean
  hasRoute: boolean
}) {
  const box: React.CSSProperties = {
    borderRadius: 14, padding: '14px 16px',
    border: '1.5px solid rgba(34,197,94,0.25)',
    background: 'linear-gradient(135deg, rgba(34,197,94,0.07) 0%, rgba(34,197,94,0.03) 100%)',
  }
  const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', padding: '4px 0' }

  if (!hasRoute) return (
    <div style={{ ...box, display: 'flex', alignItems: 'center', gap: 10 }}>
      <Info size={15} style={{ color: '#22c55e', flexShrink: 0 }} />
      <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>Fyll i städer ovan för att se prisuppskattning.</p>
    </div>
  )

  if (loading || !pricing) return (
    <div style={{ ...box, display: 'flex', alignItems: 'center', gap: 10 }}>
      <Loader2 size={15} style={{ color: '#22c55e', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
      <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0 }}>Beräknar pris...</p>
    </div>
  )

  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Gonow prisuppskattning</p>
        <span style={{ fontSize: '0.65rem', color: 'var(--muted)', background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 999 }}>{pricing.distanceKm} km</span>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
          <p style={{ fontSize: '1.25rem', fontWeight: 900, color: '#22c55e', margin: '0 0 2px', lineHeight: 1 }}>{pricing.recommendedPrice} kr</p>
          <p style={{ fontSize: '0.62rem', color: 'var(--muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rekommenderat</p>
        </div>
        <div style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
          <p style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text)', margin: '0 0 2px', lineHeight: 1 }}>{pricing.maxPrice} kr</p>
          <p style={{ fontSize: '0.62rem', color: 'var(--muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Maxpris (tak)</p>
        </div>
      </div>
      <div style={{ borderTop: '1px solid rgba(34,197,94,0.15)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={row}><span style={{ color: 'var(--muted)' }}>Föraren får ca</span><span style={{ fontWeight: 700, color: 'var(--text)' }}>{pricing.carrierPayout} kr</span></div>
        <div style={row}><span style={{ color: 'var(--muted)' }}>Gonow avgift (15%)</span><span style={{ color: 'var(--muted)' }}>{pricing.split.gonowCommission} kr</span></div>
        <div style={row}><span style={{ color: 'var(--muted)' }}>Försäkringspool (5%)</span><span style={{ color: 'var(--muted)' }}>{pricing.split.insurancePool} kr</span></div>
      </div>
      <p style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
        Gonow räknar priset automatiskt. Förare kan erbjuda lägre pris men aldrig högre än maxpriset.
      </p>
    </div>
  )
}

// ─── MyLiftCard ──────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  open:      { label: 'Öppen',    color: '#16a34a', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)'  },
  offered:   { label: 'Erbjuden', color: '#d97706', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)' },
  matched:   { label: 'Matchad',  color: '#2563eb', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
  cancelled: { label: 'Avbruten', color: '#dc2626', bg: 'rgba(239,68,68,0.07)',  border: 'rgba(239,68,68,0.2)'  },
  expired:   { label: 'Utgången', color: 'var(--muted)', bg: 'var(--surface-2)', border: 'var(--border)'         },
}

function MyLiftCard({ lift, onAccept, onDecline, onViewCarrier, onCancel }: {
  lift: LiftRequest
  onAccept: (id: string) => void
  onDecline: (id: string) => void
  onViewCarrier: (id: string) => void
  onCancel: (id: string) => void
}) {
  const meta = STATUS_META[lift.status] ?? STATUS_META.open
  const carrierName = lift.carrier?.name?.split(' ')[0] ?? 'Förare'
  const carrierAvatar = lift.carrier?.avatar_url
  const canCancel = ['open', 'offered', 'matched'].includes(lift.status)

  return (
    <div style={{ background: 'var(--surface)', border: `1.5px solid ${lift.status === 'offered' ? 'rgba(251,191,36,0.4)' : 'var(--border)'}`, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>{lift.from_city} → {lift.to_city}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '3px 0 0' }}>{formatDate(lift.travel_date)} · {lift.passengers} person{lift.passengers > 1 ? 'er' : ''}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
            {meta.label}
          </span>
          {canCancel && (
            <button
              onClick={() => onCancel(lift.id)}
              title="Avboka förfrågan"
              style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {lift.status === 'offered' && lift.carrier_id && (
        <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            {carrierAvatar
              ? <img src={carrierAvatar} alt={carrierName} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800, color: '#0a0a0a' }}>{carrierName[0]}</div>
            }
            <div>
              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{carrierName} erbjöd dig plats</p>
              <button onClick={() => onViewCarrier(lift.carrier_id!)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.72rem', color: 'var(--muted)', textDecoration: 'underline', textUnderlineOffset: 2, fontFamily: 'inherit' }}>
                Se profil →
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onAccept(lift.id)} style={{ flex: 1, padding: '10px', minHeight: 44, borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#0a0a0a', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Acceptera plats ✓
            </button>
            <button onClick={() => onDecline(lift.id)} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--muted)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Avvisa
            </button>
          </div>
        </div>
      )}

      {lift.status === 'matched' && lift.carrier_id && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '12px 14px' }}>
            {carrierAvatar
              ? <img src={carrierAvatar} alt={carrierName} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800, color: '#fff', flexShrink: 0 }}>{carrierName[0]}</div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Du åker med {carrierName}</p>
              {lift.carrier?.phone ? (
                <a href={`tel:${lift.carrier.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: '#1d4ed8', fontWeight: 600, textDecoration: 'none', marginTop: 2 }}>
                  <Phone size={11} /> {lift.carrier.phone}
                </a>
              ) : (
                <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: '2px 0 0' }}>Chatta nedan för kontaktinfo</p>
              )}
            </div>
            <button onClick={() => onViewCarrier(lift.carrier_id!)} style={{ background: 'none', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#1d4ed8', fontFamily: 'inherit', flexShrink: 0 }}>
              Profil
            </button>
          </div>
          <LiftChat liftId={lift.id} />
        </div>
      )}
    </div>
  )
}

// ─── LiftCard ────────────────────────────────────────────────────────────────

function LiftCard({ lift, isDriver, onOffer, onViewProfile }: { lift: LiftRequest; isDriver: boolean; onOffer: (id: string) => void; onViewProfile: (id: string) => void }) {
  const fullName = lift.users?.name ?? 'Passagerare'
  const userName = fullName.split(' ')[0]
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

      <div
        onClick={() => lift.passenger_id && onViewProfile(lift.passenger_id)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4, borderTop: '1px solid var(--border)', cursor: lift.passenger_id ? 'pointer' : 'default' }}
      >
        {avatar
          ? <img src={avatar} alt={userName} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(34,197,94,0.3)' }} />
          : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, color: '#0a0a0a' }}>{userName[0]}</div>
        }
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>{userName}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', color: '#f59e0b', marginTop: 1 }}>
            <Star size={10} fill="#f59e0b" /> {rating.toFixed(1)}
          </span>
        </div>
        {lift.passenger_id && (
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Se profil</span>
        )}
      </div>

      {isDriver && (
        <button onClick={() => onOffer(lift.id)} style={{
          minHeight: 44, background: 'var(--accent)', color: '#0a0a0a', border: 'none', borderRadius: 10,
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
  const [myLifts, setMyLifts] = useState<LiftRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('Alla')
  const [showPublish, setShowPublish] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [myLiftTab, setMyLiftTab] = useState<string | null>(null)

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

  useEffect(() => {
    if (!userId) return
    fetch(`/api/lift?passenger_id=${userId}`)
      .then(r => r.json())
      .then(d => setMyLifts(d.lift_requests ?? []))
      .catch(() => {})
  }, [userId])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const filtered = useMemo(() => {
    // Drivers should not see their own passenger requests
    let r = tab === 'driver' && userId
      ? lifts.filter(l => l.passenger_id !== userId)
      : lifts
    switch (filter) {
      case 'Idag':      r = r.filter(l => l.travel_date === today); break
      case 'Imorgon':   r = r.filter(l => l.travel_date === tomorrow); break
      case 'Stockholm': r = r.filter(l => l.from_city.includes('Stockholm') || l.to_city.includes('Stockholm')); break
      case 'Göteborg':  r = r.filter(l => l.from_city.includes('Göteborg') || l.to_city.includes('Göteborg')); break
      case 'Flexibelt': r = r.filter(l => l.flexibility !== 'exact'); break
    }
    return r
  }, [lifts, filter, today, tomorrow, tab, userId])

  async function handleOffer(liftId: string) {
    if (!userId) { setShowAuth(true); return }
    const res = await fetch(`/api/lift/${liftId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'offered', carrier_id: userId }),
    })
    if (res.ok) {
      setLifts(prev => prev.filter(l => l.id !== liftId))
      showToast('Platserbjudande skickat!')
    } else {
      const err = await res.json().catch(() => ({}))
      showToast(err.error ?? 'Något gick fel — försök igen.')
    }
  }

  async function handleAccept(liftId: string) {
    const res = await fetch(`/api/lift/${liftId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'matched' }),
    })
    if (res.ok) setMyLifts(prev => prev.map(l => l.id === liftId ? { ...l, status: 'matched' } : l))
  }

  async function handleDecline(liftId: string) {
    const res = await fetch(`/api/lift/${liftId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'open', carrier_id: null }),
    })
    if (res.ok) setMyLifts(prev => prev.map(l => l.id === liftId ? { ...l, status: 'open', carrier_id: null, carrier: undefined } : l))
  }

  async function handleCancel(liftId: string) {
    const lift = myLifts.find(l => l.id === liftId)
    const isMatched = lift?.status === 'matched'
    const msg = isMatched
      ? 'Resan är redan matchad med en förare. Är du säker på att du vill avboka?'
      : 'Vill du avboka denna reseförfrågan?'
    if (!confirm(msg)) return
    const res = await fetch(`/api/lift/${liftId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled', carrier_id: null }),
    })
    if (res.ok) {
      setMyLifts(prev => prev.map(l => l.id === liftId ? { ...l, status: 'cancelled', carrier_id: null, carrier: undefined } : l))
      setLifts(prev => prev.filter(l => l.id !== liftId))
      showToast('Förfrågan avbokad.')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-gradient)', paddingTop: 88, paddingBottom: 80 }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 20000, background: '#0a0a0a', color: '#fff', padding: '12px 22px', borderRadius: 999, fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', animation: 'toast-in 0.2s ease both' }}>
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

        {/* Mina förfrågningar — visas bara för inloggad passagerare */}
        {userId && tab === 'passenger' && myLifts.length > 0 && (() => {
          const active  = myLifts.filter(l => ['matched', 'offered'].includes(l.status))
          const open    = myLifts.filter(l => l.status === 'open')
          const history = myLifts.filter(l => ['cancelled', 'expired'].includes(l.status))

          const myTabs = [
            ...(active.length  > 0 ? [{ key: 'active',  label: 'Aktiva',   count: active.length,  dot: 'var(--accent)' }] : []),
            ...(open.length    > 0 ? [{ key: 'open',    label: 'Öppna',    count: open.length,    dot: '#64748b' }] : []),
            ...(history.length > 0 ? [{ key: 'history', label: 'Historik', count: history.length, dot: '#64748b' }] : []),
          ]
          const defaultTab = myTabs[0]?.key ?? 'open'

          return (
            <div style={{ marginBottom: 32 }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
                Mina förfrågningar
              </p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {myTabs.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setMyLiftTab(t.key)}
                    style={{
                      padding: '6px 13px', borderRadius: 999, border: '1px solid',
                      fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      background: (myLiftTab ?? defaultTab) === t.key ? 'var(--accent)' : 'var(--surface)',
                      color: (myLiftTab ?? defaultTab) === t.key ? '#0a0a0a' : 'var(--muted)',
                      borderColor: (myLiftTab ?? defaultTab) === t.key ? 'var(--accent)' : 'var(--border)',
                      display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
                    }}
                  >
                    {t.label}
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 5px', borderRadius: 999, background: (myLiftTab ?? defaultTab) === t.key ? 'rgba(0,0,0,0.15)' : 'var(--surface-2)', color: 'inherit' }}>
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {((myLiftTab ?? defaultTab) === 'active' ? active : (myLiftTab ?? defaultTab) === 'open' ? open : history).map(lift => (
                  <MyLiftCard key={lift.id} lift={lift} onAccept={handleAccept} onDecline={handleDecline} onViewCarrier={setProfileUserId} onCancel={handleCancel} />
                ))}
              </div>
              <div style={{ height: 1, background: 'var(--border)', margin: '20px 0 4px' }} />
            </div>
          )
        })()}

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {Array.from({ length: 4 }).map((_, i) => <LiftCardSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '64px 0', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Navigation size={24} style={{ color: 'var(--muted)' }} />
            </div>
            {tab === 'driver' ? (
              <>
                <div>
                  <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Inga passagerare längs din rutt just nu</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--muted)', maxWidth: 280, margin: '0 auto' }}>
                    Passagerare publicerar sina resor — kom tillbaka senare eller kolla igen imorgon.
                  </p>
                </div>
                <button onClick={() => setTab('passenger')} style={{ minHeight: 44, padding: '0 18px', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Se dina egna förfrågningar →
                </button>
              </>
            ) : (
              <>
                <div>
                  <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Inga förfrågningar hittades</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--muted)', maxWidth: 260, margin: '0 auto' }}>
                    Var den första att publicera en reseförfrågan och hitta samåkning.
                  </p>
                </div>
                <button onClick={handlePublishClick} style={{ minHeight: 44, padding: '0 20px', background: 'var(--accent)', color: '#0a0a0a', border: 'none', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={15} /> Publicera din resa
                </button>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, animation: 'fade-in 0.3s ease both' }}>
            {filtered.map(lift => (
              <LiftCard key={lift.id} lift={lift} isDriver={tab === 'driver'} onOffer={handleOffer} onViewProfile={setProfileUserId} />
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
            setMyLifts(prev => [lift, ...prev])
            setTab('passenger')
            setShowPublish(false)
            showToast('Reseförfrågan publicerad!')
          }}
        />
      )}
      {profileUserId && (
        <CarrierProfileModal carrierId={profileUserId} onClose={() => setProfileUserId(null)} />
      )}
    </div>
  )
}
