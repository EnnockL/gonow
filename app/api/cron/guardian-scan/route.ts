import { NextRequest, NextResponse } from 'next/server'
import { runIncidentRules } from '@/lib/system-guardian/incident-rules'
import { reportAuthFailure } from '@/lib/system-guardian/report-auth-failure'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    await reportAuthFailure(req, {
      message: 'Nekat försök att starta System Guardian-scan',
      endpoint: '/api/cron/guardian-scan', method: 'POST',
    })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runIncidentRules()
  return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), ...result })
}
