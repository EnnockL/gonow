import { createServiceClient } from '@/lib/supabase'
import { reportEvent } from './report-event'

type DB = ReturnType<typeof createServiceClient>

async function checkRepeatedAuthFailures(db: DB) {
  const since = new Date(Date.now() - 10 * 60_000).toISOString()
  const { count } = await db
    .from('system_events')
    .select('id', { count: 'exact', head: true })
    .in('event_type', ['auth_failure', 'login_failed'])
    .gte('created_at', since)
  if ((count ?? 0) >= 5) {
    await reportEvent({
      severity: 'critical',
      source: 'guardian',
      event_type: 'incident_repeated_auth_failures',
      message: `${count} autentiseringsfel de senaste 10 minuterna`,
      metadata: { count, window_minutes: 10 },
    })
  }
}

async function checkStripeWebhookFailures(db: DB) {
  const since = new Date(Date.now() - 30 * 60_000).toISOString()
  const { count } = await db
    .from('system_events')
    .select('id', { count: 'exact', head: true })
    .in('event_type', ['stripe_webhook_signature_failure', 'stripe_webhook_processing_failure'])
    .gte('created_at', since)
  if ((count ?? 0) >= 3) {
    await reportEvent({
      severity: 'critical',
      source: 'guardian',
      event_type: 'incident_stripe_webhook_failures',
      message: `${count} Stripe-webhookfel de senaste 30 minuterna`,
      metadata: { count, window_minutes: 30 },
    })
  }
}

async function checkStuckPackages(db: DB) {
  const threshold = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
  const { data } = await db
    .from('packages')
    .select('id')
    .eq('status', 'open')
    .lte('created_at', threshold)
    .limit(20)
  if (data && data.length > 0) {
    await reportEvent({
      severity: 'warning',
      source: 'guardian',
      event_type: 'packages_stuck_open',
      message: `${data.length} paket har legat i "open" status i mer än 24 timmar`,
      metadata: { count: data.length, sample_ids: data.slice(0, 5).map((p: { id: string }) => p.id) },
    })
  }
}

async function checkDeliveredWithoutConfirmation(db: DB) {
  const threshold = new Date(Date.now() - 6 * 60 * 60_000).toISOString()
  const { data } = await db
    .from('packages')
    .select('id')
    .eq('status', 'delivered')
    .lte('updated_at', threshold)
    .limit(20)
  if (data && data.length > 0) {
    await reportEvent({
      severity: 'warning',
      source: 'guardian',
      event_type: 'delivered_without_confirmation',
      message: `${data.length} paket levererade men inte bekräftade på mer än 6 timmar`,
      metadata: { count: data.length, sample_ids: data.slice(0, 5).map((p: { id: string }) => p.id) },
    })
  }
}

async function checkRepeatedApiErrors(db: DB) {
  const since = new Date(Date.now() - 15 * 60_000).toISOString()
  const { count } = await db
    .from('system_events')
    .select('id', { count: 'exact', head: true })
    .eq('severity', 'critical')
    .not('source', 'eq', 'guardian')
    .gte('created_at', since)
  if ((count ?? 0) >= 10) {
    await reportEvent({
      severity: 'critical',
      source: 'guardian',
      event_type: 'incident_api_error_spike',
      message: `${count} kritiska API-fel de senaste 15 minuterna`,
      metadata: { count, window_minutes: 15 },
    })
  }
}

async function checkNotificationBacklog(db: DB) {
  const threshold = new Date(Date.now() - 60 * 60_000).toISOString()
  const { count } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('read', false)
    .lte('created_at', threshold)
  if ((count ?? 0) >= 100) {
    await reportEvent({
      severity: 'warning',
      source: 'guardian',
      event_type: 'notification_backlog',
      message: `${count} olästa notiser äldre än 1 timme`,
      metadata: { count },
    })
  }
}

export async function runIncidentRules(): Promise<{ ran: number; errors: number }> {
  const db = createServiceClient()
  const rules = [
    checkRepeatedAuthFailures,
    checkStripeWebhookFailures,
    checkStuckPackages,
    checkDeliveredWithoutConfirmation,
    checkRepeatedApiErrors,
    checkNotificationBacklog,
  ]
  const results = await Promise.allSettled(rules.map(fn => fn(db)))
  const errors = results.filter(r => r.status === 'rejected').length
  if (errors > 0) {
    console.error(`[guardian] ${errors} incident rules failed`)
  }
  return { ran: rules.length, errors }
}
