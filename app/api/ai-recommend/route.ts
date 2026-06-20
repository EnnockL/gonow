import { createServiceClient } from '@/lib/supabase'
import { anthropic } from '@/lib/claude'
import { NextRequest, NextResponse } from 'next/server'

interface RecommendBody {
  trip_id: string
  from_city: string
  to_city: string
  departure_at: string
  weight_capacity_kg: number
  seats_available: number
}

export async function POST(req: NextRequest) {
  try {
    const body: RecommendBody = await req.json()
    const { trip_id, from_city, to_city, departure_at, weight_capacity_kg, seats_available } = body

    if (!from_city || !to_city) {
      return NextResponse.json({ error: 'from_city och to_city krävs.' }, { status: 422 })
    }

    const supabase = createServiceClient()
    const now = new Date().toISOString()

    // Fetch open packages and lift requests along the route in parallel
    const [pkgRes, liftRes] = await Promise.all([
      supabase
        .from('packages')
        .select('id, from_city, to_city, description, weight_kg, price_ceiling, deadline')
        .eq('status', 'open')
        .gt('expires_at', now)
        .or(`from_city.ilike.%${from_city}%,to_city.ilike.%${to_city}%`)
        .order('deadline', { ascending: true })
        .limit(20),
      supabase
        .from('lift_requests')
        .select('id, from_city, to_city, passengers, max_price, travel_date, flexibility')
        .eq('status', 'open')
        .gt('expires_at', now)
        .or(`from_city.ilike.%${from_city}%,to_city.ilike.%${to_city}%`)
        .limit(10),
    ])

    const packages = pkgRes.data ?? []
    const lifts = liftRes.data ?? []

    if (packages.length === 0 && lifts.length === 0) {
      return NextResponse.json({
        recommended_packages: [],
        recommended_lifts: [],
        total_earnings: 0,
        carrier_payout: 0,
        reasoning_sv: 'Inga öppna paket eller liftförfrågningar hittades längs din rutt just nu.',
      })
    }

    const systemPrompt = `Du är AI-transportledare för Gonow, en P2P-logistikplattform.
En förare har registrerat en resa. Välj den kombination av paket och passagerare som ger mest total intäkt med minst omväg.
Svara BARA med giltig JSON — ingen annan text:
{
  "recommended_packages": ["uuid"],
  "recommended_lifts": ["uuid"],
  "total_earnings": 620,
  "carrier_payout": 496,
  "reasoning_sv": "Förklarning på svenska vad föraren tjänar och varför."
}
Regler:
- Max ${Math.floor(weight_capacity_kg)} kg total vikt för paket
- Max ${seats_available} passagerare
- Prioritera paket med deadline 'today'
- carrier_payout = total_earnings × 0.80 (Gonow tar 15%, försäkring 5%)
- Returnera tomma arrayer om inget matchar rutten väl`

    interface PkgRow { id: string; from_city: string; to_city: string; description: string; weight_kg: number; price_ceiling: number; deadline: string }
    interface LiftRow { id: string; from_city: string; to_city: string; passengers: number; max_price: number | null; travel_date: string }

    const userMessage = `Resa: ${from_city} → ${to_city}, avgång ${departure_at}
Kapacitet: ${weight_capacity_kg} kg, ${seats_available} platser

Tillgängliga paket:
${(packages as PkgRow[]).map(p => `- id:${p.id} | ${p.from_city}→${p.to_city} | ${p.weight_kg}kg | ${p.price_ceiling}kr | deadline:${p.deadline} | ${p.description}`).join('\n')}

Tillgängliga liftförfrågningar:
${(lifts as LiftRow[]).map(l => `- id:${l.id} | ${l.from_city}→${l.to_city} | ${l.passengers} pers | max:${l.max_price ?? '?'}kr | datum:${l.travel_date}`).join('\n')}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    // Extract JSON safely
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI returnerade ogiltigt svar.' }, { status: 500 })
    }

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json({ ...result, trip_id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
