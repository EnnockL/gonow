import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req)
    if (!user) return unauthorized()

    const { order_id, package_id, to_user_id, rating, comment } =
      await req.json() as {
        order_id?: string
        package_id?: string
        to_user_id: string
        rating: number
        comment?: string
      }

    if ((!order_id && !package_id) || !to_user_id || !rating) {
      return NextResponse.json({ error: 'Saknade fält' }, { status: 400 })
    }
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Betyg måste vara 1–5' }, { status: 400 })
    }
    if (to_user_id === user.id) {
      return NextResponse.json({ error: 'Du kan inte betygsätta dig själv' }, { status: 400 })
    }

    const supabase = createServiceClient()

    if (package_id) {
      // Package flow — verify package is confirmed and caller is sender
      const { data: pkg } = await supabase
        .from('packages')
        .select('status, sender_id, matched_carrier_id')
        .eq('id', package_id)
        .single()

      if (!pkg || !['delivered', 'confirmed'].includes(pkg.status)) {
        return NextResponse.json({ error: 'Paketet måste vara levererat för att betygsättas' }, { status: 409 })
      }
      if (pkg.sender_id !== user.id && pkg.matched_carrier_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('package_id', package_id)
        .eq('from_user_id', user.id)
        .maybeSingle()

      if (existing) return NextResponse.json({ error: 'Du har redan betygsatt detta uppdrag' }, { status: 409 })

      const { error: insertErr } = await supabase.from('reviews').insert({
        package_id,
        from_user_id: user.id,
        to_user_id,
        rating,
        comment: comment?.trim() || null,
      })
      if (insertErr) throw insertErr
    } else {
      // Legacy order flow
      const { data: order } = await supabase
        .from('orders')
        .select('status, sender_id, carrier_id')
        .eq('id', order_id)
        .single()

      if (!order || order.status !== 'confirmed') {
        return NextResponse.json({ error: 'Ordern måste vara bekräftad' }, { status: 409 })
      }

      const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('order_id', order_id)
        .eq('from_user_id', user.id)
        .maybeSingle()

      if (existing) return NextResponse.json({ error: 'Du har redan betygsatt denna order' }, { status: 409 })

      const { error: insertErr } = await supabase.from('reviews').insert({
        order_id,
        from_user_id: user.id,
        to_user_id,
        rating,
        comment: comment?.trim() || null,
      })
      if (insertErr) throw insertErr
    }

    // Recalculate rating_avg for recipient
    const { data: allReviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('to_user_id', to_user_id)

    if (allReviews && allReviews.length > 0) {
      const avg = allReviews.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / allReviews.length
      await supabase
        .from('users')
        .update({ rating_avg: Math.round(avg * 10) / 10, rating_count: allReviews.length })
        .eq('id', to_user_id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[reviews]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orderId = searchParams.get('order_id')
  const packageId = searchParams.get('package_id')
  const fromUserId = searchParams.get('from_user_id')

  if ((!orderId && !packageId) || !fromUserId) {
    return NextResponse.json({ reviewed: false })
  }

  const supabase = createServiceClient()
  const query = supabase.from('reviews').select('id').eq('from_user_id', fromUserId)
  if (packageId) query.eq('package_id', packageId)
  else query.eq('order_id', orderId!)

  const { data } = await query.maybeSingle()
  return NextResponse.json({ reviewed: !!data })
}
