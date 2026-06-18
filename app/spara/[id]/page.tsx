'use client'

import { use, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { MapPin, Package } from 'lucide-react'
import TrackingTimeline from '@/components/tracking/TrackingTimeline'
import { createClient } from '@/lib/supabase'
import { Order, OrderStatus } from '@/lib/types'

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending:   'Väntar på betalning',
  matched:   'Bärare accepterat',
  picked_up: 'Upphämtat',
  in_transit: 'På väg',
  delivered: 'Levererat',
  confirmed: 'Bekräftat',
  disputed:  'Tvist öppen',
  cancelled: 'Avbruten',
}

export default function SparaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const paymentState = searchParams.get('payment')

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    const fetchOrder = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*, trips(from_city, to_city, departure_at, carrier_id)')
        .eq('id', id)
        .single()

      if (!mounted) return

      if (data) {
        setOrder(data)
      } else {
        // Fallback: check localStorage (demo orders)
        const stored: Order[] = JSON.parse(localStorage.getItem('gonow_bookings') || '[]')
        const local = stored.find(o => o.id === id) ?? null
        setOrder(local)
      }
      setLoading(false)
    }

    fetchOrder()

    const channel = supabase
      .channel(`order:${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        (payload: { new: Partial<Order> }) => {
          setOrder((prev) => (prev ? { ...prev, ...payload.new } : null))
        }
      )
      .subscribe()

    const pollId = window.setInterval(() => {
      fetchOrder()
    }, 8000)

    return () => {
      mounted = false
      window.clearInterval(pollId)
      supabase.removeChannel(channel)
    }
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--muted)]">Order hittades inte.</p>
      </div>
    )
  }

  async function handleConfirmDelivery() {
    setConfirming(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Kunde inte bekräfta leveransen.')
      setOrder((prev) => (prev ? { ...prev, ...data.order } : prev))
      setMessage('Leveransen är bekräftad. Förarens saldo kan nu gå vidare till payout.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Kunde inte bekräfta leveransen.')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="min-h-screen px-6 pb-16 pt-24">
      <div className="mx-auto max-w-lg">
        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Sparning</p>
          <h1 className="text-2xl font-bold text-[var(--text)]">Order #{id.slice(0, 8).toUpperCase()}</h1>
        </div>

        {paymentState === 'success' && (
          <div className="mb-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
            <p className="font-semibold text-[var(--text)]">Betalningen gick igenom.</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Vi uppdaterar ordern automatiskt. När webbhooken är klar går statusen vidare från betalning till aktiv resa.
            </p>
          </div>
        )}
        {paymentState === 'cancelled' && (
          <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
            <p className="font-semibold text-[var(--text)]">Betalningen avbröts.</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Du kan gå tillbaka till Mina sidor och starta betalningen igen när du vill.
            </p>
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-4">
            <p className="font-semibold text-[var(--text)]">{message}</p>
          </div>
        )}

        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4">
          <div className="h-3 w-3 animate-pulse rounded-full bg-[var(--accent)]" />
          <div>
            <p className="font-semibold text-[var(--text)]">{STATUS_LABELS[order.status]}</p>
            {order.pickup_address && (
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {order.pickup_address} {'->'} {order.dropoff_address}
              </p>
            )}
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="mb-3 font-medium text-[var(--text)]">Nästa steg</h3>
          <div className="flex flex-wrap gap-3 text-sm">
            {order.status === 'pending' && (
              <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[var(--text)]">
                Väntar på att betalningen bekräftas
              </span>
            )}
            {order.status === 'matched' && (
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-[var(--text)]">
                Bäraren är bokad — nästa steg är upphämtning
              </span>
            )}
            {order.status === 'picked_up' && (
              <span className="rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-2 text-[var(--text)]">
                Upphämtat — ordern är på väg till mottagaren
              </span>
            )}
            {order.status === 'in_transit' && (
              <span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-[var(--text)]">
                Leveransen är i transit just nu
              </span>
            )}
            {(order.status === 'delivered' || order.status === 'confirmed') && (
              <div className="flex flex-wrap gap-3">
                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-[var(--text)]">
                  Leveransen är genomförd ✓
                </span>
                {order.status === 'delivered' && (
                  <button
                    onClick={handleConfirmDelivery}
                    disabled={confirming}
                    className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-[var(--text)] transition hover:bg-emerald-400/20 disabled:opacity-60"
                  >
                    {confirming ? 'Bekräftar...' : 'Bekräfta leverans'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 flex h-56 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="text-center text-[var(--muted)]">
            <MapPin size={32} className="mx-auto mb-2 text-[var(--accent)]" />
            <p className="text-sm">Live-karta (Google Maps)</p>
            <p className="mt-1 text-xs">Aktiveras när bäraren startar resan</p>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="mb-4 flex items-center gap-3">
            <Package size={18} className="text-[var(--accent)]" />
            <p className="font-medium text-[var(--text)]">{order.description || 'Paket'}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-[var(--muted)]">Pris</p>
              <p className="font-semibold text-[var(--text)]">{order.price} SEK</p>
            </div>
            {order.weight_kg && (
              <div>
                <p className="text-xs text-[var(--muted)]">Vikt</p>
                <p className="font-semibold text-[var(--text)]">{order.weight_kg} kg</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="mb-4 font-medium text-[var(--text)]">Status</h3>
          <TrackingTimeline status={order.status} />
        </div>
      </div>
    </div>
  )
}
