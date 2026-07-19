import { createServiceClient } from '@/lib/supabase'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequestUser(req)
    if (!user) return unauthorized()
    const { id } = await params
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('packages')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Paket hittades inte.' }, { status: 404 })
    if (data.sender_id !== user.id && data.matched_carrier_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { data: sender } = await supabase
      .from('users')
      .select('name')
      .eq('id', data.sender_id)
      .maybeSingle()

    return NextResponse.json({ package: { ...data, sender: sender ?? null } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequestUser(req)
    if (!user) return unauthorized()

    const { id } = await params
    const body = await req.json()
    const supabase = createServiceClient()

    // Verify caller is the sender OR the matched carrier
    const { data: pkg } = await supabase
      .from('packages')
      .select('sender_id, matched_carrier_id')
      .eq('id', id)
      .single()

    if (!pkg) return NextResponse.json({ error: 'Paket hittades inte.' }, { status: 404 })
    if (pkg.sender_id !== user.id && pkg.matched_carrier_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const allowed = [
      'status', 'matched_trip_id', 'matched_carrier_id', 'final_price',
      'pickup_confirmed_at', 'delivery_photo_url', 'delivery_confirmed_at',
    ]
    const update: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) update[key] = body[key]
    }

    const { data, error } = await supabase
      .from('packages')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ package: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
