'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Activity, AlertCircle, AlertTriangle, ArrowDown, CheckCircle2, Clock,
  Info, Package, RefreshCw, Route, Shield, Sparkles, Timer,
  TrendingUp, Truck, Zap,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Overview {
  active_packages: number
  active_trips: number
  forecast_departures: number
  open_opportunities: number
  accepted_opportunities: number
  pending_matches: number
  matched_packages: number
  delivered_today: number
  packages_today: number
  trips_today: number
  in_transit: number
  forecasts_today: number
  opportunities_today: number
  accepted_today: number
  queue: {
    logistics_first: number
    private_fallback: number
    waiting_next_departure: number
    assigned_logistics: number
  }
}

interface Health {
  match_success_rate: number
  avg_match_time_hours: number
  vehicle_utilization: number
  avg_wait_days: number
  forecast_accuracy: number
  total_matched: number
  total_expired: number
  total_cancelled: number
}

interface ActivityItem {
  id: string
  time: string
  type: string
  description: string
}

interface SystemEvent {
  id: string
  severity: 'info' | 'warning' | 'critical'
  source: string
  event_type: string
  message: string
  package_id: string | null
  order_id: string | null
  metadata: Record<string, unknown>
  resolved_at: string | null
  created_at: string
}

interface GuardianData {
  events: SystemEvent[]
  summary: { critical: number; warning: number; info: number }
}

// ── Dark theme ────────────────────────────────────────────────────────────────

const BG     = '#06080d'
const SURF   = '#0c1321'
const SURF2  = '#101828'
const TEXT   = '#e2f0ff'
const MUTED  = 'rgba(226,240,255,0.38)'
const BORD   = 'rgba(255,255,255,0.05)'
const GREEN  = '#4ade80'
const G_DIM  = 'rgba(74,222,128,0.10)'
const G_BORD = 'rgba(74,222,128,0.20)'
const BLUE   = '#60a5fa'
const B_DIM  = 'rgba(96,165,250,0.10)'
const B_BORD = 'rgba(96,165,250,0.22)'
const YELLOW = '#fbbf24'
const Y_DIM  = 'rgba(251,191,36,0.10)'
const Y_BORD = 'rgba(251,191,36,0.22)'
const PURPLE = '#a78bfa'
const P_DIM  = 'rgba(167,139,250,0.10)'
const P_BORD = 'rgba(167,139,250,0.22)'
const ORANGE = '#fb923c'
const O_DIM  = 'rgba(251,146,60,0.10)'
const TEAL   = '#34d399'
const T_DIM  = 'rgba(52,211,153,0.10)'

const REFRESH_S = 15

const EVENT_META: Record<string, { label: string; color: string; bg: string }> = {
  package:              { label: 'Paket',       color: BLUE,   bg: B_DIM },
  trip:                 { label: 'Resa',         color: TEAL,   bg: T_DIM },
  match_suggested:      { label: 'AI Match',    color: GREEN,  bg: G_DIM },
  matched:              { label: 'Matchat',      color: '#56d364', bg: 'rgba(86,211,100,0.1)' },
  opportunity_created:  { label: 'Uppdrag',     color: YELLOW, bg: Y_DIM },
  opportunity_accepted: { label: 'Accept.',     color: PURPLE, bg: P_DIM },
  forecast:             { label: 'Forecast',    color: GREEN,  bg: G_DIM },
  pickup:               { label: 'Upphämtat',   color: ORANGE, bg: O_DIM },
  delivered:            { label: 'Levererat',   color: TEAL,   bg: T_DIM },
}

// ── CountUp ───────────────────────────────────────────────────────────────────

function CountUp({ to, duration = 750 }: { to: number; duration?: number }) {
  const [val, setVal] = useState(0)
  const rafRef = useRef<number>(0)
  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    const start = Date.now()
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1)
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * to))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [to, duration])
  return <>{val}</>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}
function fmtRel(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just nu'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}t`
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}
function fmtHours(h: number) {
  if (h < 1) return `${Math.round(h * 60)}min`
  if (h < 24) return `${h}t`
  return `${Math.round(h / 24)}d`
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DispatcherDashboard() {
  const [ov, setOv]                   = useState<Overview | null>(null)
  const [health, setHealth]           = useState<Health | null>(null)
  const [activity, setActivity]       = useState<ActivityItem[]>([])
  const [loading, setLoading]         = useState(true)
  const [updated, setUpdated]         = useState<Date | null>(null)
  const [countdown, setCountdown]     = useState(REFRESH_S)
  const [guardian, setGuardian]       = useState<GuardianData | null>(null)
  const [gFilter, setGFilter]         = useState<'all' | 'critical' | 'warning' | 'info'>('all')
  const [aiSummary, setAiSummary]     = useState<string | null>(null)
  const [aiLoading, setAiLoading]     = useState(false)
  const [resolving, setResolving]     = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const [r1, r2, r3, r4] = await Promise.all([
        fetch('/api/dispatcher/overview'),
        fetch('/api/dispatcher/health'),
        fetch('/api/dispatcher/activity'),
        fetch('/api/guardian/events?resolved=false&limit=50'),
      ])
      if (!r1.ok || !r2.ok || !r3.ok) return
      const [o, h, a] = await Promise.all([r1.json(), r2.json(), r3.json()])
      setOv(o)
      setHealth(h)
      setActivity(a.activity ?? [])
      if (r4.ok) setGuardian(await r4.json())
      setUpdated(new Date())
      setCountdown(REFRESH_S)
    } finally {
      setLoading(false)
    }
  }, [])

  const resolveEvent = useCallback(async (id: string) => {
    setResolving(id)
    try {
      await fetch(`/api/guardian/resolve/${id}`, { method: 'POST' })
      setGuardian(prev => prev ? {
        ...prev,
        events: prev.events.filter(e => e.id !== id),
        summary: {
          ...prev.summary,
          [prev.events.find(e => e.id === id)?.severity ?? 'info']:
            Math.max(0, (prev.summary[prev.events.find(e => e.id === id)?.severity ?? 'info'] ?? 1) - 1),
        },
      } : prev)
    } finally {
      setResolving(null)
    }
  }, [])

  const requestAISummary = useCallback(async () => {
    setAiLoading(true)
    setAiSummary(null)
    try {
      const res = await fetch('/api/guardian/summary', { method: 'POST' })
      const data = await res.json() as { summary?: string; error?: string }
      setAiSummary(data.summary ?? data.error ?? 'Ingen data.')
    } catch {
      setAiSummary('Kunde inte hämta AI-sammanfattning.')
    } finally {
      setAiLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
    const ri = setInterval(loadAll, REFRESH_S * 1000)
    const ci = setInterval(() => setCountdown(c => (c > 1 ? c - 1 : REFRESH_S)), 1000)
    return () => { clearInterval(ri); clearInterval(ci) }
  }, [loadAll])

  // ── queue pipeline ─────────────────────────────────────────────────────────
  const queueStages = ov ? [
    { label: 'Aktiva paket',     sub: 'totalt i systemet',       val: ov.active_packages,                          color: BLUE,   icon: <Package size={11} /> },
    { label: 'AI Forecast',      sub: 'planerade avgångar',       val: ov.forecast_departures,                      color: YELLOW, icon: <Route size={11} /> },
    { label: 'Logistikuppdrag',  sub: 'öppna, väntar svar',      val: ov.open_opportunities,                       color: ORANGE, icon: <Truck size={11} /> },
    { label: 'Accepterade',      sub: 'bekräftade uppdrag',       val: ov.accepted_opportunities,                   color: PURPLE, icon: <CheckCircle2 size={11} /> },
    { label: 'Matchade / Transit', sub: 'paket med förare',       val: ov.matched_packages + ov.in_transit,         color: GREEN,  icon: <Zap size={11} /> },
    { label: 'Levererade idag',  sub: 'framme hos mottagare',     val: ov.delivered_today,                          color: TEAL,   icon: <CheckCircle2 size={11} /> },
  ] : []

  // ── live counters ──────────────────────────────────────────────────────────
  // ── health cards ───────────────────────────────────────────────────────────
  const healthCards = health ? [
    {
      label: 'Matchningsgrad',
      display: `${health.match_success_rate}%`,
      bar: health.match_success_rate,
      color: health.match_success_rate >= 70 ? GREEN : ORANGE,
      desc: `${health.total_matched} lyckade / ${health.total_matched + health.total_expired + health.total_cancelled} försök`,
      icon: <Zap size={12} />,
    },
    {
      label: 'Genomsnittlig matchtid',
      display: fmtHours(health.avg_match_time_hours),
      bar: health.avg_match_time_hours > 0 ? Math.max(0, 100 - health.avg_match_time_hours * 4) : 0,
      color: health.avg_match_time_hours <= 6 ? GREEN : health.avg_match_time_hours <= 24 ? YELLOW : ORANGE,
      desc: health.avg_match_time_hours > 0 ? `snitt från skapad till bekräftad` : 'ingen data än',
      icon: <Timer size={12} />,
    },
    {
      label: 'Väntetid paket',
      display: `${health.avg_wait_days}d`,
      bar: Math.max(0, 100 - health.avg_wait_days * 10),
      color: health.avg_wait_days <= 3 ? GREEN : health.avg_wait_days <= 7 ? YELLOW : ORANGE,
      desc: `snitt ${health.avg_wait_days} dagar per öppet paket`,
      icon: <Clock size={12} />,
    },
    {
      label: 'Prognosprecision',
      display: `${health.forecast_accuracy}%`,
      bar: health.forecast_accuracy,
      color: health.forecast_accuracy >= 60 ? GREEN : YELLOW,
      desc: 'bokade vs förväntade paket',
      icon: <TrendingUp size={12} />,
    },
    {
      label: 'Fordonsanvändning',
      display: `${health.vehicle_utilization}%`,
      bar: health.vehicle_utilization,
      color: health.vehicle_utilization >= 50 ? GREEN : YELLOW,
      desc: 'accepterade uppdrag vs totalt',
      icon: <Truck size={12} />,
    },
  ] : []

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      background: BG,
      backgroundImage: 'radial-gradient(ellipse 80% 28% at 50% 0%, rgba(74,222,128,0.045) 0%, transparent 62%)',
      paddingTop: 54,
      paddingBottom: 80,
      color: TEXT,
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
    }}>
      <div style={{ maxWidth: 1514, margin: '0 auto', padding: '0 28px' }}>

        {/* breadcrumb */}
        <p style={{ fontSize: '0.62rem', color: MUTED, margin: '0 0 16px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          <Link href="/admin" style={{ color: 'inherit', textDecoration: 'none' }}>Admin</Link>
          {' / '}Dispatcher
        </p>

        {/* ── 1. SYSTEM STATUS BANNER ────────────────────────────────────── */}
        <div className="dispatcher-status" style={{
          background: 'linear-gradient(135deg, #0d1523 0%, #0a111d 100%)', border: `1px solid ${BORD}`, borderRadius: 22,
          padding: '24px 28px', marginBottom: 14,
          display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(620px, 1.8fr) auto', alignItems: 'center', gap: 30,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}>
          {/* Title */}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, flexShrink: 0, animation: 'pulse-glow 2s ease-in-out infinite' }} />
              <span style={{ fontSize: '0.58rem', fontWeight: 800, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                Systemstatus: Aktiv · Hälsa: God
              </span>
            </div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: TEXT, margin: 0, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              Dispatcher
            </h1>
            <p style={{ fontSize: '0.68rem', color: MUTED, margin: '4px 0 0' }}>
              Organiserar transporter över hela nätverket.
            </p>
          </div>

          {/* Status metrics */}
          <div className="dispatcher-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(78px, 1fr))', gap: 8 }}>
            {ov && [
              { label: 'Aktiva paket',   val: ov.active_packages,    color: BLUE },
              { label: 'Aktiva resor',   val: ov.active_trips,        color: TEAL },
              { label: 'AI-Avgångar',    val: ov.forecast_departures, color: YELLOW },
              { label: 'Möjligheter',    val: ov.open_opportunities + ov.accepted_opportunities, color: ORANGE },
              { label: 'Väntande match', val: ov.pending_matches,     color: PURPLE },
              { label: 'Matchade',       val: ov.matched_packages,    color: GREEN },
            ].map(s => (
              <div key={s.label} style={{ minWidth: 0, padding: '10px 11px', borderRadius: 12, background: 'rgba(255,255,255,0.025)', border: `1px solid ${BORD}` }}>
                <p style={{ fontSize: '1.3rem', fontWeight: 850, color: s.color, margin: 0, lineHeight: 1, letterSpacing: '-0.05em' }}>
                  <CountUp to={s.val} />
                </p>
                <p style={{ fontSize: '0.5rem', color: MUTED, margin: '5px 0 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* Refresh control */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7, flexShrink: 0 }}>
            <button
              onClick={loadAll}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 13px', borderRadius: 8,
                border: `1px solid ${G_BORD}`, background: G_DIM,
                cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700,
                color: GREEN, fontFamily: 'inherit',
              }}
            >
              <RefreshCw size={10} />
              Uppdatera
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 56, height: 2, background: BORD, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(countdown / REFRESH_S) * 100}%`, background: GREEN, transition: 'width 1s linear', borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: '0.58rem', color: MUTED, fontFamily: 'monospace' }}>
                {updated ? updated.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* ── 5. LIVE COUNTERS (today) ────────────────────────────────────── */}
        {/* ── 3+2. QUEUE + ACTIVITY ──────────────────────────────────────── */}
        <div className="dispatcher-main" style={{ display: 'grid', gridTemplateColumns: '340px minmax(0, 1fr)', gap: 14, marginBottom: 14, alignItems: 'stretch' }}>

          {/* 3. Dispatcher Queue */}
          <div style={{ background: SURF, border: `1px solid ${BORD}`, borderRadius: 20, padding: '20px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <Zap size={12} color={GREEN} />
              <h2 style={{ fontSize: '0.65rem', fontWeight: 800, color: TEXT, margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Transportkö
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {queueStages.map((s, idx) => (
                <div key={s.label}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: SURF2, borderRadius: 12, padding: '10px 11px',
                    border: `1px solid ${BORD}`,
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                      background: s.val > 0 ? G_DIM : 'rgba(255,255,255,0.025)', border: `1px solid ${s.val > 0 ? G_BORD : BORD}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color,
                    }}>
                      {s.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.65rem', color: TEXT, margin: 0, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</p>
                      <p style={{ fontSize: '0.55rem', color: MUTED, margin: 0 }}>{s.sub}</p>
                    </div>
                    <p style={{ fontSize: '1.2rem', fontWeight: 900, color: s.val > 0 ? s.color : MUTED, margin: 0, letterSpacing: '-0.04em', flexShrink: 0 }}>
                      <CountUp to={s.val} />
                    </p>
                  </div>
                  {idx < queueStages.length - 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '3px 0' }}>
                      <ArrowDown size={11} color={`${GREEN}30`} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 2. Live Activity Feed */}
          <div style={{ background: SURF, border: `1px solid ${BORD}`, borderRadius: 20, padding: '20px 22px', minHeight: 438 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Activity size={12} color={GREEN} />
              <h2 style={{ fontSize: '0.65rem', fontWeight: 800, color: TEXT, margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Senaste aktivitet
              </h2>
              <span style={{ fontSize: '0.55rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: G_DIM, color: GREEN, border: `1px solid ${G_BORD}` }}>
                Live · {countdown}s
              </span>
            </div>

            {loading ? (
              <p style={{ color: MUTED, fontSize: '0.75rem', padding: '14px 0' }}>Laddar aktivitet…</p>
            ) : activity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: MUTED }}>
                <Sparkles size={20} style={{ marginBottom: 8 }} />
                <p style={{ fontSize: '0.75rem', margin: 0 }}>Ingen aktivitet ännu.</p>
              </div>
            ) : (
              <div style={{ maxHeight: 370, overflowY: 'auto', paddingRight: 8 }}>
                {activity.map((item, idx) => {
                  const m = EVENT_META[item.type] ?? { label: item.type, color: MUTED, bg: SURF2 }
                  return (
                    <div key={item.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', paddingBottom: idx < activity.length - 1 ? 9 : 0 }}>
                      <p style={{ fontSize: '0.6rem', color: MUTED, margin: 0, fontFamily: 'monospace', flexShrink: 0, paddingTop: 3, width: 34 }}>
                        {fmtTime(item.time)}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 5 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: m.color }} />
                        {idx < activity.length - 1 && (
                          <div style={{ width: 1, flex: 1, minHeight: 12, background: BORD, marginTop: 3 }} />
                        )}
                      </div>
                      <div style={{ flex: 1, paddingBottom: idx < activity.length - 1 ? 3 : 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                          <span style={{ fontSize: '0.55rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: m.bg, color: m.color }}>
                            {m.label}
                          </span>
                          <span style={{ fontSize: '0.55rem', color: MUTED }}>{fmtRel(item.time)}</span>
                        </div>
                        <p style={{ fontSize: '0.74rem', color: TEXT, margin: 0, lineHeight: 1.4, fontWeight: 500 }}>
                          {item.description}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div style={{ paddingTop: 8, paddingLeft: 43 }}>
                  <span style={{ fontSize: '0.68rem', color: GREEN, animation: 'blink 1.3s step-end infinite', fontFamily: 'monospace' }}>_</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 4. SYSTEM HEALTH ───────────────────────────────────────────── */}
        <div style={{ background: SURF, border: `1px solid ${BORD}`, borderRadius: 18, padding: '16px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
            <TrendingUp size={12} color={GREEN} />
            <h2 style={{ fontSize: '0.65rem', fontWeight: 800, color: TEXT, margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Systemhälsa
            </h2>
          </div>

          <div className="dispatcher-health" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {loading || healthCards.length === 0 ? (
              [...Array(5)].map((_, i) => (
                <div key={i} style={{ background: SURF2, borderRadius: 11, padding: '12px 14px', height: 90, animation: 'dim-pulse 1.5s ease-in-out infinite' }} />
              ))
            ) : (
              healthCards.map(h => (
                <div key={h.label} style={{ background: SURF2, borderRadius: 11, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ color: h.color }}>{h.icon}</span>
                      <p style={{ fontSize: '0.57rem', color: MUTED, margin: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {h.label}
                      </p>
                    </div>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: h.color, boxShadow: `0 0 5px ${h.color}60`, flexShrink: 0 }} />
                  </div>
                  <p style={{ fontSize: '1.5rem', fontWeight: 900, color: h.color, margin: '0 0 6px', lineHeight: 1, letterSpacing: '-0.05em' }}>
                    {h.display}
                  </p>
                  <div style={{ height: 2, background: BORD, borderRadius: 2, marginBottom: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, h.bar))}%`, background: h.color, borderRadius: 2, transition: 'width 1.3s ease' }} />
                  </div>
                  <p style={{ fontSize: '0.57rem', color: MUTED, margin: 0, lineHeight: 1.4 }}>{h.desc}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── 6. SYSTEM GUARDIAN ─────────────────────────────────────────── */}
        {(() => {
          const critCount  = guardian?.summary.critical ?? 0
          const warnCount  = guardian?.summary.warning  ?? 0
          const bannerColor = critCount > 0 ? '#ef4444' : warnCount > 0 ? YELLOW : GREEN
          const bannerBg    = critCount > 0 ? 'rgba(239,68,68,0.08)' : warnCount > 0 ? Y_DIM : G_DIM
          const bannerBord  = critCount > 0 ? 'rgba(239,68,68,0.25)' : warnCount > 0 ? Y_BORD : G_BORD
          const statusLabel = critCount > 0 ? `${critCount} kritisk${critCount > 1 ? 'a' : ''} incident${critCount > 1 ? 'er' : ''}` : warnCount > 0 ? `${warnCount} varning${warnCount > 1 ? 'ar' : ''}` : 'Allt normalt'

          const filtered = (guardian?.events ?? []).filter(e =>
            gFilter === 'all' ? true : e.severity === gFilter
          )

          const SevIcon = ({ s }: { s: string }) => {
            if (s === 'critical') return <AlertCircle size={13} color="#ef4444" />
            if (s === 'warning')  return <AlertTriangle size={13} color={YELLOW} />
            return <Info size={13} color={BLUE} />
          }
          const sevColor = (s: string) => s === 'critical' ? '#ef4444' : s === 'warning' ? YELLOW : BLUE
          const sevBg    = (s: string) => s === 'critical' ? 'rgba(239,68,68,0.10)' : s === 'warning' ? Y_DIM : B_DIM
          const sevBord  = (s: string) => s === 'critical' ? 'rgba(239,68,68,0.25)' : s === 'warning' ? Y_BORD : B_BORD

          return (
            <div style={{ background: SURF, border: `1px solid ${BORD}`, borderRadius: 18, padding: '16px 22px', marginTop: 12 }}>
              {/* header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <Shield size={12} color={bannerColor} />
                <h2 style={{ fontSize: '0.65rem', fontWeight: 800, color: TEXT, margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em', flex: '1 0 auto' }}>
                  System Guardian
                </h2>

                {/* status badge */}
                <span style={{
                  fontSize: '0.55rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999,
                  background: bannerBg, color: bannerColor, border: `1px solid ${bannerBord}`,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: bannerColor, display: 'inline-block' }} />
                  {statusLabel}
                </span>

                {/* filter tabs */}
                {(['all', 'critical', 'warning', 'info'] as const).map(f => (
                  <button key={f} onClick={() => setGFilter(f)} style={{
                    fontSize: '0.55rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999,
                    background: gFilter === f ? (f === 'critical' ? 'rgba(239,68,68,0.12)' : f === 'warning' ? Y_DIM : f === 'info' ? B_DIM : G_DIM) : 'transparent',
                    color: gFilter === f ? (f === 'critical' ? '#ef4444' : f === 'warning' ? YELLOW : f === 'info' ? BLUE : GREEN) : MUTED,
                    border: `1px solid ${gFilter === f ? (f === 'critical' ? 'rgba(239,68,68,0.3)' : f === 'warning' ? Y_BORD : f === 'info' ? B_BORD : G_BORD) : BORD}`,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}>
                    {f === 'all' ? 'Alla' : f === 'critical' ? 'Kritisk' : f === 'warning' ? 'Varning' : 'Info'}
                    {f !== 'all' && guardian && (
                      <span style={{ marginLeft: 4, opacity: 0.7 }}>({guardian.summary[f]})</span>
                    )}
                  </button>
                ))}

                {/* AI summary button */}
                <button onClick={requestAISummary} disabled={aiLoading} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 12px', borderRadius: 8,
                  border: `1px solid ${P_BORD}`, background: P_DIM,
                  cursor: aiLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.62rem', fontWeight: 700, color: PURPLE, fontFamily: 'inherit',
                  opacity: aiLoading ? 0.6 : 1,
                }}>
                  <Sparkles size={10} />
                  {aiLoading ? 'Analyserar…' : 'AI-analys'}
                </button>
              </div>

              {/* AI summary box */}
              {aiSummary && (
                <div style={{
                  background: P_DIM, border: `1px solid ${P_BORD}`, borderRadius: 10,
                  padding: '10px 14px', marginBottom: 12,
                  fontSize: '0.72rem', color: TEXT, lineHeight: 1.55,
                }}>
                  <span style={{ fontSize: '0.55rem', fontWeight: 800, color: PURPLE, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>
                    GIS-assistent · Sammanfattning
                  </span>
                  {aiSummary}
                </div>
              )}

              {/* event list */}
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[...Array(3)].map((_, i) => (
                    <div key={i} style={{ height: 56, background: SURF2, borderRadius: 10, animation: 'dim-pulse 1.5s ease-in-out infinite' }} />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0', color: MUTED }}>
                  <Shield size={20} style={{ marginBottom: 8, opacity: 0.4 }} />
                  <p style={{ fontSize: '0.75rem', margin: 0 }}>
                    {guardian ? 'Inga aktiva incidenter.' : 'Laddar incidenter…'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
                  {filtered.map(ev => (
                    <div key={ev.id} style={{
                      background: SURF2, borderRadius: 10, padding: '9px 12px',
                      border: `1px solid ${sevBord(ev.severity)}`,
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                    }}>
                      <div style={{ flexShrink: 0, paddingTop: 1 }}>
                        <SevIcon s={ev.severity} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '0.52rem', fontWeight: 800, padding: '1px 6px', borderRadius: 4,
                            background: sevBg(ev.severity), color: sevColor(ev.severity),
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                          }}>
                            {ev.severity}
                          </span>
                          <span style={{ fontSize: '0.55rem', fontWeight: 700, color: MUTED, fontFamily: 'monospace' }}>
                            {ev.source}
                          </span>
                          <span style={{ fontSize: '0.52rem', color: MUTED }}>·</span>
                          <span style={{ fontSize: '0.55rem', color: MUTED }}>{fmtRel(ev.created_at)}</span>
                        </div>
                        <p style={{ fontSize: '0.72rem', color: TEXT, margin: 0, lineHeight: 1.4, fontWeight: 500 }}>
                          {ev.message}
                        </p>
                      </div>
                      <button
                        onClick={() => resolveEvent(ev.id)}
                        disabled={resolving === ev.id}
                        style={{
                          flexShrink: 0, padding: '3px 10px', borderRadius: 6,
                          border: `1px solid ${G_BORD}`, background: G_DIM,
                          cursor: resolving === ev.id ? 'not-allowed' : 'pointer',
                          fontSize: '0.58rem', fontWeight: 700, color: GREEN,
                          fontFamily: 'inherit', opacity: resolving === ev.id ? 0.5 : 1,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {resolving === ev.id ? '…' : 'Lös'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

      </div>

      <style>{`
        @keyframes pulse-glow {
          0%,100% { box-shadow:0 0 0 0 rgba(74,222,128,0.55),0 0 8px rgba(74,222,128,0.3); }
          50%      { box-shadow:0 0 0 7px rgba(74,222,128,0),0 0 16px rgba(74,222,128,0.12); }
        }
        @keyframes blink {
          0%,100%{ opacity:1; } 50%{ opacity:0; }
        }
        @keyframes dim-pulse {
          0%,100%{ opacity:0.6; } 50%{ opacity:0.3; }
        }
        @media (max-width: 1180px) {
          .dispatcher-status { grid-template-columns: 1fr !important; gap: 18px !important; }
          .dispatcher-metrics { grid-template-columns: repeat(3, 1fr) !important; }
          .dispatcher-main { grid-template-columns: 1fr !important; }
          .dispatcher-health { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 680px) {
          .dispatcher-metrics { grid-template-columns: repeat(2, 1fr) !important; }
          .dispatcher-health { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
