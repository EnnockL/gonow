import { NextRequest, NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

const requestSchema = z.object({
  message: z.string().trim().min(2).max(2000),
  imageBase64: z.string().max(8_000_000).nullable().optional(),
  imageMediaType: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']).optional().default('image/jpeg'),
  currentDraft: z.record(z.string(), z.unknown()).nullable().optional(),
})

const resultSchema = z.object({
  type: z.enum(['package', 'pickup', 'return', 'lift']),
  from_city: z.string().trim().min(2),
  to_city: z.string().trim().min(2),
  description: z.string().trim().min(1),
  weight_kg: z.number().positive().nullable(),
  departure_date: z.string().nullable(),
  urgency: z.enum(['today', 'tomorrow', 'flexible']),
  store_name: z.string().nullable(),
  order_reference: z.string().nullable(),
  passengers: z.number().int().positive().nullable(),
  special_requirements: z.string().nullable(),
  estimated_price_sek: z.number().nonnegative(),
  confidence: z.number().min(0).max(1),
})

const searchableText = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const cleanLocation = (value: string) => value
  .replace(/[,\s]+(?:leverera|leverans)$/i, '')
  .replace(/\s+(?:idag|imorgon|nu)$/i, '')
  .trim()

// Extracts a full address (street, apt, postal code, city) after a keyword
function extractLocation(text: string, keywords: string[]): string | null {
  const lower = searchableText(text)
  for (const kw of keywords) {
    const normalizedKeyword = searchableText(kw)
    const idx = lower.indexOf(normalizedKeyword)
    if (idx === -1) continue
    const after = text.slice(idx + normalizedKeyword.length).trimStart()
    // Stop at sentence-end or at "till"/"to" transition
    const match = after.match(/^(.{4,100}?)(?=\s+(?:till|to)\s|\s*[.!?]|$)/i)
    if (match) return match[1].trim()
  }
  return null
}

// Simulation: parse free text without calling Claude
function simulateParse(message: string) {
  const lower = message.toLowerCase()
  const searchable = searchableText(message)

  const type =
    searchable.includes('lift') || searchable.includes('passagerare') || searchable.includes('ak ')
      ? 'lift'
      : searchable.includes('retur') || searchable.includes('tillbaka')
      ? 'return'
      : searchable.includes('hamta') || searchable.includes('ikea') || searchable.includes('biltema') || searchable.includes('butik')
      ? 'pickup'
      : 'package'

  // Try to extract full addresses first (with explicit keywords)
  let fromRaw = extractLocation(message, ['från ', 'fran ', 'from ', 'avsändare: ', 'avsandare: ', 'upphämtning: ', 'upphamtning: '])
  const toRaw = extractLocation(message, [' till ', ' to ', ' → ', ' -> ', 'leverans: ', 'destination: '])

  // If "från" was not written but "till" was, extract everything before "till" as from-address
  if (!fromRaw) {
    const tillIdx = lower.indexOf(' till ')
    if (tillIdx > 2) {
      let beforeTill = message.slice(0, tillIdx).trim()
      // Strip common leading filler words (allow match at end of string too)
      beforeTill = beforeTill.replace(/^(?:skicka|hämta|retur|lift|jag vill|vill|kan du|please)(?:\s+|$)/gi, '').trim()
      beforeTill = beforeTill.replace(/^(?:ett|en|min|mitt)(?:\s+|$)/gi, '').trim()
      beforeTill = beforeTill.replace(/^(?:paket|paketet|sak|grej|saken)(?:\s+|$)/gi, '').trim()
      if (beforeTill.length >= 2) fromRaw = beforeTill
    }
  }

  // Fallback: well-known Swedish cities found in text order (not list order)
  const cities = [
    'stockholm', 'göteborg', 'malmö', 'uppsala', 'sundsvall',
    'örebro', 'linköping', 'västerås', 'helsingborg', 'norrköping',
    'jönköping', 'umeå', 'luleå', 'kiruna', 'gävle', 'borås',
    'eskilstuna', 'karlstad', 'växjö', 'halmstad',
  ]
  const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  let from_city = cleanLocation(fromRaw || 'Saknas')
  let to_city   = cleanLocation(toRaw || 'Saknas')

  // City fallback (only when both are missing): find cities in text order
  if (!fromRaw && !toRaw) {
    const cityMatches = cities
      .map(c => ({ city: capitalise(c), pos: lower.indexOf(c) }))
      .filter(m => m.pos !== -1)
      .sort((a, b) => a.pos - b.pos)
    if (cityMatches[0]) from_city = cityMatches[0].city
    if (cityMatches[1]) to_city   = cityMatches[1].city
  }

  const weightMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*kg/)
  const weight_kg = weightMatch ? parseFloat(weightMatch[1].replace(',', '.')) : null

  const passengersMatch = lower.match(/(\d+)\s*(person|passagerare|plats)/)
  const passengers = passengersMatch ? parseInt(passengersMatch[1]) : type === 'lift' ? 1 : null

  const storeNames = ['ikea', 'biltema', 'clas ohlson', 'h&m', 'zara', 'netonnet', 'elgiganten']
  const store_name = storeNames.find((s) => lower.includes(s))?.replace(/\b\w/g, (c) => c.toUpperCase()) || null
  const hasSpecialRequirements = /\b(ömtålig|omtålig|fragile|portkod|ring|lämna|lamna|instruktion|kyl|frys|värdefull|vardefull)\b/i.test(message)

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
    special_requirements: hasSpecialRequirements ? message.slice(0, 240) : null,
    estimated_price_sek: 299,
    confidence: 0.82,
  }
}

export async function POST(req: NextRequest) {
  const input = requestSchema.safeParse(await req.json().catch(() => null))
  if (!input.success) return NextResponse.json({ success: false, error: 'Beskriv vad du vill skicka.' }, { status: 400 })
  const { message, imageBase64, imageMediaType, currentDraft } = input.data

  const apiKey = process.env.ANTHROPIC_API_KEY
  const useSimulation =
    process.env.NEXT_PUBLIC_SIMULATION_MODE === 'true' ||
    !apiKey ||
    apiKey === 'placeholder'

  if (useSimulation) {
    await new Promise((r) => setTimeout(r, 800))
    const next = simulateParse(message)
    const normalizedMessage = searchableText(message)
    const merged = currentDraft ? {
      ...currentDraft,
      ...(normalizedMessage.includes('fran ') || normalizedMessage.includes('from ') ? { from_city: next.from_city } : {}),
      ...(normalizedMessage.includes(' till ') || normalizedMessage.includes(' to ') ? { to_city: next.to_city } : {}),
      ...(/\d+(?:[.,]\d+)?\s*kg/i.test(message) ? { weight_kg: next.weight_kg } : {}),
      ...(/\b(idag|imorgon|flexibel|nu)\b/i.test(message) ? { urgency: next.urgency, departure_date: next.departure_date } : {}),
      ...(/\b(lift|retur|hämta|hamta|paket)\b/i.test(message) ? { type: next.type } : {}),
      ...(/\b(ömtålig|omtålig|fragile|portkod|ring|lämna|lamna|instruktion|kyl|frys|värdefull|vardefull)\b/i.test(message) ? { special_requirements: message.slice(0, 240) } : {}),
      confidence: next.confidence,
      estimated_price_sek: next.estimated_price_sek,
    } : next
    const simulated = resultSchema.safeParse(merged)
    if (!simulated.success) return NextResponse.json({ success: false, error: 'Kunde inte tolka bokningen.' }, { status: 422 })
    return NextResponse.json({ success: true, data: simulated.data })
  }

  const { anthropic } = await import('@/lib/claude')

  const content: Anthropic.MessageParam['content'] = []

  if (imageBase64) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: imageMediaType, data: imageBase64 },
    })
  }

  content.push({
    type: 'text',
    text: currentDraft
      ? `Current booking draft: ${JSON.stringify(currentDraft)}\n\nUser correction or addition: ${message}\n\nUpdate the existing draft using the user's latest message.`
      : message,
  })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: `You are a logistics assistant for Gonow, a Swedish P2P delivery platform.
Extract delivery information from the user's message and return ONLY valid JSON.
No markdown, no explanation — pure JSON only.
Never guess a location. If origin or destination was not supplied, use the exact string "Saknas" for that field.

Return this structure:
{
  "type": "package" | "pickup" | "return" | "lift",
  "from_city": string,  // Full address if given (e.g. "Vasagatan 11 lgh 302, 111 20 Stockholm"), otherwise city name
  "to_city": string,    // Full address if given (e.g. "Storgatan 5, 411 38 Göteborg"), otherwise city name
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
    const parsed = resultSchema.safeParse(JSON.parse(text))
    if (!parsed.success) return NextResponse.json({ success: false, error: 'AI-svaret saknar bokningsuppgifter.' }, { status: 422 })
    return NextResponse.json({ success: true, data: parsed.data })
  } catch {
    return NextResponse.json({ success: false, error: 'Parse failed', raw: text }, { status: 400 })
  }
}
