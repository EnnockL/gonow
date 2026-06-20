'use client'

import { useState, useEffect } from 'react'
import { Car, Train, Bus, Plane, MapPin, Package, Users, RotateCcw, PawPrint, ChevronDown, ChevronUp, Trash2, Clock, Check, X, Inbox } from 'lucide-react'
import { getBookingsForTrip, updateBookingStatus, type BookingRequest } from '@/lib/bookings'
import { getTripCapacitySnapshot } from '@/lib/trip-capacity'
import { useAuth } from '@/hooks/useAuth'

export interface SavedTrip {
  id: string
  carrier_id?: string
  from_city: string
  to_city: string
  departure_at: string
  vehicle_type: string
  vehicle_make?: string
  vehicle_model?: string
  vehicle_color?: string
  vehicle_plate?: string
  vehicle_seats_total?: number
  seats_available: number
  weight_capacity_kg: number
  price_per_seat: number
  price_per_kg: number
  allows_passengers: boolean
  allows_packages: boolean
  allows_returns: boolean
  allows_pets: boolean
  carrier_name: string
  carrier_phone: string
  distance_km?: number
  duration_min?: number
  registered_at: string
}

const VEHICLE_ICONS: Record<string, React.ElementType> = { car: Car, train: Train, bus: Bus, flight: Plane }
const VEHICLE_LABELS: Record<string, string> = { car: 'Bil', train: 'Tåg', bus: 'Buss', flight: 'Flyg' }

const LS_KEY = 'gonow_my_trips'

export function saveTrip(trip: Omit<SavedTrip, 'id' | 'registered_at'> & { id?: string }) {
  const all = loadTrips()
  const entry: SavedTrip = {
    ...trip,
    id: trip.id ?? crypto.randomUUID(),
    registered_at: new Date().toISOString(),
  }
  const deduped = [entry, ...all.filter((t) => t.id !== entry.id)]
  localStorage.setItem(LS_KEY, JSON.stringify(deduped))
  return entry
}

export function loadTrips(): SavedTrip[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') } catch { return [] }
}

export function loadTripsForCarrier(carrierId: string): SavedTrip[] {
  return loadTrips().filter((trip) => trip.carrier_id === carrierId)
}

function deleteTrip(id: string) {
  localStorage.setItem(LS_KEY, JSON.stringify(loadTrips().filter(t => t.id !== id)))
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('sv-SE', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

const SERVICE_LABELS: Record<string, string> = { package: 'Paket', passenger: 'Passagerare', return: 'Retur' }
const SERVICE_ICONS: Record<string, React.ElementType> = { package: Package, passenger: Users, return: RotateCcw }

function BookingCard({ b, onUpdate }: { b: BookingRequest; onUpdate: () => void }) {
  const Icon = SERVICE_ICONS[b.service_type] ?? Package
  const isPending = b.status === 'pending'

  async function accept() {
    try {
      await updateBookingStatus(b.id, 'accepted')
      onUpdate()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Kunde inte acceptera bokningen.')
    }
  }

  async function decline() {
    try {
      await updateBookingStatus(b.id, 'declined')
      onUpdate()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Kunde inte avböja bokningen.')
    }
  }

  return (
    <div style={{
      border: `1px solid ${b.status === 'accepted' ? 'rgba(34,197,94,0.3)' : b.status === 'declined' ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
      borderRadius: 12, padding: '12px 14px', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>{b.sender_name || 'Anonym'}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
            · {SERVICE_LABELS[b.service_type]}
            {b.service_type === 'passenger' && (b.seats_requested ?? 1) > 1 ? ` · ${b.seats_requested} personer` : ''}
            {b.weight_kg > 0 ? ` · ${b.weight_kg} kg` : ''}
          </span>
        </div>
        {b.status === 'accepted' && (
          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: 'rgba(34,197,94,0.12)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.25)' }}>Accepterad</span>
        )}
        {b.status === 'declined' && (
          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>Avböjd</span>
        )}
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {b.pickup_address && <span>↑ {b.pickup_address}</span>}
        {b.dropoff_address && <span>↓ {b.dropoff_address}</span>}
        {b.sender_phone && <span>📞 {b.sender_phone}</span>}
        {b.description && <span style={{ fontStyle: 'italic', marginTop: 2 }}>"{b.description}"</span>}
      </div>
      {!isPending ? null : (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={accept}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.35)', background: 'rgba(34,197,94,0.08)', color: 'var(--success)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.16)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.08)')}
          >
            <Check size={12} /> Acceptera
          </button>
          <button
            onClick={decline}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.05)', color: '#ef4444', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.05)')}
          >
            <X size={12} /> Avböj
          </button>
        </div>
      )}
    </div>
  )
}

function TripCard({ trip, onDelete }: { trip: SavedTrip; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const [bookings, setBookings] = useState<BookingRequest[]>([])
  const [isMobile, setIsMobile] = useState(false)
  const VehicleIcon = VEHICLE_ICONS[trip.vehicle_type] ?? Car

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  async function refreshBookings() {
    const next = await getBookingsForTrip(trip.id)
    setBookings(next)
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      const next = await getBookingsForTrip(trip.id)
      if (active) setBookings(next)
    }

    load()
    window.addEventListener('gonow_booking_received', refreshBookings)
    return () => {
      active = false
      window.removeEventListener('gonow_booking_received', refreshBookings)
    }
  }, [trip.id])

  const pendingCount = bookings.filter(b => b.status === 'pending').length
  const capacity = getTripCapacitySnapshot(trip, bookings)

  const allowedTags = [
    trip.allows_packages   && { icon: Package,  label: 'Paket'       },
    trip.allows_passengers && { icon: Users,     label: 'Passagerare' },
    trip.allows_returns    && { icon: RotateCcw, label: 'Returer'     },
    trip.allows_pets       && { icon: PawPrint,  label: 'Husdjur'     },
  ].filter(Boolean) as { icon: React.ElementType; label: string }[]

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden', transition: 'border-color 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(34,197,94,0.3)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      {/* Header row — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', background: 'none', border: 'none', padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit' }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <VehicleIcon size={16} style={{ color: 'var(--accent)' }} />
        </div>

        <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{trip.from_city.split(',')[0]}</span>
            <span style={{ color: 'var(--accent)', flexShrink: 0 }}>→</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{trip.to_city.split(',')[0]}</span>
          </p>
          <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={10} />
            {fmtDate(trip.departure_at)}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {pendingCount > 0 && (
            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: 'rgba(34,197,94,0.15)', color: 'var(--accent)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Inbox size={10} /> {pendingCount}
            </span>
          )}
          <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '3px 10px', borderRadius: 100, background: 'rgba(34,197,94,0.1)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.2)' }}>
            Aktiv
          </span>
          {open ? <ChevronUp size={14} style={{ color: 'var(--muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--muted)' }} />}
        </div>
      </button>

      {/* Expanded details */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Route full */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[['Från', trip.from_city], ['Till', trip.to_city]].map(([lbl, val]) => (
              <div key={lbl} style={{ display: 'flex', gap: 8, fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--muted)', flexShrink: 0, width: 28 }}>{lbl}</span>
                <span style={{ color: 'var(--text)', fontWeight: 500, wordBreak: 'break-word' }}>{val}</span>
              </div>
            ))}
            {trip.distance_km && (
              <div style={{ display: 'flex', gap: 8, fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--muted)', flexShrink: 0, width: 28 }}>Km</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{trip.distance_km} km · {Math.floor((trip.duration_min ?? 0) / 60)}h {(trip.duration_min ?? 0) % 60}min</span>
              </div>
            )}
            {(capacity.acceptedPassengers > 0 || capacity.acceptedPackages > 0) && (
              <div style={{ display: 'flex', gap: 8, fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--muted)', flexShrink: 0, width: 28 }}>Live</span>
                <span style={{ color: 'var(--text)', fontWeight: 500 }}>
                  {capacity.acceptedPassengers} passagerare accepterade · {capacity.acceptedPackages} paket accepterade
                </span>
              </div>
            )}
          </div>

          {/* Kapacitet + pris */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
            {[
              ['Maxvikt', `${trip.weight_capacity_kg} kg`],
              ['Lediga nu', `${capacity.seatsLeft ?? trip.seats_available} st`],
              ['Vikt kvar', `${capacity.weightLeftKg ?? trip.weight_capacity_kg} kg`],
              ['Pris/kg', `${trip.price_per_kg} kr`],
              ['Pris/plats', `${trip.price_per_seat} kr`],
            ].map(([k, v]) => (
              <div key={k} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px' }}>
                <p style={{ fontSize: '0.68rem', color: 'var(--muted)', marginBottom: 2 }}>{k}</p>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{v}</p>
              </div>
            ))}
          </div>

          {/* Tillåter */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {allowedTags.map(({ icon: Icon, label }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', padding: '4px 10px', borderRadius: 100, border: '1px solid rgba(34,197,94,0.25)', background: 'var(--accent-softer)', color: 'var(--accent)', fontWeight: 500 }}>
                <Icon size={10} /> {label}
              </span>
            ))}
          </div>

          {/* Bokningsförfrågningar */}
          <div>
            <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Inbox size={11} /> Bokningsförfrågningar
              {bookings.length > 0 && <span style={{ fontWeight: 400, color: 'var(--muted)' }}>({bookings.length})</span>}
            </p>
            {bookings.length === 0 ? (
              <p style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic' }}>Inga förfrågningar ännu.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bookings.map(b => (
                  <BookingCard key={b.id} b={b} onUpdate={refreshBookings} />
                ))}
              </div>
            )}
          </div>

          {/* Kontakt + radera */}
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: isMobile ? 10 : 0, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
              {trip.carrier_name && <span style={{ fontWeight: 500, color: 'var(--text)' }}>{trip.carrier_name} · </span>}
              {trip.carrier_phone}
            </p>
            <button
              onClick={e => { e.stopPropagation(); onDelete() }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', transition: 'color 0.15s' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#ef4444')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--muted)')}
            >
              <Trash2 size={12} /> Ta bort
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MyTrips() {
  const { userId } = useAuth()
  const [trips, setTrips] = useState<SavedTrip[]>([])

  useEffect(() => {
    if (!userId) {
      setTrips([])
      return
    }

    setTrips(loadTripsForCarrier(userId))
    // Refresh when storage changes (e.g. after registration)
    const onStorage = () => setTrips(loadTripsForCarrier(userId))
    window.addEventListener('gonow_trips_updated', onStorage)
    return () => window.removeEventListener('gonow_trips_updated', onStorage)
  }, [userId])

  function remove(id: string) {
    deleteTrip(id)
    if (userId) {
      setTrips(loadTripsForCarrier(userId))
    }
  }

  if (trips.length === 0) return (
    <div style={{ textAlign: 'center', padding: '32px 16px', border: '1px dashed var(--border)', borderRadius: 14 }}>
      <MapPin size={20} style={{ color: 'var(--muted)', marginBottom: 8 }} />
      <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Inga registrerade resor än.</p>
      <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 4 }}>Fyll i formuläret till vänster för att lägga till en.</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {trips.map(trip => (
        <TripCard key={trip.id} trip={trip} onDelete={() => remove(trip.id)} />
      ))}
    </div>
  )
}
