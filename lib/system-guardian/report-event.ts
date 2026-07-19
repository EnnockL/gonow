import { createServiceClient } from '@/lib/supabase'

export type EventSeverity = 'info' | 'warning' | 'critical'

export interface SystemEventInput {
  severity: EventSeverity
  source: string
  event_type: string
  message: string
  user_id?: string | null
  package_id?: string | null
  trip_id?: string | null
  order_id?: string | null
  request_id?: string | null
  metadata?: Record<string, unknown>
}

const REDACT_KEYS = [
  'password', 'secret', 'token', 'key', 'authorization',
  'card', 'cvv', 'pan', 'ssn', 'bankid', 'webhook',
  'stripe_signature', 'client_secret',
]

function redact(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(meta)) {
    if (REDACT_KEYS.some(r => k.toLowerCase().includes(r))) {
      out[k] = '[REDACTED]'
    } else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redact(v as Record<string, unknown>)
    } else {
      out[k] = v
    }
  }
  return out
}

export async function reportEvent(input: SystemEventInput): Promise<void> {
  try {
    if (!input.source || !input.event_type || !input.message) {
      console.error('[guardian] invalid event — missing required fields')
      return
    }

    const supabase = createServiceClient()
    const { error } = await supabase.from('system_events').insert({
      severity:   input.severity,
      source:     input.source,
      event_type: input.event_type,
      message:    input.message.slice(0, 1000),
      user_id:    input.user_id    ?? null,
      package_id: input.package_id ?? null,
      trip_id:    input.trip_id    ?? null,
      order_id:   input.order_id   ?? null,
      request_id: input.request_id ?? null,
      metadata:   input.metadata ? redact(input.metadata) : {},
    })

    if (error) {
      // Never throw — guardian must never break the customer journey
      console.error('[guardian] write failed:', error.message)
    }
  } catch (err) {
    console.error('[guardian] unexpected error:', err)
  }
}
