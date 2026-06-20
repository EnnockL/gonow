'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { UppdragPackage } from './PackageCard'

interface PubliceraModalProps {
  onClose: () => void
  onSuccess: (pkg: UppdragPackage) => void
}

const WEIGHT_OPTIONS = [
  { label: '< 1 kg', value: 0.5 },
  { label: '1–3 kg', value: 2 },
  { label: '3–5 kg', value: 4 },
  { label: '5–10 kg', value: 7 },
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
  const [payout, setPayout] = useState('')
  const [isFragile, setIsFragile] = useState(false)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function deriveTags(): string[] {
    const t: string[] = []
    if (deadline === 'today') t.push('Idag')
    if (deadline === 'tomorrow') t.push('Imorgon')
    if (deadline === 'flexible') t.push('Flexibel tid')
    if (isFragile) t.push('Ömtåligt')
    return t
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!from || !to || !description || !pickup || !payout) return
    setSubmitting(true)

    const payoutNum = parseInt(payout)
    const allTags = deriveTags()

    try {
      const res = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_city: from,
          to_city: to,
          description,
          weight_kg: weightKg,
          from_address: pickup,
          deadline,
          price_ceiling: payoutNum,
          is_fragile: isFragile,
        }),
      })
      const json = await res.json()

      const newPkg: UppdragPackage = {
        id: json.package?.id ?? `local-${Date.now()}`,
        route: `${from} → ${to}`,
        from, to,
        payout: payoutNum,
        type: description,
        weight: `${weightKg} kg`,
        pickup,
        tags: allTags,
        deadline,
      }
      onSuccess(newPkg)
    } catch {
      onSuccess({
        id: `local-${Date.now()}`,
        route: `${from} → ${to}`,
        from, to,
        payout: payoutNum,
        type: description,
        weight: `${weightKg} kg`,
        pickup,
        tags: allTags,
        deadline,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px 12px',
    fontSize: '0.85rem', color: 'var(--text)',
    fontFamily: 'inherit', outline: 'none',
    transition: 'border-color 0.15s',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    display: 'block', marginBottom: 6,
  }
  const focus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    (e.target.style.borderColor = 'var(--accent)')
  const blur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    (e.target.style.borderColor = 'var(--border)')

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 10001, width: '100%', maxWidth: 460, padding: '0 16px',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '24px 22px', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>Publicera paket</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex' }}><X size={18} /></button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Från</label>
                <input value={from} onChange={e => setFrom(e.target.value)} placeholder="Stockholm" required style={inputStyle} onFocus={focus} onBlur={blur} />
              </div>
              <div>
                <label style={labelStyle}>Till</label>
                <input value={to} onChange={e => setTo(e.target.value)} placeholder="Göteborg" required style={inputStyle} onFocus={focus} onBlur={blur} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Vad skickas?</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="t.ex. Kläder, Elektronik, Böcker" required style={inputStyle} onFocus={focus} onBlur={blur} />
            </div>

            <div>
              <label style={labelStyle}>Vikt</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {WEIGHT_OPTIONS.map(w => (
                  <button key={w.label} type="button" onClick={() => setWeightKg(w.value)} style={{
                    padding: '7px 14px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600,
                    border: '1px solid', cursor: 'pointer', fontFamily: 'inherit',
                    background: weightKg === w.value ? 'var(--accent)' : 'var(--surface-2)',
                    color: weightKg === w.value ? '#0a0a0a' : 'var(--muted)',
                    borderColor: weightKg === w.value ? 'var(--accent)' : 'var(--border)',
                    transition: 'all 0.15s',
                  }}>
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Upphämtningsadress</label>
              <input value={pickup} onChange={e => setPickup(e.target.value)} placeholder="Vasagatan 11, Vasastan" required style={inputStyle} onFocus={focus} onBlur={blur} />
            </div>

            <div>
              <label style={labelStyle}>Senast leverans</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {DEADLINE_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setDeadline(opt.value)} style={{
                    flex: 1, padding: '8px 0', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600,
                    border: '1px solid', cursor: 'pointer', fontFamily: 'inherit',
                    background: deadline === opt.value ? 'var(--accent)' : 'var(--surface-2)',
                    color: deadline === opt.value ? '#0a0a0a' : 'var(--muted)',
                    borderColor: deadline === opt.value ? 'var(--accent)' : 'var(--border)',
                    transition: 'all 0.15s',
                  }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Erbjuden ersättning (kr)</label>
              <div style={{ position: 'relative' }}>
                <input type="number" min="0" value={payout} onChange={e => setPayout(e.target.value)} placeholder="200" required
                  style={{ ...inputStyle, paddingRight: 36 }} onFocus={focus} onBlur={blur} />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '0.82rem', color: 'var(--muted)' }}>kr</span>
              </div>
              <p style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 5, marginBottom: 0 }}>
                Pristak — förare kan erbjuda lägre men aldrig högre.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" onClick={() => setIsFragile(v => !v)} style={{
                width: 36, height: 20, borderRadius: 999, border: 'none', cursor: 'pointer',
                background: isFragile ? 'var(--accent)' : 'var(--border)',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}>
                <span style={{
                  position: 'absolute', top: 2, left: isFragile ? 18 : 2,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s', display: 'block',
                }} />
              </button>
              <span style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 500 }}>Ömtåligt innehåll</span>
            </div>

            <div>
              <label style={labelStyle}>Notering <span style={{ fontWeight: 400, textTransform: 'none' }}>(valfri)</span></label>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Berätta mer..." rows={2}
                style={{ ...inputStyle, resize: 'vertical' }} onFocus={focus} onBlur={blur} />
            </div>

            <button type="submit" disabled={submitting} style={{
              minHeight: 46, marginTop: 4,
              background: 'var(--accent)', color: '#0a0a0a',
              border: 'none', borderRadius: 12,
              fontSize: '0.9rem', fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', opacity: submitting ? 0.7 : 1, transition: 'opacity 0.15s',
            }}>
              {submitting ? 'Publicerar...' : 'Publicera paket'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
