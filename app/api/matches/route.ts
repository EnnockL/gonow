import { createServiceClient } from '@/lib/supabase'
import { expirePendingMatches } from '@/lib/ai/match-expiry'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const packageId = searchParams.get('package_id')
  const driverId = searchParams.get('driver_id')
  const senderId = searchParams.get('sender_id')

  if (!packageId && !driverId && !senderId) {
    return NextResponse.json({ error: 'package_id, driver_id, eller sender_id krävs' }, { status: 400 })
  }

  expirePendingMatches().catch(() => {})

  const supabase = createServiceClient()

  if (senderId) {
    const { data: senderPkgs } = await supabase
      .from('packages')
      .select('id')
      .eq('sender_id', senderId)

    const pkgIds = (senderPkgs ?? []).map((p: { id: string }) => p.id)
    if (pkgIds.length === 0) return NextResponse.json({ matches: [] })

    const { data, error } = await supabase
      .from('package_matches')
      .select(`
        *,
        packages(id, from_city, to_city, description, weight_kg, price_ceiling, status),
        drivers:users!driver_id(id, name, rating_avg, avatar_url)
      `)
      .in('package_id', pkgIds)
      .in('status', ['suggested', 'customer_accepted', 'driver_pending_confirmation', 'matched'])
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ matches: data ?? [] })
  }

  let query = supabase
    .from('package_matches')
    .select(`
      *,
      packages(id, from_city, to_city, description, weight_kg, price_ceiling, deadline),
      trips(id, from_city, to_city, departure_at, weight_capacity_kg),
      drivers:users!driver_id(id, name, rating_avg, avatar_url)
    `)
    .order('created_at', { ascending: false })

  if (packageId) query = query.eq('package_id', packageId)

  if (driverId) {
    query = query
      .eq('driver_id', driverId)
      .not('status', 'eq', 'expired')
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ matches: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({})) as {
    package_id?: string
    proposed_price?: number
    ai_message_driver?: string
  }

  const { package_id, proposed_price, ai_message_driver } = body

  if (!package_id) {
    return NextResponse.json({ error: 'package_id krävs' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: pkg, error: pkgErr } = await supabase
    .from('packages')
    .select('id, price_ceiling, status, sender_id')
    .eq('id', package_id)
    .single()

  if (pkgErr || !pkg) {
    return NextResponse.json({ error: 'Paket hittades inte.' }, { status: 404 })
  }

  if (pkg.status !== 'open') {
    return NextResponse.json({ error: 'Paketet är inte öppet för erbjudanden.' }, { status: 409 })
  }

  if (pkg.sender_id === user.id) {
    return NextResponse.json({ error: 'Du kan inte erbjuda körning på ditt eget paket.' }, { status: 403 })
  }

  if (proposed_price != null && proposed_price > pkg.price_ceiling) {
    return NextResponse.json({ error: `Priset överstiger pristaket (${pkg.price_ceiling} kr).` }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('package_matches')
    .select('id')
    .eq('package_id', package_id)
    .eq('driver_id', user.id)
    .neq('status', 'cancelled')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Du har redan ett aktivt erbjudande för detta paket.' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('package_matches')
    .insert({
      package_id,
      driver_id: user.id,
      status: 'suggested',
      proposed_price: proposed_price ?? pkg.price_ceiling,
      ai_message_driver: ai_message_driver ?? null,
      ai_message_customer: ai_message_driver ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ match: data }, { status: 201 })
}
