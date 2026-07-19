import { createServiceClient } from '@/lib/supabase'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'
import { createNotification } from '@/lib/notifications/create-notification'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequestUser(req)
    if (!user) return unauthorized()

    const { id } = await params
    const supabase = createServiceClient()

    const { data: opp, error: fetchErr } = await supabase
      .from('logistics_opportunities')
      .select('id, status, forecast_departure_id, from_city, to_city, departure_date')
      .eq('id', id)
      .single()

    if (fetchErr || !opp) {
      return NextResponse.json({ error: 'Möjligheten hittades inte.' }, { status: 404 })
    }

    if (opp.status !== 'open') {
      return NextResponse.json(
        { error: `Kan inte acceptera — status är redan "${opp.status}".` },
        { status: 409 },
      )
    }

    const { data: updated, error: updateErr } = await supabase
      .from('logistics_opportunities')
      .update({
        status: 'accepted',
        accepted_by_provider_id: user.id,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    const route = `${(opp as { from_city: string }).from_city} → ${(opp as { to_city: string }).to_city}`

    if (opp.forecast_departure_id) {
      // Forecast-linked: update all packages for this departure
      await supabase
        .from('packages')
        .update({
          status: 'matched',
          dispatcher_stage: 'assigned_logistics',
          assigned_provider_type: 'logistics_company',
          assigned_provider_id: user.id,
        })
        .eq('forecast_departure_id', opp.forecast_departure_id)
        .not('status', 'eq', 'cancelled')

      const { data: pkgs } = await supabase
        .from('packages')
        .select('id, sender_id')
        .eq('forecast_departure_id', opp.forecast_departure_id)
        .not('status', 'eq', 'cancelled')

      if (pkgs?.length) {
        const senderIds = [
          ...new Set(
            (pkgs as Array<{ id: string; sender_id: string | null }>)
              .map(p => p.sender_id)
              .filter((s): s is string => !!s),
          ),
        ]

        for (const senderId of senderIds) {
          createNotification({
            userId: senderId,
            type: 'logistics_accepted',
            title: 'Transport ordnad!',
            message: `Ditt paket har matchats med en logistiktransport på ${route}.`,
            relatedType: 'logistics_opportunity',
            relatedId: id,
          }).catch(() => {})
        }
      }
    } else {
      // Non-forecast: cluster of open packages on same route (e.g. after driver declined)
      const { data: openPkgs } = await supabase
        .from('packages')
        .select('id, sender_id')
        .eq('from_city', (opp as { from_city: string }).from_city)
        .eq('to_city', (opp as { to_city: string }).to_city)
        .eq('status', 'open')
        .is('assigned_provider_type', null)

      if (openPkgs?.length) {
        const pkgIds = (openPkgs as Array<{ id: string; sender_id: string | null }>).map(p => p.id)

        await supabase
          .from('packages')
          .update({
            status: 'matched',
            dispatcher_stage: 'assigned_logistics',
            assigned_provider_type: 'logistics_company',
            assigned_provider_id: user.id,
          })
          .in('id', pkgIds)

        const senderIds = [
          ...new Set(
            (openPkgs as Array<{ id: string; sender_id: string | null }>)
              .map(p => p.sender_id)
              .filter((s): s is string => !!s),
          ),
        ]

        for (const senderId of senderIds) {
          createNotification({
            userId: senderId,
            type: 'logistics_accepted',
            title: 'Transport ordnad!',
            message: `Ditt paket har matchats med en logistiktransport på ${route}.`,
            relatedType: 'logistics_opportunity',
            relatedId: id,
          }).catch(() => {})
        }
      }
    }

    return NextResponse.json({ opportunity: updated })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
