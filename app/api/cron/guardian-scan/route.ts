import { NextRequest, NextResponse } from 'next/server'
import { runIncidentRules } from '@/lib/system-guardian/incident-rules'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runIncidentRules()
  return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), ...result })
}
