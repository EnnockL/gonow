'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, Check, CheckCircle2, Package, Sparkles, Star, Truck, Zap } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { authedFetch } from '@/lib/auth/authed-fetch'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  related_type?: string | null
  related_id?: string | null
  read_at: string | null
  created_at: string
}

function timeAgo(ts: string) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return 'just nu'
  if (diff < 3600) return `${Math.floor(diff / 60)} min sedan`
  if (diff < 86400) return `${Math.floor(diff / 3600)} tim sedan`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} dagar sedan`
  return new Date(ts).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

function NotifIcon({ type }: { type: string }) {
  const s = { flexShrink: 0 as const }
  if (type === 'match_suggested') return <Zap size={16} color="#4ade80" style={s} />
  if (type === 'match_driver_confirm' || type === 'match_confirmed') return <CheckCircle2 size={16} color="#4ade80" style={s} />
  if (type === 'match_expired') return <Package size={16} color="#f59e0b" style={s} />
  if (type === 'logistics_accepted') return <Truck size={16} color="#a78bfa" style={s} />
  if (type.startsWith('order_')) return <Package size={16} color="#60a5fa" style={s} />
  if (type === 'review') return <Star size={16} color="#f59e0b" style={s} />
  return <Bell size={16} color="var(--muted)" style={s} />
}

const TYPE_LABEL: Record<string, string> = {
  match_suggested:      'AI Match',
  match_driver_confirm: 'Bekräfta',
  match_confirmed:      'Matchad',
  match_expired:        'Utgångna',
  logistics_accepted:   'Logistik',
  order_matched:        'Order',
  order_picked_up:      'Hämtad',
  order_in_transit:     'Transit',
  order_delivered:      'Levererad',
  order_confirmed:      'Bekräftad',
  message:              'Meddelande',
  lift_offered:         'Lift',
  lift_matched:         'Lift',
}

export default function NotificationsPage() {
  const { userId } = useAuth()
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const load = useCallback(async () => {
    if (!userId) return
    const res = await authedFetch('/api/notifications')
    if (res.ok) {
      const data = await res.json()
      setNotifs(data.notifications ?? [])
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  async function markOneRead(id: string) {
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    await authedFetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
  }

  async function markAllRead() {
    if (!userId) return
    setNotifs((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    await authedFetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
  }

  const shown = filter === 'unread' ? notifs.filter(n => !n.read_at) : notifs
  const unread = notifs.filter(n => !n.read_at).length

  // Sort: unread first, then by created_at desc
  const sorted = [...shown].sort((a, b) => {
    if (!a.read_at && b.read_at) return -1
    if (a.read_at && !b.read_at) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '90px 16px 64px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em' }}>
            Notifikationer
          </h1>
          {unread > 0 && (
            <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '4px 0 0' }}>
              {unread} olästa
            </p>
          )}
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--surface)',
              cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
              color: 'var(--gn)', fontFamily: 'inherit',
            }}
          >
            <Check size={13} />
            Markera alla lästa
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 8,
              border: `1px solid ${filter === f ? 'var(--gn)' : 'var(--border)'}`,
              background: filter === f ? 'rgba(74,222,128,0.1)' : 'var(--surface)',
              color: filter === f ? 'var(--gn)' : 'var(--muted)',
              cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            {f === 'all' ? `Alla (${notifs.length})` : `Olästa (${unread})`}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ height: 76, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', animation: 'pulse 1.5s ease-in-out infinite', opacity: 0.6 }} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
          <Sparkles size={28} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontSize: '0.9rem', margin: 0 }}>
            {filter === 'unread' ? 'Inga olästa notifikationer.' : 'Inga notifikationer ännu.'}
          </p>
          <p style={{ fontSize: '0.78rem', margin: '6px 0 0', opacity: 0.6 }}>
            Du får notiser när något händer med dina paket eller resor.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sorted.map((n) => {
            const isRead = !!n.read_at
            const label = TYPE_LABEL[n.type]
            return (
              <div
                key={n.id}
                onClick={() => !isRead && markOneRead(n.id)}
                style={{
                  display: 'flex', gap: 14, padding: '14px 16px',
                  background: 'var(--surface)',
                  border: `1px solid ${isRead ? 'var(--border)' : 'rgba(74,222,128,0.15)'}`,
                  borderRadius: 14,
                  cursor: isRead ? 'default' : 'pointer',
                  boxShadow: isRead ? 'none' : '0 0 0 1px rgba(74,222,128,0.06)',
                  transition: 'box-shadow 0.15s',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: isRead ? 'var(--surface-2)' : 'rgba(74,222,128,0.08)',
                  border: `1px solid ${isRead ? 'var(--border)' : 'rgba(74,222,128,0.15)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <NotifIcon type={n.type} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                    <p style={{
                      fontSize: '0.88rem', fontWeight: isRead ? 500 : 700,
                      color: 'var(--text)', margin: 0, lineHeight: 1.3,
                    }}>
                      {n.title}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {label && (
                        <span style={{
                          fontSize: '0.6rem', fontWeight: 700, padding: '1px 7px',
                          borderRadius: 999, background: 'var(--surface-2)',
                          color: 'var(--muted)', border: '1px solid var(--border)',
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                          {label}
                        </span>
                      )}
                      {!isRead && (
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gn)', flexShrink: 0 }} />
                      )}
                    </div>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0 0 6px', lineHeight: 1.5 }}>
                    {n.message}
                  </p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--muted)', margin: 0, opacity: 0.55 }}>
                    {timeAgo(n.created_at)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
