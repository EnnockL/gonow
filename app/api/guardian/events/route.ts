import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth/require-admin'

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req, { endpoint: '/api/guardian/events' })
  if (guard.response) return guard.response

  const { searchParams } = new URL(req.url)
  const severity  = searchParams.get('severity')
  const source    = searchParams.get('source')
  const resolved  = searchParams.get('resolved')
  const limit     = Math.min(Number(searchParams.get('limit') ?? '100'), 200)

  const db = createServiceClient()
  let q = db
    .from('system_events')
    .select('id, severity, source, event_type, message, user_id, package_id, trip_id, order_id, request_id, metadata, resolved_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (severity) q = q.eq('severity', severity)
  if (source)   q = q.eq('source', source)
  if (resolved === 'false') q = q.is('resolved_at', null)
  if (resolved === 'true')  q = q.not('resolved_at', 'is', null)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Summary counts
  const { data: counts } = await db
    .from('system_events')
    .select('severity', { count: 'exact' })
    .is('resolved_at', null)

  const summary = { critical: 0, warning: 0, info: 0 }
  if (counts) {
    for (const row of counts as Array<{ severity: string }>) {
      if (row.severity in summary) summary[row.severity as keyof typeof summary]++
    }
  }

  return NextResponse.json({ events: data ?? [], summary })
}
