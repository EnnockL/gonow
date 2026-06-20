'use client'

import { useState, useEffect, useMemo } from 'react'
import { MapPin, Clock, Car, Users, Package as PkgIcon, Star, Shield, Route } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import AuthModal from '@/components/auth/AuthModal'
import TripBookingModal, { type TripInfo } from '@/components/booking/TripBookingModal'
import { TripCardSkeleton } from '@/components/ui/Skeleton'

interface Trip {
  id: string
  carrier_id: string
  from_city: string
  to_city: string
  departure_at: string
  arrival_est: string | null
  vehicle_type: string | null
  seats_available: number
  weight_capacity_kg: number
  allows_passengers: boolean
  allows_packages: boolean
  price_per_seat: number | null
  price_per_kg: number | null
  status: string
  users?: {
    name: string
    rating_avg: number
    rating_count: number
    avatar_url: string | null
    bankid_verified: boolean
  }
}

const FILTERS = ['Alla', 'Idag', 'Imorgon', 'Stockholm', 'Göteborg', 'Norrland', 'Lediga platser', 'Godsutrymme'] as const
type Filter = typeof FILTERS[number]

const VEHICLE_LABELS: Record<string, string> = {
  car: 'Bil',
  train: 'Tåg',
  bus: 'Buss',
  flight: 'Flyg',
}

function formatDep(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const day = new Date(iso)
  day.setHours(0, 0, 0, 0)
  const prefix = day.getTime() === today.getTime() ? 'Idag' : day.getTime() === tomorrow.getTime() ? 'Imorgon' : d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${prefix} kl ${d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
}

// ─── toTripInfo — konverterar Trip → TripInfo för TripBookingModal ────────────

function toTripInfo(trip: Trip): TripInfo {
  return {
    id: trip.id,
    from: trip.from_city,
    to: trip.to_city,
    carrier: trip.users?.name ?? 'Förare',
    carrier_id: trip.carrier_id,
    price: trip.price_per_kg ?? trip.price_per_seat ?? 0,
    pricePerKg: trip.price_per_kg ?? undefined,
    pricePerSeat: trip.price_per_seat ?? undefined,
    vehicleType: trip.vehicle_type ?? undefined,
    seatsLeft: trip.seats_available,
    weightLeftKg: trip.weight_capacity_kg,
  }
}

// ─── TripCard ─────────────────────────────────────────────────────────────────

function TripCard({ trip, onBookSeat, onSendPackage }: {
  trip: Trip
  onBookSeat: (trip: Trip) => void
  onSendPackage: (trip: Trip) => void
}) {
  const carrier = trip.users
  const name = carrier?.name ?? 'Förare'
  const rating = carrier?.rating_avg ?? 5.0
  const ratingCount = carrier?.rating_count ?? 0
  const avatar = carrier?.avatar_url
  const verified = carrier?.bankid_verified ?? false

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Route + time */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
            {trip.from_city}
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '2px 0 0' }}>→ {trip.to_city}</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
            <Clock size={12} /> {formatDep(trip.departure_at)}
          </p>
          {trip.vehicle_type && (
            <p style={{ fontSize: '0.68rem', color: 'var(--muted)', margin: '3px 0 0' }}>
              <Car size={10} style={{ display: 'inline', marginRight: 3 }} />
              {VEHICLE_LABELS[trip.vehicle_type] ?? trip.vehicle_type}
            </p>
          )}
        </div>
      </div>

      {/* Capacity + pricing */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {trip.allows_passengers && trip.seats_available > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '5px 10px' }}>
            <Users size={13} style={{ color: '#22c55e' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>
              {trip.seats_available} platser{trip.price_per_seat ? ` · från ${trip.price_per_seat} kr` : ''}
            </span>
          </div>
        )}
        {trip.allows_packages && trip.weight_capacity_kg > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '5px 10px' }}>
            <PkgIcon size={13} style={{ color: '#3b82f6' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>
              {trip.weight_capacity_kg} kg utrymme{trip.price_per_kg ? ` · ${trip.price_per_kg} kr/kg` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Carrier */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
        {avatar
          ? <img src={avatar} alt={name} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
          : <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, color: '#0a0a0a' }}>{name[0]}</div>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>{name}</span>
            {verified && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.62rem', fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 6px', borderRadius: 999 }}>
                <Shield size={9} /> BankID
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
            <Star size={11} fill="#f59e0b" style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{rating.toFixed(1)} ({ratingCount} omdömen)</span>
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {trip.allows_passengers && trip.seats_available > 0 && (
          <button onClick={() => onBookSeat(trip)} style={{
            flex: 1, minHeight: 44, background: 'var(--accent)', color: '#0a0a0a', border: 'none', borderRadius: 10,
            fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Boka plats
          </button>
        )}
        {trip.allows_packages && trip.weight_capacity_kg > 0 && (
          <button onClick={() => onSendPackage(trip)} style={{
            flex: 1, minHeight: 44, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10,
            fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Skicka paket →
          </button>
        )}
      </div>
    </div>
  )
}


// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ResorPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('Alla')
  const { userId } = useAuth()
  const [modalTrip, setModalTrip] = useState<{ trip: Trip; type: 'passenger' | 'package' } | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [pendingModal, setPendingModal] = useState<{ trip: Trip; type: 'passenger' | 'package' } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  function openModal(trip: Trip, type: 'passenger' | 'package') {
    if (!userId) {
      setPendingModal({ trip, type })
      setShowAuth(true)
    } else {
      setModalTrip({ trip, type })
    }
  }

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    fetch('/api/trips?status=active')
      .then(r => r.json())
      .then(d => setTrips(d.trips ?? []))
      .catch(() => setTrips([]))
      .finally(() => setLoading(false))
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const filtered = useMemo(() => {
    let r = trips
    switch (filter) {
      case 'Idag': {
        const end = new Date(today)
        end.setHours(23, 59, 59, 999)
        r = r.filter(t => { const d = new Date(t.departure_at); return d >= today && d <= end })
        break
      }
      case 'Imorgon': {
        const tEnd = new Date(tomorrow)
        tEnd.setHours(23, 59, 59, 999)
        r = r.filter(t => { const d = new Date(t.departure_at); return d >= tomorrow && d <= tEnd })
        break
      }
      case 'Stockholm':    r = r.filter(t => t.from_city.includes('Stockholm') || t.to_city.includes('Stockholm')); break
      case 'Göteborg':     r = r.filter(t => t.from_city.includes('Göteborg') || t.to_city.includes('Göteborg')); break
      case 'Norrland':     r = r.filter(t => ['Umeå','Luleå','Sundsvall','Östersund','Härnösand'].some(c => t.from_city.includes(c) || t.to_city.includes(c))); break
      case 'Lediga platser': r = r.filter(t => t.allows_passengers && t.seats_available > 0); break
      case 'Godsutrymme':  r = r.filter(t => t.allows_packages && t.weight_capacity_kg > 0); break
    }
    return r
  }, [trips, filter])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-gradient)', paddingTop: 88, paddingBottom: 80 }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 20000, background: '#0a0a0a', color: '#fff', padding: '12px 22px', borderRadius: 999, fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', animation: 'toast-in 0.2s ease both' }}>
          <span style={{ color: '#22c55e' }}>✓</span> {toast}
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '0 16px' : '0 24px' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: isMobile ? '1.6rem' : '2rem', fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em', lineHeight: 1.1 }}>Aktiva resor</h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginTop: 6, marginBottom: 0, lineHeight: 1.6 }}>
            Registrerade resor med ledigt utrymme — ta med ett paket eller boka en plats.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', marginBottom: 24 }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              flexShrink: 0, padding: '7px 14px', borderRadius: 999, border: '1px solid',
              fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              background: filter === f ? 'var(--accent)' : 'var(--surface)',
              color: filter === f ? '#0a0a0a' : 'var(--muted)',
              borderColor: filter === f ? 'var(--accent)' : 'var(--border)',
              transition: 'all 0.15s',
            }}>
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {Array.from({ length: 4 }).map((_, i) => <TripCardSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '64px 0', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Route size={24} style={{ color: 'var(--muted)' }} />
            </div>
            <div>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                {filter === 'Alla' ? 'Inga aktiva resor hittades' : `Inga resor för "${filter}"`}
              </p>
              <p style={{ fontSize: '0.84rem', color: 'var(--muted)', maxWidth: 280, margin: '0 auto' }}>
                {filter === 'Alla'
                  ? 'Inga förare har registrerat en resa just nu. Kolla tillbaka snart!'
                  : 'Prova ett annat filter eller visa alla resor.'}
              </p>
            </div>
            {filter !== 'Alla' && (
              <button onClick={() => setFilter('Alla')} style={{ minHeight: 44, padding: '0 20px', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Visa alla resor
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, animation: 'fade-in 0.3s ease both' }}>
            {filtered.map(trip => (
              <TripCard
                key={trip.id}
                trip={trip}
                onBookSeat={trip => openModal(trip, 'passenger')}
                onSendPackage={trip => openModal(trip, 'package')}
              />
            ))}
          </div>
        )}
      </div>

      {showAuth && (
        <AuthModal
          onClose={() => { setShowAuth(false); setPendingModal(null) }}
          onSuccess={() => {
            setShowAuth(false)
            if (pendingModal) { setModalTrip(pendingModal); setPendingModal(null) }
          }}
          reason={pendingModal?.type === 'package' ? 'Logga in för att skicka paket' : 'Logga in för att boka plats'}
        />
      )}
      {modalTrip && (
        <TripBookingModal
          trip={toTripInfo(modalTrip.trip)}
          initialType={modalTrip.type}
          onClose={() => setModalTrip(null)}
        />
      )}
    </div>
  )
}
