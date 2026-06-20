'use client'

import { use, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  CheckCircle2,
  Circle,
  Clock3,
  Loader2,
  MapPin,
  Package,
  ShieldCheck,
  Truck,
  User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Order, OrderStatus } from '@/lib/types'

const STEPS: { status: OrderStatus; label: string; desc: string }[] = [
  { status: 'pending', label: 'Accepterad', desc: 'Bäraren har accepterat uppdraget' },
  { status: 'matched', label: 'Betald', desc: 'Betalning bekräftad' },
  { status: 'picked_up', label: 'Upphämtad', desc: 'Paketet är hämtat av bäraren' },
  { status: 'in_transit', label: 'På väg', desc: 'Leveransen är i transit' },
  { status: 'delivered', label: 'Levererad', desc: 'Framme hos mottagaren' },
  { status: 'confirmed', label: 'Bekräftad', desc: 'Mottagaren har bekräftat leveransen' },
]

const STATUS_ORDER: OrderStatus[] = ['pending', 'matched', 'picked_up', 'in_transit', 'delivered', 'confirmed']

const STATUS_COLOR: Partial<Record<OrderStatus, { bg: string; color: string; dot: string }>> = {
  pending: { bg: 'rgba(245,158,11,0.08)', color: '#b45309', dot: '#f59e0b' },
  matched: { bg: 'rgba(34,197,94,0.08)', color: '#15803d', dot: '#22c55e' },
  picked_up: { bg: 'rgba(124,58,237,0.08)', color: '#7c3aed', dot: '#7c3aed' },
  in_transit: { bg: 'rgba(14,165,233,0.08)', color: '#0369a1', dot: '#0ea5e9' },
  delivered: { bg: 'rgba(34,197,94,0.08)', color: '#15803d', dot: '#22c55e' },
  confirmed: { bg: 'rgba(34,197,94,0.08)', color: '#15803d', dot: '#22c55e' },
  cancelled: { bg: 'rgba(239,68,68,0.08)', color: '#dc2626', dot: '#ef4444' },
  disputed: { bg: 'rgba(239,68,68,0.08)', color: '#dc2626', dot: '#ef4444' },
}

function timeAgo(ts: string) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return 'just nu'
  if (diff < 3600) return `${Math.floor(diff / 60)} min sedan`
  if (diff < 86400) return `${Math.floor(diff / 3600)} tim sedan`
  return `${Math.floor(diff / 86400)} dagar sedan`
}

function nextStepCopy(status: OrderStatus) {
  switch (status) {
    case 'pending':
      return 'Väntar på att kunden slutför betalningen innan uppdraget går vidare.'
    case 'matched':
      return 'Betalningen är klar. Nu kan bäraren starta uppdraget.'
    case 'picked_up':
      return 'Paketet är upphämtat och redo att markeras som på väg.'
    case 'in_transit':
      return 'Leveransen är aktiv. Här kommer senare ETA och GPS att kunna visas.'
    case 'delivered':
      return 'Inväntar att mottagaren bekräftar leveransen så att utbetalningen kan frigöras.'
    case 'confirmed':
      return 'Flödet är helt klart. Den här sidan fungerar nu som ett kvitto över hela leveransen.'
    case 'cancelled':
      return 'Ordern är avbruten och kommer inte att fortsätta till payout.'
    default:
      return 'Status uppdateras löpande här.'
  }
}

function statusProgress(status: OrderStatus) {
  const idx = STATUS_ORDER.indexOf(status)
  if (idx < 0) return 8
  return Math.max(8, Math.min(100, Math.round(((idx + 1) / STATUS_ORDER.length) * 100)))
}

function etaLabel(status: OrderStatus) {
  switch (status) {
    case 'pending':
      return 'Invantar betalning'
    case 'matched':
      return 'Kan starta idag'
    case 'picked_up':
      return 'Ca 1-2 h till nästa steg'
    case 'in_transit':
      return 'ETA 45-90 min'
    case 'delivered':
      return 'Levererad, inväntar kvittens'
    case 'confirmed':
      return 'Slutförd'
    case 'cancelled':
      return 'Avslutad'
    default:
      return 'Uppdateras snart'
  }
}

function checkpointFeed(status: OrderStatus) {
  const feed = [
    { key: 'accepted', title: 'Uppdrag accepterat', body: 'En bärare har tagit uppdraget och reservkapacitet är satt.', active: true },
    { key: 'payment', title: 'Betalning och escrow', body: 'Pengar låses innan leveransen startar och släpps först efter kvittens.', active: ['matched', 'picked_up', 'in_transit', 'delivered', 'confirmed'].includes(status) },
    { key: 'pickup', title: 'Upphämtning', body: 'Paketet markeras som upphämtat när bäraren startat den fysiska hanteringen.', active: ['picked_up', 'in_transit', 'delivered', 'confirmed'].includes(status) },
    { key: 'route', title: 'På väg', body: 'Här kommer GPS, ETA och kontrollpunkter senare att synkas in i samma vy.', active: ['in_transit', 'delivered', 'confirmed'].includes(status) },
    { key: 'proof', title: 'Leverans och bevis', body: 'Mottagaren kvitterar och payout kan frigöras till bäraren.', active: ['delivered', 'confirmed'].includes(status) },
  ]

  return feed
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
  const [isMobile, setIsMobile] = useState(false)
  const paymentState = searchParams.get('payment')

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    async function fetchOrder() {
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

    const channel = supabase
      .channel(`order:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, (payload: { new: Partial<Order> }) => {
        setOrder((prev) => (prev ? { ...prev, ...payload.new } : null))
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
      setOrder((prev) => (prev ? { ...prev, ...data.order } : prev))
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : 'Kunde inte bekräfta.')
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
      </div>
    )
  }

  if (!order) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--muted)' }}>Order hittades inte.</p>
      </div>
    )
  }

  const currentIdx = STATUS_ORDER.indexOf(order.status)
  const statusStyle = STATUS_COLOR[order.status] ?? STATUS_COLOR.pending!
  const currentStep = STEPS.find((step) => step.status === order.status)
  const routeLabel = order.trips ? `${order.trips.from_city} → ${order.trips.to_city}` : `${order.pickup_address} → ${order.dropoff_address}`
  const progress = statusProgress(order.status)
  const checkpoints = checkpointFeed(order.status)
  const facts = [
    {
      label: 'Status',
      value: currentStep?.label ?? order.status,
      hint: currentStep?.desc ?? 'Uppdateras i realtid',
      icon: <Truck size={16} color="var(--accent)" />,
    },
    {
      label: 'Belopp',
      value: `${order.price} kr`,
      hint: order.weight_kg ? `${order.weight_kg} kg paket` : 'Fast pris for detta uppdrag',
      icon: <Package size={16} color="var(--accent)" />,
    },
    {
      label: 'Bärare',
      value: carrier?.name ?? 'Tilldelad',
      hint: order.trips?.departure_at
        ? `Avgång ${new Date(order.trips.departure_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}`
        : 'Resa registrerad i systemet',
      icon: <ShieldCheck size={16} color="var(--accent)" />,
    },
    {
      label: 'Senast uppdaterad',
      value: timeAgo(lastUpdated),
      hint: 'Poll och realtime på samma vy',
      icon: <Clock3 size={16} color="var(--accent)" />,
    },
  ]

  return (
    <div style={{ minHeight: '100vh', padding: isMobile ? '82px 16px 36px' : '96px 24px 60px', background: 'linear-gradient(180deg, var(--bg) 0%, color-mix(in srgb, var(--accent) 5%, var(--bg)) 100%)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 20, padding: isMobile ? '18px 16px' : '24px 24px', borderRadius: isMobile ? 22 : 28, background: 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(240,253,244,0.96) 100%)', border: '1px solid rgba(34,197,94,0.16)', boxShadow: '0 22px 54px rgba(34,197,94,0.08)' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
            Spåra · #{id.slice(0, 8).toUpperCase()}
          </p>
          <h1 style={{ fontSize: isMobile ? '1.35rem' : '1.72rem', fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em' }}>
            Följ leveransen steg för steg
          </h1>
          <p style={{ fontSize: isMobile ? '0.82rem' : '0.76rem', color: 'var(--muted)', marginTop: 8, lineHeight: 1.65, maxWidth: 760 }}>
            {routeLabel}. Den här vyn är byggd som en gemensam sanningskälla för kund, bärare och support.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <div style={{ padding: '9px 12px', borderRadius: 999, background: statusStyle.bg, border: `1px solid ${statusStyle.dot}33`, fontSize: '0.74rem', fontWeight: 700, color: statusStyle.color }}>
              {currentStep?.label ?? order.status}
            </div>
            <div style={{ padding: '9px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(34,197,94,0.16)', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text)' }}>
              {etaLabel(order.status)}
            </div>
          </div>
        </div>

        {paymentState === 'success' && (
          <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 14, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <p style={{ fontWeight: 700, color: '#15803d', marginBottom: 4 }}>Betalningen gick igenom</p>
            <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Bäraren kan nu starta uppdraget.</p>
          </div>
        )}

        {paymentState === 'cancelled' && (
          <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 14, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <p style={{ fontWeight: 700, color: '#b45309', marginBottom: 4 }}>Betalningen avbrots</p>
            <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Gå till Mina sidor och starta betalningen igen.</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 18 }}>
          {facts.map((fact) => (
            <div
              key={fact.label}
              style={{
                padding: isMobile ? 14 : '16px 18px',
                borderRadius: isMobile ? 18 : 20,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                boxShadow: '0 10px 24px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', margin: 0 }}>{fact.label}</p>
                {fact.icon}
              </div>
              <p style={{ fontSize: isMobile ? '0.95rem' : '1.04rem', fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>{fact.value}</p>
              <p style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: 6, lineHeight: 1.45 }}>{fact.hint}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 380px', gap: 20, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '20px 24px', borderRadius: 18, background: statusStyle.bg, border: `1.5px solid ${statusStyle.dot}44`, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: statusStyle.dot,
                  flexShrink: 0,
                  boxShadow: `0 0 0 5px ${statusStyle.dot}33`,
                  animation: ['delivered', 'confirmed', 'cancelled'].includes(order.status) ? 'none' : 'pulse 2s infinite',
                }}
              />
              <div>
                <p style={{ fontWeight: 800, fontSize: '1.1rem', color: statusStyle.color, margin: 0 }}>{currentStep?.label ?? order.status}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 3 }}>{currentStep?.desc}</p>
              </div>
            </div>

            <div style={{ padding: isMobile ? '18px 16px' : '20px 22px', borderRadius: isMobile ? 18 : 20, background: 'var(--surface)', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 0.9fr', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                  <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', margin: 0 }}>Framdrift</p>
                  <strong style={{ fontSize: '0.88rem', color: 'var(--text)' }}>{progress}% klar</strong>
                </div>
                <div style={{ height: 10, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), #4ade80)', borderRadius: 999, transition: 'width 0.25s ease' }} />
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
                  {nextStepCopy(order.status)}
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr', gap: 10 }}>
                <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 6 }}>Eta</p>
                  <p style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>{etaLabel(order.status)}</p>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 6 }}>Ansvarig</p>
                  <p style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>{carrier?.name ?? 'Gonow-natverk'}</p>
                </div>
              </div>
            </div>

            <div style={{ padding: isMobile ? '18px 16px' : '20px 22px', borderRadius: isMobile ? 18 : 20, background: 'var(--surface)', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.05fr 0.95fr', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ padding: '14px 16px', borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Rutt</p>
                  <p style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{routeLabel}</p>
                  <p style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: 6 }}>{order.pickup_address} → {order.dropoff_address}</p>
                </div>
                <div style={{ padding: '14px 16px', borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Nästa steg</p>
                  <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{nextStepCopy(order.status)}</p>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Avsändare', name: sender?.name, phone: undefined },
                  { label: 'Bärare', name: carrier?.name, phone: undefined },
                  { label: 'Mottagare', name: recipient?.name, phone: recipient?.phone },
                ].map(({ label, name, phone }) => (
                  <div key={label} style={{ padding: '14px 16px', borderRadius: 16, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>{label}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: phone ? 4 : 0 }}>
                      <User size={14} color="var(--muted)" />
                      <p style={{ fontSize: '0.88rem', fontWeight: 700, color: name ? 'var(--text)' : 'var(--muted)', margin: 0 }}>{name ?? 'Inte tillgänglig än'}</p>
                    </div>
                    {phone ? <p style={{ fontSize: '0.76rem', color: 'var(--muted)', margin: 0 }}>{phone}</p> : null}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ height: isMobile ? 220 : 280, borderRadius: isMobile ? 20 : 18, background: 'linear-gradient(180deg, rgba(34,197,94,0.08), rgba(0,0,0,0.02))', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at top right, rgba(34,197,94,0.14), transparent 40%)', pointerEvents: 'none' }} />
              <MapPin size={36} color="var(--accent)" />
              <p style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Live-karta och positionsflöde</p>
              <p style={{ fontSize: '0.76rem', color: 'var(--muted)', margin: 0, textAlign: 'center', maxWidth: 360 }}>
                Aktiveras när bäraren startar resan. Här finns plats för GPS-push, ETA och kontrollpunkter.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', padding: '0 16px' }}>
                {['Startpunkt', 'Checkpoint', 'Ankomst'].map((item, index) => (
                  <div key={item} style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid rgba(34,197,94,0.25)', background: index <= Math.max(0, currentIdx - 1) ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.72)', color: index <= Math.max(0, currentIdx - 1) ? '#15803d' : 'var(--muted)', fontSize: '0.72rem', fontWeight: 700 }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: isMobile ? '18px 16px' : '20px 22px', borderRadius: isMobile ? 18 : 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.92rem', margin: 0 }}>Checkpoint-feed</p>
                <span style={{ padding: '6px 10px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: statusStyle.color, background: statusStyle.bg }}>
                  {currentStep?.label ?? order.status}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {checkpoints.map((item) => (
                  <div key={item.key} style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 12, alignItems: 'start' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: item.active ? 'rgba(34,197,94,0.16)' : 'var(--surface-2)', border: `1.5px solid ${item.active ? 'rgba(34,197,94,0.45)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.active ? 'var(--accent)' : 'var(--border)' }} />
                    </div>
                    <div style={{ paddingBottom: 6 }}>
                      <p style={{ fontSize: '0.82rem', fontWeight: 700, color: item.active ? 'var(--text)' : 'var(--muted)', margin: 0 }}>{item.title}</p>
                      <p style={{ fontSize: '0.76rem', color: 'var(--muted)', lineHeight: 1.6, marginTop: 4 }}>{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

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
                          {done ? (
                            <CheckCircle2 size={14} color="#fff" />
                          ) : active ? (
                            <Loader2 size={13} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <Circle size={13} color="var(--border)" />
                          )}
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', margin: 0 }}>Driftnotis</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
                    Spårningssidan är byggd för att fungera som den tydliga sanningskällan mellan kund, bärare och framtida supportflöde.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ padding: '20px 22px', borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.92rem', margin: 0 }}>Vad händer nu</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { title: 'Betalning och escrow', text: 'När betalningen har passerat läggs den på hold tills leveransen är kvitterad.' },
                  { title: 'Bärarflöde', text: 'Bäraren markerar upphämtad, på väg och levererad i sin egen kontrollpanel.' },
                  { title: 'Kvittens', text: 'Mottagaren bekräftar sist, vilket är signalen som senare ska trigga payout.' },
                ].map((item) => (
                  <div key={item.title} style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{item.title}</p>
                    <p style={{ fontSize: '0.74rem', color: 'var(--muted)', lineHeight: 1.6, marginTop: 5 }}>{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {order.status === 'delivered' && (
              <div style={{ padding: isMobile ? '18px 16px' : '20px 22px', borderRadius: isMobile ? 20 : 22, background: 'linear-gradient(180deg, rgba(34,197,94,0.08), rgba(240,253,244,0.88))', border: '1.5px solid rgba(34,197,94,0.25)', boxShadow: '0 16px 36px rgba(34,197,94,0.10)' }}>
                <p style={{ fontWeight: 700, color: '#15803d', marginBottom: 6, fontSize: '0.95rem' }}>Paketet är levererat</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 16 }}>Bekräfta att du tagit emot paketet för att frigöra bärarens betalning.</p>
                {confirmError ? <p style={{ fontSize: '0.78rem', color: '#dc2626', marginBottom: 10 }}>{confirmError}</p> : null}
                <button onClick={handleConfirm} disabled={confirming} style={{ width: '100%', padding: '13px 18px', borderRadius: 12, border: 'none', background: '#15803d', color: '#fff', fontFamily: 'inherit', fontWeight: 800, fontSize: '0.9rem', cursor: confirming ? 'not-allowed' : 'pointer', opacity: confirming ? 0.7 : 1 }}>
                  {confirming ? 'Bekräftar...' : 'Bekräfta leverans'}
                </button>
              </div>
            )}

            {order.status === 'confirmed' && (
              <div style={{ padding: isMobile ? '18px 16px' : '18px 22px', borderRadius: isMobile ? 20 : 18, background: 'linear-gradient(180deg, rgba(34,197,94,0.08), rgba(240,253,244,0.84))', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 14px 30px rgba(34,197,94,0.08)' }}>
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

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
