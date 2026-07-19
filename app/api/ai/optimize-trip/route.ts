import { NextRequest, NextResponse } from 'next/server'
import { optimizeTrip } from '@/lib/ai/dispatcher'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { fromCity?: string; toCity?: string }
    const fromCity = (body.fromCity ?? '').trim()
    const toCity   = (body.toCity   ?? '').trim()

    if (!fromCity || !toCity) {
      return NextResponse.json({ error: 'fromCity och toCity krävs' }, { status: 400 })
    }

    const result = await optimizeTrip({ fromCity, toCity })

    if (!result) {
      return NextResponse.json(
        { error: `Kunde inte beräkna rutt: ${fromCity} → ${toCity}. Kontrollera stavningen.` },
        { status: 422 },
      )
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
