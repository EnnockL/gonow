import { NextRequest, NextResponse } from 'next/server'

type RequestBody = {
  context_type:    string
  context_route:   string | null
  other_name:      string
  recent_messages: string[]
  hint:            string
}

type OpenAIResponse = {
  choices: Array<{ message: { content: string } }>
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI ej tillgänglig' }, { status: 503 })

  try {
    const body = await req.json() as RequestBody
    const { context_type, context_route, other_name, recent_messages, hint } = body

    const ctxDesc = context_type === 'package'
      ? `paketleverans${context_route ? ` (${context_route})` : ''}`
      : context_type === 'lift'
      ? `samåkning${context_route ? ` (${context_route})` : ''}`
      : 'konversation'

    const history = recent_messages.length > 0
      ? `Senaste meddelanden:\n${recent_messages.slice(-4).join('\n')}\n\n`
      : ''

    const userPrompt = `Kontext: ${ctxDesc} med ${other_name}.\n${history}Ämne: ${hint || 'allmänt hälsning'}`

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model:       'gpt-4o-mini',
        max_tokens:  120,
        temperature: 0.7,
        messages: [
          { role: 'system', content: 'Du är ett meddelandehjälpmedel i Gonows logistikapp. Skriv korta, vänliga svar på svenska. Max 2 meningar. Inga emojis om de inte passar naturligt.' },
          { role: 'user',   content: userPrompt },
        ],
      }),
    })

    if (!res.ok) return NextResponse.json({ error: 'OpenAI-fel' }, { status: 502 })

    const data = await res.json() as OpenAIResponse
    const suggestion = data.choices?.[0]?.message?.content?.trim() ?? ''
    return NextResponse.json({ suggestion })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
