'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Package, Users, TrendingUp, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react'

interface Stats {
  totalOrders: number
  activeTrips: number
  pendingPayouts: number
  disputed: number
}

interface OrderRow {
  id: string
  status: string
  price: number
  type: string
  created_at: string
}

const STATUS_DOT: Record<string, string> = {
  confirmed: '#34d399',
  disputed: '#f87171',
  pending: '#fbbf24',
  matched: '#22c55e',
  in_transit: '#a78bfa',
  delivered: '#34d399',
}

const TYPE_LABELS: Record<string, string> = {
  package: 'Paket',
  pickup: 'Upphämtning',
  return: 'Retur',
  lift: 'Lift',
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats>({ totalOrders: 0, activeTrips: 0, pendingPayouts: 0, disputed: 0 })
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    setRefreshing(true)
    const supabase = createClient()
    const [ordersRes, tripsRes, payoutsRes, disputedRes] = await Promise.all([
      supabase.from('orders').select('id, status, price, type, created_at').order('created_at', { ascending: false }).limit(50),
      supabase.from('trips').select('id', { count: 'exact' }).eq('status', 'active'),
      supabase.from('payouts').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('orders').select('id', { count: 'exact' }).eq('status', 'disputed'),
    ])
    setOrders(ordersRes.data || [])
    setStats({
      totalOrders: ordersRes.data?.length || 0,
      activeTrips: tripsRes.count || 0,
      pendingPayouts: payoutsRes.count || 0,
      disputed: disputedRes.count || 0,
    })
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const statCards = [
    { icon: Package, label: 'Totala ordrar', value: stats.totalOrders, accent: '#22c55e', delta: '+12%' },
    { icon: Users, label: 'Aktiva resor', value: stats.activeTrips, accent: '#7bf0a8', delta: '+5%' },
    { icon: TrendingUp, label: 'Väntande utbet.', value: stats.pendingPayouts, accent: '#34d399', delta: null },
    { icon: AlertTriangle, label: 'Tvister', value: stats.disputed, accent: '#f87171', delta: stats.disputed > 0 ? `${stats.disputed} aktiva` : null },
  ]

  return (
    <div style={{ minHeight: '100vh', paddingTop: 80, paddingBottom: 80 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>

        {/* Header */}
        <div style={{ paddingTop: 32, paddingBottom: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <p className="label" style={{ marginBottom: 10 }}>Internt</p>
            <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1.1 }}>
              Admin Dashboard
            </h1>
          </div>
          <button
            onClick={load}
            disabled={refreshing}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--muted)', fontSize: '0.75rem', cursor: 'pointer',
              transition: 'color 0.15s', fontFamily: 'inherit', opacity: refreshing ? 0.6 : 1,
            }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Uppdatera
          </button>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
          {statCards.map((s) => (
            <div key={s.label} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <s.icon size={18} style={{ color: s.accent }} />
                </div>
                {s.delta && (
                  <span style={{ fontSize: '0.68rem', fontWeight: 500, color: s.accent, background: `${s.accent}12`, padding: '2px 8px', borderRadius: 100 }}>
                    {s.delta}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 4, lineHeight: 1 }}>
                {s.value}
              </p>
              <p style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 500 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Orders table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>Senaste ordrar</h2>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{orders.length} visas</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Order ID', 'Typ', 'Status', 'Pris', 'Skapad'].map((h) => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => {
                  const dot = STATUS_DOT[o.status] || 'var(--muted)'
                  return (
                    <tr key={o.id} style={{ borderBottom: i < orders.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--muted)' }}>
                        #{o.id.slice(0, 8)}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text)' }}>
                        {TYPE_LABELS[o.type] || o.type}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ color: dot, fontWeight: 500 }}>{o.status}</span>
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 500 }}>
                        {o.price} kr
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: '0.72rem' }}>
                        {new Date(o.created_at).toLocaleDateString('sv-SE')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {orders.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '48px 0', textAlign: 'center' }}>
                <CheckCircle2 size={24} style={{ color: 'var(--muted)' }} />
                <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Inga ordrar ännu.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
