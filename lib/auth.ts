import { createClient } from './supabase'

export async function signUp(email: string, password: string, name: string, phone?: string) {
  const supabase = createClient()

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, phone: phone || null },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('Ingen användare skapades')

  // Profile creation via API route (bypasses RLS — no session yet when email confirmation is required)
  await fetch('/api/auth/create-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: data.user.id, email, name, phone: phone || null }),
  }).catch(() => {})  // Non-fatal — profile will be created on first login if this fails

  return data.user
}

export async function signIn(email: string, password: string) {
  const response = await fetch('/api/auth/sign-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error || 'Kunde inte logga in.')

  await loginWithSession(payload.access_token, payload.refresh_token)
  return payload.user
}

export async function verifySignupOtp(email: string, token: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })
  if (error) throw new Error(error.message)
  return data.user
}

export async function resendSignupOtp(email: string) {
  const supabase = createClient()
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })
  if (error) throw new Error(error.message)
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
}

export async function getAuthUser() {
  const supabase = createClient()
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

export async function loginWithSession(accessToken: string, refreshToken: string) {
  const supabase = createClient()
  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
  if (error) throw new Error(error.message)
}

export async function getUserProfile(userId: string) {
  const supabase = createClient()
  const { data } = await supabase.from('users').select('*').eq('id', userId).single()
  return data ?? null
}
