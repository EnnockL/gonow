'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Package, MapPin, Scale, Calendar, FileText, ArrowRight } from 'lucide-react'
import { AIParseResult, OrderType } from '@/lib/types'

interface ManualFormProps {
  onParsed: (result: AIParseResult) => void
}

const WEIGHT_OPTIONS = [
  { label: 'Under 1 kg', value: 0.5 },
  { label: '1–5 kg', value: 3 },
  { label: '5–10 kg', value: 7 },
  { label: '10–20 kg', value: 15 },
  { label: '20–50 kg', value: 35 },
  { label: 'Övrigt', value: -1 },
]

const TYPE_OPTIONS: { label: string; value: OrderType; desc: string }[] = [
  { label: 'Paket', value: 'package', desc: 'Skicka ett paket med en privatperson' },
  { label: 'Upphämtning', value: 'pickup', desc: 'Hämta från butik eller lager' },
  { label: 'Retur', value: 'return', desc: 'Returnera vara till butik' },
  { label: 'Lift', value: 'lift', desc: 'Boka passagerarplats i bil' },
]

const field: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: '0.875rem',
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
  appearance: 'none',
  WebkitAppearance: 'none',
}

export default function ManualForm({ onParsed }: ManualFormProps) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<OrderType>('package')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [description, setDescription] = useState('')
  const [weightOption, setWeightOption] = useState<number>(3)
  const [customWeight, setCustomWeight] = useState('')
  const [urgency, setUrgency] = useState<'today' | 'tomorrow' | 'flexible'>('flexible')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!from.trim()) { setError('Ange upphämtningsadress'); return }
    if (!to.trim())   { setError('Ange leveransadress'); return }

    const weight_kg =
      weightOption === -1
        ? customWeight ? parseFloat(customWeight.replace(',', '.')) : null
        : weightOption

    const today = new Date()
    if (urgency === 'tomorrow') today.setDate(today.getDate() + 1)
    const departure_date = urgency === 'flexible' ? null : today.toISOString().split('T')[0]

    onParsed({
      type,
      from_city: from.trim(),
      to_city: to.trim(),
      description: description.trim() || `${TYPE_OPTIONS.find(t => t.value === type)?.label} · ${from.trim()} → ${to.trim()}`,
      weight_kg,
      departure_date,
      urgency,
      store_name: null,
      order_reference: null,
      passengers: type === 'lift' ? 1 : null,
      special_requirements: null,
      estimated_price_sek: 299,
      confidence: 0.95,
    })
  }

  return (
    <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '0.8rem', color: 'var(--muted)', padding: 0,
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
      >
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        Föredrar du formulär? Fyll i manuellt
      </button>

      {open && (
        <form onSubmit={handleSubmit} style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Typ */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
              <Package size={10} style={{ display: 'inline', marginRight: 5 }} />Typ av tjänst
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1px solid ${type === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                    background: type === opt.value ? 'var(--accent-softer)' : 'var(--surface)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: type === opt.value ? 'var(--accent)' : 'var(--text)', marginBottom: 2 }}>{opt.label}</p>
                  <p style={{ fontSize: '0.68rem', color: 'var(--muted)', lineHeight: 1.3 }}>{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Adresser */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <MapPin size={10} style={{ display: 'inline', marginRight: 5 }} />Adresser
            </label>
            <input
              type="text"
              placeholder="Upphämtning — t.ex. Vasagatan 11 lgh 302, 111 20 Stockholm"
              value={from}
              onChange={e => setFrom(e.target.value)}
              style={field}
            />
            <input
              type="text"
              placeholder="Leverans — t.ex. Storgatan 5, 411 38 Göteborg"
              value={to}
              onChange={e => setTo(e.target.value)}
              style={field}
            />
          </div>

          {/* Vikt */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
              <Scale size={10} style={{ display: 'inline', marginRight: 5 }} />Vikt
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {WEIGHT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setWeightOption(opt.value)}
                  style={{
                    padding: '8px 6px',
                    borderRadius: 8,
                    border: `1px solid ${weightOption === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                    background: weightOption === opt.value ? 'var(--accent-softer)' : 'var(--surface)',
                    fontSize: '0.75rem',
                    fontWeight: weightOption === opt.value ? 600 : 400,
                    color: weightOption === opt.value ? 'var(--accent)' : 'var(--muted-2)',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {weightOption === -1 && (
              <input
                type="number"
                placeholder="Ange kg, t.ex. 8.5"
                value={customWeight}
                onChange={e => setCustomWeight(e.target.value)}
                min="0.1"
                step="0.1"
                style={{ ...field, marginTop: 8 }}
              />
            )}
          </div>

          {/* Beskrivning */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
              <FileText size={10} style={{ display: 'inline', marginRight: 5 }} />Beskrivning (valfri)
            </label>
            <textarea
              placeholder="Beskriv paketet kort — t.ex. Boklåda, ömtålig"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              style={{ ...field, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {/* Leveranstid */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
              <Calendar size={10} style={{ display: 'inline', marginRight: 5 }} />Leveranstid
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {([['today','Idag'],['tomorrow','Imorgon'],['flexible','Flexibelt']] as const).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setUrgency(v)}
                  style={{
                    flex: 1, padding: '9px 0', borderRadius: 8,
                    border: `1px solid ${urgency === v ? 'var(--accent)' : 'var(--border)'}`,
                    background: urgency === v ? 'var(--accent-softer)' : 'var(--surface)',
                    fontSize: '0.78rem', fontWeight: urgency === v ? 600 : 400,
                    color: urgency === v ? 'var(--accent)' : 'var(--muted-2)',
                    cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p style={{ fontSize: '0.78rem', color: 'var(--error, #ff6b6b)', background: 'rgba(255,107,107,0.08)', borderRadius: 8, padding: '8px 12px' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', padding: '12px 0', borderRadius: 12, fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            Sök bärare <ArrowRight size={15} />
          </button>
        </form>
      )}
    </div>
  )
}
