import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { id, email, name, phone } = await req.json()
  if (!id || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const supabase = createServiceClient()
  const payload = {
    id,
    email,
    name: name || email.split('@')[0],
    phone: phone || null,
    role: 'user',
  }

  const existingById = await supabase.from('users').select('id').eq('id', id).maybeSingle()
  if (existingById.error) {
    return NextResponse.json({ error: existingById.error.message }, { status: 500 })
  }
  if (existingById.data) {
    return NextResponse.json({ ok: true })
  }

  const existingByEmail = await supabase.from('users').select('id').eq('email', email).maybeSingle()
  if (existingByEmail.error) {
    return NextResponse.json({ error: existingByEmail.error.message }, { status: 500 })
  }

  if (existingByEmail.data) {
    const { error } = await supabase.from('users').update(payload).eq('id', existingByEmail.data.id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, migrated: true })
  }

  const { error } = await supabase.from('users').insert(payload)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
