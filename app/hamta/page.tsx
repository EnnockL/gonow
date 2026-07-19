'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapPin, FileText, Store, ArrowRight, CheckCircle2, Package } from 'lucide-react'

const POPULAR_STORES = [
  { name: 'IKEA', locations: 'Kungens Kurva, Backebol, Hammarby' },
  { name: 'Biltema', locations: 'Täby, Kungens Kurva, Göteborg' },
  { name: 'Clas Ohlson', locations: 'Cityläge, 80+ butiker' },
  { name: 'Bauhaus', locations: 'Stockholm, Göteborg, Malmö' },
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
} as const

export default function HamtaPage() {
  const [isMobile, setIsMobile] = useState(false)
  const [form, setForm] = useState({ store_name: '', store_address: '', order_reference: '', delivery_address: '', city: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  function set(k: string, v: string) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  function focusIn(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = 'var(--accent)'
    e.target.style.background = 'var(--accent-softer)'
  }
  function focusOut(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = 'var(--border)'
    e.target.style.background = 'var(--surface-2)'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/ai-parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Hamta min bestallning fran ${form.store_name} (${form.store_address}), ordernummer ${form.order_reference}, leverera till ${form.delivery_address} i ${form.city}.`,
      }),
    })
    setLoading(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle2 size={32} style={{ color: 'var(--success)' }} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 10 }}>Upphämtning beställd!</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: 24, lineHeight: 1.6 }}>
            Vi matchar dig med en bärare som passerar {form.store_name || 'butiken'}.
          </p>
          <Link href="/profil" className="btn-primary" style={{ display: 'inline-flex', padding: '12px 24px', gap: 8 }}>
            Visa mina ordrar <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', paddingTop: isMobile ? 68 : 80, paddingBottom: isMobile ? 48 : 80 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: isMobile ? '0 16px' : '0 24px' }}>
        <div style={{ paddingTop: isMobile ? 20 : 32, paddingBottom: isMobile ? 28 : 48 }}>
          <p className="label" style={{ marginBottom: 10 }}>Butiksupphämtning</p>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.75rem)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)', marginBottom: 12, lineHeight: 1.1 }}>
            Hämta din order.
            <br />
            Utan att röra dig.
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--muted)', maxWidth: 440 }}>
            En resenär plockar upp din beställning på vägen och levererar den direkt hem till dig.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: isMobile ? 16 : 24 }}>
          <div className="card" style={{ padding: isMobile ? 20 : 28 }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
              Orderuppgifter
              </p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>
                    <Store size={11} /> Butik
                  </label>
                  <input required placeholder="t.ex. IKEA, Biltema" value={form.store_name} onChange={(e) => set('store_name', e.target.value)} onFocus={focusIn} onBlur={focusOut} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>
                    <MapPin size={11} /> Butikens adress / stad
                  </label>
                  <input required placeholder="t.ex. Kungens Kurva, Stockholm" value={form.store_address} onChange={(e) => set('store_address', e.target.value)} onFocus={focusIn} onBlur={focusOut} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>
                  <FileText size={11} /> Ordernummer / referens
                </label>
                  <input required placeholder="t.ex. IKEA-20260601-4521" value={form.order_reference} onChange={(e) => set('order_reference', e.target.value)} onFocus={focusIn} onBlur={focusOut} style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>
                    <MapPin size={11} /> Din gatuadress
                  </label>
                  <input required placeholder="t.ex. Storgatan 12" value={form.delivery_address} onChange={(e) => set('delivery_address', e.target.value)} onFocus={focusIn} onBlur={focusOut} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>Stad</label>
                  <input required placeholder="t.ex. Sundbyberg" value={form.city} onChange={(e) => set('city', e.target.value)} onFocus={focusIn} onBlur={focusOut} style={inputStyle} />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', borderRadius: 10, padding: '12px 0', marginTop: 4 }}>
                {loading ? 'Bearbetar...' : 'Beställ upphämtning →'}
              </button>
            </form>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card-sm">
              <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Populära butiker</p>
              {POPULAR_STORES.map((s) => (
                <div key={s.name} onClick={() => set('store_name', s.name)} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>{s.name}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{s.locations}</span>
                </div>
              ))}
            </div>

            <div className="card-sm" style={{ background: 'var(--accent-softer)', borderColor: 'var(--gn-015)' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)', marginBottom: 10 }}>Hur det fungerar</p>
              {[
                { icon: FileText, text: 'Du anger butik och ordernummer' },
                { icon: Package, text: 'En bärare hämtar upp ordern' },
                { icon: MapPin, text: 'Levereras hem till dig' },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <Icon size={11} style={{ color: 'var(--accent)' }} />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.5 }}>{text}</p>
                </div>
              ))}
            </div>

            <div className="card-sm" style={{ background: 'var(--success-soft)', borderColor: 'var(--success-border)' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)', marginBottom: 6 }}>Ingen postkö</p>
              <p style={{ fontSize: '0.73rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                Slipp kön på ombud. Betalning frigörs efter leverans.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
