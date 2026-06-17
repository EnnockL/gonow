'use client'

import { useState } from 'react'

export default function EarningsWidget() {
  const [km, setKm] = useState(480)
  const [packages, setPackages] = useState(3)
  const [passengers, setPassengers] = useState(1)

  const pkgEarnings = packages * 15 * (km / 10)
  const passengerEarnings = passengers * 150
  const total = pkgEarnings + passengerEarnings
  const payout = total * 0.85

  return (
    <div
      style={{
        borderRadius: 24,
        border: '1px solid var(--enterprise-panel-border)',
        background: 'var(--enterprise-panel-soft-bg)',
        padding: 24,
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: -60,
          top: -60,
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: 'var(--enterprise-panel-glow)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
        <div>
          <p style={{ fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
            Payout forecast
          </p>
          <h3 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.04em', lineHeight: 1 }}>
            {Math.round(payout)} kr
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 8 }}>
            Uppskattad utbetalning baserat pa vald ruttmix.
          </p>
        </div>
        <div
          style={{
            padding: '7px 12px',
            borderRadius: 999,
            border: '1px solid rgba(34,197,94,0.18)',
            background: 'rgba(34,197,94,0.08)',
            fontSize: '0.76rem',
            fontWeight: 700,
            color: 'var(--success)',
            whiteSpace: 'nowrap',
          }}
        >
          +85% payout
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--muted-2)' }}>
            <span>Avstand</span>
            <span>{km} km</span>
          </div>
          <input
            type="range"
            min="50"
            max="2000"
            step="10"
            value={km}
            onChange={(e) => setKm(+e.target.value)}
            className="w-full accent-[var(--accent)]"
          />
        </div>

        <div>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--muted-2)' }}>
            <span>Paket</span>
            <span>{packages} st</span>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            value={packages}
            onChange={(e) => setPackages(+e.target.value)}
            className="w-full accent-[var(--accent)]"
          />
        </div>

        <div>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--muted-2)' }}>
            <span>Passagerare</span>
            <span>{passengers} st</span>
          </div>
          <input
            type="range"
            min="0"
            max="4"
            value={passengers}
            onChange={(e) => setPassengers(+e.target.value)}
            className="w-full accent-[var(--accent)]"
          />
        </div>

        <div
          style={{
            borderRadius: 18,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            padding: 18,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: 'var(--muted-2)', marginBottom: 8 }}>
            <span>Bruttointakt</span>
            <span>{Math.round(total)} kr</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 14 }}>
            <span>Gonow-avgift (15%)</span>
            <span>-{Math.round(total * 0.15)} kr</span>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
            <div>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 4 }}>Din utbetalning</p>
              <p style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--success)', letterSpacing: '-0.04em', lineHeight: 1 }}>
                {Math.round(payout)} kr
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Per 480 km-standardrutt</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
