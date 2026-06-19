import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()

  // Try with age+city first; fall back if columns don't exist yet
  let user: Record<string, unknown> | null = null
  const { data: userFull, error: fullErr } = await supabase
    .from('users')
    .select('id, name, avatar_url, rating_avg, rating_count, bankid_verified, created_at, age, city, gender, bio')
    .eq('id', id)
    .single()

  if (fullErr) {
    const { data: userBasic } = await supabase
      .from('users')
      .select('id, name, avatar_url, rating_avg, rating_count, bankid_verified, created_at')
      .eq('id', id)
      .single()
    user = userBasic as Record<string, unknown> | null
  } else {
    user = userFull as Record<string, unknown> | null
  }

  if (!user) return NextResponse.json({ error: 'Användaren hittades inte' }, { status: 404 })

  const { count: completedTrips } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('receiver_id', id)
    .in('status', ['confirmed', 'delivered'])

  return NextResponse.json({
    id: user.id,
    name: user.name,
    avatar_url: user.avatar_url ?? null,
    rating_avg: (user.rating_avg as number) ?? 0,
    rating_count: (user.rating_count as number) ?? 0,
    bankid_verified: (user.bankid_verified as boolean) ?? false,
    member_since: user.created_at,
    completed_trips: completedTrips ?? 0,
    age: (user.age as number | null) ?? null,
    city: (user.city as string | null) ?? null,
    gender: (user.gender as string | null) ?? null,
    bio: (user.bio as string | null) ?? null,
  })
}
