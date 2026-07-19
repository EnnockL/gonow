import { createServiceClient } from '@/lib/supabase'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'
import { createNotification } from '@/lib/notifications/create-notification'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequestUser(req)
    if (!user) return unauthorized()

    const { id } = await params
    const supabase = createServiceClient()

    const { data: pkg } = await supabase
      .from('packages')
      .select('id, status, sender_id, matched_carrier_id, from_city, to_city')
      .eq('id', id)
      .single()

    if (!pkg) return NextResponse.json({ error: 'Paket hittades inte.' }, { status: 404 })
    if (pkg.sender_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (pkg.status === 'confirmed') {
      return NextResponse.json({ package: pkg, reused: true })
    }
    if (pkg.status !== 'delivered') {
      return NextResponse.json(
        { error: `Paketet måste vara levererat för att bekräftas (nuvarande: "${pkg.status}").` },
        { status: 409 },
      )
    }

    const { data: updated, error } = await supabase
      .from('packages')
      .update({ status: 'confirmed', delivery_confirmed_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { error: orderSyncError } = await supabase
      .from('orders')
      .update({ status: 'confirmed' })
      .contains('metadata', { package_id: id })
    if (orderSyncError) {
      await supabase.from('packages').update({ status: 'delivered' }).eq('id', id)
      return NextResponse.json({ error: 'Leveransen kunde inte synkroniseras med utbetalningen.' }, { status: 500 })
    }

    // Notify driver that sender confirmed
    if (pkg.matched_carrier_id) {
      const route = `${(pkg as { from_city: string }).from_city} → ${(pkg as { to_city: string }).to_city}`
      createNotification({
        userId: pkg.matched_carrier_id,
        type: 'delivery_confirmed',
        title: 'Leverans bekräftad!',
        message: `Avsändaren bekräftade leveransen ${route}. Tack för uppdraget!`,
        relatedType: 'package',
        relatedId: id,
      }).catch(() => {})
    }

    return NextResponse.json({ package: updated })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
