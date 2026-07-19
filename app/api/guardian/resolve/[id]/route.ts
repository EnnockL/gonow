import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth/require-admin'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin(req, { endpoint: '/api/guardian/resolve/[id]' })
  if (guard.response) return guard.response
  const db = createServiceClient()
  const { id } = await params
  const { error } = await db
    .from('system_events')
    .update({ resolved_at: new Date().toISOString() })
    .eq('id', id)
    .is('resolved_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
