'use client'

import { useState, useEffect } from 'react'

interface Pricing { base_fee: number; per_km: number; per_kg: number; commission_pct: number }

export default function EarningsWidget() {
  const [km, setKm] = useState(480)
  const [packages, setPackages] = useState(3)
  const [passengers, setPassengers] = useState(1)
  const [pricePerKg, setPricePerKg] = useState(15)
  const [pricePerSeat, setPricePerSeat] = useState(150)
  const [pricing, setPricing] = useState<Pricing | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const { createClient } = await import('@/lib/supabase')
        const { data } = await createClient().from('pricing').select('*').single()
        if (data) {
          setPricing(data as Pricing)
          setPricePerKg(data.per_kg ?? 15)
        }
      } catch { /* use defaults */ }
    }
    load()
  }, [])

  const avgKgPerPackage = 3
  const commission = pricing?.commission_pct ?? 15

  const pkgRevenue  = packages  * pricePerKg  * avgKgPerPackage
  const liftRevenue = passengers * pricePerSeat
  const total  = pkgRevenue + liftRevenue
  const payout = Math.round(total * (1 - commission / 100))

  const sliders = [
    { label: 'Avstånd', val: km,         setVal: setKm,        min: 50,  max: 2000, step: 10,  unit: 'km'  },
    { label: 'Paket',   val: packages,    setVal: setPackages,  min: 0,   max: 10,   step: 1,   unit: 'st'  },
    { label: 'Passagerare', val: passengers, setVal: setPassengers, min: 0, max: 4, step: 1,  unit: 'st'  },
  ]

  return (
    <div style={{ borderRadius: 24, border: '1px solid var(--enterprise-panel-border)', background: 'var(--enterprise-panel-soft-bg)', padding: 24, boxShadow: 'var(--shadow-lg)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: '50%', background: 'var(--enterprise-panel-glow)', pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
        <div>
          <p style={{ fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
            Intjäningskalkyl
          </p>
          <h3 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.04em', lineHeight: 1 }}>
            {payout} kr
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 8 }}>
            Uppskattad utbetalning baserat på ruttmix.
          </p>
        </div>
        <div style={{ padding: '7px 12px', borderRadius: 999, border: '1px solid rgba(34,197,94,0.18)', background: 'rgba(34,197,94,0.08)', fontSize: '0.76rem', fontWeight: 700, color: 'var(--success)', whiteSpace: 'nowrap' }}>
          {100 - commission}% till dig
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {sliders.map(s => (
          <div key={s.label}>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--muted-2)' }}>
              <span>{s.label}</span>
              <span>{s.val} {s.unit}</span>
            </div>
            <input
              type="range"
              min={s.min} max={s.max} step={s.step}
              value={s.val}
              onChange={e => s.setVal(+e.target.value)}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
          </div>
        ))}

        <div style={{ borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px 18px' }}>
          {[
            [`Paket (${packages} × ~${avgKgPerPackage} kg × ${pricePerKg} kr/kg)`, `${Math.round(pkgRevenue)} kr`],
            [`Passagerare (${passengers} × ${pricePerSeat} kr)`, `${Math.round(liftRevenue)} kr`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.77rem', color: 'var(--muted-2)', marginBottom: 7 }}>
              <span>{k}</span><span>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.77rem', color: 'var(--muted)', marginBottom: 12 }}>
            <span>Gonow-avgift ({commission}%)</span>
            <span>−{Math.round(total * commission / 100)} kr</span>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 4 }}>Din utbetalning</p>
              <p style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--success)', letterSpacing: '-0.04em', lineHeight: 1 }}>{payout} kr</p>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--muted)', textAlign: 'right', lineHeight: 1.5 }}>Exkl. drivmedel<br />och vagnskador</p>
          </div>
        </div>
      </div>
    </div>
  )
}
