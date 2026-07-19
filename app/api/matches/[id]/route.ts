import { createServiceClient } from '@/lib/supabase'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'
import { transitionMatch, type MatchStatus } from '@/lib/ai/match-state'
import { notify } from '@/lib/notify'
import { NextRequest, NextResponse } from 'next/server'

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

async function ensureLegacyOrderBridge(
  supabase: ReturnType<typeof createServiceClient>,
  input: {
    packageId: string
    senderId: string
    driverId: string
    tripId?: string | null
    description?: string | null
    weightKg?: number | null
    pickupAddress?: string | null
    dropoffAddress?: string | null
    price?: number | null
  },
) {
  const { data: existing } = await supabase
    .from('orders')
    .select('*')
    .eq('sender_id', input.senderId)
    .eq('trip_id', input.tripId ?? null)
    .contains('metadata', { package_id: input.packageId })
    .limit(1)
    .maybeSingle()

  if (existing) return existing

  const price = Number(input.price ?? 0)
  const commission = roundCurrency(price * 0.15)
  const carrierPayout = roundCurrency(price - commission)

  const { data: created, error } = await supabase
    .from('orders')
    .insert({
      sender_id: input.senderId,
      carrier_id: input.driverId,
      receiver_id: input.driverId,
      trip_id: input.tripId ?? null,
      type: 'package',
      description: input.description || 'Gonow-paket',
      weight_kg: Number(input.weightKg ?? 0),
      pickup_address: input.pickupAddress || '',
      dropoff_address: input.dropoffAddress || '',
      price,
      commission,
      carrier_payout: carrierPayout,
      status: 'pending',
      metadata: {
        package_id: input.packageId,
        source: 'package_match',
      },
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return created
}

async function ensurePackageConversation(
  supabase: ReturnType<typeof createServiceClient>,
  packageId: string,
  senderId: string,
  driverId: string,
) {
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('context_type', 'package')
    .eq('context_id', packageId)
    .or(`and(participant_a.eq.${senderId},participant_b.eq.${driverId}),and(participant_a.eq.${driverId},participant_b.eq.${senderId})`)
    .limit(1)
    .maybeSingle()

  if (existing) return existing.id as string

  const { data: created, error } = await supabase
    .from('conversations')
    .insert({
      context_type: 'package',
      context_id: packageId,
      participant_a: senderId,
      participant_b: driverId,
    })
    .select('id')
    .single()

  if (error) {
    if (error.message.includes("Could not find the table 'public.conversations'")) return `package:${packageId}`
    throw new Error(`Kunde inte skapa paketkonversation: ${error.message}`)
  }
  return created.id as string
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequestUser(req)
    if (!user) return unauthorized()

    const { id } = await params
    const { action } = await req.json() as { action: 'customer_accept' | 'customer_decline' | 'driver_confirm' | 'driver_decline' | 'expire' }

    const supabase = createServiceClient()

    const { data: match, error: fetchErr } = await supabase
      .from('package_matches')
      .select('*, packages(id, sender_id, from_city, to_city, from_address, to_address, description, weight_kg, price_ceiling, dispatcher_stage)')
      .eq('id', id)
      .single()

    if (fetchErr || !match) {
      return NextResponse.json({ error: 'Match hittades inte.' }, { status: 404 })
    }

    // Verify caller is sender (customer actions) or driver (driver actions)
    const pkg = match.packages as {
      id: string
      sender_id: string | null
      from_city: string
      to_city: string
      from_address?: string | null
      to_address?: string | null
      description?: string | null
      weight_kg?: number | null
      price_ceiling?: number | null
    } | null
    const isCustomerAction = action === 'customer_accept' || action === 'customer_decline'
    const isDriverAction = action === 'driver_confirm' || action === 'driver_decline'

    if (isCustomerAction && pkg?.sender_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (isDriverAction && match.driver_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = transitionMatch(match.status as MatchStatus, action)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }

    const update: Record<string, unknown> = { status: result.nextStatus }
    if (action === 'customer_accept') update.customer_accepted_at = new Date().toISOString()
    if (action === 'customer_accept') update.driver_pending_at = new Date().toISOString()
    if (result.sideEffects.setExpiresAt) update.expires_at = result.sideEffects.setExpiresAt
    if (action === 'driver_confirm') update.driver_confirmed_at = new Date().toISOString()

    const { data: updated, error: updateErr } = await supabase
      .from('package_matches')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    const route = pkg ? `${pkg.from_city} → ${pkg.to_city}` : 'din rutt'

    if (result.sideEffects.notifyDriver && match.driver_id) {
      await supabase
        .from('package_matches')
        .update({ status: 'driver_pending_confirmation' })
        .eq('id', id)

      notify({
        user_id: match.driver_id,
        type: 'match_driver_confirm',
        title: 'Kunden accepterade ditt förslag!',
        message: `Bekräfta att du kan ta paketet ${route}. Du har 30 minuter på dig.`,
      }).catch(() => {})
    }

    let conversationId: string | null = null
    if (result.sideEffects.updatePackageStatus === 'matched' && pkg) {
      const { error: packageUpdateError } = await supabase
        .from('packages')
        .update({
          status: 'matched',
          dispatcher_stage: 'matched',
          matched_carrier_id: match.driver_id,
          matched_trip_id: match.trip_id,
        })
        .eq('id', pkg.id)

      if (packageUpdateError) throw new Error(`Kunde inte uppdatera paketet: ${packageUpdateError.message}`)

      if (pkg.sender_id && match.driver_id) {
        await ensureLegacyOrderBridge(supabase, {
          packageId: pkg.id,
          senderId: pkg.sender_id,
          driverId: match.driver_id,
          tripId: match.trip_id,
          description: pkg.description,
          weightKg: pkg.weight_kg,
          pickupAddress: pkg.from_address,
          dropoffAddress: pkg.to_address,
          price: match.proposed_price ?? pkg.price_ceiling ?? 0,
        })
        conversationId = await ensurePackageConversation(supabase, pkg.id, pkg.sender_id, match.driver_id)
      }
    }

    // Driver declined or match expired — reset package to open for re-matching
    if ((action === 'driver_decline' || action === 'expire') && pkg) {
      await supabase
        .from('packages')
        .update({ status: 'open', dispatcher_stage: null })
        .eq('id', pkg.id)
    }

    if (result.sideEffects.notifyCustomer && pkg?.sender_id) {
      const isMatched = result.nextStatus === 'matched'
      const isDeclinedByDriver = action === 'driver_decline'
      notify({
        user_id: pkg.sender_id,
        type: isMatched ? 'match_confirmed' : 'match_declined',
        title: isMatched ? 'Transport bekräftad!' : isDeclinedByDriver ? 'Föraren nekade förfrågan' : 'Förslag gick ut',
        message: isMatched
          ? `Din transport ${route} är bokad. Föraren hämtar paketet på avtalad tid.`
          : isDeclinedByDriver
            ? `Föraren kunde inte ta paketet ${route}. Gonow fortsätter söka efter en annan transport.`
            : `Föraren bekräftade inte i tid. Gonow fortsätter söka efter transport åt dig.`,
      }).catch(() => {})
    }

    return NextResponse.json({ match: updated, conversation_id: conversationId })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
