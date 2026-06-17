import { NextRequest, NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'

// Simulation: parse free text without calling Claude
function simulateParse(message: string) {
  const lower = message.toLowerCase()

  const type =
    lower.includes('lift') || lower.includes('passagerare') || lower.includes('åk')
      ? 'lift'
      : lower.includes('retur') || lower.includes('tillbaka')
      ? 'return'
      : lower.includes('hämta') || lower.includes('ikea') || lower.includes('biltema') || lower.includes('butik')
      ? 'pickup'
      : 'package'

  const cityPairs: [string, string, string, string, number][] = [
    ['stockholm', 'göteborg', 'Stockholm', 'Göteborg', 470],
    ['stockholm', 'malmö', 'Stockholm', 'Malmö', 610],
    ['göteborg', 'stockholm', 'Göteborg', 'Stockholm', 470],
    ['malmö', 'stockholm', 'Malmö', 'Stockholm', 610],
    ['malmö', 'göteborg', 'Malmö', 'Göteborg', 280],
    ['göteborg', 'malmö', 'Göteborg', 'Malmö', 280],
    ['stockholm', 'sundsvall', 'Stockholm', 'Sundsvall', 400],
    ['stockholm', 'kiruna', 'Stockholm', 'Kiruna', 1400],
    ['stockholm', 'uppsala', 'Stockholm', 'Uppsala', 70],
    ['uppsala', 'stockholm', 'Uppsala', 'Stockholm', 70],
  ]

  let from_city = 'Stockholm'
  let to_city = 'Göteborg'
  let km = 470

  for (const [f, t, fc, tc, d] of cityPairs) {
    if (lower.includes(f) && lower.includes(t)) {
      from_city = fc
      to_city = tc
      km = d
      break
    }
    if (lower.includes(f)) { from_city = fc }
    if (lower.includes(t)) { to_city = tc }
  }

  const weightMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*kg/)
  const weight_kg = weightMatch ? parseFloat(weightMatch[1].replace(',', '.')) : null

  const passengersMatch = lower.match(/(\d+)\s*(person|passagerare|plats)/)
  const passengers = passengersMatch ? parseInt(passengersMatch[1]) : type === 'lift' ? 1 : null

  const storeNames = ['ikea', 'biltema', 'clas ohlson', 'h&m', 'zara', 'nrk', 'netonnet', 'elgiganten']
  const store_name = storeNames.find((s) => lower.includes(s))?.replace(/\b\w/g, (c) => c.toUpperCase()) || null

  const estimated_price_sek = Math.round(150 + km + (weight_kg ? weight_kg * 20 : 0))

  const urgency = lower.includes('idag') || lower.includes('nu')
    ? 'today'
    : lower.includes('imorgon')
    ? 'tomorrow'
    : 'flexible'

  const today = new Date()
  if (urgency === 'tomorrow') today.setDate(today.getDate() + 1)
  const departure_date = urgency === 'flexible' ? null : today.toISOString().split('T')[0]

  return {
    type,
    from_city,
    to_city,
    description: message.slice(0, 120),
    weight_kg,
    departure_date,
    urgency,
    store_name,
    order_reference: null,
    passengers,
    special_requirements: null,
    estimated_price_sek,
    confidence: 0.85,
  }
}

export async function POST(req: NextRequest) {
  const { message, imageBase64 } = await req.json()

  // Simulation mode — no Anthropic API key needed
  if (process.env.NEXT_PUBLIC_SIMULATION_MODE === 'true') {
    await new Promise((r) => setTimeout(r, 800)) // realistic feel
    return NextResponse.json({ success: true, data: simulateParse(message) })
  }

  const { anthropic } = await import('@/lib/claude')

  const content: Anthropic.MessageParam['content'] = []

  if (imageBase64) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
    })
  }

  content.push({ type: 'text', text: message })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: `You are a logistics assistant for Gonow, a Swedish P2P delivery platform.
Extract delivery information from the user's message and return ONLY valid JSON.
No markdown, no explanation — pure JSON only.

Return this structure:
{
  "type": "package" | "pickup" | "return" | "lift",
  "from_city": string,
  "to_city": string,
  "description": string,
  "weight_kg": number | null,
  "departure_date": "YYYY-MM-DD" | null,
  "urgency": "today" | "tomorrow" | "flexible",
  "store_name": string | null,
  "order_reference": string | null,
  "passengers": number | null,
  "special_requirements": string | null,
  "estimated_price_sek": number,
  "confidence": number
}

For estimated_price_sek: base 150 SEK + 1 SEK per km + 20 SEK per kg.
Stockholm to Gothenburg = ~470km. Stockholm to Malmö = ~600km. Stockholm to Kiruna = ~1400km.`,
    messages: [{ role: 'user', content }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const parsed = JSON.parse(text)
    return NextResponse.json({ success: true, data: parsed })
  } catch {
    return NextResponse.json({ success: false, error: 'Parse failed', raw: text }, { status: 400 })
  }
}
