'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { TrendingUp, Package, Car, Users, RefreshCw, DollarSign, Star, ShieldOff, Activity } from 'lucide-react'

interface KPIs {
  packagesToday: number
  tripsToday: number
  liftRequestsToday: number
  gmvBooked: number
  gmvDelivered: number
  conversionRate: number
  avgRating: number
  newUsersToday: number
}

export default function AdminDashboard() {
  const { profile, loading: authLoading } = useAuth()
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const supabase = createClient()
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayISO = todayStart.toISOString()

      const [packagesRes, tripsRes, liftRes, gmvBookedRes, gmvDeliveredRes, ratingRes, usersRes] =
        await Promise.all([
          supabase.from('packages').select('id', { count: 'exact', head: true }).gte('created_at', todayISO),
          supabase.from('trips').select('id', { count: 'exact', head: true }).gte('created_at', todayISO),
          supabase.from('lift_requests').select('id', { count: 'exact', head: true }).gte('created_at', todayISO),
          supabase.from('orders').select('price').in('status', ['matched', 'in_transit', 'delivered', 'confirmed']),
          supabase.from('orders').select('price').in('status', ['delivered', 'confirmed']),
          supabase.from('users').select('rating_avg').gt('rating_count', 0),
          supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', todayISO),
        ])

      const gmvBooked = (gmvBookedRes.data ?? []).reduce((s: number, r: { price: number | null }) => s + (r.price ?? 0), 0)
      const gmvDelivered = (gmvDeliveredRes.data ?? []).reduce((s: number, r: { price: number | null }) => s + (r.price ?? 0), 0)
      const ratings = ratingRes.data ?? []
      const avgRating =
        ratings.length > 0 ? ratings.reduce((s: number, r: { rating_avg: number | null }) => s + (r.rating_avg ?? 0), 0) / ratings.length : 0

      setKpis({
        packagesToday: packagesRes.count ?? 0,
        tripsToday: tripsRes.count ?? 0,
        liftRequestsToday: liftRes.count ?? 0,
        gmvBooked,
        gmvDelivered,
        conversionRate: gmvBooked > 0 ? Math.round((gmvDelivered / gmvBooked) * 100) : 0,
        avgRating: Number(avgRating.toFixed(1)),
        newUsersToday: usersRes.count ?? 0,
      })
    } catch {
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLastRefresh(new Date())
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (profile?.role !== 'admin') {
      setLoading(false)
      return
    }
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [authLoading, profile?.role, load])

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (profile?.role !== 'admin') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, paddingTop: 80 }}>
        <ShieldOff size={48} style={{ color: 'var(--muted)', marginBottom: 4 }} />
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Åtkomst nekad</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0, textAlign: 'center', maxWidth: 280 }}>
          Den här sidan kräver admin-behörighet.
        </p>
      </div>
    )
  }

  if (!kpis) return null

  const tiles: { icon: React.ElementType; label: string; value: string | number; color: string }[] = [
    { icon: Package,     label: 'Paket idag',         value: kpis.packagesToday,                                      color: '#22c55e' },
    { icon: Car,         label: 'Resor idag',          value: kpis.tripsToday,                                         color: '#34d399' },
    { icon: Activity,    label: 'Lift idag',           value: kpis.liftRequestsToday,                                  color: '#7bf0a8' },
    { icon: Users,       label: 'Nya användare idag',  value: kpis.newUsersToday,                                      color: '#86efac' },
    { icon: DollarSign,  label: 'GMV bokad (kr)',       value: kpis.gmvBooked.toLocaleString('sv-SE'),                  color: '#22c55e' },
    { icon: DollarSign,  label: 'GMV levererad (kr)',   value: kpis.gmvDelivered.toLocaleString('sv-SE'),               color: '#16a34a' },
    { icon: TrendingUp,  label: 'Konvertering',         value: `${kpis.conversionRate}%`,                               color: '#4ade80' },
    { icon: Star,        label: 'Snittbetyg',           value: kpis.avgRating > 0 ? kpis.avgRating : '–',              color: '#fbbf24' },
  ]

  return (
    <div style={{ minHeight: '100vh', paddingTop: 80, paddingBottom: 80, background: 'var(--page-gradient)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>

        <div style={{ paddingTop: 32, paddingBottom: 32, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
              Internt · Admin
            </p>
            <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--text)', margin: 0, lineHeight: 1.1 }}>
              Dashboard
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: 0 }}>
              Auto-uppdateras var 60:e sek · senast {lastRefresh.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <button
              onClick={load}
              disabled={refreshing}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 13px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--surface)', color: 'var(--muted)', fontSize: '0.75rem',
                cursor: refreshing ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                opacity: refreshing ? 0.6 : 1, transition: 'opacity 0.15s',
              }}
            >
              <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              Uppdatera
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 48 }}>
          {tiles.map(({ icon: Icon, label, value, color }) => (
            <div
              key={label}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 18px', animation: 'fade-in 0.3s ease both' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <p style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, lineHeight: 1.3 }}>{label}</p>
              </div>
              <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', margin: 0, lineHeight: 1 }}>{value}</p>
            </div>
          ))}
        </div>

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
