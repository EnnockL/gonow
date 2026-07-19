import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

// Simple in-process rate limit: max 3 calls per admin per minute
const rateLimitMap = new Map<string, number>()
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 3

const PII_KEYS = ['email', 'phone', 'name', 'address', 'personal', 'bankid', 'iban']

function sanitizeForAI(meta: unknown): unknown {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return meta
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (PII_KEYS.some(p => k.toLowerCase().includes(p))) {
      out[k] = '[REDACTED]'
    } else {
      out[k] = sanitizeForAI(v)
    }
  }
  return out
}

export async function POST(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorized()

  const db = createServiceClient()
  const { data: profile } = await db.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Rate limit per admin
  const now = Date.now()
  const last = rateLimitMap.get(user.id) ?? 0
  if (now - last < RATE_WINDOW_MS) {
    return NextResponse.json({ error: 'Rate limited — vänta innan du begär en ny sammanfattning.' }, { status: 429 })
  }
  rateLimitMap.set(user.id, now)

  const since = new Date(now - 2 * 60 * 60_000).toISOString()
  const { data: events } = await db
    .from('system_events')
    .select('severity, source, event_type, message, metadata, created_at')
    .is('resolved_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!events || events.length === 0) {
    return NextResponse.json({ summary: 'Inga olösta händelser de senaste 2 timmarna. Systemet verkar stabilt.' })
  }

  const sanitized = events.map((e: {
    severity: string; source: string; event_type: string;
    message: string; metadata: unknown; created_at: string
  }) => ({
    severity:   e.severity,
    source:     e.source,
    event_type: e.event_type,
    message:    e.message,
    created_at: e.created_at,
    metadata:   sanitizeForAI(e.metadata),
  }))

  const client = new Anthropic()
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `Du är operativ on-call-analytiker för Gonow, en transportplattform. Här är olösta systemhändelser från de senaste 2 timmarna:

${JSON.stringify(sanitized, null, 2)}

Ge en kort driftssammanfattning med:
1. Övergripande incidentsammanfattning (2–3 meningar)
2. Trolig grundorsak
3. Påverkade flöden/tjänster
4. Rekommenderade utredningssteg (max 3 punkter)

Föreslå INTE att exekvera fixar eller ändra data. Håll det kort och handlingsorienterat.`,
    }],
  })

  const text = res.content[0].type === 'text' ? res.content[0].text : ''
  return NextResponse.json({ summary: text })
}
