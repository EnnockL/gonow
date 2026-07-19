'use client'

import { useEffect, useState } from 'react'
import {
  Bus,
  Car,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Inbox,
  MapPin,
  Package,
  PawPrint,
  Plane,
  RotateCcw,
  Train,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { authedFetch } from '@/lib/auth/authed-fetch'

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

type DriverTripMatch = {
  id: string
  trip_id?: string | null
  status: string
  proposed_price?: number | null
  ai_message_driver?: string | null
  packages?: {
    id: string
    from_city: string
    to_city: string
    description?: string | null
    weight_kg?: number | null
    price_ceiling?: number | null
  } | null
}

const VEHICLE_ICONS: Record<string, React.ElementType> = { car: Car, train: Train, bus: Bus, flight: Plane }

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

function syncTripsCache(trips: SavedTrip[]) {
  if (typeof window === 'undefined') return trips
  localStorage.setItem(LS_KEY, JSON.stringify(trips))
  return trips
}

export function loadTrips(): SavedTrip[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function loadTripsForCarrier(carrierId: string): SavedTrip[] {
  return loadTrips().filter((trip) => trip.carrier_id === carrierId)
}

function deleteTrip(id: string) {
  localStorage.setItem(LS_KEY, JSON.stringify(loadTrips().filter((t) => t.id !== id)))
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('sv-SE', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function getMatchStateLabel(status: string) {
  if (status === 'matched') return { label: 'Transport klar', color: 'var(--success)', bg: 'var(--gn-012)', border: 'var(--gn-025)' }
  if (status === 'paid') return { label: 'Betald', color: 'var(--gn-dk)', bg: 'var(--gn-012)', border: 'var(--gn-025)' }
  if (status === 'cancelled') return { label: 'Avböjd', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' }
  return { label: 'Väntar svar', color: '#b45309', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' }
}

function MatchCard({ match, onUpdate }: { match: DriverTripMatch; onUpdate: () => void }) {
  const pkg = match.packages
  const state = getMatchStateLabel(match.status)
  const isPending = match.status === 'driver_pending_confirmation'

  async function submit(action: 'driver_confirm' | 'driver_decline') {
    try {
      const res = await authedFetch(`/api/matches/${match.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(payload.error || 'Kunde inte uppdatera förfrågan.')
      }
      onUpdate()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Kunde inte uppdatera förfrågan.')
    }
  }

  return (
    <div
      style={{
        border: `1px solid ${state.border}`,
        borderRadius: 12,
        padding: '12px 14px',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <Package size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {pkg?.from_city ?? 'Paket'} → {pkg?.to_city ?? ''}
          </span>
        </div>
        <span
          style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 100,
            background: state.bg,
            color: state.color,
            border: `1px solid ${state.border}`,
            flexShrink: 0,
          }}
        >
          {state.label}
        </span>
      </div>

      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {pkg?.description && <span style={{ fontStyle: 'italic' }}>"{pkg.description}"</span>}
        {pkg?.weight_kg ? <span>{pkg.weight_kg} kg</span> : null}
        {match.proposed_price != null ? <span>{match.proposed_price} kr</span> : null}
        {match.ai_message_driver ? <span>{match.ai_message_driver}</span> : null}
      </div>

      {isPending ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => submit('driver_confirm')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              padding: '7px',
              borderRadius: 8,
              border: '1px solid var(--gn-035)',
              background: 'var(--gn-008)',
              color: 'var(--success)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <Check size={12} /> Acceptera
          </button>
          <button
            onClick={() => submit('driver_decline')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              padding: '7px',
              borderRadius: 8,
              border: '1px solid rgba(239,68,68,0.25)',
              background: 'rgba(239,68,68,0.05)',
              color: '#ef4444',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <X size={12} /> Avböj
          </button>
        </div>
      ) : null}
    </div>
  )
}

function TripCard({ trip, onDelete }: { trip: SavedTrip; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const [matches, setMatches] = useState<DriverTripMatch[]>([])
  const [isMobile, setIsMobile] = useState(false)
  const VehicleIcon = VEHICLE_ICONS[trip.vehicle_type] ?? Car

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  async function refreshMatches() {
    if (!trip.carrier_id) {
      setMatches([])
      return
    }
    const res = await authedFetch(`/api/matches?driver_id=${trip.carrier_id}`)
    const payload = await res.json().catch(() => ({ matches: [] }))
    const next = ((res.ok ? payload.matches : []) ?? []) as DriverTripMatch[]
    setMatches(next.filter((match) => match.trip_id === trip.id && match.status !== 'expired'))
  }

  useEffect(() => {
    let active = true

    async function load() {
      if (!trip.carrier_id) {
        if (active) setMatches([])
        return
      }

      try {
        const res = await authedFetch(`/api/matches?driver_id=${trip.carrier_id}`)
        const payload = await res.json().catch(() => ({ matches: [] }))
        const next = ((res.ok ? payload.matches : []) ?? []) as DriverTripMatch[]
        if (active) {
          setMatches(next.filter((match) => match.trip_id === trip.id && match.status !== 'expired'))
        }
      } catch {
        if (active) setMatches([])
      }
    }

    void load()
    window.addEventListener('gonow_booking_received', refreshMatches)
    return () => {
      active = false
      window.removeEventListener('gonow_booking_received', refreshMatches)
    }
  }, [trip.id, trip.carrier_id])

  const pendingCount = matches.filter((match) => match.status === 'driver_pending_confirmation').length
  const acceptedPackages = matches.filter((match) => ['matched', 'paid', 'picked_up', 'in_transit', 'delivered', 'confirmed'].includes(match.status))
  const acceptedWeightKg = acceptedPackages.reduce((sum, match) => sum + Number(match.packages?.weight_kg || 0), 0)
  const weightLeftKg =
    typeof trip.weight_capacity_kg === 'number'
      ? Math.max(0, Number(trip.weight_capacity_kg) - acceptedWeightKg)
      : null

  const allowedTags = [
    trip.allows_packages && { icon: Package, label: 'Paket' },
    trip.allows_passengers && { icon: Users, label: 'Passagerare' },
    trip.allows_returns && { icon: RotateCcw, label: 'Returer' },
    trip.allows_pets && { icon: PawPrint, label: 'Husdjur' },
  ].filter(Boolean) as { icon: React.ElementType; label: string }[]

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 14,
        background: 'var(--surface)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen((value) => !value)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          padding: '14px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: 'inherit',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'var(--accent-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <VehicleIcon size={16} style={{ color: 'var(--accent)' }} />
        </div>

        <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
          <p
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
              {trip.from_city.split(',')[0]}
            </span>
            <span style={{ color: 'var(--accent)', flexShrink: 0 }}>→</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
              {trip.to_city.split(',')[0]}
            </span>
          </p>
          <p
            style={{
              fontSize: '0.72rem',
              color: 'var(--muted)',
              marginTop: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Clock size={10} />
            {fmtDate(trip.departure_at)}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {pendingCount > 0 ? (
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 100,
                background: 'var(--gn-015)',
                color: 'var(--accent)',
                border: '1px solid var(--gn-030)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Inbox size={10} /> {pendingCount}
            </span>
          ) : null}
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: 100,
              background: 'var(--gn-010)',
              color: 'var(--success)',
              border: '1px solid var(--gn-020)',
            }}
          >
            Aktiv
          </span>
          {open ? <ChevronUp size={14} style={{ color: 'var(--muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--muted)' }} />}
        </div>
      </button>

      {open ? (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            padding: '16px 16px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              ['Från', trip.from_city],
              ['Till', trip.to_city],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', gap: 8, fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--muted)', flexShrink: 0, width: 28 }}>{label}</span>
                <span style={{ color: 'var(--text)', fontWeight: 500, wordBreak: 'break-word' }}>{value}</span>
              </div>
            ))}
            {trip.distance_km ? (
              <div style={{ display: 'flex', gap: 8, fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--muted)', flexShrink: 0, width: 28 }}>Km</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                  {trip.distance_km} km · {Math.floor((trip.duration_min ?? 0) / 60)}h {(trip.duration_min ?? 0) % 60}min
                </span>
              </div>
            ) : null}
            {acceptedPackages.length > 0 ? (
              <div style={{ display: 'flex', gap: 8, fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--muted)', flexShrink: 0, width: 28 }}>Live</span>
                <span style={{ color: 'var(--text)', fontWeight: 500 }}>
                  {acceptedPackages.length} paket accepterade
                </span>
              </div>
            ) : null}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
            {[
              ['Maxvikt', `${trip.weight_capacity_kg} kg`],
              ['Lediga nu', `${trip.seats_available} st`],
              ['Vikt kvar', `${weightLeftKg ?? trip.weight_capacity_kg} kg`],
              ['Pris/kg', `${trip.price_per_kg} kr`],
              ['Pris/plats', `${trip.price_per_seat} kr`],
            ].map(([label, value]) => (
              <div key={label} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px' }}>
                <p style={{ fontSize: '0.68rem', color: 'var(--muted)', marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{value}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {allowedTags.map(({ icon: Icon, label }) => (
              <span
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: '0.72rem',
                  padding: '4px 10px',
                  borderRadius: 100,
                  border: '1px solid var(--gn-025)',
                  background: 'var(--accent-softer)',
                  color: 'var(--accent)',
                  fontWeight: 500,
                }}
              >
                <Icon size={10} /> {label}
              </span>
            ))}
          </div>

          <div>
            <p
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Inbox size={11} /> Paketförfrågningar
              {matches.length > 0 ? <span style={{ fontWeight: 400, color: 'var(--muted)' }}>({matches.length})</span> : null}
            </p>
            {matches.length === 0 ? (
              <p style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic' }}>Inga förfrågningar ännu.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {matches.map((match) => (
                  <MatchCard key={match.id} match={match} onUpdate={refreshMatches} />
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'flex-start' : 'center',
              justifyContent: 'space-between',
              gap: isMobile ? 10 : 0,
              paddingTop: 4,
              borderTop: '1px solid var(--border)',
            }}
          >
            <p style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
              {trip.carrier_name ? <span style={{ fontWeight: 500, color: 'var(--text)' }}>{trip.carrier_name} · </span> : null}
              {trip.carrier_phone}
            </p>
            <button
              onClick={(event) => {
                event.stopPropagation()
                onDelete()
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 6,
                color: 'var(--muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.72rem',
              }}
            >
              <Trash2 size={12} /> Ta bort
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function MyTrips() {
  const { userId } = useAuth()
  const [trips, setTrips] = useState<SavedTrip[]>([])

  useEffect(() => {
    let active = true

    async function refreshTrips() {
      if (!userId) {
        if (active) setTrips([])
        return
      }

      const localTrips = loadTripsForCarrier(userId)

      try {
        const res = await authedFetch(`/api/trips?carrier_id=${userId}`)
        const payload = await res.json().catch(() => ({ trips: [] }))
        const remoteTrips = ((res.ok ? payload.trips : []) ?? []) as SavedTrip[]
        const unsyncedLocalTrips = localTrips.filter((trip) => !remoteTrips.some((remote) => remote.id === trip.id))
        const combinedTrips = [...remoteTrips, ...unsyncedLocalTrips]
        syncTripsCache(combinedTrips)
        if (active) setTrips(combinedTrips)
      } catch {
        if (active) setTrips(localTrips)
      }
    }

    if (!userId) {
      setTrips([])
      return
    }

    void refreshTrips()
    const onStorage = () => {
      void refreshTrips()
    }
    window.addEventListener('gonow_trips_updated', onStorage)
    return () => {
      active = false
      window.removeEventListener('gonow_trips_updated', onStorage)
    }
  }, [userId])

  function remove(id: string) {
    deleteTrip(id)
    if (userId) {
      setTrips(loadTripsForCarrier(userId))
    }
  }

  if (trips.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 16px', border: '1px dashed var(--border)', borderRadius: 14 }}>
        <MapPin size={20} style={{ color: 'var(--muted)', marginBottom: 8 }} />
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Inga registrerade resor än.</p>
        <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 4 }}>Fyll i formuläret till vänster för att lägga till en.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {trips.map((trip) => (
        <TripCard key={trip.id} trip={trip} onDelete={() => remove(trip.id)} />
      ))}
    </div>
  )
}
