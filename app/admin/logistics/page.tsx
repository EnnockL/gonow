'use client'

import { useEffect, useState, useCallback } from 'react'
import { Package, ArrowRight, Clock, Users, CheckCircle2, RefreshCw } from 'lucide-react'
import Link from 'next/link'

interface PkgRow {
  id: string
  from_city: string
  to_city: string
  description: string
  weight_kg: number
  price_ceiling: number
  deadline: string
  dispatcher_stage: string | null
  logistics_offer_expires_at: string | null
  fallback_opened_at: string | null
  created_at: string
}

const STAGE_META: Record<string, { label: string; color: string; bg: string }> = {
  logistics_first:        { label: 'Logistik först',         color: '#d97706', bg: 'rgba(251,191,36,0.12)' },
  private_fallback:       { label: 'Öppen för privatförare', color: 'var(--gn-dk)', bg: 'var(--gn-008)' },
  waiting_next_departure: { label: 'Väntar nästa avgång',   color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  matched:                { label: 'Matchad',                color: '#2563eb', bg: 'rgba(59,130,246,0.08)' },
  cancelled:              { label: 'Avbruten',               color: '#dc2626', bg: 'rgba(239,68,68,0.07)' },
}

function timeLeft(iso: string | null) {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'Utgånget'
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min} min kvar`
  return `${Math.floor(min / 60)} tim kvar`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

export default function LogisticsAdminPage() {
  const [allPackages, setAllPackages] = useState<PkgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch('/api/packages?stage=logistics_first'),
        fetch('/api/packages?stage=private_fallback'),
        fetch('/api/packages?stage=waiting_next_departure'),
      ])
      const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()])
      setAllPackages([
        ...(d1.packages ?? []),
        ...(d2.packages ?? []),
        ...(d3.packages ?? []),
      ])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function openForPrivate(pkgId: string) {
    setOpeningId(pkgId)
    try {
      const res = await fetch(`/api/packages/${pkgId}/dispatcher`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatcher_stage: 'private_fallback' }),
      })
      if (res.ok) {
        setAllPackages(prev => prev.map(p => p.id === pkgId
          ? { ...p, dispatcher_stage: 'private_fallback', fallback_opened_at: new Date().toISOString() }
          : p
        ))
        showToast('Paketet är nu öppet för privatförare.')
      } else {
        const err = await res.json().catch(() => ({}))
        showToast(err.error ?? 'Något gick fel.')
      }
    } finally {
      setOpeningId(null)
    }
  }

  const byStage = (stage: string) => allPackages.filter(p => (p.dispatcher_stage ?? 'logistics_first') === stage)

  const logisticsFirst = byStage('logistics_first')
  const privateFallback = byStage('private_fallback')
  const waiting = byStage('waiting_next_departure')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-gradient)', paddingTop: 88, paddingBottom: 80 }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 20000, background: '#0a0a0a', color: '#fff', padding: '12px 22px', borderRadius: 999, fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,0.28)', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--gn)' }}>✓</span> {toast}
        </div>
      )}

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <Link href="/admin" style={{ color: 'inherit', textDecoration: 'none' }}>Admin</Link> / Logistik
            </p>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text)', margin: '0 0 8px', letterSpacing: '-0.03em' }}>AI Dispatcher</h1>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href="/admin/logistics/opportunities" style={{ fontSize: '0.75rem', fontWeight: 700, padding: '5px 12px', borderRadius: 8, background: 'var(--gn-010)', border: '1px solid var(--gn-025)', color: 'var(--gn-dk)', textDecoration: 'none', display: 'inline-block' }}>
                Logistikmöjligheter →
              </Link>
              <Link href="/admin/dispatcher" style={{ fontSize: '0.75rem', fontWeight: 700, padding: '5px 12px', borderRadius: 8, background: 'var(--gn-010)', border: '1px solid var(--gn-025)', color: 'var(--gn-dk)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gn)', display: 'inline-block' }} />
                Dispatcher Dashboard →
              </Link>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'inherit' }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Uppdatera
          </button>
        </div>

        {/* Stage summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
          {[
            { label: 'Logistik först', count: logisticsFirst.length, icon: <Package size={18} />, color: '#d97706', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
            { label: 'Privat fallback', count: privateFallback.length, icon: <Users size={18} />, color: 'var(--gn-dk)', bg: 'var(--gn-008)', border: 'var(--gn-020)' },
            { label: 'Väntar avgång', count: waiting.length, icon: <Clock size={18} />, color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.2)' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ color: s.color }}>{s.icon}</div>
              <div>
                <p style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text)', margin: 0, lineHeight: 1 }}>{s.count}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '3px 0 0', fontWeight: 500 }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Logistics first section */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', display: 'inline-block' }} />
            Logistik först
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '0 0 16px' }}>
            Dessa paket erbjuds först till logistikföretag. Om ingen accepterar öppnas de för privatförare.
          </p>
          {loading ? (
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Laddar…</div>
          ) : logisticsFirst.length === 0 ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem' }}>
              Inga paket i logistik-kö
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {logisticsFirst.map(pkg => (
                <PackageDispatchRow
                  key={pkg.id}
                  pkg={pkg}
                  onOpenPrivate={() => openForPrivate(pkg.id)}
                  opening={openingId === pkg.id}
                />
              ))}
            </div>
          )}
        </section>

        {/* Private fallback section */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gn)', display: 'inline-block' }} />
            Öppnad för privatförare
          </h2>
          {loading ? null : privateFallback.length === 0 ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem' }}>
              Inga paket i privat-kö
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {privateFallback.map(pkg => (
                <PackageDispatchRow key={pkg.id} pkg={pkg} />
              ))}
            </div>
          )}
        </section>

        {waiting.length > 0 && (
          <section>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6b7280', display: 'inline-block' }} />
              Väntar nästa avgång
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {waiting.map(pkg => (
                <PackageDispatchRow key={pkg.id} pkg={pkg} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function PackageDispatchRow({
  pkg,
  onOpenPrivate,
  opening,
}: {
  pkg: PkgRow
  onOpenPrivate?: () => void
  opening?: boolean
}) {
  const stage = pkg.dispatcher_stage ?? 'logistics_first'
  const meta = STAGE_META[stage] ?? STAGE_META.logistics_first
  const tLeft = stage === 'logistics_first' ? timeLeft(pkg.logistics_offer_expires_at) : null

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            {pkg.from_city} <ArrowRight size={12} style={{ display: 'inline', color: 'var(--muted)' }} /> {pkg.to_city}
          </p>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: meta.bg, color: meta.color }}>
            {meta.label}
          </span>
        </div>
        <p style={{ fontSize: '0.76rem', color: 'var(--muted)', margin: '4px 0 0' }}>
          {pkg.description} · {pkg.weight_kg} kg · {pkg.price_ceiling} kr
          {tLeft && <span style={{ marginLeft: 10, color: '#d97706', fontWeight: 600 }}><Clock size={10} style={{ display: 'inline', marginRight: 3 }} />{tLeft}</span>}
          {pkg.fallback_opened_at && stage === 'private_fallback' && (
            <span style={{ marginLeft: 10 }}>Öppnad {fmtDate(pkg.fallback_opened_at)}</span>
          )}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        {onOpenPrivate && stage === 'logistics_first' && (
          <button
            onClick={onOpenPrivate}
            disabled={opening}
            style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#0a0a0a', fontSize: '0.8rem', fontWeight: 700, cursor: opening ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: opening ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            {opening ? 'Öppnar…' : <><CheckCircle2 size={13} /> Öppna för privatförare</>}
          </button>
        )}
      </div>
    </div>
  )
}
