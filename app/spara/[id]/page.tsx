'use client'

import { use, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Circle, Loader2, MapPin, Package, User } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Order, OrderStatus } from '@/lib/types'

const STEPS: { status: OrderStatus; label: string; desc: string }[] = [
  { status: 'pending',    label: 'Accepterad',  desc: 'Bärare har accepterat uppdraget' },
  { status: 'matched',    label: 'Betald',       desc: 'Betalning bekräftad' },
  { status: 'picked_up',  label: 'Upphämtad',   desc: 'Paketet är hämtat av bäraren' },
  { status: 'in_transit', label: 'På väg',       desc: 'Leveransen är i transit' },
  { status: 'delivered',  label: 'Levererad',    desc: 'Framme hos mottagaren' },
  { status: 'confirmed',  label: 'Bekräftad',    desc: 'Mottagaren har bekräftat leveransen' },
]

const STATUS_ORDER: OrderStatus[] = ['pending', 'matched', 'picked_up', 'in_transit', 'delivered', 'confirmed']

const STATUS_COLOR: Partial<Record<OrderStatus, { bg: string; color: string; dot: string }>> = {
  pending:    { bg: 'rgba(245,158,11,0.08)',  color: '#b45309', dot: '#f59e0b' },
  matched:    { bg: 'rgba(34,197,94,0.08)',   color: '#15803d', dot: '#22c55e' },
  picked_up:  { bg: 'rgba(124,58,237,0.08)',  color: '#7c3aed', dot: '#7c3aed' },
  in_transit: { bg: 'rgba(14,165,233,0.08)',  color: '#0369a1', dot: '#0ea5e9' },
  delivered:  { bg: 'rgba(34,197,94,0.08)',   color: '#15803d', dot: '#22c55e' },
  confirmed:  { bg: 'rgba(34,197,94,0.08)',   color: '#15803d', dot: '#22c55e' },
  cancelled:  { bg: 'rgba(239,68,68,0.08)',   color: '#dc2626', dot: '#ef4444' },
  disputed:   { bg: 'rgba(239,68,68,0.08)',   color: '#dc2626', dot: '#ef4444' },
}

function timeAgo(ts: string) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return 'just nu'
  if (diff < 3600) return `${Math.floor(diff / 60)} min sedan`
  if (diff < 86400) return `${Math.floor(diff / 3600)} tim sedan`
  return `${Math.floor(diff / 86400)} dag(ar) sedan`
}

export default function SparaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const [order, setOrder] = useState<Order & { trips?: { from_city: string; to_city: string; departure_at: string; carrier_id: string } | null } | null>(null)
  const [carrier, setCarrier] = useState<{ name: string } | null>(null)
  const [sender, setSender] = useState<{ name: string } | null>(null)
  const [recipient, setRecipient] = useState<{ name: string; phone?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString())
  const paymentState = searchParams.get('payment')

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    async function fetchOrder() {
      // Use API route (service client) to bypass RLS — works for both sender and carrier
      const res = await fetch(`/api/orders/${id}`).catch(() => null)
      if (!mounted) return
      if (res?.ok) {
        const json = await res.json()
        if (json.order) {
          setOrder(json.order)
          setLastUpdated(new Date().toISOString())
          if (json.carrier) setCarrier(json.carrier)
          if (json.sender) setSender(json.sender)
          if (json.recipient) setRecipient(json.recipient)
        }
      }
      setLoading(false)
    }

    fetchOrder()

    // Realtime updates
    const channel = supabase
      .channel(`order:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, (payload: { new: Partial<Order> }) => {
        setOrder((prev) => prev ? { ...prev, ...payload.new } : null)
        setLastUpdated(new Date().toISOString())
      })
      .subscribe()

    const pollId = window.setInterval(fetchOrder, 10000)

    return () => {
      mounted = false
      window.clearInterval(pollId)
      supabase.removeChannel(channel)
    }
  }, [id])

  async function handleConfirm() {
    setConfirming(true)
    setConfirmError(null)
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Kunde inte bekräfta leveransen.')
      setOrder((prev) => prev ? { ...prev, ...data.order } : prev)
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : 'Kunde inte bekräfta.')
    } finally {
      setConfirming(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
    </div>
  )

  if (!order) return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--muted)' }}>Order hittades inte.</p>
    </div>
  )

  const currentIdx = STATUS_ORDER.indexOf(order.status)
  const statusStyle = STATUS_COLOR[order.status] ?? STATUS_COLOR.pending!
  const currentStep = STEPS.find(s => s.status === order.status)

  return (
    <div style={{ minHeight: '100vh', padding: '96px 24px 60px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
            Spårning · #{id.slice(0, 8).toUpperCase()}
          </p>
          <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            {order.pickup_address} → {order.dropoff_address}
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 6 }}>
            Uppdateras automatiskt · senast {timeAgo(lastUpdated)}
          </p>
        </div>

        {/* Payment banners */}
        {paymentState === 'success' && (
          <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 14, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <p style={{ fontWeight: 700, color: '#15803d', marginBottom: 4 }}>Betalningen gick igenom</p>
            <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Bäraren kan nu starta uppdraget.</p>
          </div>
        )}
        {paymentState === 'cancelled' && (
          <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 14, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <p style={{ fontWeight: 700, color: '#b45309', marginBottom: 4 }}>Betalningen avbröts</p>
            <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Gå till Mina sidor och starta betalningen igen.</p>
          </div>
        )}

        {/* Two-column grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>

          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Live status */}
            <div style={{ padding: '20px 24px', borderRadius: 18, background: statusStyle.bg, border: `1.5px solid ${statusStyle.dot}44`, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: statusStyle.dot, flexShrink: 0, boxShadow: `0 0 0 5px ${statusStyle.dot}33`, animation: ['delivered','confirmed','cancelled'].includes(order.status) ? 'none' : 'pulse 2s infinite' }} />
              <div>
                <p style={{ fontWeight: 800, fontSize: '1.15rem', color: statusStyle.color, margin: 0 }}>{currentStep?.label ?? order.status}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 3 }}>{currentStep?.desc}</p>
              </div>
            </div>

            {/* Map placeholder */}
            <div style={{ height: 280, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <MapPin size={36} color="var(--accent)" />
              <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>Live-karta</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: 0 }}>Aktiveras när bäraren startar resan</p>
            </div>

            {/* Timeline */}
            <div style={{ padding: '22px 24px', borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 22, fontSize: '0.92rem' }}>Leveranshistorik</p>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {STEPS.map((step, i) => {
                  const stepIdx = STATUS_ORDER.indexOf(step.status)
                  const done = stepIdx < currentIdx
                  const active = stepIdx === currentIdx
                  const isLast = i === STEPS.length - 1
                  return (
                    <div key={step.status} style={{ display: 'flex', gap: 14 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? '#22c55e' : active ? 'var(--accent)' : 'var(--surface-2)', border: `2px solid ${done ? '#22c55e' : active ? 'var(--accent)' : 'var(--border)'}` }}>
                          {done ? <CheckCircle2 size={14} color="#fff" /> : active ? <Loader2 size={13} color="#fff" style={{ animation: 'spin 1s linear infinite' }} /> : <Circle size={13} color="var(--border)" />}
                        </div>
                        {!isLast && <div style={{ width: 2, flex: 1, minHeight: 26, background: done ? '#22c55e' : 'var(--border)', margin: '4px 0' }} />}
                      </div>
                      <div style={{ paddingBottom: isLast ? 0 : 22 }}>
                        <p style={{ fontSize: '0.9rem', fontWeight: done || active ? 700 : 500, color: done || active ? 'var(--text)' : 'var(--muted)', margin: 0 }}>{step.label}</p>
                        <p style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: 2 }}>{step.desc}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Order info */}
            <div style={{ padding: '20px 22px', borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.92rem', margin: 0 }}>Orderdetaljer</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0 }}>Paket</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Package size={13} color="var(--accent)" />
                    <p style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.85rem', margin: 0 }}>{order.description || 'Paket'}</p>
                  </div>
                </div>
                {order.weight_kg ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0 }}>Vikt</p>
                    <p style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.85rem', margin: 0 }}>{order.weight_kg} kg</p>
                  </div>
                ) : null}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0 }}>Pris</p>
                  <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem', margin: 0 }}>{order.price} kr</p>
                </div>
                <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Avsändare', name: sender?.name, phone: undefined },
                    { label: 'Bärare', name: carrier?.name, phone: undefined },
                    { label: 'Mottagare', name: recipient?.name, phone: recipient?.phone },
                  ].map(({ label, name, phone }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0 }}>{label}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <User size={13} color="var(--muted)" />
                          <p style={{ fontWeight: 600, color: name ? 'var(--text)' : 'var(--muted)', fontSize: '0.85rem', margin: 0 }}>{name ?? '–'}</p>
                        </div>
                        {phone && <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: 0 }}>{phone}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Confirm / confirmed / cancelled */}
            {order.status === 'delivered' && (
              <div style={{ padding: '20px 22px', borderRadius: 18, background: 'rgba(34,197,94,0.06)', border: '1.5px solid rgba(34,197,94,0.25)' }}>
                <p style={{ fontWeight: 700, color: '#15803d', marginBottom: 6, fontSize: '0.95rem' }}>Paketet är levererat!</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 16 }}>Bekräfta att du tagit emot paketet för att frigöra bärarens betalning.</p>
                {confirmError && <p style={{ fontSize: '0.78rem', color: '#dc2626', marginBottom: 10 }}>{confirmError}</p>}
                <button onClick={handleConfirm} disabled={confirming} style={{ width: '100%', padding: '13px 18px', borderRadius: 12, border: 'none', background: '#15803d', color: '#fff', fontFamily: 'inherit', fontWeight: 800, fontSize: '0.9rem', cursor: confirming ? 'not-allowed' : 'pointer', opacity: confirming ? 0.7 : 1 }}>
                  {confirming ? 'Bekräftar...' : 'Bekräfta leverans'}
                </button>
              </div>
            )}

            {order.status === 'confirmed' && (
              <div style={{ padding: '18px 22px', borderRadius: 18, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <CheckCircle2 size={22} color="#15803d" />
                <div>
                  <p style={{ fontWeight: 700, color: '#15803d', margin: 0 }}>Leverans bekräftad</p>
                  <p style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: 2 }}>Bärarens betalning frigörs nu.</p>
                </div>
              </div>
            )}

            {order.status === 'cancelled' && (
              <div style={{ padding: '18px 22px', borderRadius: 18, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <p style={{ fontWeight: 700, color: '#dc2626', margin: 0 }}>Order avbruten</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
