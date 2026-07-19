import { createServiceClient } from '@/lib/supabase'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'
import { createNotification } from '@/lib/notifications/create-notification'
import { NextRequest, NextResponse } from 'next/server'
import { reportEvent } from '@/lib/system-guardian/report-event'

type DriverAction = 'pickup' | 'start_transit' | 'deliver'

const TRANSITIONS: Record<DriverAction, { from: string; to: string; label: string }> = {
  pickup:          { from: 'paid',       to: 'picked_up',  label: 'upphämtat' },
  start_transit:   { from: 'picked_up',  to: 'in_transit', label: 'på väg' },
  deliver:         { from: 'in_transit', to: 'delivered',  label: 'levererat' },
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequestUser(req)
    if (!user) return unauthorized()

    const { id } = await params
    const { action } = await req.json() as { action: DriverAction }

    const transition = TRANSITIONS[action]
    if (!transition) {
      return NextResponse.json({ error: 'Ogiltig action. Använd: pickup | deliver' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: pkg, error: fetchErr } = await supabase
      .from('packages')
      .select('id, status, sender_id, matched_carrier_id, from_city, to_city')
      .eq('id', id)
      .single()

    if (fetchErr || !pkg) {
      return NextResponse.json({ error: 'Paket hittades inte.' }, { status: 404 })
    }

    // Only the matched carrier may update status
    if (pkg.matched_carrier_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden — du är inte tilldelad det här paketet.' }, { status: 403 })
    }

    if (pkg.status !== transition.from) {
      await reportEvent({
        severity: 'warning',
        source: 'driver_status',
        event_type: 'invalid_package_status_transition',
        message: `Ogiltig statusövergång: "${pkg.status}" → "${transition.to}" (förväntad from: "${transition.from}") för action "${action}"`,
        user_id: user.id,
        package_id: id,
        metadata: { action, current_status: pkg.status, expected_from: transition.from, attempted_to: transition.to },
      })
      return NextResponse.json(
        { error: `Paketet måste ha status "${transition.from}" för att ${action === 'pickup' ? 'hämtas upp' : 'levereras'} (nuvarande: "${pkg.status}").` },
        { status: 409 },
      )
    }

    const updateFields: Record<string, string> = { status: transition.to }
    if (action === 'pickup')        updateFields.pickup_confirmed_at  = new Date().toISOString()
    if (action === 'deliver')       updateFields.delivery_confirmed_at = new Date().toISOString()

    const { data: updated, error: updateErr } = await supabase
      .from('packages')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single()

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    const orderUpdate: Record<string, string> = { status: transition.to }
    if (action === 'pickup') orderUpdate.picked_up_at = updateFields.pickup_confirmed_at
    if (action === 'deliver') orderUpdate.delivered_at = updateFields.delivery_confirmed_at
    const { error: orderSyncError } = await supabase
      .from('orders')
      .update(orderUpdate)
      .contains('metadata', { package_id: id })
    if (orderSyncError) {
      await supabase.from('packages').update({ status: transition.from }).eq('id', id)
      return NextResponse.json({ error: 'Paketresan kunde inte synkroniseras med betalningen.' }, { status: 500 })
    }

    // Notify sender
    if (pkg.sender_id) {
      const route = `${(pkg as { from_city: string }).from_city} → ${(pkg as { to_city: string }).to_city}`
      const titles: Record<DriverAction, { title: string; message: string }> = {
        pickup:          { title: 'Paketet är hämtat!',   message: `Din förare har hämtat paketet ${route}.` },
        start_transit:   { title: 'Paketet är på väg!',   message: `Ditt paket ${route} är nu på väg till dig.` },
        deliver:         { title: 'Paketet är levererat!',message: `Ditt paket ${route} har levererats. Bekräfta att allt är OK.` },
      }
      createNotification({
        userId: pkg.sender_id,
        type: action === 'deliver' ? 'package_delivered' : 'package_pickup',
        ...titles[action],
        relatedType: 'package',
        relatedId: id,
      }).catch(() => {})
    }

    return NextResponse.json({ package: updated })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
