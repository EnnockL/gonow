'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Order, User } from '@/lib/types'
import { Package, Star, LogOut, Shield, ChevronRight, MapPin, Clock } from 'lucide-react'
import Link from 'next/link'

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Väntar',     color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
  matched:    { label: 'Matchad',    color: '#92ff63', bg: 'rgba(146,255,99,0.1)' },
  picked_up:  { label: 'Upphämtad', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  in_transit: { label: 'På väg',    color: '#92ff63', bg: 'rgba(146,255,99,0.1)' },
  delivered:  { label: 'Levererad', color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  confirmed:  { label: 'Bekräftad', color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  disputed:   { label: 'Tvist',     color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
}

export default function ProfilPage() {
  const [user, setUser] = useState<User | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }: { data: { user: { id: string; email?: string } | null } }) => {
      if (!data.user) { setLoading(false); return }
      const { data: profile } = await supabase.from('users').select('*').eq('id', data.user.id).single()
      setUser(profile)
      const { data: ords } = await supabase
        .from('orders').select('*')
        .or(`sender_id.eq.${data.user.id},receiver_id.eq.${data.user.id}`)
        .order('created_at', { ascending: false }).limit(20)
      setOrders(ords || [])
      setLoading(false)
    })
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          <Shield size={24} style={{ color: 'var(--muted)' }} />
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Logga in</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', maxWidth: 300 }}>Du måste logga in med BankID för att se din profil och dina ordrar.</p>
        <Link href="/" className="btn-primary" style={{ marginTop: 8, padding: '11px 24px' }}>
          Tillbaka till startsidan
        </Link>
      </div>
    )
  }

  const initials = user.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?'

  return (
    <div style={{ minHeight: '100vh', paddingTop: 80, paddingBottom: 80 }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px' }}>

        {/* Profile header */}
        <div style={{ paddingTop: 32, paddingBottom: 40, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--accent-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)',
              flexShrink: 0, letterSpacing: '-0.02em',
            }}>
              {initials}
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 4 }}>
                {user.name}
              </h1>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 8 }}>{user.email}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#fbbf24' }}>
                  <Star size={12} style={{ fill: '#fbbf24' }} />
                  {user.rating_avg?.toFixed(1) || '–'} ({user.rating_count || 0})
                </span>
                {user.bankid_verified && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 100, background: 'var(--success-soft)', border: '1px solid var(--success-border)', fontSize: '0.7rem', fontWeight: 500, color: 'var(--success)' }}>
                    <Shield size={10} /> BankID
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              borderRadius: 8, border: '1px solid var(--border)', background: 'none',
              color: 'var(--muted)', fontSize: '0.75rem', cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s', fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(248,113,113,0.4)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
          >
            <LogOut size={13} /> Logga ut
          </button>
        </div>

        {/* Orders header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>
            Dina ordrar
            {orders.length > 0 && (
              <span style={{ marginLeft: 8, fontSize: '0.72rem', fontWeight: 400, color: 'var(--muted)' }}>
                ({orders.length})
              </span>
            )}
          </h2>
          <Link href="/skicka" style={{ fontSize: '0.75rem', color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            Ny order <ChevronRight size={13} />
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 48, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={22} style={{ color: 'var(--muted)' }} />
            </div>
            <p style={{ color: 'var(--muted)', fontWeight: 500 }}>Inga ordrar ännu.</p>
            <Link href="/skicka" style={{ fontSize: '0.8rem', color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              Skicka ditt första paket <ChevronRight size={13} />
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {orders.map((order) => {
              const st = STATUS_MAP[order.status] || { label: order.status, color: 'var(--muted)', bg: 'var(--surface-2)' }
              return (
                <Link
                  key={order.id}
                  href={`/spara/${order.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                    borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)',
                    textDecoration: 'none', transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(146,255,99,0.3)'; (e.currentTarget as HTMLElement).style.background = 'var(--accent-softer)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Package size={16} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', marginBottom: 3 }}>
                      {order.description || 'Paket'}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--muted)' }}>
                        <MapPin size={10} style={{ color: 'var(--accent)' }} />
                        {order.pickup_address} → {order.dropoff_address}
                      </span>
                      {order.created_at && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--muted)' }}>
                          <Clock size={10} />
                          {new Date(order.created_at).toLocaleDateString('sv-SE')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 500, color: st.color, background: st.bg }}>
                      {st.label}
                    </span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
                      {order.price} kr
                    </span>
                    <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
