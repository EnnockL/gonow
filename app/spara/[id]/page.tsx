'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import TrackingTimeline from '@/components/tracking/TrackingTimeline'
import { Order, OrderStatus } from '@/lib/types'
import { MapPin, Package } from 'lucide-react'
import { use } from 'react'

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Väntar på bärare',
  matched: 'Bärare accepterat',
  picked_up: 'Upphämtat',
  in_transit: 'På väg',
  delivered: 'Levererat',
  confirmed: 'Bekräftat',
  disputed: 'Tvist öppen',
}

export default function SparaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    supabase
      .from('orders')
      .select('*, trips(from_city, to_city, departure_at, carrier_id)')
      .eq('id', id)
      .single()
      .then(({ data }: { data: Order | null }) => {
        setOrder(data)
        setLoading(false)
      })

    // Subscribe to real-time status changes
    const channel = supabase
      .channel(`order:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, (payload: { new: Partial<Order> }) => {
        setOrder((prev) => prev ? { ...prev, ...payload.new } : null)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
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

  return (
    <div className="min-h-screen pt-24 pb-16 px-6">
      <div className="mx-auto max-w-lg">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-2">Spårning</p>
          <h1 className="text-2xl font-bold text-[var(--text)]">Order #{id.slice(0, 8).toUpperCase()}</h1>
        </div>

        {/* Status banner */}
        <div className="mb-6 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4 flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-[var(--accent)] animate-pulse" />
          <div>
            <p className="font-semibold text-[var(--text)]">{STATUS_LABELS[order.status]}</p>
            {order.pickup_address && (
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {order.pickup_address} → {order.dropoff_address}
              </p>
            )}
          </div>
        </div>

        {/* Map placeholder */}
        <div className="mb-6 h-56 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center">
          <div className="text-center text-[var(--muted)]">
            <MapPin size={32} className="mx-auto mb-2 text-[var(--accent)]" />
            <p className="text-sm">Live-karta (Google Maps)</p>
            <p className="text-xs mt-1">Aktiveras när bäraren startar resan</p>
          </div>
        </div>

        {/* Order details */}
        <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center gap-3 mb-4">
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

        {/* Timeline */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="mb-4 font-medium text-[var(--text)]">Status</h3>
          <TrackingTimeline status={order.status} />
        </div>
      </div>
    </div>
  )
}
