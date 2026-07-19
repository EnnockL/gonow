'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Car, Clock, Package as PackageIcon, Route, Shield, Star, Users } from 'lucide-react'
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

const CARD_SURFACE: CSSProperties = {
  background: 'linear-gradient(180deg, color-mix(in srgb, var(--surface) 94%, white 6%) 0%, var(--surface) 100%)',
  border: '1px solid color-mix(in srgb, var(--border) 84%, var(--gn) 16%)',
  boxShadow: '0 24px 50px rgba(15, 23, 42, 0.08)',
}

function formatDep(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const day = new Date(iso)
  day.setHours(0, 0, 0, 0)
  const prefix =
    day.getTime() === today.getTime()
      ? 'Idag'
      : day.getTime() === tomorrow.getTime()
        ? 'Imorgon'
        : d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${prefix} kl ${d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
}

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

function StatCard({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <div
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        padding: '14px 14px 12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 122,
      }}
    >
      <div style={{ fontSize: '1.75rem', fontWeight: 950, color: 'var(--text)', letterSpacing: '-0.05em' }}>{value}</div>
      <div>
        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 5, lineHeight: 1.55 }}>{hint}</div>
      </div>
    </div>
  )
}

function TripCard({
  trip,
  onBookSeat,
  onSendPackage,
}: {
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
    <div
      style={{
        ...CARD_SURFACE,
        borderRadius: 24,
        padding: 22,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: '-18%',
          bottom: '-44%',
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(146,255,99,0.16) 0%, rgba(146,255,99,0.04) 38%, transparent 72%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span
            style={{
              alignSelf: 'flex-start',
              fontSize: '0.68rem',
              fontWeight: 800,
              color: 'var(--gn-dk)',
              background: 'var(--gn-010)',
              border: '1px solid var(--gn-020)',
              padding: '6px 10px',
              borderRadius: 999,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Aktiv rutt
          </span>
          <div>
            <p style={{ fontSize: '1.18rem', fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em' }}>
              {trip.from_city} <span style={{ color: 'var(--muted)' }}>→</span> {trip.to_city}
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: '4px 0 0', lineHeight: 1.6 }}>
              Registrerad för snabb bokning, paket eller samåkning.
            </p>
          </div>
        </div>

        <div
          style={{
            textAlign: 'right',
            flexShrink: 0,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '10px 12px',
            minWidth: 126,
          }}
        >
          <p
            style={{
              fontSize: '0.8rem',
              fontWeight: 800,
              color: 'var(--text)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              justifyContent: 'flex-end',
            }}
          >
            <Clock size={12} /> {formatDep(trip.departure_at)}
          </p>
          {trip.vehicle_type && (
            <p style={{ fontSize: '0.68rem', color: 'var(--muted)', margin: '5px 0 0' }}>
              <Car size={10} style={{ display: 'inline', marginRight: 3 }} />
              {VEHICLE_LABELS[trip.vehicle_type] ?? trip.vehicle_type}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(164px, 1fr))', gap: 10 }}>
        {trip.allows_passengers && trip.seats_available > 0 && (
          <div style={{ background: 'var(--gn-008)', border: '1px solid var(--gn-020)', borderRadius: 16, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Users size={13} style={{ color: 'var(--gn)' }} />
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Passagerare</span>
            </div>
            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text)' }}>
              {trip.seats_available === 1 ? '1 plats kvar' : `${trip.seats_available} platser kvar`}
            </span>
            {trip.price_per_seat && <span style={{ fontSize: '0.74rem', color: 'var(--gn-dk)', fontWeight: 700 }}>Från {trip.price_per_seat} kr / plats</span>}
          </div>
        )}

        {trip.allows_packages && trip.weight_capacity_kg > 0 && (
          <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: 16, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <PackageIcon size={13} style={{ color: 'var(--gn)' }} />
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Paketutrymme</span>
            </div>
            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text)' }}>
              {trip.weight_capacity_kg === 1 ? '1 kg ledigt' : `${trip.weight_capacity_kg} kg ledigt`}
            </span>
            {trip.price_per_kg && <span style={{ fontSize: '0.74rem', color: 'var(--gn-dk)', fontWeight: 700 }}>{trip.price_per_kg} kr / kg</span>}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        {avatar ? (
          <img src={avatar} alt={name} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 900, color: '#0a0a0a' }}>
            {name[0]}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)' }}>{name}</span>
            {verified && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.62rem', fontWeight: 700, color: 'var(--gn)', background: 'var(--gn-010)', padding: '4px 8px', borderRadius: 999 }}>
                <Shield size={9} /> BankID
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Star size={11} fill="#f59e0b" style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{rating.toFixed(1)} • {ratingCount} omdömen</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {trip.allows_passengers && trip.seats_available > 0 && (
          <button
            onClick={() => onBookSeat(trip)}
            style={{
              flex: 1,
              minHeight: 46,
              background: 'var(--accent)',
              color: '#0a0a0a',
              border: 'none',
              borderRadius: 12,
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Boka plats
          </button>
        )}

        {trip.allows_packages && trip.weight_capacity_kg > 0 && (
          <button
            onClick={() => onSendPackage(trip)}
            style={{
              flex: 1,
              minHeight: 46,
              background: 'var(--surface-2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Skicka paket →
          </button>
        )}
      </div>
    </div>
  )
}

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
      .then((r) => r.json())
      .then((d) => setTrips(d.trips ?? []))
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
    let result = trips
    switch (filter) {
      case 'Idag': {
        const end = new Date(today)
        end.setHours(23, 59, 59, 999)
        result = result.filter((t) => {
          const d = new Date(t.departure_at)
          return d >= today && d <= end
        })
        break
      }
      case 'Imorgon': {
        const end = new Date(tomorrow)
        end.setHours(23, 59, 59, 999)
        result = result.filter((t) => {
          const d = new Date(t.departure_at)
          return d >= tomorrow && d <= end
        })
        break
      }
      case 'Stockholm':
        result = result.filter((t) => t.from_city.includes('Stockholm') || t.to_city.includes('Stockholm'))
        break
      case 'Göteborg':
        result = result.filter((t) => t.from_city.includes('Göteborg') || t.to_city.includes('Göteborg'))
        break
      case 'Norrland':
        result = result.filter((t) => ['Umeå', 'Luleå', 'Sundsvall', 'Östersund', 'Härnösand'].some((city) => t.from_city.includes(city) || t.to_city.includes(city)))
        break
      case 'Lediga platser':
        result = result.filter((t) => t.allows_passengers && t.seats_available > 0)
        break
      case 'Godsutrymme':
        result = result.filter((t) => t.allows_packages && t.weight_capacity_kg > 0)
        break
    }
    return result
  }, [filter, today, tomorrow, trips])

  const stats = [
    { value: String(trips.length), label: 'aktiva resor', hint: 'Verifierade rutter i nätverket just nu' },
    { value: String(trips.filter((t) => t.seats_available > 0).length), label: 'med lediga platser', hint: 'Samåkning och persontransporter' },
    { value: String(trips.filter((t) => t.weight_capacity_kg > 0).length), label: 'med paketutrymme', hint: 'Bokningsbara fraktmöjligheter' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-gradient)', paddingTop: 88, paddingBottom: 80 }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20000,
            background: '#0a0a0a',
            color: '#fff',
            padding: '12px 22px',
            borderRadius: 999,
            fontSize: '0.85rem',
            fontWeight: 600,
            boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: 'var(--gn)' }}>✓</span> {toast}
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '0 16px' : '0 24px' }}>
        <div style={{ ...CARD_SURFACE, borderRadius: isMobile ? 26 : 30, padding: isMobile ? '20px 18px' : '28px 28px 24px', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: -32, bottom: -52, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(146,255,99,0.16) 0%, rgba(146,255,99,0.03) 50%, transparent 76%)' }} />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.25fr) minmax(280px, 0.75fr)', gap: 22, position: 'relative' }}>
            <div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', fontWeight: 800, color: 'var(--gn-dk)', background: 'var(--gn-010)', border: '1px solid var(--gn-020)', padding: '7px 12px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                <Route size={13} /> Marketplace live
              </span>
              <h1 style={{ fontSize: isMobile ? '1.8rem' : '2.35rem', fontWeight: 950, color: 'var(--text)', margin: 0, letterSpacing: '-0.05em', lineHeight: 1.02 }}>
                Bokningsbara resor
                <br />
                för paket och personer.
              </h1>
              <p style={{ fontSize: isMobile ? '0.92rem' : '0.98rem', color: 'var(--muted)', marginTop: 12, marginBottom: 0, lineHeight: 1.7, maxWidth: 640 }}>
                Jämför aktiva rutter, verifierade förare och tillgänglig kapacitet i ett lugnt, tydligt flöde som känns premium på både mobil och desktop.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {stats.map((item) => (
                <StatCard key={item.label} value={item.value} label={item.label} hint={item.hint} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', marginBottom: 24 }}>
          {FILTERS.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              style={{
                flexShrink: 0,
                padding: '8px 14px',
                borderRadius: 999,
                border: '1px solid',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: filter === item ? 'var(--accent)' : 'var(--surface)',
                color: filter === item ? '#0a0a0a' : 'var(--muted)',
                borderColor: filter === item ? 'var(--accent)' : 'var(--border)',
              }}
            >
              {item}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {Array.from({ length: 4 }).map((_, index) => (
              <TripCardSkeleton key={index} />
            ))}
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
                {filter === 'Alla' ? 'Inga förare har registrerat en resa just nu. Kolla tillbaka snart.' : 'Prova ett annat filter eller visa alla resor.'}
              </p>
            </div>
            {filter !== 'Alla' && (
              <button
                onClick={() => setFilter('Alla')}
                style={{
                  minHeight: 44,
                  padding: '0 20px',
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Visa alla resor
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {filtered.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onBookSeat={(selectedTrip) => openModal(selectedTrip, 'passenger')}
                onSendPackage={(selectedTrip) => openModal(selectedTrip, 'package')}
              />
            ))}
          </div>
        )}
      </div>

      {showAuth && (
        <AuthModal
          onClose={() => {
            setShowAuth(false)
            setPendingModal(null)
          }}
          onSuccess={() => {
            setShowAuth(false)
            if (pendingModal) {
              setModalTrip(pendingModal)
              setPendingModal(null)
              showToast('Du är inloggad. Fortsätt med bokningen.')
            }
          }}
          reason="Logga in för att boka plats"
        />
      )}

      {modalTrip && (
        <TripBookingModal
          trip={toTripInfo(modalTrip.trip)}
          initialType={modalTrip.type}
          lockType={true}
          onClose={() => setModalTrip(null)}
        />
      )}
    </div>
  )
}
