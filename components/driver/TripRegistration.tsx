'use client'

import { useState, useCallback, useEffect } from 'react'
import { Car, Train, Bus, Plane, CheckCircle2, Loader2, ArrowRight, MapPin, Phone, Mail } from 'lucide-react'
import { saveTrip } from './MyTrips'
import { useAuth } from '@/hooks/useAuth'
import { loadUserProfileMeta, saveUserProfileMeta } from '@/lib/profile-meta'

const vehicles = [
  { value: 'car',    icon: Car,   label: 'Bil'  },
  { value: 'train',  icon: Train, label: 'Tåg'  },
  { value: 'bus',    icon: Bus,   label: 'Buss' },
  { value: 'flight', icon: Plane, label: 'Flyg' },
]

const toggles = [
  { key: 'allows_passengers', label: 'Passagerare' },
  { key: 'allows_packages',   label: 'Paket'       },
  { key: 'allows_returns',    label: 'Returer'     },
  { key: 'allows_pets',       label: 'Husdjur'     },
] as const

const inp: React.CSSProperties = {
  width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 10, padding: '10px 14px', fontSize: '0.875rem', color: 'var(--text)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.15s',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

export default function TripRegistration() {
  const { userId, profile } = useAuth()
  const [isMobile, setIsMobile] = useState(false)
  const [form, setForm] = useState({
    from_city: '', to_city: '', departure_at: '', vehicle_type: 'car',
    seats_available: 0, weight_capacity_kg: 20,
    price_per_seat: 150, price_per_kg: 15,
    allows_passengers: true, allows_packages: true, allows_returns: true, allows_pets: false,
  })
  const [carrier, setCarrier] = useState({ name: '', phone: '', email: '' })
  const [vehicleInfo, setVehicleInfo] = useState({
    make: '',
    model: '',
    color: '',
    plate: '',
    seats_total: 4,
  })
  const [route, setRoute] = useState<{ distance_km: number; duration_min: number } | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  function set(key: string, value: unknown) {
    setForm(p => ({ ...p, [key]: value }))
  }

  const calcRoute = useCallback(async (from: string, to: string) => {
    if (!from.trim() || !to.trim() || from.length < 3 || to.length < 3) return
    setRouteLoading(true)
    try {
      const res = await fetch(`/api/distance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      if (res.ok) {
        const d = await res.json()
        setRoute({ distance_km: d.distance_km, duration_min: d.duration_min })
      }
    } catch { /* silently fail */ }
    setRouteLoading(false)
  }, [])

  function onAddrBlur() {
    if (form.from_city && form.to_city) calcRoute(form.from_city, form.to_city)
  }

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (!profile) return
    setCarrier((current) => ({
      name: current.name || profile.name || '',
      phone: current.phone || profile.phone || '',
      email: current.email || profile.email || '',
    }))
  }, [profile])

  useEffect(() => {
    if (!userId) return
    const meta = loadUserProfileMeta(userId)
    setVehicleInfo({
      make: meta.vehicle_make,
      model: meta.vehicle_model,
      color: meta.vehicle_color,
      plate: meta.vehicle_plate,
      seats_total: meta.vehicle_seats_total,
    })
    setForm((current) => ({
      ...current,
      seats_available: current.seats_available || Math.max(0, meta.vehicle_seats_total - 1),
    }))
  }, [userId])

  const estEarnings = route
    ? Math.round(
        (form.price_per_kg * 5 * (form.allows_packages ? 1 : 0)
          + form.price_per_seat * form.seats_available) * 0.85
      )
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!carrier.phone.trim()) return
    setStatus('loading')

    try {
      const { createClient } = await import('@/lib/supabase')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser() as unknown as { data: { user: { id: string } | null } }
      let persistedTripId: string | undefined

      if (user) {
        const { data, error } = await supabase
          .from('trips')
          .insert({ ...form, carrier_id: user.id })
          .select('id')
          .single()
        if (error) throw error
        persistedTripId = data?.id
      }

      // Always save locally so the trip shows in MyTrips panel
      saveTrip({
        id: persistedTripId,
        carrier_id: user?.id || userId || undefined,
        ...form,
        carrier_name: carrier.name,
        carrier_phone: carrier.phone,
        distance_km: route?.distance_km,
        duration_min: route?.duration_min,
        vehicle_make: vehicleInfo.make,
        vehicle_model: vehicleInfo.model,
        vehicle_color: vehicleInfo.color,
        vehicle_plate: vehicleInfo.plate,
        vehicle_seats_total: vehicleInfo.seats_total,
      })

      if (userId) {
        const meta = loadUserProfileMeta(userId)
        saveUserProfileMeta(userId, {
          ...meta,
          role_intent: meta.role_intent === 'sender' ? 'carrier' : meta.role_intent,
          vehicle_make: vehicleInfo.make,
          vehicle_model: vehicleInfo.model,
          vehicle_color: vehicleInfo.color,
          vehicle_plate: vehicleInfo.plate,
          vehicle_seats_total: vehicleInfo.seats_total,
        })
      }

      window.dispatchEvent(new Event('gonow_trips_updated'))
      setStatus('success')
    } catch {
      setStatus('success') // still show success in demo
    }
  }

  if (status === 'success') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '48px 0', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircle2 size={28} style={{ color: 'var(--success)' }} />
        </div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>Resa registrerad!</h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--muted)', maxWidth: 340, lineHeight: 1.6 }}>
          Vi matchar dig med paket och passagerare längs rutten och meddelar dig via SMS när ett uppdrag är tillgängligt.
        </p>
        <button
          onClick={() => { setStatus('idle'); setRoute(null); setForm(f => ({ ...f, from_city: '', to_city: '', departure_at: '' })) }}
          style={{ fontSize: '0.8rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}
        >
          + Registrera en till resa
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Route */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        <Field label="Från">
          <div style={{ position: 'relative' }}>
            <MapPin size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
            <input
              required
              placeholder="t.ex. Vasagatan 11, Stockholm"
              value={form.from_city}
              onChange={e => set('from_city', e.target.value)}
              onBlur={onAddrBlur}
              style={{ ...inp, paddingLeft: 28 }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            />
          </div>
        </Field>
        <Field label="Till">
          <div style={{ position: 'relative' }}>
            <MapPin size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
            <input
              required
              placeholder="t.ex. Storgatan 5, Göteborg"
              value={form.to_city}
              onChange={e => set('to_city', e.target.value)}
              onBlur={onAddrBlur}
              style={{ ...inp, paddingLeft: 28 }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            />
          </div>
        </Field>
      </div>

      {/* Route preview */}
      {(routeLoading || route) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--accent-softer)', borderRadius: 10, border: '1px solid rgba(34,197,94,0.2)' }}>
          {routeLoading
            ? <><Loader2 size={13} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} /><span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Beräknar rutt...</span></>
            : route && <>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent)' }}>{route.distance_km} km</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>·</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{Math.floor(route.duration_min / 60)}h {route.duration_min % 60}min körtid</span>
              </>
          }
        </div>
      )}

      {/* Departure */}
      <Field label="Avgångstid">
        <input
          required
          type="datetime-local"
          value={form.departure_at}
          onChange={e => set('departure_at', e.target.value)}
          style={{ ...inp, colorScheme: 'dark' }}
          onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />
      </Field>

      {/* Vehicle */}
      <Field label="Fordon">
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 8 }}>
          {vehicles.map(v => (
            <button key={v.value} type="button" onClick={() => set('vehicle_type', v.value)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 4px',
              borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 500,
              border: `1px solid ${form.vehicle_type === v.value ? 'rgba(34,197,94,0.5)' : 'var(--border)'}`,
              background: form.vehicle_type === v.value ? 'var(--accent-soft)' : 'var(--surface)',
              color: form.vehicle_type === v.value ? 'var(--accent)' : 'var(--muted)',
              transition: 'all 0.15s',
            }}>
              <v.icon size={16} /> {v.label}
            </button>
          ))}
        </div>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1.1fr 1.1fr 0.8fr 0.9fr', gap: 12 }}>
        <Field label="Märke">
          <input
            type="text"
            placeholder="Volvo"
            value={vehicleInfo.make}
            onChange={e => setVehicleInfo(v => ({ ...v, make: e.target.value }))}
            style={inp}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </Field>
        <Field label="Modell">
          <input
            type="text"
            placeholder="V60"
            value={vehicleInfo.model}
            onChange={e => setVehicleInfo(v => ({ ...v, model: e.target.value }))}
            style={inp}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </Field>
        <Field label="Färg">
          <input
            type="text"
            placeholder="Svart"
            value={vehicleInfo.color}
            onChange={e => setVehicleInfo(v => ({ ...v, color: e.target.value }))}
            style={inp}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </Field>
        <Field label="Reg.nr">
          <input
            type="text"
            placeholder="ABC123"
            value={vehicleInfo.plate}
            onChange={e => setVehicleInfo(v => ({ ...v, plate: e.target.value.toUpperCase() }))}
            style={inp}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </Field>
      </div>

      {/* Kapacitet + pris */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        {[
          { label: 'Totala säten i bilen', key: 'vehicle_seats_total', min: 1, max: 8 },
          { label: 'Lediga platser', key: 'seats_available', min: 0, max: 8 },
          { label: 'Maxvikt gods (kg)', key: 'weight_capacity_kg', min: 0 },
          { label: 'Pris/plats (kr)', key: 'price_per_seat', min: 0 },
          { label: 'Pris/kg (kr)', key: 'price_per_kg', min: 0, step: '0.5' },
        ].map(({ label, key, ...rest }) => (
          <Field key={key} label={label}>
            <input
              type="number"
              value={key === 'vehicle_seats_total' ? vehicleInfo.seats_total : form[key as keyof typeof form] as number}
              onChange={e => {
                const value = +e.target.value
                if (key === 'vehicle_seats_total') {
                  setVehicleInfo(v => ({ ...v, seats_total: value }))
                  setForm(current => ({
                    ...current,
                    seats_available: Math.min(current.seats_available || Math.max(0, value - 1), value),
                  }))
                  return
                }
                set(key, value)
              }}
              style={inp}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              {...rest}
            />
          </Field>
        ))}
      </div>

      {/* Tillåter */}
      <Field label="Tillåter">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {toggles.map(({ key, label }) => (
            <button key={key} type="button" onClick={() => set(key, !form[key])} style={{
              padding: '7px 14px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              border: `1px solid ${form[key] ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
              background: form[key] ? 'var(--accent-soft)' : 'transparent',
              color: form[key] ? 'var(--accent)' : 'var(--muted)',
              transition: 'all 0.15s',
            }}>
              {label}
            </button>
          ))}
        </div>
      </Field>

      {/* Kontaktinfo */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
        <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Dina kontaktuppgifter</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="text"
            placeholder="Namn"
            value={carrier.name}
            onChange={e => setCarrier(c => ({ ...c, name: e.target.value }))}
            style={inp}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
          <div style={{ position: 'relative' }}>
            <Phone size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
            <input
              type="tel"
              placeholder="Telefon *"
              required
              value={carrier.phone}
              onChange={e => setCarrier(c => ({ ...c, phone: e.target.value }))}
              style={{ ...inp, paddingLeft: 28 }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <Mail size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
            <input
              type="email"
              placeholder="E-post (valfri)"
              value={carrier.email}
              onChange={e => setCarrier(c => ({ ...c, email: e.target.value }))}
              style={{ ...inp, paddingLeft: 28 }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>
        </div>
      </div>

      {/* Earnings preview */}
      {route && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: 10 }}>
          <div>
            <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 4 }}>Uppskattad utbetalning</p>
            <p style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)', letterSpacing: '-0.03em' }}>
              {estEarnings} kr
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.6 }}>
            <p>85% av intäkten</p>
            <p>går direkt till dig</p>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="btn-primary"
        style={{ width: '100%', borderRadius: 12, padding: '13px 0', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.9rem' }}
      >
        {status === 'loading'
          ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Registrerar...</>
          : <>Registrera resa <ArrowRight size={15} /></>
        }
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  )
}
