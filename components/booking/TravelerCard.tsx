import { Trip } from '@/lib/types'
import { Star, Shield, Package, Car } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

interface TravelerCardProps {
  trip: Trip & { users?: { name: string; rating_avg: number; rating_count: number; avatar_url?: string } }
  price: number
  onSelect: () => void
  selected?: boolean
}

export default function TravelerCard({ trip, price, onSelect, selected }: TravelerCardProps) {
  const carrier = trip.users
  const initials = carrier?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'GN'

  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left transition-all ${
        selected
          ? 'border-[var(--accent)] bg-[var(--accent)]/5'
          : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/50'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/20 text-sm font-bold text-[var(--accent)]">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-semibold text-[var(--text)]">{carrier?.name || 'Anonym bärare'}</p>
            <span className="text-xl font-bold text-[var(--accent)]">{price} kr</span>
          </div>
          <div className="mt-1 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-[var(--muted)]">
              <Star size={12} className="text-yellow-400 fill-yellow-400" />
              {carrier?.rating_avg?.toFixed(1) || '5.0'} ({carrier?.rating_count || 0})
            </span>
            {trip.departure_at && (
              <span className="text-xs text-[var(--muted)]">
                {format(new Date(trip.departure_at), 'EEE d MMM, HH:mm', { locale: sv })}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success)]/10 px-2 py-0.5 text-xs text-[var(--success)]">
              <Shield size={10} />
              BankID
            </span>
            {trip.vehicle_type && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]">
                <Car size={10} />
                {trip.vehicle_type}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]">
              <Package size={10} />
              Max {trip.weight_capacity_kg} kg
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}
