'use client'

import { useState } from 'react'
import AIChat from '@/components/booking/AIChat'
import TravelerCard from '@/components/booking/TravelerCard'
import { AIParseResult, Trip } from '@/lib/types'
import { useRoutePrice } from '@/lib/hooks/useRoutePrice'
import { Loader2, CheckCircle2, Package, MapPin, Scale, Calendar, ArrowRight, Route } from 'lucide-react'

type Step = 'chat' | 'matches' | 'payment' | 'confirmed'

export default function SkickaPage() {
  const [step, setStep] = useState<Step>('chat')
  const [parsed, setParsed] = useState<AIParseResult | null>(null)
  const [trips, setTrips] = useState<Trip[]>([])
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(false)
  const { result: routePrice, calculate } = useRoutePrice()

  async function handleParsed(result: AIParseResult) {
    setParsed(result)
    if (result.confidence < 0.5) return
    setLoading(true)
    try {
      const [matchRes] = await Promise.all([
        fetch('/api/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from_city: result.from_city,
            to_city: result.to_city,
            departure_date: result.departure_date || new Date().toISOString().split('T')[0],
            weight_kg: result.weight_kg || 1,
            type: result.type,
          }),
        }),
        calculate(result.from_city, result.to_city, result.weight_kg || 1),
      ])
      const data = await matchRes.json()
      setTrips(data.trips || [])
      setStep('matches')
    } catch {
      setTrips([])
      setStep('matches')
    }
    setLoading(false)
  }

  async function handlePayment() {
    if (!selectedTrip || !parsed) return
    setStep('payment')
    setTimeout(() => setStep('confirmed'), 1800)
  }

  const STEPS = [
    { key: 'chat', label: 'Beskriv' },
    { key: 'matches', label: 'Välj bärare' },
    { key: 'payment', label: 'Betala' },
    { key: 'confirmed', label: 'Klart' },
  ]
  const stepIdx = STEPS.findIndex((s) => s.key === step)

  return (
    <div style={{ minHeight: '100vh', paddingTop: 80, paddingBottom: 64 }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px' }}>

        {/* Page header */}
        <div style={{ paddingTop: 32, paddingBottom: 40 }}>
          <p className="label" style={{ marginBottom: 8 }}>Skicka paket</p>
          <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.25rem)', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text)', marginBottom: 8 }}>
            Berätta vart det ska
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
            Skriv fritt — vår AI förstår naturligt språk och matchar dig med rätt bärare.
          </p>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 40, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '4px' }}>
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, textAlign: 'center',
                background: i === stepIdx ? 'var(--accent-soft)' : 'transparent',
                transition: 'background 0.2s',
              }}
            >
              <span style={{
                fontSize: '0.75rem', fontWeight: i <= stepIdx ? 600 : 400,
                color: i < stepIdx ? 'var(--success)' : i === stepIdx ? 'var(--accent)' : 'var(--muted)',
              }}>
                {i < stepIdx ? '✓ ' : ''}{s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Step: Chat */}
        {step === 'chat' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
            <div className="card" style={{ padding: 24 }}>
              <AIChat onParsed={handleParsed} />
              {loading && (
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--muted)' }}>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  Söker bärare längs din rutt...
                </div>
              )}
            </div>

            {/* Right info panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="card-sm">
                <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                  Pris-guide
                </p>
                {[
                  ['Stockholm → Göteborg', '149–220 kr'],
                  ['Stockholm → Malmö', '189–280 kr'],
                  ['Göteborg → Malmö', '99–150 kr'],
                  ['Uppsala → Stockholm', '69–120 kr'],
                ].map(([route, price]) => (
                  <div key={route} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{route}</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>{price}</span>
                  </div>
                ))}
              </div>

              <div className="card-sm" style={{ background: 'var(--success-soft)', borderColor: 'var(--success-border)' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)', marginBottom: 6 }}>✓ Alltid inbyggt</p>
                <ul style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.8, listStyle: 'none' }}>
                  <li>BankID-verifierad bärare</li>
                  <li>250 000 kr försäkring</li>
                  <li>Live-spårning</li>
                  <li>Escrow-betalning</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Step: Matches */}
        {step === 'matches' && parsed && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Summary pill */}
              <div className="card-sm" style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                {[
                  { icon: MapPin, text: `${parsed.from_city} → ${parsed.to_city}` },
                  { icon: Package, text: parsed.description?.slice(0, 30) || 'Paket' },
                  ...(parsed.weight_kg ? [{ icon: Scale, text: `${parsed.weight_kg} kg` }] : []),
                  ...(routePrice ? [{ icon: Route, text: `${routePrice.distance_km} km` }] : []),
                  ...(parsed.departure_date ? [{ icon: Calendar, text: parsed.departure_date }] : []),
                ].map(({ icon: Icon, text }) => (
                  <span key={text} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--muted-2)' }}>
                    <Icon size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    {text}
                  </span>
                ))}
              </div>

              {trips.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 48 }}>
                  <p style={{ color: 'var(--muted)', marginBottom: 8 }}>Inga bärare hittades för just nu.</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 16 }}>Vi meddelar dig när någon kör den rutten.</p>
                  <button onClick={() => setStep('chat')} style={{ fontSize: '0.8rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    ← Ändra sökning
                  </button>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: '0.78rem', color: 'var(--muted)', paddingLeft: 4 }}>{trips.length} bärare matchade</p>
                  {trips.map((trip) => (
                    <TravelerCard
                      key={trip.id}
                      trip={trip as Trip & { users?: { name: string; rating_avg: number; rating_count: number } }}
                      price={parsed.estimated_price_sek}
                      onSelect={() => setSelectedTrip(trip)}
                      selected={selectedTrip?.id === trip.id}
                    />
                  ))}
                </>
              )}
            </div>

            {/* Right: booking summary */}
            <div>
              <div className="card" style={{ position: 'sticky', top: 80 }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Bokningssammanfattning</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {[
                    ['Tjänst', parsed.type === 'package' ? 'Paket' : parsed.type === 'pickup' ? 'Upphämtning' : parsed.type === 'return' ? 'Retur' : 'Lift'],
                    ['Rutt', `${parsed.from_city} → ${parsed.to_city}`],
                    ...(routePrice ? [['Avstånd', `${routePrice.distance_km} km`]] : []),
                    ...(routePrice ? [['Tid (bil)', `${Math.floor(routePrice.duration_min / 60)}h ${routePrice.duration_min % 60}min`]] : []),
                    ['Leverans', parsed.urgency === 'today' ? 'Idag' : parsed.urgency === 'tomorrow' ? 'Imorgon' : 'Flexibelt'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                      <span style={{ color: 'var(--muted)' }}>{k}</span>
                      <span style={{ color: 'var(--text)', fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                  {routePrice && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)', background: 'var(--surface-2)', borderRadius: 8, padding: '6px 10px' }}>
                      {routePrice.breakdown.base_fee} kr start + {routePrice.breakdown.km_fee} kr/km + {routePrice.breakdown.kg_fee} kr/kg
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Totalt</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)' }}>
                      {routePrice ? routePrice.price : parsed.estimated_price_sek} kr
                    </span>
                  </div>
                </div>
                <button
                  onClick={handlePayment}
                  disabled={!selectedTrip}
                  className="btn-primary"
                  style={{ width: '100%', borderRadius: 10, padding: '12px 0', fontSize: '0.875rem' }}
                >
                  Betala med Swish <ArrowRight size={14} />
                </button>
                {!selectedTrip && <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--muted)', marginTop: 8 }}>Välj en bärare ovan</p>}
              </div>
            </div>
          </div>
        )}

        {/* Step: Payment */}
        {step === 'payment' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '80px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={24} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Öppnar Swish...</p>
          </div>
        )}

        {/* Step: Confirmed */}
        {step === 'confirmed' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '80px 0', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={32} style={{ color: 'var(--success)' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Bokning bekräftad!</h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem', maxWidth: 320 }}>Du spårar leveransen i realtid när bäraren hämtar paketet.</p>
            <a href="/profil" className="btn-primary" style={{ marginTop: 8, padding: '12px 24px' }}>
              Visa mina ordrar <ArrowRight size={14} />
            </a>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
