'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Activity, AlertCircle, AlertTriangle, ArrowDown, Briefcase, Car,
  CheckCircle2, Clock, Info, Map, MessageSquare, Package, RefreshCw,
  Route, Shield, Sparkles, Timer, TrendingUp, Truck, Zap,
} from 'lucide-react'
import Link from 'next/link'
import { authedFetch } from '@/lib/auth/authed-fetch'
import { useAuth } from '@/hooks/useAuth'

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

// ── Platinum + functional color theme ────────────────────────────────────────

const GLASS   = 'rgba(255,255,255,0.038)'
const GLASS2  = 'rgba(255,255,255,0.06)'
const TEXT    = '#f4f6fc'
const MUTED   = 'rgba(200,210,230,0.44)'
const BORD    = 'rgba(210,220,240,0.09)'

// platinum silver — structural accents
const PLAT    = '#c4d0e8'
const PLAT2   = '#e8edf8'
const PL_DIM  = 'rgba(196,208,232,0.10)'
const PL_BORD = 'rgba(196,208,232,0.20)'

// green — good / active / live
const GREEN   = '#4ade80'
const G_DIM   = 'rgba(74,222,128,0.10)'
const G_BORD  = 'rgba(74,222,128,0.22)'

// red — critical / error
const RED     = '#f87171'
const R_DIM   = 'rgba(248,113,113,0.10)'
const R_BORD  = 'rgba(248,113,113,0.25)'

// amber — warning
const AMBER   = '#fbbf24'
const A_DIM   = 'rgba(251,191,36,0.10)'
const A_BORD  = 'rgba(251,191,36,0.22)'

// ice blue — info
const ICE     = '#bae6fd'
const I_DIM   = 'rgba(186,230,253,0.10)'
const I_BORD  = 'rgba(186,230,253,0.22)'

// queue stage tints — platinum tones
const Q_COLORS = ['#a5b4d4','#c4d0e8','#94a3c0','#b0bcd8','#d4ddf0','#e2e8f8']

const REFRESH_S = 15

const EVENT_META: Record<string, { label: string; color: string; bg: string }> = {
  package:              { label: 'Paket',      color: PLAT,  bg: PL_DIM },
  trip:                 { label: 'Resa',        color: ICE,   bg: I_DIM },
  match_suggested:      { label: 'AI Match',   color: GREEN, bg: G_DIM },
  matched:              { label: 'Matchat',     color: GREEN, bg: G_DIM },
  opportunity_created:  { label: 'Uppdrag',    color: AMBER, bg: A_DIM },
  opportunity_accepted: { label: 'Accept.',    color: ICE,   bg: I_DIM },
  forecast:             { label: 'Forecast',   color: PLAT,  bg: PL_DIM },
  pickup:               { label: 'Upphämtat',  color: AMBER, bg: A_DIM },
  delivered:            { label: 'Levererat',  color: GREEN, bg: G_DIM },
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
function healthColor(good: boolean, warn: boolean) {
  if (good) return GREEN
  if (warn) return AMBER
  return RED
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DispatcherDashboard() {
  const [ov, setOv]               = useState<Overview | null>(null)
  const [health, setHealth]       = useState<Health | null>(null)
  const [activity, setActivity]   = useState<ActivityItem[]>([])
  const { userId, profile } = useAuth()
  const [loading, setLoading]     = useState(true)
  const [updated, setUpdated]     = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(REFRESH_S)
  const [guardian, setGuardian]   = useState<GuardianData | null>(null)
  const [guardianLoading, setGuardianLoading] = useState(true)
  const [guardianMode, setGuardianMode] = useState<'live' | 'fallback'>('live')
  const [gFilter, setGFilter]     = useState<'all' | 'critical' | 'warning' | 'info'>('all')
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [resolving, setResolving] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const [r1, r2, r3, r4] = await Promise.all([
        fetch('/api/dispatcher/overview'),
        fetch('/api/dispatcher/health'),
        fetch('/api/dispatcher/activity'),
        authedFetch('/api/guardian/events?resolved=false&limit=50'),
      ])
      if (!r1.ok || !r2.ok || !r3.ok) return
      const [o, h, a] = await Promise.all([r1.json(), r2.json(), r3.json()])
      setOv(o)
      setHealth(h)
      setActivity(a.activity ?? [])
      if (r4.ok) {
        setGuardian(await r4.json())
        setGuardianMode('live')
      } else {
        setGuardian({ events: [], summary: { critical: 0, warning: 0, info: 0 } })
        setGuardianMode('fallback')
      }
      setUpdated(new Date())
      setCountdown(REFRESH_S)
    } catch {
      setGuardian(current => current ?? { events: [], summary: { critical: 0, warning: 0, info: 0 } })
      setGuardianMode('fallback')
    } finally {
      setLoading(false)
      setGuardianLoading(false)
    }
  }, [])

  const resolveEvent = useCallback(async (id: string) => {
    setResolving(id)
    try {
      const response = await authedFetch(`/api/guardian/resolve/${id}`, { method: 'POST' })
      if (!response.ok) return
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
      const res = await authedFetch('/api/guardian/summary', { method: 'POST' })
      const data = await res.json() as { summary?: string; error?: string; mode?: 'ai' | 'rules' }
      if (data.mode === 'rules') setGuardianMode('fallback')
      setAiSummary(data.summary ?? data.error ?? 'Ingen data.')
    } catch {
      setGuardianMode('fallback')
      setAiSummary('AI är inte tillgänglig. Guardian fortsätter med regelbaserad övervakning.')
    } finally {
      setAiLoading(false)
    }
  }, [])

  useEffect(() => {
    const initial = window.setTimeout(() => void loadAll(), 0)
    const ri = setInterval(loadAll, REFRESH_S * 1000)
    const ci = setInterval(() => setCountdown(c => (c > 1 ? c - 1 : REFRESH_S)), 1000)
    return () => { clearTimeout(initial); clearInterval(ri); clearInterval(ci) }
  }, [loadAll])

  // ── derived data ────────────────────────────────────────────────────────────

  const queueStages = ov ? [
    { label: 'Aktiva paket',       sub: 'totalt i systemet',    val: ov.active_packages,                       icon: <Package size={11} /> },
    { label: 'AI Forecast',        sub: 'planerade avgångar',    val: ov.forecast_departures,                   icon: <Route size={11} /> },
    { label: 'Logistikuppdrag',    sub: 'öppna, väntar svar',   val: ov.open_opportunities,                    icon: <Truck size={11} /> },
    { label: 'Accepterade',        sub: 'bekräftade uppdrag',    val: ov.accepted_opportunities,                icon: <CheckCircle2 size={11} /> },
    { label: 'Matchade / Transit', sub: 'paket med förare',      val: ov.matched_packages + ov.in_transit,      icon: <Zap size={11} /> },
    { label: 'Levererade idag',    sub: 'framme hos mottagare',  val: ov.delivered_today,                       icon: <CheckCircle2 size={11} /> },
  ] : []

  const todayStats = ov ? [
    { label: 'Paket idag',      val: ov.packages_today },
    { label: 'Resor idag',      val: ov.trips_today },
    { label: 'Prognoser idag',  val: ov.forecasts_today },
    { label: 'Uppdrag idag',    val: ov.opportunities_today },
    { label: 'Accept. idag',    val: ov.accepted_today },
    { label: 'Levererade idag', val: ov.delivered_today },
  ] : []

  const healthCards = health ? [
    {
      label: 'Matchningsgrad',
      display: `${health.match_success_rate}%`,
      bar: health.match_success_rate,
      color: healthColor(health.match_success_rate >= 70, health.match_success_rate >= 40),
      desc: `${health.total_matched} lyckade / ${health.total_matched + health.total_expired + health.total_cancelled} försök`,
      icon: <Zap size={12} />,
    },
    {
      label: 'Genomsnittlig matchtid',
      display: fmtHours(health.avg_match_time_hours),
      bar: health.avg_match_time_hours > 0 ? Math.max(0, 100 - health.avg_match_time_hours * 4) : 0,
      color: healthColor(health.avg_match_time_hours <= 6, health.avg_match_time_hours <= 24),
      desc: health.avg_match_time_hours > 0 ? 'snitt från skapad till bekräftad' : 'ingen data än',
      icon: <Timer size={12} />,
    },
    {
      label: 'Väntetid paket',
      display: `${health.avg_wait_days}d`,
      bar: Math.max(0, 100 - health.avg_wait_days * 10),
      color: healthColor(health.avg_wait_days <= 3, health.avg_wait_days <= 7),
      desc: `snitt ${health.avg_wait_days} dagar per öppet paket`,
      icon: <Clock size={12} />,
    },
    {
      label: 'Prognosprecision',
      display: `${health.forecast_accuracy}%`,
      bar: health.forecast_accuracy,
      color: healthColor(health.forecast_accuracy >= 60, health.forecast_accuracy >= 35),
      desc: 'bokade vs förväntade paket',
      icon: <TrendingUp size={12} />,
    },
    {
      label: 'Fordonsanvändning',
      display: `${health.vehicle_utilization}%`,
      bar: health.vehicle_utilization,
      color: healthColor(health.vehicle_utilization >= 50, health.vehicle_utilization >= 25),
      desc: 'accepterade uppdrag vs totalt',
      icon: <Truck size={12} />,
    },
  ] : []

  // guardian helpers
  const critCount   = guardian?.summary.critical ?? 0
  const warnCount   = guardian?.summary.warning  ?? 0
  const gStatusColor = critCount > 0 ? RED : warnCount > 0 ? AMBER : PLAT2
  const gStatusBg    = critCount > 0 ? R_DIM : warnCount > 0 ? A_DIM : PL_DIM
  const gStatusBord  = critCount > 0 ? R_BORD : warnCount > 0 ? A_BORD : PL_BORD
  const gStatusLabel = critCount > 0
    ? `${critCount} kritisk${critCount > 1 ? 'a' : ''} incident${critCount > 1 ? 'er' : ''}`
    : warnCount > 0 ? `${warnCount} varning${warnCount > 1 ? 'ar' : ''}` : 'Allt normalt'
  const filteredEvents = (guardian?.events ?? []).filter(e =>
    gFilter === 'all' || e.severity === gFilter
  )

  const sevColor = (s: string) => s === 'critical' ? RED   : s === 'warning' ? AMBER : ICE
  const sevBg    = (s: string) => s === 'critical' ? R_DIM : s === 'warning' ? A_DIM : I_DIM
  const sevBord  = (s: string) => s === 'critical' ? R_BORD: s === 'warning' ? A_BORD : I_BORD
  const SevIcon  = ({ s }: { s: string }) =>
    s === 'critical' ? <AlertCircle size={13} color={RED} />
    : s === 'warning' ? <AlertTriangle size={13} color={AMBER} />
    : <Info size={13} color={ICE} />

  // ── render ─────────────────────────────────────────────────────────────────

  const mainLinks = [
    { href: '/skicka',      label: 'Skicka',      icon: <Package size={15} /> },
    { href: '/lift',        label: 'Lift',         icon: <Car size={15} /> },
    { href: '/resor',       label: 'Resor',        icon: <Map size={15} /> },
    { href: '/uppdrag',     label: 'Uppdrag',      icon: <Briefcase size={15} /> },
    { href: '/kor',         label: 'Kör & tjäna',  icon: <Truck size={15} /> },
    { href: '/meddelanden', label: 'Chat',         icon: <MessageSquare size={15} />, badge: 'NY' },
  ]

  const adminLinks = [
    { href: '/admin/dashboard', label: 'Översikt',   icon: <Activity size={15} /> },
    { href: '/admin/dispatcher',label: 'Dispatcher', icon: <Zap size={15} />, active: true },
    { href: '/admin/logistics', label: 'Logistik',   icon: <Truck size={15} /> },
    { href: '/forecast',        label: 'Forecast',   icon: <TrendingUp size={15} /> },
    { href: '/admin/dispatcher',label: 'Guardian',   icon: <Shield size={15} /> },
  ]

  const userInitials = (profile?.name ?? '')
    .split(' ').filter(Boolean).slice(0, 2)
    .map((n: string) => n[0].toUpperCase()).join('') || 'A'

  return (
    <div className="dp-shell">

      {/* fixed background */}
      <div className="dp-bg" aria-hidden="true" />
      <div className="dp-glow-tl" aria-hidden="true" />
      <div className="dp-glow-br" aria-hidden="true" />

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────── */}
      <nav className="dp-sidebar">

        {/* Brand */}
        <div className="dp-sidebar-brand">
          <div className="dp-brand-dot" />
          <span className="dp-brand-name">Gonow</span>
        </div>

        {/* Platform nav */}
        <p className="dp-sidebar-section-label">Navigering</p>
        <ul className="dp-nav-list">
          {mainLinks.map(l => (
            <li key={l.label}>
              <Link href={l.href} className="dp-nav-item">
                <span className="dp-nav-icon">{l.icon}</span>
                <span>{l.label}</span>
                {l.badge && <span className="dp-nav-badge">{l.badge}</span>}
              </Link>
            </li>
          ))}
        </ul>

        {/* Admin nav */}
        <p className="dp-sidebar-section-label" style={{ marginTop: 12 }}>Admin</p>
        <ul className="dp-nav-list">
          {adminLinks.map(l => (
            <li key={l.label}>
              <Link href={l.href} className={`dp-nav-item${l.active ? ' dp-nav-active' : ''}`}>
                <span className="dp-nav-icon">{l.icon}</span>
                <span>{l.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        {/* Footer: user + CTA */}
        <div className="dp-sidebar-footer">
          {/* refresh indicator */}
          <div className="dp-refresh-mini" style={{ marginBottom: 12 }}>
            <div className="dp-sys-status">
              <span className="dp-status-dot" style={{ width: 6, height: 6 }} />
              <span className="dp-sys-label">System: Aktiv</span>
            </div>
            <div className="dp-progress-track" style={{ width: '100%', marginTop: 6 }}>
              <div className="dp-progress-fill" style={{ width: `${(countdown / REFRESH_S) * 100}%` }} />
            </div>
          </div>

          {/* user row */}
          {userId && (
            <Link href="/profil" className="dp-user-row">
              <div className="dp-user-avatar">{userInitials}</div>
              <span className="dp-user-name">{profile?.name?.split(' ')[0] ?? 'Konto'}</span>
            </Link>
          )}

          {/* CTA */}
          <button
            type="button"
            className="dp-cta-btn"
            onClick={() => window.dispatchEvent(new CustomEvent('gonow_open_package_booking'))}
          >
            Skicka nu
          </button>
        </div>
      </nav>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
      <div className="dp-main">
      <div className="dp-wrap">

        {/* ── HERO BANNER — Spotify artist page style ─────────────────── */}
        <div className="dp-hero">

          <div className="dp-hero-left">
            <div className="dp-status-pill">
              <span className="dp-status-dot" />
              <span>Systemstatus: Aktiv</span>
            </div>
            <h1 className="dp-h1">Gonow Dispatcher</h1>
            <p className="dp-tagline">Realtidsövervakning · Intelligent routing · System Guardian</p>

            {/* metrics inline under title */}
            <div className="dp-hero-metrics">
              {ov ? [
                { label: 'Aktiva paket',  val: ov.active_packages },
                { label: 'Aktiva resor',  val: ov.active_trips },
                { label: 'AI-Avgångar',   val: ov.forecast_departures },
                { label: 'Möjligheter',   val: ov.open_opportunities + ov.accepted_opportunities },
                { label: 'Väntar match',  val: ov.pending_matches },
                { label: 'Matchade',      val: ov.matched_packages },
              ].map((s, i) => (
                <div key={s.label} className="dp-metric-cell" style={{ animationDelay: `${i * 60}ms` }}>
                  <span className="dp-metric-val"><CountUp to={s.val} /></span>
                  <span className="dp-metric-label">{s.label}</span>
                </div>
              )) : [...Array(6)].map((_, i) => (
                <div key={i} className="dp-metric-cell dp-skeleton" />
              ))}
            </div>
          </div>

          {/* right: refresh */}
          <div className="dp-hero-right">
            <button className="dp-btn-refresh" onClick={loadAll}>
              <RefreshCw size={12} />
              Uppdatera
            </button>
            <div className="dp-progress-row">
              <div className="dp-progress-track">
                <div className="dp-progress-fill" style={{ width: `${(countdown / REFRESH_S) * 100}%` }} />
              </div>
              <span className="dp-mono dp-time-label">
                {updated ? updated.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* ── TODAY COUNTERS ───────────────────────────────────────────── */}
        <div className="dp-counters">
          {loading ? [...Array(6)].map((_, i) => (
            <div key={i} className="dp-counter-card dp-skeleton" />
          )) : todayStats.map(s => (
            <div key={s.label} className="dp-counter-card">
              <span className="dp-counter-val"><CountUp to={s.val} /></span>
              <span className="dp-counter-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── QUEUE + ACTIVITY ────────────────────────────────────────── */}
        <div className="dp-mid">

          {/* queue pipeline */}
          <div className="dp-card dp-queue">
            <div className="dp-section-header">
              <Zap size={14} color={GREEN} />
              <span>Transportkö</span>
            </div>

            <div className="dp-queue-list">
              {queueStages.map((s, idx) => (
                <div key={s.label}>
                  <div className="dp-queue-row">
                    <div className="dp-queue-icon" style={{ color: Q_COLORS[idx] }}>
                      {s.icon}
                    </div>
                    <div className="dp-queue-text">
                      <span className="dp-queue-name">{s.label}</span>
                      <span className="dp-queue-sub">{s.sub}</span>
                    </div>
                    <span className="dp-queue-count" style={{ color: s.val > 0 ? Q_COLORS[idx] : MUTED }}>
                      <CountUp to={s.val} />
                    </span>
                  </div>
                  {idx < queueStages.length - 1 && (
                    <div className="dp-queue-arrow">
                      <ArrowDown size={10} color={`${PLAT}28`} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* activity feed */}
          <div className="dp-card dp-activity">
            <div className="dp-section-header">
              <Activity size={14} color={GREEN} />
              <span>Senaste aktivitet</span>
              <span className="dp-live-badge">Live · {countdown}s</span>
            </div>

            {loading ? (
              <p className="dp-empty-text">Laddar aktivitet…</p>
            ) : activity.length === 0 ? (
              <div className="dp-empty">
                <Sparkles size={18} />
                <span>Ingen aktivitet ännu.</span>
              </div>
            ) : (
              <div className="dp-activity-scroll">
                {activity.map((item, idx) => {
                  const m = EVENT_META[item.type] ?? { label: item.type, color: MUTED, bg: GLASS2 }
                  return (
                    <div key={item.id} className="dp-activity-row" style={{ paddingBottom: idx < activity.length - 1 ? 10 : 0 }}>
                      <span className="dp-mono dp-act-time">{fmtTime(item.time)}</span>
                      <div className="dp-act-line">
                        <div className="dp-act-dot" style={{ background: m.color }} />
                        {idx < activity.length - 1 && <div className="dp-act-connector" />}
                      </div>
                      <div className="dp-act-body" style={{ paddingBottom: idx < activity.length - 1 ? 4 : 0 }}>
                        <div className="dp-act-meta">
                          <span className="dp-tag" style={{ background: m.bg, color: m.color }}>{m.label}</span>
                          <span className="dp-act-rel">{fmtRel(item.time)}</span>
                        </div>
                        <p className="dp-act-desc">{item.description}</p>
                      </div>
                    </div>
                  )
                })}
                <div className="dp-cursor-row">
                  <span className="dp-mono dp-cursor">_</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── SYSTEM HEALTH ────────────────────────────────────────────── */}
        <div className="dp-card dp-health-wrap">
          <div className="dp-section-header">
            <TrendingUp size={14} color={GREEN} />
            <span>Systemhälsa</span>
          </div>

          <div className="dp-health-grid">
            {loading || healthCards.length === 0 ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="dp-health-card dp-skeleton" />
              ))
            ) : healthCards.map(h => (
              <div key={h.label} className="dp-health-card">
                <div className="dp-health-top">
                  <div className="dp-health-icon-row">
                    <span style={{ color: h.color }}>{h.icon}</span>
                    <span className="dp-label-xs">{h.label}</span>
                  </div>
                  <div className="dp-health-dot" style={{ background: h.color, boxShadow: `0 0 6px ${h.color}55` }} />
                </div>
                <p className="dp-health-val" style={{ color: h.color }}>{h.display}</p>
                <div className="dp-bar-track">
                  <div className="dp-bar-fill" style={{ width: `${Math.min(100, Math.max(0, h.bar))}%`, background: h.color }} />
                </div>
                <p className="dp-health-desc">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── SYSTEM GUARDIAN ──────────────────────────────────────────── */}
        <div className="dp-card dp-guardian">
          <div className="dp-section-header" style={{ flexWrap: 'wrap', gap: 8 }}>
            <Shield size={12} color={gStatusColor} />
            <span style={{ flex: '1 0 auto' }}>System Guardian</span>

            <span className="dp-tag" style={{ background: gStatusBg, color: gStatusColor, border: `1px solid ${gStatusBord}`, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: gStatusColor, display: 'inline-block' }} />
              {gStatusLabel}
            </span>

            {guardianMode === 'fallback' && (
              <span className="dp-tag" style={{ background: A_DIM, color: AMBER, border: `1px solid ${A_BORD}` }}>
                Reservläge · regelmotor
              </span>
            )}

            {(['all', 'critical', 'warning', 'info'] as const).map(f => (
              <button key={f} className="dp-filter-btn" onClick={() => setGFilter(f)}
                style={{
                  background: gFilter === f ? (f === 'critical' ? R_DIM : f === 'warning' ? A_DIM : f === 'info' ? I_DIM : PL_DIM) : 'transparent',
                  color:      gFilter === f ? (f === 'critical' ? RED  : f === 'warning' ? AMBER : f === 'info' ? ICE  : PLAT2) : MUTED,
                  border:     `1px solid ${gFilter === f ? (f === 'critical' ? R_BORD : f === 'warning' ? A_BORD : f === 'info' ? I_BORD : PL_BORD) : BORD}`,
                }}>
                {f === 'all' ? 'Alla' : f === 'critical' ? 'Kritisk' : f === 'warning' ? 'Varning' : 'Info'}
                {f !== 'all' && guardian && <span style={{ marginLeft: 4, opacity: 0.65 }}>({guardian.summary[f]})</span>}
              </button>
            ))}

            <button className="dp-btn-ai" onClick={requestAISummary} disabled={aiLoading}>
              <Sparkles size={10} />
              {aiLoading ? 'Analyserar…' : 'Driftanalys'}
            </button>
          </div>

          {aiSummary && (
            <div className="dp-ai-box">
              <span className="dp-ai-label">GIS-assistent · Sammanfattning</span>
              <p className="dp-ai-text">{aiSummary}</p>
            </div>
          )}

          {loading || guardianLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...Array(3)].map((_, i) => <div key={i} className="dp-skeleton" style={{ height: 56, borderRadius: 12 }} />)}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="dp-empty">
              <Shield size={18} style={{ opacity: 0.35 }} />
              <span>{guardianMode === 'fallback' ? 'Inga regelbaserade avvikelser. Incidentloggen återansluts automatiskt.' : 'Inga aktiva incidenter.'}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 420, overflowY: 'auto' }}>
              {filteredEvents.map(ev => (
                <div key={ev.id} className="dp-ev-row" style={{ borderColor: sevBord(ev.severity), background: sevBg(ev.severity) }}>
                  <SevIcon s={ev.severity} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="dp-ev-meta">
                      <span className="dp-tag" style={{ background: sevBg(ev.severity), color: sevColor(ev.severity), textTransform: 'uppercase' }}>
                        {ev.severity}
                      </span>
                      <span className="dp-mono" style={{ fontSize: '0.56rem', color: MUTED }}>{ev.source}</span>
                      <span style={{ fontSize: '0.52rem', color: MUTED }}>·</span>
                      <span style={{ fontSize: '0.56rem', color: MUTED }}>{fmtRel(ev.created_at)}</span>
                    </div>
                    <p className="dp-ev-msg">{ev.message}</p>
                  </div>
                  <button
                    className="dp-btn-resolve"
                    onClick={() => resolveEvent(ev.id)}
                    disabled={resolving === ev.id}
                    style={{ opacity: resolving === ev.id ? 0.45 : 1 }}
                  >
                    {resolving === ev.id ? '…' : 'Lös'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>{/* dp-wrap */}
      </div>{/* dp-main */}

      <style>{`

        /* ── shell — sidebar + main layout ──────────────────────────── */
        .dp-shell {
          position: relative;
          min-height: 100vh;
          color: ${TEXT};
          font-family: var(--font-sans, system-ui, sans-serif);
          display: flex;
          overflow-x: hidden;
        }

        /* ── LEFT SIDEBAR ────────────────────────────────────────────── */
        .dp-sidebar {
          position: fixed;
          top: 0;
          left: 0;
          width: 220px;
          height: 100vh;
          background: #0a0c10;
          border-right: 1px solid rgba(255,255,255,0.05);
          display: flex;
          flex-direction: column;
          padding: 24px 0 20px;
          z-index: 10;
          flex-shrink: 0;
          overflow-y: auto;
        }

        .dp-sidebar-brand {
          display: flex; align-items: center; gap: 10px;
          padding: 0 20px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          margin-bottom: 16px;
        }
        .dp-brand-dot {
          width: 28px; height: 28px; border-radius: 8px;
          background: ${GREEN};
          flex-shrink: 0;
        }
        .dp-brand-name {
          font-size: 1rem; font-weight: 800; color: #fff;
          letter-spacing: -0.02em;
        }

        .dp-sidebar-section-label {
          font-size: 0.58rem; font-weight: 700; color: ${MUTED};
          text-transform: uppercase; letter-spacing: 0.1em;
          padding: 0 20px; margin: 0 0 8px;
        }

        .dp-nav-list {
          list-style: none; margin: 0; padding: 0 8px;
        }
        .dp-nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px; border-radius: 8px;
          font-size: 0.79rem; font-weight: 500; color: ${MUTED};
          text-decoration: none;
          transition: background 0.12s, color 0.12s;
          margin-bottom: 1px;
        }
        .dp-nav-item:hover {
          background: rgba(255,255,255,0.07);
          color: #fff;
        }
        .dp-nav-active {
          background: rgba(74,222,128,0.12) !important;
          color: ${GREEN} !important;
          font-weight: 700;
        }
        .dp-nav-icon { flex-shrink: 0; display: flex; }
        .dp-nav-badge {
          margin-left: auto; font-size: 0.52rem; font-weight: 800;
          background: rgba(74,222,128,0.15); color: ${GREEN};
          border-radius: 4px; padding: 1px 5px; letter-spacing: 0.04em;
        }

        .dp-sidebar-footer {
          padding: 14px 12px 0;
          border-top: 1px solid rgba(255,255,255,0.06);
          margin-top: auto;
        }
        .dp-sys-status {
          display: flex; align-items: center; gap: 7px;
        }
        .dp-sys-label {
          font-size: 0.6rem; font-weight: 600; color: ${MUTED};
        }
        .dp-refresh-mini .dp-progress-track,
        .dp-progress-track {
          width: 100%; height: 2px;
          background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden;
        }
        .dp-user-row {
          display: flex; align-items: center; gap: 9px;
          padding: 8px 10px; border-radius: 8px;
          text-decoration: none;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.03);
          margin-bottom: 8px;
          transition: background 0.12s;
        }
        .dp-user-row:hover { background: rgba(255,255,255,0.07); }
        .dp-user-avatar {
          width: 26px; height: 26px; border-radius: 50%;
          background: ${PLAT}; color: #0a0c10;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.6rem; font-weight: 800; flex-shrink: 0;
        }
        .dp-user-name {
          font-size: 0.78rem; font-weight: 600; color: ${TEXT};
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .dp-cta-btn {
          width: 100%; padding: 9px 0; border-radius: 999px;
          background: ${GREEN}; color: #0a0a0a;
          font-size: 0.8rem; font-weight: 700; border: none;
          cursor: pointer; font-family: inherit;
          transition: opacity 0.15s;
          margin-bottom: 4px;
        }
        .dp-cta-btn:hover { opacity: 0.88; }

        /* ── MAIN CONTENT AREA ───────────────────────────────────────── */
        .dp-main {
          margin-left: 220px;
          flex: 1;
          min-width: 0;
          padding-bottom: 80px;
        }

        /* ── Spotify-dark background ─────────────────────────────────── */
        .dp-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          background: #111318;
          pointer-events: none;
        }
        /* top green gradient bleed like Spotify artist pages */
        .dp-bg::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 80% 38% at 50% -4%,
            rgba(74,222,128,0.13) 0%, transparent 62%);
        }

        /* ── glow orbs ───────────────────────────────────────────────── */
        .dp-glow-tl, .dp-glow-br {
          position: fixed; border-radius: 999px;
          pointer-events: none; z-index: 0;
        }
        .dp-glow-tl {
          width: 480px; height: 480px; top: -60px; left: -100px;
          background: radial-gradient(circle, rgba(74,222,128,0.055) 0%, transparent 68%);
        }
        .dp-glow-br {
          width: 440px; height: 440px; bottom: -80px; right: -80px;
          background: radial-gradient(circle, rgba(74,222,128,0.03) 0%, transparent 68%);
        }

        /* ── content wrap ────────────────────────────────────────────── */
        .dp-wrap {
          position: relative; z-index: 1;
          max-width: 1420px; margin: 0 auto; padding: 0;
        }

        /* ── breadcrumb ──────────────────────────────────────────────── */
        .dp-crumb {
          font-size: 0.62rem; font-weight: 700; color: ${MUTED};
          text-transform: uppercase; letter-spacing: 0.08em;
          margin: 0 0 0; padding: 0 32px 16px;
        }

        /* ── HERO — Spotify artist page — full-width, title bottom-left ─ */
        .dp-hero {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 32px;
          align-items: end;
          min-height: 300px;
          background: linear-gradient(180deg,
            rgba(74,222,128,0.16) 0%,
            rgba(74,222,128,0.06) 60%,
            transparent 100%);
          border-radius: 0;
          padding: 0 32px 36px;
          margin-bottom: 0;
          width: 100%;
        }

        .dp-hero-left { min-width: 0; }

        .dp-status-pill {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 0.6rem; font-weight: 700; letter-spacing: 0.05em;
          text-transform: uppercase; color: ${GREEN};
          margin-bottom: 12px;
        }
        .dp-status-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: ${GREEN};
          animation: plat-pulse 2.4s ease-in-out infinite;
          flex-shrink: 0;
        }

        .dp-h1 {
          font-size: 3.8rem; font-weight: 900; margin: 0; line-height: 0.95;
          letter-spacing: -0.05em; color: #fff;
          text-shadow: 0 4px 32px rgba(0,0,0,0.5);
        }
        .dp-tagline {
          font-size: 0.75rem; color: ${MUTED};
          margin: 10px 0 0; letter-spacing: 0.02em; font-weight: 500;
        }

        /* hero right — refresh control */
        .dp-hero-right {
          display: flex; flex-direction: column;
          align-items: flex-end; gap: 10px; flex-shrink: 0;
          padding-bottom: 4px;
        }
        .dp-btn-refresh {
          display: flex; align-items: center; gap: 7px;
          padding: 12px 24px; border-radius: 999px;
          border: none; background: ${GREEN};
          cursor: pointer; font-size: 0.78rem; font-weight: 700;
          color: #000; font-family: inherit;
          transition: transform 0.12s, background 0.15s;
          letter-spacing: 0.01em;
        }
        .dp-btn-refresh:hover { background: #6ee7a0; transform: scale(1.04); }
        .dp-progress-row { display: flex; align-items: center; gap: 8px; }
        .dp-progress-track {
          width: 72px; height: 2px;
          background: rgba(255,255,255,0.12); border-radius: 2px; overflow: hidden;
        }
        .dp-progress-fill {
          height: 100%; border-radius: 2px;
          background: ${GREEN};
          transition: width 1s linear;
        }
        .dp-time-label { font-size: 0.6rem; color: ${MUTED}; }

        /* hero metrics — below the title */
        .dp-hero-metrics {
          display: flex; gap: 32px; flex-wrap: wrap;
          margin-top: 20px; padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .dp-metric-cell {
          display: flex; flex-direction: column; gap: 2px;
          animation: fade-up 0.4s ease both;
          min-width: 70px;
        }
        .dp-metric-val {
          font-size: 1.7rem; font-weight: 900;
          color: #fff; letter-spacing: -0.05em; line-height: 1;
        }
        .dp-metric-label {
          font-size: 0.56rem; font-weight: 600; color: ${MUTED};
          text-transform: uppercase; letter-spacing: 0.05em;
        }

        /* ── today counters ──────────────────────────────────────────── */
        .dp-counters {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px; margin-bottom: 8px;
          padding: 24px 32px 8px;
        }
        .dp-counter-card {
          background: #1a1d24;
          border-radius: 8px;
          padding: 20px 16px;
          display: flex; flex-direction: column; gap: 6px;
          cursor: default;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: border-color 0.2s, background 0.2s;
        }
        .dp-counter-card:hover {
          background: rgba(255,255,255,0.055);
          border-color: ${PL_BORD};
        }
        .dp-counter-val {
          font-size: 2rem; font-weight: 900; color: ${TEXT};
          letter-spacing: -0.05em; line-height: 1;
          background: linear-gradient(135deg, #fff 0%, ${PLAT} 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .dp-counter-label {
          font-size: 0.57rem; font-weight: 700; color: ${MUTED};
          text-transform: uppercase; letter-spacing: 0.06em;
        }

        /* ── shared card — Spotify solid dark ───────────────────────── */
        .dp-card {
          background: #1a1d24;
          border-radius: 12px;
        }

        /* ── section header — Spotify big bold ───────────────────────── */
        .dp-section-header {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 20px;
        }
        .dp-section-header > span:first-of-type {
          font-size: 1.4rem; font-weight: 800; color: #fff;
          letter-spacing: -0.03em; flex: 1;
        }

        /* ── mid row ─────────────────────────────────────────────────── */
        .dp-mid {
          display: grid;
          grid-template-columns: 300px minmax(0,1fr);
          gap: 8px; margin-bottom: 8px; align-items: start;
          padding: 0 32px;
        }

        /* queue — Spotify track list */
        .dp-queue { padding: 24px 20px; }
        .dp-queue-list { display: flex; flex-direction: column; }
        .dp-queue-row {
          display: flex; align-items: center; gap: 12px;
          border-radius: 6px; padding: 10px 8px;
          transition: background 0.15s;
        }
        .dp-queue-row:hover { background: rgba(255,255,255,0.07); }
        .dp-queue-icon {
          width: 32px; height: 32px; border-radius: 6px; flex-shrink: 0;
          background: rgba(255,255,255,0.06);
          display: flex; align-items: center; justify-content: center;
        }
        .dp-queue-text { flex: 1; min-width: 0; }
        .dp-queue-name { display: block; font-size: 0.82rem; color: #fff; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dp-queue-sub  { display: block; font-size: 0.62rem; color: ${MUTED}; margin-top: 1px; }
        .dp-queue-count { font-size: 1.4rem; font-weight: 900; letter-spacing: -0.04em; flex-shrink: 0; }
        .dp-queue-arrow { display: flex; justify-content: center; padding: 2px 0; }

        /* activity — Spotify feed */
        .dp-activity { padding: 24px 22px; }
        .dp-live-badge {
          font-size: 0.6rem; font-weight: 700;
          padding: 3px 10px; border-radius: 999px;
          background: ${G_DIM}; color: ${GREEN};
          border: 1px solid ${G_BORD};
        }
        .dp-activity-scroll { max-height: 390px; overflow-y: auto; padding-right: 6px; }
        .dp-activity-row { display: flex; gap: 10px; align-items: flex-start; }
        .dp-act-time { font-size: 0.6rem; color: ${MUTED}; flex-shrink: 0; padding-top: 3px; width: 36px; }
        .dp-act-line { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; padding-top: 5px; }
        .dp-act-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .dp-act-connector { width: 1px; flex: 1; min-height: 14px; background: rgba(255,255,255,0.08); margin-top: 4px; }
        .dp-act-body { flex: 1; }
        .dp-act-meta { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
        .dp-act-rel { font-size: 0.58rem; color: ${MUTED}; }
        .dp-act-desc { font-size: 0.8rem; color: #fff; margin: 0; line-height: 1.45; font-weight: 500; }
        .dp-cursor-row { padding: 10px 0 0 46px; }
        .dp-cursor { font-size: 0.72rem; color: ${GREEN}; animation: blink 1.3s step-end infinite; }

        /* ── health — Spotify album card style ───────────────────────── */
        .dp-health-wrap { padding: 24px 32px; margin-bottom: 8px; }
        .dp-health-grid {
          display: grid;
          grid-template-columns: repeat(5,1fr);
          gap: 8px;
        }
        .dp-health-card {
          background: #242730;
          border-radius: 8px; padding: 18px 16px;
          transition: background 0.2s, transform 0.15s;
          cursor: default;
        }
        .dp-health-card:hover { background: #2a2e3a; transform: translateY(-2px); }
        .dp-health-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .dp-health-icon-row { display: flex; align-items: center; gap: 6px; }
        .dp-health-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .dp-health-val { font-size: 2rem; font-weight: 900; margin: 0 0 8px; line-height: 1; letter-spacing: -0.05em; }
        .dp-bar-track { height: 3px; background: rgba(255,255,255,0.10); border-radius: 3px; margin-bottom: 8px; overflow: hidden; }
        .dp-bar-fill { height: 100%; border-radius: 3px; transition: width 1.3s ease; }
        .dp-health-desc { font-size: 0.6rem; color: ${MUTED}; margin: 0; line-height: 1.4; }

        /* ── guardian ────────────────────────────────────────────────── */
        .dp-guardian { padding: 24px 32px; }
        .dp-filter-btn {
          font-size: 0.62rem; font-weight: 700; padding: 4px 12px; border-radius: 999px;
          cursor: pointer; font-family: inherit; transition: all 0.12s;
        }
        .dp-btn-ai {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 999px;
          border: none; background: rgba(255,255,255,0.10);
          cursor: pointer; font-size: 0.7rem; font-weight: 700;
          color: #fff; font-family: inherit; transition: background 0.15s, transform 0.12s;
        }
        .dp-btn-ai:disabled { opacity: 0.5; cursor: not-allowed; }
        .dp-btn-ai:hover:not(:disabled) { background: rgba(255,255,255,0.18); transform: scale(1.03); }
        .dp-ai-box {
          background: #242730;
          border-left: 3px solid ${GREEN};
          border-radius: 0 8px 8px 0;
          padding: 14px 18px; margin-bottom: 16px;
        }
        .dp-ai-label {
          display: block; font-size: 0.58rem; font-weight: 800;
          color: ${GREEN}; text-transform: uppercase; letter-spacing: 0.1em;
          margin-bottom: 7px;
        }
        .dp-ai-text { font-size: 0.78rem; color: #fff; margin: 0; line-height: 1.58; }

        .dp-ev-row {
          border-radius: 8px; padding: 12px 14px;
          border-left-width: 3px; border-left-style: solid;
          border-top: none; border-right: none; border-bottom: none;
          background: #242730;
          display: flex; align-items: flex-start; gap: 12px;
          transition: background 0.15s;
        }
        .dp-ev-row:hover { background: #2a2e3a; }
        .dp-ev-meta { display: flex; align-items: center; gap: 7px; margin-bottom: 4px; flex-wrap: wrap; }
        .dp-ev-msg { font-size: 0.78rem; color: #fff; margin: 0; line-height: 1.45; font-weight: 500; }
        .dp-btn-resolve {
          flex-shrink: 0; padding: 6px 14px; border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.2); background: transparent;
          cursor: pointer; font-size: 0.65rem; font-weight: 700;
          color: #fff; font-family: inherit; white-space: nowrap;
          transition: background 0.12s, border-color 0.12s, transform 0.1s;
        }
        .dp-btn-resolve:hover:not(:disabled) { background: rgba(255,255,255,0.12); transform: scale(1.04); }

        /* ── shared utils ────────────────────────────────────────────── */
        .dp-tag {
          font-size: 0.56rem; font-weight: 700;
          padding: 2px 8px; border-radius: 4px;
          letter-spacing: 0.04em;
        }
        .dp-label-xs {
          font-size: 0.6rem; color: ${MUTED}; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.06em;
        }
        .dp-mono { font-family: monospace; }
        .dp-empty {
          display: flex; flex-direction: column; align-items: center;
          gap: 10px; padding: 40px 0; color: ${MUTED}; font-size: 0.8rem;
          text-align: center;
        }
        .dp-empty-text { color: ${MUTED}; font-size: 0.8rem; padding: 16px 0; margin: 0; }
        .dp-skeleton {
          background: rgba(255,255,255,0.04);
          border-radius: 8px;
          animation: dp-skeleton 1.6s ease-in-out infinite;
        }
        .dp-counter-card.dp-skeleton { height: 84px; }
        .dp-metric-cell.dp-skeleton  { min-width: 70px; height: 52px; border-radius: 6px; }
        .dp-health-card.dp-skeleton  { height: 110px; }

        /* ── animations ──────────────────────────────────────────────── */
        @keyframes plat-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.6), 0 0 8px rgba(74,222,128,0.3); }
          50%      { box-shadow: 0 0 0 7px rgba(74,222,128,0), 0 0 14px rgba(74,222,128,0.1); }
        }
        @keyframes blink {
          0%,100% { opacity:1; } 50% { opacity:0; }
        }
        @keyframes dp-skeleton {
          0%,100% { opacity:0.5; } 50% { opacity:0.25; }
        }
        @keyframes fade-up {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }

        /* ── responsive ──────────────────────────────────────────────── */
        @media (max-width: 1100px) {
          .dp-hero { grid-template-columns: 1fr; }
          .dp-hero-right { align-items: flex-start; flex-direction: row; flex-wrap: wrap; gap: 12px; }
          .dp-health-grid { grid-template-columns: repeat(3,1fr); }
        }
        @media (max-width: 1100px) {
          .dp-health-grid { grid-template-columns: repeat(3,1fr); }
        }
        @media (max-width: 900px) {
          .dp-sidebar { display: none; }
          .dp-main { margin-left: 0; }
          .dp-mid { grid-template-columns: 1fr; }
        }
        @media (max-width: 700px) {
          .dp-h1 { font-size: 2.2rem; }
          .dp-hero { padding: 0 16px 28px; min-height: 220px; }
          .dp-crumb { padding: 0 16px 12px; }
          .dp-counters { grid-template-columns: repeat(3,1fr); padding: 16px 16px 8px; }
          .dp-mid { padding: 0 16px; }
          .dp-health-wrap { padding: 20px 16px; }
          .dp-health-grid { grid-template-columns: repeat(2,1fr); }
          .dp-guardian { padding: 20px 16px; }
          .dp-hero-metrics { flex-wrap: wrap; gap: 16px; }
        }

      `}</style>
    </div>
  )
}
