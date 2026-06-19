import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_id, name, phone, role, city, age, gender, bio } = body

    if (!user_id) return NextResponse.json({ error: 'user_id krävs' }, { status: 400 })

    const supabase = createServiceClient()
    const payload: Record<string, unknown> = {}
    if (name !== undefined) payload.name = name
    if (phone !== undefined) payload.phone = phone || null
    if (role !== undefined) payload.role = role
    if (city !== undefined) payload.city = city || null
    if (age !== undefined) payload.age = age || null
    if (gender !== undefined) payload.gender = gender || null
    if (bio !== undefined) payload.bio = bio || null

    const { error } = await supabase.from('users').update(payload).eq('id', user_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
