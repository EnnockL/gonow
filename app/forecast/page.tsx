'use client'

import { useEffect, useState, useCallback } from 'react'
import { Sparkles, Package, Weight, Calendar, Clock, RefreshCw, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface ForecastDeparture {
  id: string
  from_city: string
  to_city: string
  departure_date: string
  departure_time: string
  booking_deadline: string
  predicted_package_count: number
  predicted_total_weight: number
  status: string
  ai_reason: string
  created_at: string
  booked_package_count: number
}

const WEEKDAYS_SV = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag']
const MONTHS_SV = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${WEEKDAYS_SV[d.getDay()]} ${d.getDate()} ${MONTHS_SV[d.getMonth()]}`
}

function fmtDeadline(iso: string) {
  const d = new Date(iso)
  return `${WEEKDAYS_SV[d.getDay()]} ${d.getDate()} ${MONTHS_SV[d.getMonth()]} kl. ${d.getHours().toString().padStart(2, '0')}:00`
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  const days = Math.ceil(diff / 86400000)
  if (days === 0) return 'Idag'
  if (days === 1) return 'Imorgon'
  return `Om ${days} dagar`
}

export default function ForecastPage() {
  const [departures, setDepartures] = useState<ForecastDeparture[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/forecast/departures')
      const data = await res.json()
      setDepartures(data.departures ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function generate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/forecast/generate', { method: 'POST' })
      const data = await res.json()
      if (data.created > 0) await load()
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-gradient)', paddingTop: 88, paddingBottom: 80 }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '0 16px' : '0 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--gn-010)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={16} color="var(--gn-dk)" />
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              AI Forecast
            </span>
          </div>
          <h1 style={{ fontSize: isMobile ? '1.8rem' : '2.2rem', fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            Planerade avgångar
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--muted)', margin: '10px 0 0', maxWidth: 480 }}>
            AI analyserar efterfrågemönster och skapar planerade transportavgångar. Boka din plats i förväg.
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
          <button
            onClick={load}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'inherit' }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Uppdatera
          </button>
          <button
            onClick={generate}
            disabled={generating}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--accent)', cursor: generating ? 'not-allowed' : 'pointer', fontSize: '0.82rem', fontWeight: 700, color: '#0a0a0a', fontFamily: 'inherit', opacity: generating ? 0.7 : 1 }}
          >
            <Sparkles size={13} />
            {generating ? 'Analyserar…' : 'Kör AI-analys'}
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ height: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : departures.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 20 }}>
            <Sparkles size={36} style={{ color: 'var(--muted)', marginBottom: 16 }} />
            <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Inga planerade avgångar ännu</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: '0 0 20px' }}>
              Klicka &quot;Kör AI-analys&quot; för att generera avgångar baserat på historisk efterfrågan.
            </p>
            <button
              onClick={generate}
              disabled={generating}
              style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#0a0a0a', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}
            >
              {generating ? 'Analyserar…' : 'Kör AI-analys nu'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
            {departures.map(dep => (
              <ForecastCard key={dep.id} dep={dep} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

function ForecastCard({ dep }: { dep: ForecastDeparture }) {
  const urgency = daysUntil(dep.departure_date)
  const isUrgent = urgency === 'Imorgon' || urgency === 'Idag'

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1.5px solid ${isUrgent ? 'var(--gn-025)' : 'var(--border)'}`,
      borderRadius: 18, padding: '20px 22px',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Route */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <p style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
            {dep.from_city}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '2px 0' }}>
            <ArrowRight size={13} color="var(--muted)" />
            <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>{dep.to_city}</p>
          </div>
        </div>
        <span style={{
          fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: 999,
          background: isUrgent ? 'var(--gn-010)' : 'var(--surface-2)',
          color: isUrgent ? 'var(--gn-dk)' : 'var(--muted)',
          border: `1px solid ${isUrgent ? 'var(--gn-020)' : 'var(--border)'}`,
          flexShrink: 0,
        }}>
          {urgency}
        </span>
      </div>

      {/* Time info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={13} color="var(--muted)" />
          <span style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 600 }}>
            {fmtDate(dep.departure_date)} kl. {dep.departure_time}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={13} color="var(--muted)" />
          <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
            Boka senast {fmtDeadline(dep.booking_deadline)}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 90, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 7 }}>
          <Package size={13} color="var(--muted)" />
          <div>
            <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1 }}>{dep.predicted_package_count}</p>
            <p style={{ fontSize: '0.65rem', color: 'var(--muted)', margin: '2px 0 0' }}>förväntade</p>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 90, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 7 }}>
          <Weight size={13} color="var(--muted)" />
          <div>
            <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1 }}>{dep.predicted_total_weight} kg</p>
            <p style={{ fontSize: '0.65rem', color: 'var(--muted)', margin: '2px 0 0' }}>förväntad vikt</p>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 90, background: dep.booked_package_count > 0 ? 'var(--gn-008)' : 'var(--surface-2)', border: dep.booked_package_count > 0 ? '1px solid var(--gn-020)' : '1px solid transparent', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 7 }}>
          <Package size={13} color={dep.booked_package_count > 0 ? 'var(--gn-dk)' : 'var(--muted)'} />
          <div>
            <p style={{ fontSize: '1rem', fontWeight: 800, color: dep.booked_package_count > 0 ? 'var(--gn-dk)' : 'var(--text)', margin: 0, lineHeight: 1 }}>{dep.booked_package_count}</p>
            <p style={{ fontSize: '0.65rem', color: 'var(--muted)', margin: '2px 0 0' }}>bokade</p>
          </div>
        </div>
      </div>

      {/* Demand badge */}
      {dep.booked_package_count >= dep.predicted_package_count * 0.8 && dep.booked_package_count > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626' }}>🔥 Stark efterfrågan — avgången fyller på snabbt!</span>
        </div>
      )}
      {dep.booked_package_count >= 1 && dep.booked_package_count < dep.predicted_package_count * 0.8 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: 'var(--gn-008)', border: '1px solid var(--gn-020)' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gn-dk)' }}>✓ Avgång nästan redo — {dep.booked_package_count} paket bokade</span>
        </div>
      )}

      {/* AI reason */}
      <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: 0, lineHeight: 1.5, fontStyle: 'italic' }}>
        {dep.ai_reason}
      </p>

      {/* CTA */}
      <Link
        href={`/uppdrag?forecast_departure_id=${dep.id}&from=${encodeURIComponent(dep.from_city)}&to=${encodeURIComponent(dep.to_city)}`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '11px', borderRadius: 12, background: 'var(--accent)',
          color: '#0a0a0a', fontWeight: 700, fontSize: '0.85rem',
          textDecoration: 'none', transition: 'opacity 0.15s',
        }}
      >
        <Package size={14} />
        Boka paket för denna avgång
      </Link>
    </div>
  )
}
