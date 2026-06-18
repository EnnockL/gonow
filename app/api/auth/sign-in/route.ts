import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'E-post och lösenord krävs.' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Supabase saknar klientkonfiguration.' }, { status: 500 })
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
    return NextResponse.json(
      {
        error: payload?.msg || payload?.error_description || payload?.error || 'Kunde inte logga in.',
      },
      { status: response.status }
    )
  }

  const accessToken = payload?.access_token
  const refreshToken = payload?.refresh_token

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: 'Supabase returnerade ingen giltig session.' }, { status: 500 })
  }

  return NextResponse.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: payload?.token_type || 'bearer',
    expires_in: Number(payload?.expires_in || 3600),
    expires_at: payload?.expires_at ? Number(payload.expires_at) : undefined,
    user: payload?.user ?? null,
  })
}
