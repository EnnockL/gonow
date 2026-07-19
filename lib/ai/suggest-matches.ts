import { createServiceClient } from '../supabase'
import { notify } from '../notify'

interface PackageRow {
  id: string
  sender_id: string | null
  from_city: string
  to_city: string
  weight_kg: number
  price_ceiling: number
  deadline: string
  dispatcher_stage: string | null
  from_lat?: number | null
  from_lng?: number | null
  to_lat?: number | null
  to_lng?: number | null
}

interface TripRow {
  id: string
  carrier_id: string
  from_city: string
  to_city: string
  departure_at: string
  weight_capacity_kg: number
  weight_reserved_kg?: number | null
  from_lat?: number | null
  from_lng?: number | null
  to_lat?: number | null
  to_lng?: number | null
  users?: { name: string } | null
}

function cityMatch(a: string, b: string) {
  return a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase())
}

function distanceKm(aLat?: number | null, aLng?: number | null, bLat?: number | null, bLng?: number | null) {
  if ([aLat, aLng, bLat, bLng].some(value => typeof value !== 'number')) return null
  const rad = (value: number) => value * Math.PI / 180
  const dLat = rad((bLat as number) - (aLat as number))
  const dLng = rad((bLng as number) - (aLng as number))
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat as number)) * Math.cos(rad(bLat as number)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function routeMatch(trip: TripRow, pkg: PackageRow) {
  const cityRoute = cityMatch(trip.from_city, pkg.from_city) && cityMatch(trip.to_city, pkg.to_city)
  const pickupDistance = distanceKm(trip.from_lat, trip.from_lng, pkg.from_lat, pkg.from_lng)
  const deliveryDistance = distanceKm(trip.to_lat, trip.to_lng, pkg.to_lat, pkg.to_lng)
  const gisRoute = pickupDistance !== null && deliveryDistance !== null && pickupDistance <= 40 && deliveryDistance <= 40
  const weightLeft = (trip.weight_capacity_kg ?? 0) - (trip.weight_reserved_kg ?? 0)
  return weightLeft >= pkg.weight_kg && (cityRoute || gisRoute)
}

function buildCustomerMessage(trip: TripRow, pkg: PackageRow): string {
  const date = new Date(trip.departure_at).toLocaleDateString('sv-SE', { weekday: 'long', month: 'long', day: 'numeric' })
  const time = new Date(trip.departure_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  const driverName = trip.users?.name?.split(' ')[0] ?? 'En förare'
  return `Vi hittade ingen transport exakt på önskat datum, men ${driverName} kan ta ditt paket ${date} kl. ${time} (${pkg.from_city} → ${pkg.to_city}).`
}

function buildDriverMessage(pkg: PackageRow): string {
  return `Detta paket (${pkg.from_city} → ${pkg.to_city}, ${pkg.weight_kg} kg) passar din rutt. Du kan tjäna upp till ${pkg.price_ceiling} kr med liten eller ingen omväg.`
}

// Called when a package is published — scan trips for matches
export async function suggestMatchesForPackage(pkg: PackageRow): Promise<void> {
  const supabase = createServiceClient()

  const { data: trips } = await supabase
    .from('trips')
    .select('*, users(name)')
    .eq('status', 'active')
    .gte('weight_capacity_kg', pkg.weight_kg)
    .gte('departure_at', new Date().toISOString())
    .order('departure_at', { ascending: true })
    .limit(5)

  if (!trips?.length) return

  const matches = trips.filter((trip: TripRow) => routeMatch(trip, pkg))

  if (!matches.length) return

  // Create suggestions for the top 2 matches
  const top = matches.slice(0, 2) as TripRow[]

  for (const trip of top) {
    const { error } = await supabase.from('package_matches').insert({
      package_id: pkg.id,
      trip_id: trip.id,
      driver_id: trip.carrier_id,
      status: 'suggested',
      proposed_pickup_date: trip.departure_at.split('T')[0],
      proposed_price: pkg.price_ceiling,
      ai_message_customer: buildCustomerMessage(trip, pkg),
      ai_message_driver: buildDriverMessage(pkg),
    })

    if (!error && pkg.sender_id) {
      notify({
        user_id: trip.carrier_id,
        type: 'match_driver_suggested',
        title: 'Nytt paket längs din rutt',
        message: buildDriverMessage(pkg),
      }).catch(() => {})
      notify({
        user_id: pkg.sender_id,
        type: 'match_suggested',
        title: 'Gonow hittade ett alternativ!',
        message: `En förare kan ta ditt paket ${pkg.from_city} → ${pkg.to_city}. Öppna för att se detaljer.`,
      }).catch(() => {})
    }
  }
}

// Called when a trip is registered — scan packages for matches
export async function suggestMatchesForTrip(trip: TripRow): Promise<void> {
  const supabase = createServiceClient()

  const { data: packages } = await supabase
    .from('packages')
    .select('id, sender_id, from_city, to_city, weight_kg, price_ceiling, deadline, dispatcher_stage')
    .eq('status', 'open')
    .or('dispatcher_stage.is.null,dispatcher_stage.eq.private_fallback')
    .lte('weight_kg', trip.weight_capacity_kg)
    .gt('expires_at', new Date().toISOString())
    .limit(10)

  if (!packages?.length) return

  const matches = (packages as PackageRow[]).filter((pkg) => routeMatch(trip, pkg))

  for (const pkg of matches.slice(0, 3)) {
    // Don't create duplicate suggestions
    const { data: existing } = await supabase
      .from('package_matches')
      .select('id')
      .eq('package_id', pkg.id)
      .eq('trip_id', trip.id)
      .in('status', ['suggested', 'customer_accepted', 'driver_pending_confirmation'])
      .maybeSingle()

    if (existing) continue

    const { error } = await supabase.from('package_matches').insert({
      package_id: pkg.id,
      trip_id: trip.id,
      driver_id: trip.carrier_id,
      status: 'suggested',
      proposed_pickup_date: trip.departure_at.split('T')[0],
      proposed_price: pkg.price_ceiling,
      ai_message_customer: buildCustomerMessage(trip, pkg),
      ai_message_driver: buildDriverMessage(pkg),
    })

    if (!error && pkg.sender_id) {
      notify({
        user_id: trip.carrier_id,
        type: 'match_driver_suggested',
        title: 'Nytt paket längs din rutt',
        message: buildDriverMessage(pkg),
      }).catch(() => {})
      notify({
        user_id: pkg.sender_id,
        type: 'match_suggested',
        title: 'Gonow hittade ett alternativ!',
        message: `En förare kan ta ditt paket ${pkg.from_city} → ${pkg.to_city}. Öppna för att se detaljer.`,
      }).catch(() => {})
    }
  }
}
