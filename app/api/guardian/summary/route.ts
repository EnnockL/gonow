import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase'
import { buildGuardianFallbackSummary } from '@/lib/system-guardian/fallback-summary'
import Anthropic from '@anthropic-ai/sdk'

const rateLimitMap = new Map<string, number>()
const RATE_WINDOW_MS = 60_000
const PII_KEYS = ['email', 'phone', 'name', 'address', 'personal', 'bankid', 'iban']

function sanitizeForAI(meta: unknown): unknown {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return meta
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(meta as Record<string, unknown>)) {
    out[key] = PII_KEYS.some(part => key.toLowerCase().includes(part))
      ? '[REDACTED]'
      : sanitizeForAI(value)
  }
  return out
}

export async function POST(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorized()

  const db = createServiceClient()
  const { data: profile } = await db.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = Date.now()
  const last = rateLimitMap.get(user.id) ?? 0
  if (now - last < RATE_WINDOW_MS) {
    return NextResponse.json({ error: 'Vänta innan du begär en ny sammanfattning.' }, { status: 429 })
  }
  rateLimitMap.set(user.id, now)

  const since = new Date(now - 2 * 60 * 60_000).toISOString()
  const { data: events, error } = await db
    .from('system_events')
    .select('severity, source, event_type, message, metadata, created_at')
    .is('resolved_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({
      summary: 'Guardian kunde inte läsa incidentloggen. Kontrollera databaskopplingen och använd den operativa översikten tills anslutningen är återställd.',
      mode: 'rules', ai_available: false,
    })
  }

  const sanitized = (events ?? []).map((event: {
    severity: string; source: string; event_type: string;
    message: string; metadata: unknown; created_at: string
  }) => ({
    severity: event.severity,
    source: event.source,
    event_type: event.event_type,
    message: event.message,
    created_at: event.created_at,
    metadata: sanitizeForAI(event.metadata),
  }))
  const fallback = buildGuardianFallbackSummary(sanitized)

  if (sanitized.length === 0 || !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ summary: fallback, mode: 'rules', ai_available: false })
  }

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Du är operativ on-call-analytiker för Gonow. Analysera följande avidentifierade systemhändelser:\n\n${JSON.stringify(sanitized, null, 2)}\n\nGe en kort incidentsammanfattning, trolig grundorsak, berörda flöden och högst tre utredningssteg. Föreslå inte att data ändras.`,
      }],
    })
    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ summary: text || fallback, mode: text ? 'ai' : 'rules', ai_available: Boolean(text) })
  } catch (aiError) {
    console.error('[guardian] AI summary unavailable:', aiError)
    return NextResponse.json({ summary: fallback, mode: 'rules', ai_available: false })
  }
}
