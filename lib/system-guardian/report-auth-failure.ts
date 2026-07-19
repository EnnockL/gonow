import { createHash } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { reportEvent } from './report-event'

const recentAttempts = new Map<string, number>()
const WINDOW_MS = 60_000

export async function reportAuthFailure(
  req: NextRequest,
  input: { endpoint: string; method: string; message: string; userId?: string | null },
) {
  const source = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('user-agent')
    || 'unknown'
  const fingerprint = createHash('sha256').update(source).digest('hex').slice(0, 12)
  const key = `${input.endpoint}:${fingerprint}`
  const now = Date.now()
  const previous = recentAttempts.get(key) ?? 0
  if (now - previous < WINDOW_MS) return

  recentAttempts.set(key, now)
  if (recentAttempts.size > 1000) {
    for (const [entry, timestamp] of recentAttempts) {
      if (now - timestamp > WINDOW_MS) recentAttempts.delete(entry)
    }
  }

  await reportEvent({
    severity: 'warning',
    source: 'security',
    event_type: 'auth_failure',
    message: input.message,
    user_id: input.userId ?? null,
    metadata: { endpoint: input.endpoint, method: input.method, fingerprint },
  })
}
