'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, Check, CheckCircle2, Package, Star, Truck, Zap } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
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
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  if (diff < 86400) return `${Math.floor(diff / 3600)} tim`
  return `${Math.floor(diff / 86400)} d`
}

function NotifIcon({ type }: { type: string }) {
  if (type.startsWith('order_') || type === 'match_confirmed') return <Package size={13} color="var(--gn)" />
  if (type === 'review') return <Star size={13} color="#f59e0b" />
  if (type === 'logistics_assigned' || type === 'logistics_accepted') return <Truck size={13} color="#a78bfa" />
  if (type === 'match_suggested' || type === 'match_driver_confirm') return <Zap size={13} color="#4ade80" />
  return <CheckCircle2 size={13} color="var(--muted)" />
}

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifs.filter((n) => !n.read_at).length

  useEffect(() => {
    if (!userId) return
    const supabase = createClient()

    async function load() {
      const res = await authedFetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifs(data.notifications ?? [])
      }
    }
    load()

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload: { new: Notification }) => {
        setNotifs((prev) => [payload.new, ...prev].slice(0, 40))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function markAllRead() {
    setNotifs((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })))
    await authedFetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
  }

  async function markOneRead(id: string) {
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    await authedFetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen((v) => !v); if (!open && unread > 0) markAllRead() }}
        aria-label={`Notifikationer${unread > 0 ? ` (${unread} olästa)` : ''}`}
        style={{
          position: 'relative', width: 36, height: 36, borderRadius: '50%',
          border: '1px solid var(--border)', background: 'var(--surface)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text)',
        }}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2, width: 16, height: 16,
            borderRadius: '50%', background: 'var(--gn)', color: '#0a0a0a',
            fontSize: '0.6rem', fontWeight: 800, display: 'flex',
            alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 340, maxHeight: 440, overflowY: 'auto',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, boxShadow: '0 20px 48px rgba(0,0,0,0.18)', zIndex: 9999,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 10px', borderBottom: '1px solid var(--border)',
            position: 'sticky', top: 0, background: 'var(--surface)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>Notifikationer</span>
              {unread > 0 && (
                <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: 'rgba(74,222,128,0.12)', color: 'var(--gn)', border: '1px solid rgba(74,222,128,0.2)' }}>
                  {unread} nya
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {unread > 0 && (
                <button onClick={markAllRead} style={{ background: 'none', border: 'none', fontSize: '0.72rem', color: 'var(--gn)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Check size={11} /> Alla lästa
                </button>
              )}
              <Link href="/notifications" onClick={() => setOpen(false)} style={{ fontSize: '0.72rem', color: 'var(--muted)', textDecoration: 'none' }}>
                Visa alla
              </Link>
            </div>
          </div>

          {notifs.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem' }}>
              Inga notifikationer ännu
            </div>
          ) : (
            notifs.slice(0, 12).map((n) => {
              const isRead = !!n.read_at
              return (
                <div
                  key={n.id}
                  onClick={() => !isRead && markOneRead(n.id)}
                  style={{
                    display: 'flex', gap: 10, padding: '11px 16px',
                    borderBottom: '1px solid var(--border)',
                    background: isRead ? 'transparent' : 'rgba(74,222,128,0.04)',
                    cursor: isRead ? 'default' : 'pointer',
                  }}
                >
                  <div style={{
                    width: 30, height: 30, borderRadius: 9,
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 2,
                  }}>
                    <NotifIcon type={n.type} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: '0.82rem', fontWeight: isRead ? 500 : 700, color: 'var(--text)', margin: 0, lineHeight: 1.3 }}>
                      {n.title}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>
                      {n.message}
                    </p>
                    <p style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 3, opacity: 0.55 }}>
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                  {!isRead && (
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gn)', flexShrink: 0, marginTop: 7 }} />
                  )}
                </div>
              )
            })
          )}

          {notifs.length > 12 && (
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              style={{ display: 'block', textAlign: 'center', padding: '12px', fontSize: '0.78rem', color: 'var(--gn)', textDecoration: 'none', borderTop: '1px solid var(--border)' }}
            >
              Visa alla {notifs.length} notifikationer →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
