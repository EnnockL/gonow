import { createServiceClient } from '@/lib/supabase'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'
import { notify } from '@/lib/notify'
import { suggestMatchesForPackage } from '@/lib/ai/suggest-matches'
import { expireStalePackages } from '@/lib/packages/expire-stale'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { geocode, drivingDistance } from '@/lib/distance'
import { calcPackagePrice } from '@/lib/price'

const createPackageSchema = z.object({
  trip_id: z.string().min(1).optional(),
  service_type: z.enum(['package', 'return']).default('package'),
  package_type: z.enum(['package', 'large', 'pallet', 'document', 'return']).default('package'),
  from_city: z.string().trim().min(2).max(160),
  from_address: z.string().trim().min(3).max(300),
  to_city: z.string().trim().min(2).max(160),
  to_address: z.string().trim().min(3).max(300),
  description: z.string().trim().min(1).max(500),
  weight_kg: z.coerce.number().min(0.1).max(1000),
  price_ceiling: z.coerce.number().int().min(1).max(100000).optional(),
  deadline: z.enum(['today', 'tomorrow', 'flexible']).default('flexible'),
  receiver_name: z.string().trim().min(2).max(120),
  receiver_phone: z.string().trim().min(7).max(30),
  is_fragile: z.boolean().optional(),
  forecast_departure_id: z.string().min(1).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const deadline = searchParams.get('deadline')
    const stage = searchParams.get('stage')
    const carrierId = searchParams.get('carrier_id')
    const statusesParam = searchParams.get('statuses')
    const senderId = searchParams.get('sender_id')
    const supabase = createServiceClient()

    // Sender view: return packages published by this user
    if (senderId) {
      const user = await getRequestUser(req)
      if (!user) return unauthorized()
      if (user.id !== senderId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      const { data, error } = await supabase
        .from('packages')
        .select('*, package_offers(id, carrier_id, offered_price, message, status, created_at, users(name, rating_avg, avatar_url))')
        .eq('sender_id', senderId)
        .order('created_at', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ packages: data ?? [] })
    }

    // Driver view: return packages assigned to this carrier (with sender info)
    if (carrierId) {
      const user = await getRequestUser(req)
      if (!user) return unauthorized()
      if (user.id !== carrierId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      const statuses = statusesParam ? statusesParam.split(',') : ['matched', 'paid', 'picked_up', 'in_transit', 'delivered']
      const { data, error } = await supabase
        .from('packages')
        .select('*, sender:users!sender_id(name, phone)')
        .eq('matched_carrier_id', carrierId)
        .in('status', statuses)
        .order('created_at', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ packages: data ?? [] })
    }

    // Expire stale open packages and notify senders (fire-and-forget)
    expireStalePackages().catch(() => {})

    // Public marketplace view — null expires_at = never expires
    const now = new Date().toISOString()
    let query = supabase
      .from('packages')
      .select('*')
      .eq('status', 'open')
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false })

    if (stage) {
      query = query.eq('dispatcher_stage', stage)
    } else {
      query = query.or('dispatcher_stage.is.null,dispatcher_stage.eq.private_fallback,dispatcher_stage.eq.logistics_first')
    }

    if (from) query = query.ilike('from_city', `%${from}%`)
    if (to) query = query.ilike('to_city', `%${to}%`)
    if (deadline) query = query.eq('deadline', deadline)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ packages: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req)
    if (!user) return unauthorized()

    const parsed = createPackageSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Kontrollera paketuppgifterna.', issues: parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    const body = parsed.data
    const supabase = createServiceClient()
    const idempotencyKey = req.headers.get('idempotency-key')?.trim()
    const requestTag = idempotencyKey ? `request:${idempotencyKey}` : null

    if (requestTag) {
      const { data: existing } = await supabase
        .from('packages')
        .select('*')
        .eq('sender_id', user.id)
        .contains('tags', [requestTag])
        .maybeSingle()
      if (existing) return NextResponse.json({ package: existing, idempotent_replay: true }, { status: 200 })
    }

    let selectedTrip: { id: string; carrier_id: string | null; status: string; allows_packages: boolean; weight_capacity_kg: number | null; weight_reserved_kg: number | null; max_package_count: number | null; current_package_count: number | null } | null = null
    if (body.trip_id) {
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select('id, carrier_id, status, allows_packages, weight_capacity_kg, weight_reserved_kg, max_package_count, current_package_count')
        .eq('id', body.trip_id)
        .maybeSingle()
      if (tripError || !trip) return NextResponse.json({ error: 'Den valda transporten finns inte längre.' }, { status: 404 })
      if (trip.status !== 'active' || !trip.allows_packages) {
        return NextResponse.json({ error: 'Den valda transporten tar inte emot paket längre.' }, { status: 409 })
      }
      const weightLeft = (trip.weight_capacity_kg ?? 0) - (trip.weight_reserved_kg ?? 0)
      const packageSlotsLeft = (trip.max_package_count ?? 0) - (trip.current_package_count ?? 0)
      if (weightLeft < body.weight_kg || packageSlotsLeft <= 0) {
        return NextResponse.json({ error: 'Den valda transporten har inte tillräcklig kapacitet kvar.' }, { status: 409 })
      }
      selectedTrip = trip
    }

    const [fromGeo, toGeo] = await Promise.all([
      geocode(body.from_address || body.from_city),
      geocode(body.to_address || body.to_city),
    ])
    if (!fromGeo || !toGeo) {
      return NextResponse.json({ error: 'Kunde inte verifiera upphämtnings- eller leveransadressen.' }, { status: 422 })
    }
    const route = await drivingDistance(fromGeo.lat, fromGeo.lng, toGeo.lat, toGeo.lng)
    if (!route) return NextResponse.json({ error: 'Kunde inte beräkna transportsträckan.' }, { status: 502 })
    const serverPrice = calcPackagePrice({ km: route.distance_km, kg: body.weight_kg, urgency: body.deadline })

    const weightKg = typeof body.weight_kg === 'number'
      ? body.weight_kg
      : parseFloat(String(body.weight_kg ?? '5').replace(/[^\d.]/g, '')) || 5

    const logisticsOfferExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('packages')
      .insert({
        sender_id: user.id,
        from_city: body.from_city,
        from_address: body.from_address ?? null,
        to_city: body.to_city,
        to_address: body.to_address ?? null,
        description: body.description,
        weight_kg: weightKg,
        is_fragile: body.is_fragile ?? false,
        deadline: body.deadline ?? 'flexible',
        price_ceiling: serverPrice.recommended,
        distance_km: route.distance_km,
        from_lat: fromGeo.lat,
        from_lng: fromGeo.lng,
        to_lat: toGeo.lat,
        to_lng: toGeo.lng,
        receiver_name: body.receiver_name,
        receiver_phone: body.receiver_phone,
        tags: [
          `service:${body.package_type}`,
          ...(requestTag ? [requestTag] : []),
        ],
        status: 'open',
        expires_at: expiresAt,
        dispatcher_stage: null,
        logistics_offer_expires_at: logisticsOfferExpiresAt,
        assigned_provider_type: null,
        assigned_provider_id: null,
        ...(body.forecast_departure_id ? { forecast_departure_id: body.forecast_departure_id } : {}),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Trip-selected flow: create a package_match directly at driver_pending_confirmation
    if (body.trip_id && selectedTrip?.carrier_id) {
        await supabase.from('package_matches').insert({
          package_id: data.id,
          driver_id: selectedTrip.carrier_id,
          trip_id: body.trip_id,
          status: 'driver_pending_confirmation',
          proposed_price: body.price_ceiling ?? null,
          ai_message_customer: 'Förfrågan skickad till föraren. Du får besked när föraren svarar.',
          ai_message_driver: 'En kund vill skicka ett paket med din resa.',
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        })

        notify({
          user_id: selectedTrip.carrier_id,
          type: 'match_driver_confirm',
          title: 'Ny paketeförfrågan!',
          message: `En kund vill skicka ett paket med din resa ${data.from_city} → ${data.to_city}. Svara inom 30 minuter.`,
        }).catch(() => {})
    } else {
      await suggestMatchesForPackage(data).catch((error) => {
        console.error('Package route matching failed', { packageId: data.id, error })
      })
    }

    return NextResponse.json({ package: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
