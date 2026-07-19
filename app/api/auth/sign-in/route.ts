import { NextRequest, NextResponse } from 'next/server'
import { checkLoginRateLimit, recordFailedLogin, recordSuccessfulLogin } from '@/lib/system-guardian/login-security'

const GENERIC_AUTH_ERROR = 'E-post eller lösenord är fel.'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!email || !password) {
    return NextResponse.json({ error: 'E-post och lösenord krävs.' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Supabase saknar klientkonfiguration.' }, { status: 500 })
  }

  const gate = await checkLoginRateLimit(req, email)
  if (gate.blocked) {
    await recordFailedLogin(req, email, true)
    return NextResponse.json(
      { error: 'För många försök. Vänta en stund och försök igen.' },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfter) } },
    )
  }

  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
    },
    body: JSON.stringify({ email, password }),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    await recordFailedLogin(req, email, response.status === 429)
    if (response.status === 429) {
      return NextResponse.json(
        { error: 'För många försök. Vänta en stund och försök igen.' },
        { status: 429, headers: { 'Retry-After': '600' } },
      )
    }
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 })
  }

  const accessToken = payload?.access_token
  const refreshToken = payload?.refresh_token

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: 'Supabase returnerade ingen giltig session.' }, { status: 500 })
  }

  await recordSuccessfulLogin(req, email, payload?.user?.id ?? null)

  return NextResponse.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: payload?.token_type || 'bearer',
    expires_in: Number(payload?.expires_in || 3600),
    expires_at: payload?.expires_at ? Number(payload.expires_at) : undefined,
    user: payload?.user ?? null,
  })
}
