'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ArrowRight, Truck, Package, User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

type Role = 'user' | 'carrier' | 'both'

interface FormData {
  role: Role | null
  phone: string
  city: string
  vehicleType: string
}

const VEHICLE_TYPES = ['Personbil', 'Skåpbil', 'Lastbil', 'Motorcykel', 'Cykel / Elsparkcykel']

const stepLabels = ['Välkommen', 'Kontaktinfo', 'Förare', 'Klart']

export default function OnboardingPage() {
  const router = useRouter()
  const { userId, profile } = useAuth()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>({ role: null, phone: '', city: '', vehicleType: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function skipAll() {
    if (!userId) { router.push('/profil'); return }
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, onboarding_completed: true }),
    }).catch(() => {})
    router.push('/profil')
  }

  async function saveAndFinish() {
    if (!userId) return
    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        user_id: userId,
        onboarding_completed: true,
      }
      if (form.role && form.role !== 'both') payload.role = form.role
      if (form.phone) payload.phone = form.phone
      if (form.city) payload.city = form.city

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Kunde inte spara profil')
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: '0.9rem',
    color: 'var(--text)',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  }

  const btnPrimary: React.CSSProperties = {
    width: '100%',
    minHeight: 48,
    background: 'var(--accent)',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: 12,
    fontSize: '0.92rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'opacity 0.15s',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-gradient)', paddingTop: 80, paddingBottom: 60, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, padding: '0 20px' }}>

        {/* Progress dots */}
        {step < 3 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32, marginTop: 16 }}>
            {stepLabels.slice(0, 3).map((label, i) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700,
                  background: i < step ? 'var(--accent)' : i === step ? 'var(--accent)' : 'var(--surface-2)',
                  color: i <= step ? '#0a0a0a' : 'var(--muted)',
                  border: i === step ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: 'all 0.2s',
                }}>{i < step ? '✓' : i + 1}</div>
                <span style={{ fontSize: '0.6rem', color: i === step ? 'var(--accent)' : 'var(--muted)', fontWeight: i === step ? 700 : 400 }}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Step 0 — Välkommen */}
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fade-in 0.25s ease both' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--gn-012)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <span style={{ fontSize: '1.8rem' }}>👋</span>
              </div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text)', margin: '0 0 8px', letterSpacing: '-0.03em' }}>
                Välkommen{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}!
              </h1>
              <p style={{ fontSize: '0.88rem', color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>
                Berätta lite om dig så att vi kan anpassa din upplevelse.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Vad vill du göra på Gonow?</p>
              {([
                { value: 'user' as Role, icon: Package, label: 'Skicka paket / resa', desc: 'Jag vill skicka saker eller boka plats' },
                { value: 'carrier' as Role, icon: Truck, label: 'Köra / bärare', desc: 'Jag vill ta uppdrag och transportera' },
                { value: 'both' as Role, icon: User, label: 'Båda', desc: 'Jag vill både skicka och köra' },
              ] as const).map(({ value, icon: Icon, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, role: value }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    background: form.role === value ? 'var(--gn-008)' : 'var(--surface)',
                    border: `2px solid ${form.role === value ? 'var(--accent)' : 'var(--border)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: form.role === value ? 'var(--gn-015)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={18} style={{ color: form.role === value ? 'var(--accent)' : 'var(--muted)' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 2px' }}>{label}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: 0 }}>{desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <button
              style={{ ...btnPrimary, opacity: !form.role ? 0.5 : 1 }}
              disabled={!form.role}
              onClick={() => form.role && setStep(1)}
            >
              Fortsätt <ArrowRight size={16} />
            </button>
            <button type="button" onClick={skipAll} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', padding: '4px 0' }}>
              Hoppa över just nu
            </button>
          </div>
        )}

        {/* Step 1 — Grundinfo */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fade-in 0.25s ease both' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>Grundinfo</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>Telefon och stad används för att matcha dig med resor nära dig.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Telefonnummer</label>
                <input
                  type="tel"
                  placeholder="+46 70 000 00 00"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Din stad</label>
                <input
                  type="text"
                  placeholder="Stockholm"
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setStep(0)} style={{ flex: 1, minHeight: 48, background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 12, fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Tillbaka
              </button>
              <button
                type="button"
                onClick={() => setStep(form.role === 'carrier' || form.role === 'both' ? 2 : 3)}
                style={{ ...btnPrimary, flex: 2 }}
              >
                {form.role === 'carrier' || form.role === 'both' ? 'Fortsätt' : 'Slutför'} <ArrowRight size={16} />
              </button>
            </div>
            <button type="button" onClick={skipAll} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', padding: '4px 0' }}>
              Hoppa över just nu
            </button>
          </div>
        )}

        {/* Step 2 — Förare preferenser (only for carrier/both) */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fade-in 0.25s ease both' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>Ditt fordon</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>Vilken typ av fordon kör du? (valfritt)</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {VEHICLE_TYPES.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, vehicleType: f.vehicleType === v ? '' : v }))}
                  style={{
                    padding: '12px 16px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontSize: '0.88rem', fontWeight: 600,
                    background: form.vehicleType === v ? 'var(--gn-008)' : 'var(--surface)',
                    border: `2px solid ${form.vehicleType === v ? 'var(--accent)' : 'var(--border)'}`,
                    color: form.vehicleType === v ? 'var(--text)' : 'var(--muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>

            {error && <p style={{ fontSize: '0.82rem', color: '#dc2626', textAlign: 'center' }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setStep(1)} style={{ flex: 1, minHeight: 48, background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 12, fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Tillbaka
              </button>
              <button type="button" onClick={saveAndFinish} disabled={saving} style={{ ...btnPrimary, flex: 2, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Sparar...' : 'Slutför'} {!saving && <CheckCircle2 size={16} />}
              </button>
            </div>
            <button type="button" onClick={skipAll} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', padding: '4px 0' }}>
              Hoppa över just nu
            </button>
          </div>
        )}

        {/* Step 3 — Klart */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center', paddingTop: 24, animation: 'fade-in 0.3s ease both' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--gn-012)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={36} style={{ color: 'var(--gn)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text)', margin: '0 0 10px', letterSpacing: '-0.03em' }}>Allt klart!</h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--muted)', lineHeight: 1.7, margin: 0, maxWidth: 320 }}>
                Din profil är redo. Du kan nu börja använda Gonow för att skicka paket, resa med samåkning eller ta uppdrag.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/profil')}
              style={{ ...btnPrimary, maxWidth: 280 }}
            >
              Gå till min profil <ArrowRight size={16} />
            </button>
            <button type="button" onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              Utforska Gonow
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
