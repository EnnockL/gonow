'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Loader2, Info } from 'lucide-react'
import { UppdragPackage } from './PackageCard'

interface PubliceraModalProps {
  onClose: () => void
  onSuccess: (pkg: UppdragPackage) => void
}

interface PricingResult {
  distanceKm: number
  recommendedPrice: number
  maxPrice: number
  carrierPayout: number
  split: { gonowCommission: number; insurancePool: number }
}

const WEIGHT_OPTIONS = [
  { label: '< 1 kg', value: 0.5 },
  { label: '1-3 kg', value: 2 },
  { label: '3-5 kg', value: 4 },
  { label: '5-10 kg', value: 7 },
  { label: '10+ kg', value: 12 },
]
const DEADLINE_OPTIONS: { value: UppdragPackage['deadline']; label: string }[] = [
  { value: 'today', label: 'Idag' },
  { value: 'tomorrow', label: 'Imorgon' },
  { value: 'flexible', label: 'Flexibelt' },
]

export default function PubliceraModal({ onClose, onSuccess }: PubliceraModalProps) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [description, setDescription] = useState('')
  const [weightKg, setWeightKg] = useState(4)
  const [pickup, setPickup] = useState('')
  const [deadline, setDeadline] = useState<UppdragPackage['deadline']>('flexible')
  const [isFragile, setIsFragile] = useState(false)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pricing, setPricing] = useState<PricingResult | null>(null)
  const [pricingLoading, setPricingLoading] = useState(false)
  const [pricingError, setPricingError] = useState<string | null>(null)

  const urgency = deadline === 'today' ? 'today' : 'standard'

  const fetchPricing = useCallback(async (f: string, t: string, kg: number, urg: string, frag: boolean) => {
    if (!f.trim() || !t.trim() || f.length < 2 || t.length < 2) return
    setPricingLoading(true)
    setPricingError(null)
    try {
      const res = await fetch(
        `/api/price-ceiling?type=package&from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}&kg=${kg}&urgency=${urg}&fragile=${frag}`
      )
      const json = await res.json()
      if (!res.ok) { setPricingError(json.error ?? 'Priset kunde inte beräknas'); return }
      setPricing(json as PricingResult)
    } catch {
      setPricingError('Natverksfel')
    } finally {
      setPricingLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => fetchPricing(from, to, weightKg, urgency, isFragile), 900)
    return () => clearTimeout(timer)
  }, [from, to, weightKg, urgency, isFragile, fetchPricing])

  function deriveTags(): string[] {
    const tags: string[] = []
    if (deadline === 'today') tags.push('Idag')
    if (deadline === 'tomorrow') tags.push('Imorgon')
    if (deadline === 'flexible') tags.push('Flexibel tid')
    if (isFragile) tags.push('Ömtåligt')
    return tags
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!from || !to || !description || !pickup) return
    setSubmitting(true)
    const priceCeiling = pricing?.maxPrice ?? 0
    try {
      const res = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_city: from, to_city: to, description,
          weight_kg: weightKg, from_address: pickup,
          deadline, price_ceiling: priceCeiling, is_fragile: isFragile,
        }),
      })
      const json = await res.json()
      onSuccess({
        id: json.package?.id ?? `local-${Date.now()}`,
        route: `${from} → ${to}`, from, to,
        payout: priceCeiling, type: description,
        weight: `${weightKg} kg`, pickup, tags: deriveTags(), deadline,
      })
    } catch {
      onSuccess({
        id: `local-${Date.now()}`, route: `${from} → ${to}`, from, to,
        payout: priceCeiling, type: description,
        weight: `${weightKg} kg`, pickup, tags: deriveTags(), deadline,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px 12px', fontSize: '0.85rem',
    color: 'var(--text)', fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.15s',
  }
  const lbl: React.CSSProperties = {
    fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)',
    textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6,
  }
  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => (e.target.style.borderColor = 'var(--accent)')
  const onBlur  = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => (e.target.style.borderColor = 'var(--border)')

  const chipBtn = (active: boolean): React.CSSProperties => ({
    padding: '7px 14px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600,
    border: '1px solid', cursor: 'pointer', fontFamily: 'inherit',
    background: active ? 'var(--accent)' : 'var(--surface-2)',
    color: active ? '#0a0a0a' : 'var(--muted)',
    borderColor: active ? 'var(--accent)' : 'var(--border)',
    transition: 'all 0.15s',
  })

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10001, width: '100%', maxWidth: 480, padding: '0 16px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '24px 22px', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', animation: 'modal-in 0.2s ease both' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Publicera paket</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex' }}><X size={18} /></button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={lbl}>Från</label><input value={from} onChange={e => setFrom(e.target.value)} placeholder="Stockholm" required style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
              <div><label style={lbl}>Till</label><input value={to} onChange={e => setTo(e.target.value)} placeholder="Göteborg" required style={inp} onFocus={onFocus} onBlur={onBlur} /></div>
            </div>

            <div>
              <label style={lbl}>Vad skickas?</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="t.ex. Kläder, Elektronik, Böcker" required style={inp} onFocus={onFocus} onBlur={onBlur} />
            </div>

            <div>
              <label style={lbl}>Vikt</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {WEIGHT_OPTIONS.map(w => (
                  <button key={w.label} type="button" onClick={() => setWeightKg(w.value)} style={chipBtn(weightKg === w.value)}>{w.label}</button>
                ))}
              </div>
            </div>

            <div>
              <label style={lbl}>Upphämtningsadress</label>
              <input value={pickup} onChange={e => setPickup(e.target.value)} placeholder="Vasagatan 11, Vasastan" required style={inp} onFocus={onFocus} onBlur={onBlur} />
            </div>

            <div>
              <label style={lbl}>Senast leverans</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {DEADLINE_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setDeadline(opt.value)}
                    style={{ ...chipBtn(deadline === opt.value), flex: 1, borderRadius: 10, padding: '8px 0', fontSize: '0.82rem' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" onClick={() => setIsFragile(v => !v)} style={{ width: 36, height: 20, borderRadius: 999, border: 'none', cursor: 'pointer', background: isFragile ? 'var(--accent)' : 'var(--border)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 2, left: isFragile ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block' }} />
              </button>
              <span style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 500 }}>Ömtåligt innehåll (+25 kr)</span>
            </div>

            <div>
              <label style={lbl}>Notering <span style={{ fontWeight: 400, textTransform: 'none' }}>(valfri)</span></label>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Berätta mer..." rows={2} style={{ ...inp, resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} />
            </div>

            <PricingBox pricing={pricing} loading={pricingLoading} error={pricingError} hasRoute={from.length >= 2 && to.length >= 2} />

            <button type="submit" disabled={submitting} style={{ minHeight: 46, marginTop: 4, background: 'var(--accent)', color: '#0a0a0a', border: 'none', borderRadius: 12, fontSize: '0.9rem', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Publicerar...' : 'Publicera paket'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

interface PricingBoxProps {
  pricing: PricingResult | null
  loading: boolean
  error: string | null
  hasRoute: boolean
}

function PricingBox({ pricing, loading, error, hasRoute }: PricingBoxProps) {
  const box: React.CSSProperties = {
    borderRadius: 14, padding: '14px 16px',
    border: '1.5px solid rgba(34,197,94,0.25)',
    background: 'linear-gradient(135deg, rgba(34,197,94,0.07) 0%, rgba(34,197,94,0.03) 100%)',
  }
  const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', padding: '4px 0' }

  if (!hasRoute) return (
    <div style={{ ...box, display: 'flex', alignItems: 'center', gap: 10 }}>
      <Info size={15} style={{ color: '#22c55e', flexShrink: 0 }} />
      <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>Fyll i städer ovan för att se automatisk prisuppskattning.</p>
    </div>
  )

  if (loading) return (
    <div style={{ ...box, display: 'flex', alignItems: 'center', gap: 10 }}>
      <Loader2 size={15} style={{ color: '#22c55e', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
      <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0 }}>Beräknar pris...</p>
    </div>
  )

  if (error || !pricing) return (
    <div style={{ ...box, borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}>
      <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0 }}>{error ?? 'Priset kunde inte beräknas.'}</p>
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
        Gonow räknar priset automatiskt baserat på sträcka, vikt och leveransbehov. Förare kan erbjuda lägre pris men aldrig högre än maxpriset.
      </p>
    </div>
  )
}
