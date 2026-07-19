import { createHmac } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const WINDOW_MINUTES = 10
const WINDOW_MS = WINDOW_MINUTES * 60_000
const ACCOUNT_LIMIT = 5
const SOURCE_LIMIT = 20

type SecurityMetadata = {
  count?: number
  identifier_fingerprint?: string
  source_fingerprint?: string
  masked_identifier?: string
  risk?: string
  action?: string
  window_minutes?: number
}

function signingKey() {
  return process.env.GUARDIAN_FINGERPRINT_SECRET
    || process.env.CRON_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || 'gonow-guardian-local-fallback'
}

function fingerprint(value: string) {
  return createHmac('sha256', signingKey()).update(value).digest('hex').slice(0, 16)
}

function sourceFrom(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')?.trim()
    || req.headers.get('user-agent')
    || 'unknown'
}

function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  if (!domain) return 'okänt konto'
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`
}

function totalAttempts(rows: Array<{ metadata: SecurityMetadata }> | null) {
  return (rows ?? []).reduce((sum, row) => sum + Math.max(1, Number(row.metadata?.count ?? 1)), 0)
}

export function getLoginIdentity(req: NextRequest, email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  return {
    normalizedEmail,
    maskedIdentifier: maskEmail(normalizedEmail),
    identifierFingerprint: fingerprint(`account:${normalizedEmail}`),
    sourceFingerprint: fingerprint(`source:${sourceFrom(req)}`),
  }
}

export async function checkLoginRateLimit(req: NextRequest, email: string) {
  const identity = getLoginIdentity(req, email)
  const db = createServiceClient()
  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const selection = 'metadata, created_at'

  const [accountResult, sourceResult] = await Promise.all([
    db.from('system_events').select(selection)
      .eq('event_type', 'login_failed').is('resolved_at', null)
      .gte('created_at', since)
      .contains('metadata', { identifier_fingerprint: identity.identifierFingerprint }),
    db.from('system_events').select(selection)
      .eq('event_type', 'login_failed').is('resolved_at', null)
      .gte('created_at', since)
      .contains('metadata', { source_fingerprint: identity.sourceFingerprint }),
  ])

  // Fail open if monitoring storage is unavailable; Supabase Auth still applies its own limits.
  if (accountResult.error || sourceResult.error) {
    console.error('[guardian] login rate-limit read failed:', accountResult.error?.message || sourceResult.error?.message)
    return { blocked: false, retryAfter: 0, identity }
  }

  const accountAttempts = totalAttempts(accountResult.data as Array<{ metadata: SecurityMetadata }> | null)
  const sourceAttempts = totalAttempts(sourceResult.data as Array<{ metadata: SecurityMetadata }> | null)
  const blocked = accountAttempts >= ACCOUNT_LIMIT || sourceAttempts >= SOURCE_LIMIT

  return {
    blocked,
    retryAfter: blocked ? Math.ceil(WINDOW_MS / 1000) : 0,
    identity,
  }
}

export async function recordFailedLogin(req: NextRequest, email: string, blocked = false) {
  const identity = getLoginIdentity(req, email)
  const db = createServiceClient()
  const since = new Date(Date.now() - WINDOW_MS).toISOString()

  const { data: existing } = await db.from('system_events')
    .select('id, metadata')
    .eq('event_type', 'login_failed')
    .is('resolved_at', null)
    .gte('created_at', since)
    .contains('metadata', {
      identifier_fingerprint: identity.identifierFingerprint,
      source_fingerprint: identity.sourceFingerprint,
    })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const previous = (existing?.metadata ?? {}) as SecurityMetadata
  const count = Math.max(0, Number(previous.count ?? 0)) + 1
  const risk = blocked || count >= ACCOUNT_LIMIT ? 'critical' : count >= 3 ? 'high' : 'medium'
  const action = blocked || count >= ACCOUNT_LIMIT ? 'Tillfälligt begränsad' : 'Övervakas'
  const metadata: SecurityMetadata = {
    count,
    identifier_fingerprint: identity.identifierFingerprint,
    source_fingerprint: identity.sourceFingerprint,
    masked_identifier: identity.maskedIdentifier,
    risk,
    action,
    window_minutes: WINDOW_MINUTES,
  }

  const payload = {
    severity: risk === 'critical' ? 'critical' : 'warning',
    source: 'auth',
    event_type: 'login_failed',
    message: blocked ? 'Blockerade upprepade inloggningsförsök' : 'Misslyckade inloggningsförsök',
    metadata,
  }

  const result = existing?.id
    ? await db.from('system_events').update({ ...payload, created_at: new Date().toISOString() }).eq('id', existing.id)
    : await db.from('system_events').insert(payload)

  if (result.error) console.error('[guardian] failed login write failed:', result.error.message)
}

export async function recordSuccessfulLogin(req: NextRequest, email: string, userId?: string | null) {
  const identity = getLoginIdentity(req, email)
  const db = createServiceClient()
  const resolvedAt = new Date().toISOString()

  const { data: resolved } = await db.from('system_events')
    .update({ resolved_at: resolvedAt })
    .eq('event_type', 'login_failed')
    .is('resolved_at', null)
    .contains('metadata', { identifier_fingerprint: identity.identifierFingerprint })
    .select('id')

  // Keep a closed audit marker only when Guardian previously observed failures.
  if ((resolved?.length ?? 0) > 0) {
    const { error } = await db.from('system_events').insert({
      severity: 'info',
      source: 'auth',
      event_type: 'login_succeeded_after_failures',
      message: 'Lyckad inloggning efter tidigare misslyckade försök',
      user_id: userId ?? null,
      resolved_at: resolvedAt,
      metadata: {
        masked_identifier: identity.maskedIdentifier,
        identifier_fingerprint: identity.identifierFingerprint,
        source_fingerprint: identity.sourceFingerprint,
        resolved_incidents: resolved?.length ?? 0,
      },
    })
    if (error) console.error('[guardian] successful login audit write failed:', error.message)
  }
}
