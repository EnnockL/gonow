import { NextRequest, NextResponse } from 'next/server'
import { pickBestTrip } from '@/lib/ai/match-scorer'
import type { AIMatchResult } from '@/lib/ai/types'

type TripInput = {
  id:                  string
  users?:              { name: string; rating_avg: number; rating_count: number } | null
  departure_at?:       string | null
  weight_capacity_kg?: number | null
}

type RequestBody = {
  trips: TripInput[]
  parsed: {
    from_city:       string
    to_city:         string
    weight_kg?:      number | null
    departure_date?: string | null
  }
}

type AnthropicResponse = {
  content: Array<{ type: string; text: string }>
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as RequestBody
    const { trips, parsed } = body

    if (!Array.isArray(trips) || trips.length === 0) {
      return NextResponse.json({ error: 'Inga resor att matcha' }, { status: 400 })
    }

    const best = pickBestTrip(trips, { weight_kg: parsed.weight_kg })
    if (!best) {
      return NextResponse.json({ error: 'Ingen matchning' }, { status: 404 })
    }

    const toResult = (
      reasons: string[],
      source: AIMatchResult['source'],
    ): AIMatchResult => ({
      bestTripId: best.tripId,
      score:      best.score,
      reasons,
      source,
    })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json<AIMatchResult>(toResult(best.reasons, 'engine'))
    }

    // V2: Claude generates a natural language recommendation
    try {
      const bestTrip = trips.find(t => t.id === best.tripId)
      const prompt   = `Du är Gonows AI-assistent. Svar på svenska, max 2 meningar, ingen lista.

Avsändaren vill skicka ${parsed.weight_kg ?? 1} kg från ${parsed.from_city} till ${parsed.to_city}.

Rekommenderad bärare: ${bestTrip?.users?.name ?? 'Okänd'}
Betyg: ${bestTrip?.users?.rating_avg?.toFixed(1) ?? '—'} (${bestTrip?.users?.rating_count ?? 0} resor)
Kapacitet: ${bestTrip?.weight_capacity_kg ?? '?'} kg
Avgång: ${bestTrip?.departure_at ? new Date(bestTrip.departure_at).toLocaleDateString('sv-SE') : 'okänt'}

Förklara kortfattat varför denna bärare är rätt val. Nämn konkreta siffror.`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'x-api-key':          apiKey,
          'anthropic-version':  '2023-06-01',
          'content-type':       'application/json',
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 100,
          messages:   [{ role: 'user', content: prompt }],
        }),
      })

      if (res.ok) {
        const data   = await res.json() as AnthropicResponse
        const aiText = data.content?.[0]?.type === 'text' ? data.content[0].text : null
        if (aiText) {
          return NextResponse.json<AIMatchResult>(toResult([aiText], 'claude'))
        }
      }
    } catch {
      // Fallback to engine result
    }

    return NextResponse.json<AIMatchResult>(toResult(best.reasons, 'engine'))
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
