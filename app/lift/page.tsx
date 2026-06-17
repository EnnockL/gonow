'use client'

import { useState } from 'react'
import TravelerCard from '@/components/booking/TravelerCard'
import { Trip } from '@/lib/types'
import { Loader2, Users, MapPin, Calendar, ArrowRight, ChevronRight } from 'lucide-react'

const POPULAR_ROUTES = [
  { from: 'Stockholm', to: 'Göteborg', price: '149 kr', time: '~3h' },
  { from: 'Malmö', to: 'Stockholm', price: '219 kr', time: '~4.5h' },
  { from: 'Uppsala', to: 'Stockholm', price: '89 kr', time: '~45 min' },
  { from: 'Göteborg', to: 'Malmö', price: '129 kr', time: '~3h' },
]

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

export default function LiftPage() {
  const [form, setForm] = useState({ from_city: '', to_city: '', date: '', passengers: '1' })
  const [trips, setTrips] = useState<Trip[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)

  function focusIn(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = 'var(--accent)'
    e.target.style.background = 'var(--accent-softer)'
  }
  function focusOut(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = 'var(--border)'
    e.target.style.background = 'var(--surface-2)'
  }

  function applyRoute(from: string, to: string) {
    setForm((p) => ({ ...p, from_city: from, to_city: to }))
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, passengers: +form.passengers, weight_kg: 0, type: 'lift', departure_date: form.date }),
    })
    const data = await res.json()
    setTrips(data.trips || [])
    setSearched(true)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', paddingTop: 80, paddingBottom: 80 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px' }}>

        {/* Header */}
        <div style={{ paddingTop: 32, paddingBottom: 48 }}>
          <p className="label" style={{ marginBottom: 10 }}>Samåkning</p>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.75rem)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)', marginBottom: 12, lineHeight: 1.1 }}>
            Dela resa.<br />Dela kostnad.
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--muted)', maxWidth: 420 }}>
            Hitta någon som redan kör din rutt — billigare än tåget, snabbare än bussen, bättre för miljön.
          </p>
        </div>

        {/* Search + Results */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>

          {/* Left: search + results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <form onSubmit={handleSearch} className="card" style={{ padding: 24 }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
                Sök lift
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>
                    <MapPin size={10} /> Från
                  </label>
                  <input required placeholder="t.ex. Uppsala" value={form.from_city}
                    onChange={(e) => setForm((p) => ({ ...p, from_city: e.target.value }))}
                    onFocus={focusIn} onBlur={focusOut} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>
                    <MapPin size={10} /> Till
                  </label>
                  <input required placeholder="t.ex. Stockholm" value={form.to_city}
                    onChange={(e) => setForm((p) => ({ ...p, to_city: e.target.value }))}
                    onFocus={focusIn} onBlur={focusOut} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>
                    <Calendar size={10} /> Datum
                  </label>
                  <input required type="date" value={form.date}
                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                    onFocus={focusIn} onBlur={focusOut}
                    style={{ ...inputStyle, colorScheme: 'light' }} />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>
                    <Users size={10} /> Passagerare
                  </label>
                  <input type="number" min="1" max="4" value={form.passengers}
                    onChange={(e) => setForm((p) => ({ ...p, passengers: e.target.value }))}
                    onFocus={focusIn} onBlur={focusOut} style={inputStyle} />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary"
                style={{ width: '100%', borderRadius: 10, padding: '12px 0' }}>
                {loading
                  ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite', display: 'inline', marginRight: 6 }} />Söker...</>
                  : <>Sök lift <ArrowRight size={14} /></>}
              </button>
            </form>

            {searched && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {trips.length === 0 ? (
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 48, textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users size={22} style={{ color: 'var(--muted)' }} />
                    </div>
                    <p style={{ color: 'var(--muted)', fontWeight: 500 }}>Inga resor hittades för den dagen.</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--muted)', opacity: 0.7 }}>Prova ett annat datum eller kör din egna resa via Kör & tjäna.</p>
                    <a href="/kor" className="btn-outline" style={{ marginTop: 4, fontSize: '0.8rem', padding: '8px 18px' }}>
                      Registrera en resa →
                    </a>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: '0.78rem', color: 'var(--muted)', paddingLeft: 4 }}>
                      {trips.length} {trips.length === 1 ? 'resa' : 'resor'} hittades
                    </p>
                    {trips.map((trip) => (
                      <TravelerCard
                        key={trip.id}
                        trip={trip as Trip & { users?: { name: string; rating_avg: number; rating_count: number } }}
                        price={trip.price_per_seat || 150}
                        onSelect={() => {}}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right: popular routes + info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card-sm">
              <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                Populära rutter
              </p>
              {POPULAR_ROUTES.map((r) => (
                <button
                  key={`${r.from}-${r.to}`}
                  type="button"
                  onClick={() => applyRoute(r.from, r.to)}
                  style={{
                    display: 'flex', alignItems: 'center', width: '100%', padding: '8px 0',
                    borderBottom: '1px solid var(--border)', background: 'none', border: 'none',
                    borderBottomColor: 'var(--border)', borderBottomWidth: 1, borderBottomStyle: 'solid',
                    cursor: 'pointer', textAlign: 'left', transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
                      {r.from} → {r.to}
                    </p>
                    <p style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{r.time}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)' }}>{r.price}</span>
                    <ChevronRight size={12} style={{ color: 'var(--muted)' }} />
                  </div>
                </button>
              ))}
            </div>

            <div className="card-sm" style={{ background: 'var(--success-soft)', borderColor: 'var(--success-border)' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)', marginBottom: 8 }}>✓ BankID-verifierat</p>
              <p style={{ fontSize: '0.73rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                Alla chaufförer är verifierade med BankID. Betalning via Swish — frigörs efter avslutad resa.
              </p>
            </div>

            <div className="card-sm" style={{ background: 'var(--accent-softer)', borderColor: 'rgba(146,255,99,0.15)' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>Upp till 60% billigare</p>
              <p style={{ fontSize: '0.73rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                Jämfört med tåg och flyg. Dela kostnad med chauffören — alla vinner.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
