import { OrderStatus } from '@/lib/types'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'

const STEPS: { status: OrderStatus; label: string; desc: string }[] = [
  { status: 'matched', label: 'Matchad', desc: 'Bärare accepterade ditt uppdrag' },
  { status: 'picked_up', label: 'Upphämtad', desc: 'Paketet är hämtat' },
  { status: 'in_transit', label: 'På väg', desc: 'Resan pågår — spåra live' },
  { status: 'delivered', label: 'Levererad', desc: 'Framme hos mottagaren' },
  { status: 'confirmed', label: 'Bekräftad', desc: 'Mottagaren har scannat QR-koden' },
]

const ORDER: OrderStatus[] = ['pending', 'matched', 'picked_up', 'in_transit', 'delivered', 'confirmed']

interface Props { status: OrderStatus }

export default function TrackingTimeline({ status }: Props) {
  const currentIdx = ORDER.indexOf(status)

  return (
    <div className="flex flex-col gap-0">
      {STEPS.map((step, i) => {
        const stepIdx = ORDER.indexOf(step.status)
        const done = stepIdx < currentIdx
        const active = stepIdx === currentIdx

        return (
          <div key={step.status} className="flex gap-4">
            <div className="flex flex-col items-center">
              {done ? (
                <CheckCircle2 size={20} className="text-[var(--success)] flex-shrink-0" />
              ) : active ? (
                <Loader2 size={20} className="text-[var(--accent)] animate-spin flex-shrink-0" />
              ) : (
                <Circle size={20} className="text-[var(--border)] flex-shrink-0" />
              )}
              {i < STEPS.length - 1 && (
                <div className={`w-px flex-1 my-1 ${done ? 'bg-[var(--success)]' : 'bg-[var(--border)]'}`} style={{ minHeight: 24 }} />
              )}
            </div>
            <div className="pb-5">
              <p className={`text-sm font-medium ${done || active ? 'text-[var(--text)]' : 'text-[var(--muted)]'}`}>
                {step.label}
              </p>
              <p className="text-xs text-[var(--muted)]">{step.desc}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
