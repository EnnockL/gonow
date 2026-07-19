'use client'

import { useEffect, useState, useCallback } from 'react'
import { ArrowRight, CheckCircle2, MapPin, Package, RefreshCw, Sparkles, Truck, Weight, X } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

interface Opportunity {
  id: string
  from_city: string
  to_city: string
  departure_date: string
  departure_time: string
  package_count: number
  total_weight: number
  estimated_gmv: number
  recommended_vehicle: string
  status: string
  ai_reason: string
  accepted_by_provider_id: string | null
  accepted_at: string | null
  created_at: string
}

interface PickupStop {
  package_id: string
  pickup_address: string | null
  from_city: string
  to_city: string
  weight_kg: number
  description: string | null
  suggested_order: number
}

interface PickupPlan {
  opportunity: Opportunity
  stops: PickupStop[]
}

const WEEKDAYS = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

const VEHICLE_ICON: Record<string, string> = {
  'skåpbil': '🚐',
  'lätt lastbil': '🚚',
  'lastbil': '🏗️',
}

export default function LogisticsOpportunitiesPage() {
  const { userId } = useAuth()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [pickupPlan, setPickupPlan] = useState<PickupPlan | null>(null)
  const [loadingPlan, setLoadingPlan] = useState(false)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/logistics/opportunities')
      const data = await res.json()
      setOpportunities(data.opportunities ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAccept(oppId: string) {
    if (!userId) return
    setAcceptingId(oppId)
    try {
      const res = await fetch(`/api/logistics/opportunities/${oppId}/accept`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: userId }),
      })
      const data = await res.json()
      if (res.ok) {
        setOpportunities(prev => prev.map(o => o.id === oppId ? { ...o, ...data.opportunity } : o))
        showToast('Uppdrag accepterat — paket tilldelade logistikföretag.')
      } else {
        showToast(data.error ?? 'Något gick fel.')
      }
    } finally {
      setAcceptingId(null)
    }
  }

  async function handleShowPlan(oppId: string) {
    setLoadingPlan(true)
    try {
      const res = await fetch(`/api/logistics/opportunities/${oppId}/pickup-plan`)
      const data = await res.json()
      if (res.ok) {
        setPickupPlan(data)
      } else {
        showToast(data.error ?? 'Kunde inte hämta upphämtningsplan.')
      }
    } finally {
      setLoadingPlan(false)
    }
  }

  async function generate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/logistics/opportunities/generate', { method: 'POST' })
      const data = await res.json()
      if (data.created > 0) {
        await load()
        showToast(`${data.created} ny${data.created > 1 ? 'a' : ''} logistikmöjlighet${data.created > 1 ? 'er' : ''} skapad${data.created > 1 ? 'e' : ''}.`)
      } else {
        showToast('Inga nya möjligheter — behöver fler bokade paket per avgång (minst 5).')
      }
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-gradient)', paddingTop: 88, paddingBottom: 80 }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 20000, background: '#0a0a0a', color: '#fff', padding: '12px 22px', borderRadius: 999, fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,0.28)', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--gn)' }}>✓</span> {toast}
        </div>
      )}

      {pickupPlan && (
        <PickupPlanModal plan={pickupPlan} onClose={() => setPickupPlan(null)} />
      )}

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px' }}>
        {/* Breadcrumb + header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '0 0 6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <Link href="/admin" style={{ color: 'inherit', textDecoration: 'none' }}>Admin</Link>
            {' / '}
            <Link href="/admin/logistics" style={{ color: 'inherit', textDecoration: 'none' }}>Logistik</Link>
            {' / '}
            Möjligheter
          </p>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text)', margin: '0 0 6px', letterSpacing: '-0.03em' }}>
            Logistikmöjligheter
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: 0 }}>
            När en planerad avgång har tillräckligt många bokade paket skapar AI en möjlighet för logistikföretag.
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
          <button
            onClick={load}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', fontFamily: 'inherit' }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Uppdatera
          </button>
          <button
            onClick={generate}
            disabled={generating}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 10, border: 'none', background: 'var(--accent)', cursor: generating ? 'not-allowed' : 'pointer', fontSize: '0.82rem', fontWeight: 700, color: '#0a0a0a', fontFamily: 'inherit', opacity: generating ? 0.7 : 1 }}
          >
            <Sparkles size={13} />
            {generating ? 'Analyserar…' : 'Generera möjligheter'}
          </button>
        </div>

        {/* Summary stats */}
        {opportunities.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
            {[
              { label: 'Möjligheter totalt', value: opportunities.length, bg: 'var(--gn-008)', border: 'var(--gn-020)' },
              { label: 'Totalt paket', value: opportunities.reduce((s, o) => s + o.package_count, 0), bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
              { label: 'Potentiell GMV (kr)', value: opportunities.reduce((s, o) => s + o.estimated_gmv, 0).toLocaleString('sv-SE'), bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 14, padding: '16px 18px' }}>
                <p style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text)', margin: 0, lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: '4px 0 0', fontWeight: 500 }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Laddar…</div>
        ) : opportunities.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 18, padding: '48px 24px', textAlign: 'center' }}>
            <Truck size={36} style={{ color: 'var(--muted)', marginBottom: 14 }} />
            <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>Inga logistikmöjligheter ännu</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0 0 18px' }}>
              Minst 5 paket måste vara bokade på samma avgång. Kör AI-analysen för att skapa möjligheter.
            </p>
            <button
              onClick={generate}
              disabled={generating}
              style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#0a0a0a', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}
            >
              {generating ? 'Analyserar…' : 'Generera nu'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {opportunities.map(opp => (
              <OpportunityCard
                key={opp.id}
                opp={opp}
                accepting={acceptingId === opp.id}
                loadingPlan={loadingPlan}
                onAccept={() => handleAccept(opp.id)}
                onShowPlan={() => handleShowPlan(opp.id)}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function OpportunityCard({
  opp,
  accepting,
  loadingPlan,
  onAccept,
  onShowPlan,
}: {
  opp: Opportunity
  accepting: boolean
  loadingPlan: boolean
  onAccept: () => void
  onShowPlan: () => void
}) {
  const vehicleIcon = VEHICLE_ICON[opp.recommended_vehicle] ?? '🚐'
  const isAccepted = opp.status === 'accepted'

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1.5px solid ${isAccepted ? 'rgba(59,130,246,0.35)' : 'var(--gn-020)'}`,
      borderRadius: 18, padding: '20px 22px',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Route + date + status badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <p style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>{opp.from_city}</p>
            <ArrowRight size={14} color="var(--muted)" />
            <p style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>{opp.to_city}</p>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '3px 0 0', fontWeight: 500 }}>
            {fmtDate(opp.departure_date)} kl. {opp.departure_time}
          </p>
        </div>
        {isAccepted ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: 'rgba(59,130,246,0.1)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.25)', flexShrink: 0 }}>
            <CheckCircle2 size={12} /> Accepterat
          </span>
        ) : (
          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: 'var(--gn-010)', color: 'var(--gn-dk)', border: '1px solid var(--gn-020)', flexShrink: 0 }}>
            Öppen
          </span>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { icon: <Package size={13} />, label: 'Paket', value: opp.package_count },
          { icon: <Weight size={13} />, label: 'Vikt', value: `${opp.total_weight} kg` },
          { icon: <span style={{ fontSize: '0.85rem' }}>kr</span>, label: 'Est. GMV', value: `${opp.estimated_gmv.toLocaleString('sv-SE')} kr` },
          { icon: <span style={{ fontSize: '0.85rem' }}>{vehicleIcon}</span>, label: 'Fordon', value: opp.recommended_vehicle },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--muted)', marginBottom: 4 }}>
              {s.icon}
              <span style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
            </div>
            <p style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* AI reason */}
      <p style={{ fontSize: '0.76rem', color: 'var(--muted)', margin: 0, lineHeight: 1.5, fontStyle: 'italic', borderLeft: '2px solid var(--gn-020)', paddingLeft: 10 }}>
        {opp.ai_reason}
      </p>

      {/* Actions */}
      {isAccepted ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)' }}>
            <CheckCircle2 size={15} color="#2563eb" />
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#2563eb' }}>
              Uppdrag accepterat{opp.accepted_at ? ` · ${new Date(opp.accepted_at).toLocaleDateString('sv-SE')}` : ''}
            </span>
          </div>
          <button
            onClick={onShowPlan}
            disabled={loadingPlan}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '11px', borderRadius: 12,
              border: '1.5px solid rgba(59,130,246,0.3)',
              background: 'rgba(59,130,246,0.06)',
              color: '#2563eb', fontWeight: 700, fontSize: '0.85rem',
              cursor: loadingPlan ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', opacity: loadingPlan ? 0.6 : 1,
            }}
          >
            <MapPin size={15} />
            {loadingPlan ? 'Hämtar plan…' : 'Visa upphämtningsplan'}
          </button>
        </div>
      ) : (
        <button
          onClick={onAccept}
          disabled={accepting}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '12px', borderRadius: 12, border: 'none',
            background: accepting ? 'var(--surface-2)' : 'var(--accent)',
            color: accepting ? 'var(--muted)' : '#0a0a0a',
            fontWeight: 700, fontSize: '0.88rem',
            cursor: accepting ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <CheckCircle2 size={15} />
          {accepting ? 'Accepterar…' : 'Acceptera uppdrag'}
        </button>
      )}
    </div>
  )
}

function PickupPlanModal({ plan, onClose }: { plan: PickupPlan; onClose: () => void }) {
  const { opportunity: opp, stops } = plan
  const totalWeight = stops.reduce((s, st) => s + (st.weight_kg ?? 0), 0)

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 0 0' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--surface)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <MapPin size={15} color="var(--gn-dk)" />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gn-dk)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Upphämtningsplan</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em' }}>{opp.from_city}</span>
              <ArrowRight size={13} color="var(--muted)" />
              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em' }}>{opp.to_city}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ padding: 8, borderRadius: 10, border: 'none', background: 'var(--surface-2)', cursor: 'pointer', display: 'flex', color: 'var(--muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Summary */}
        <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {[
            { label: 'Stopp', value: stops.length },
            { label: 'Total vikt', value: `${Math.round(totalWeight * 10) / 10} kg` },
            { label: 'Avgång', value: `${new Date(opp.departure_date).toLocaleDateString('sv-SE')} kl. ${opp.departure_time}` },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px' }}>
              <p style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text)', margin: 0, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: '0.65rem', color: 'var(--muted)', margin: '3px 0 0', fontWeight: 500 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Stops list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 22px 28px' }}>
          {stops.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center', padding: '32px 0' }}>
              Inga paket hittades för denna avgång.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {stops.map((stop, idx) => (
                <div key={stop.package_id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {/* Timeline */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 2 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'var(--gn-010)', border: '2px solid var(--gn-025)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.72rem', fontWeight: 800, color: 'var(--gn-dk)',
                      flexShrink: 0,
                    }}>
                      {stop.suggested_order}
                    </div>
                    {idx < stops.length - 1 && (
                      <div style={{ width: 2, flex: 1, minHeight: 24, background: 'var(--border)', marginTop: 4, marginBottom: 4 }} />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, paddingBottom: idx < stops.length - 1 ? 16 : 0 }}>
                    <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <MapPin size={12} color="var(--muted)" />
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>
                            {stop.pickup_address ?? stop.from_city}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--muted)', background: 'var(--surface)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0 }}>
                          {stop.weight_kg ?? 0} kg
                        </span>
                      </div>
                      {stop.pickup_address && stop.pickup_address !== stop.from_city && (
                        <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: 0 }}>{stop.from_city}</p>
                      )}
                      {stop.description && (
                        <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: 0, fontStyle: 'italic' }}>{stop.description}</p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Package size={11} color="var(--muted)" />
                        <span style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'monospace' }}>
                          #{stop.package_id.slice(0, 8)}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>→ {stop.to_city}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 20, textAlign: 'center', lineHeight: 1.5 }}>
            MVP-sortering: paket sorterade efter stad och adress. Google Maps-optimering kommer i nästa steg.
          </p>
        </div>
      </div>
    </div>
  )
}
