import { createServiceClient } from '@/lib/supabase'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req)
    if (!user) return unauthorized()

    const supabase = createServiceClient()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('packages')
      .select('id, status, final_price, price_ceiling, from_city, to_city, delivery_confirmed_at, pickup_confirmed_at, created_at')
      .eq('matched_carrier_id', user.id)
      .in('status', ['matched', 'paid', 'picked_up', 'in_transit', 'delivered', 'confirmed'])
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    type Row = { status: string; final_price: number | null; price_ceiling: number | null; delivery_confirmed_at: string | null }
    const pkgs: Row[] = data ?? []
    const deliveredToday = pkgs.filter((p: Row) =>
      p.delivery_confirmed_at &&
      new Date(p.delivery_confirmed_at) >= todayStart
    )
    const earningsToday = deliveredToday.reduce(
      (sum: number, p: Row) => sum + (p.final_price ?? p.price_ceiling ?? 0), 0,
    )

    return NextResponse.json({
      total:             pkgs.length,
      active:            pkgs.filter((p: Row) => ['matched', 'paid', 'picked_up', 'in_transit'].includes(p.status)).length,
      delivered_today:   deliveredToday.length,
      earnings_today:    earningsToday,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
