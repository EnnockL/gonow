'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Car, Train, Bus, Plane, CheckCircle2 } from 'lucide-react'

const vehicles = [
  { value: 'car', icon: Car, label: 'Bil' },
  { value: 'train', icon: Train, label: 'Tåg' },
  { value: 'bus', icon: Bus, label: 'Buss' },
  { value: 'flight', icon: Plane, label: 'Flyg' },
]

const toggles = [
  { key: 'allows_passengers', label: 'Passagerare' },
  { key: 'allows_packages', label: 'Paket' },
  { key: 'allows_returns', label: 'Returer' },
  { key: 'allows_pets', label: 'Husdjur' },
] as const

export default function TripRegistration() {
  const [form, setForm] = useState({
    from_city: '', to_city: '', departure_at: '', vehicle_type: 'car',
    seats_available: 0, weight_capacity_kg: 20,
    price_per_seat: 150, price_per_kg: 15,
    allows_passengers: true, allows_packages: true, allows_returns: true, allows_pets: false,
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  function set(key: string, value: unknown) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser() as unknown as { data: { user: { id: string } | null } }
      if (!user) { setStatus('error'); return }
      const { error } = await supabase.from('trips').insert({ ...form, carrier_id: user.id })
      if (error) throw error
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0', textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircle2 size={26} style={{ color: 'var(--success)' }} />
        </div>
        <p style={{ fontWeight: 600, color: 'var(--text)' }}>Resa registrerad!</p>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Vi matchar dig med paket och passagerare längs din rutt.</p>
      </div>
    )
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: '0.875rem',
    color: 'var(--text)',
    transition: 'border-color 0.15s, background 0.15s',
    outline: 'none',
    fontFamily: 'inherit',
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Route */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>Från</label>
          <input required placeholder="t.ex. Stockholm" value={form.from_city} onChange={(e) => set('from_city', e.target.value)} style={inputStyle}
            onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'var(--accent)'; (e.target as HTMLInputElement).style.background = 'var(--accent-softer)' }}
            onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'var(--border)'; (e.target as HTMLInputElement).style.background = 'var(--surface-2)' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>Till</label>
          <input required placeholder="t.ex. Göteborg" value={form.to_city} onChange={(e) => set('to_city', e.target.value)} style={inputStyle}
            onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'var(--accent)'; (e.target as HTMLInputElement).style.background = 'var(--accent-softer)' }}
            onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'var(--border)'; (e.target as HTMLInputElement).style.background = 'var(--surface-2)' }}
          />
        </div>
      </div>

      {/* Departure */}
      <div>
        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>Avgångstid</label>
        <input required type="datetime-local" value={form.departure_at} onChange={(e) => set('departure_at', e.target.value)} style={{ ...inputStyle, colorScheme: 'light' }}
          onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'var(--accent)' }}
          onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'var(--border)' }}
        />
      </div>

      {/* Vehicle */}
      <div>
        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 8, fontWeight: 500 }}>Fordon</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {vehicles.map((v) => (
            <button key={v.value} type="button" onClick={() => set('vehicle_type', v.value)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 4px', borderRadius: 10,
              border: `1px solid ${form.vehicle_type === v.value ? 'rgba(146,255,99,0.5)' : 'var(--border)'}`,
              background: form.vehicle_type === v.value ? 'var(--accent-soft)' : 'var(--surface)',
              color: form.vehicle_type === v.value ? 'var(--accent)' : 'var(--muted)',
              fontSize: '0.7rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}>
              <v.icon size={16} />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Capacity + pricing */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          { label: 'Lediga platser', key: 'seats_available', min: 0, max: 8 },
          { label: 'Maxvikt gods (kg)', key: 'weight_capacity_kg', min: 0 },
          { label: 'Pris/plats (SEK)', key: 'price_per_seat', min: 0 },
          { label: 'Pris/kg (SEK)', key: 'price_per_kg', min: 0, step: '0.5' },
        ].map(({ label, key, ...rest }) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>{label}</label>
            <input
              type="number"
              value={form[key as keyof typeof form] as number}
              onChange={(e) => set(key, +e.target.value)}
              style={inputStyle}
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'var(--accent)' }}
              onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'var(--border)' }}
              {...rest}
            />
          </div>
        ))}
      </div>

      {/* Toggles */}
      <div>
        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 8, fontWeight: 500 }}>Tillåter</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {toggles.map(({ key, label }) => (
            <button key={key} type="button" onClick={() => set(key, !form[key])} style={{
              padding: '6px 14px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
              border: `1px solid ${form[key] ? 'rgba(146,255,99,0.4)' : 'var(--border)'}`,
              background: form[key] ? 'var(--accent-soft)' : 'transparent',
              color: form[key] ? 'var(--accent)' : 'var(--muted)',
              transition: 'all 0.15s', fontFamily: 'inherit',
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <button type="submit" disabled={status === 'loading'} className="btn-primary" style={{ width: '100%', borderRadius: 10, padding: '12px 0', marginTop: 4 }}>
        {status === 'loading' ? 'Registrerar...' : 'Registrera resa →'}
      </button>

      {status === 'error' && (
        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--danger)' }}>Något gick fel. Är du inloggad?</p>
      )}
    </form>
  )
}
