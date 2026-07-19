import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    const { data: opp, error: oppErr } = await supabase
      .from('logistics_opportunities')
      .select('*')
      .eq('id', id)
      .single()

    if (oppErr || !opp) {
      return NextResponse.json({ error: 'Möjligheten hittades inte.' }, { status: 404 })
    }

    if (!opp.forecast_departure_id) {
      return NextResponse.json({ opportunity: opp, stops: [] })
    }

    const { data: packages, error: pkgErr } = await supabase
      .from('packages')
      .select('id, pickup_address, from_city, to_city, weight_kg, description, sender_id')
      .eq('forecast_departure_id', opp.forecast_departure_id)
      .not('status', 'eq', 'cancelled')

    if (pkgErr) return NextResponse.json({ error: pkgErr.message }, { status: 500 })

    type PkgRow = {
      id: string
      pickup_address: string | null
      from_city: string
      to_city: string
      weight_kg: number | null
      description: string | null
      sender_id: string
    }

    // MVP sort: group by from_city alphabetically, then by pickup_address
    const sorted = (packages as PkgRow[] ?? []).slice().sort((a: PkgRow, b: PkgRow) => {
      const cityA = (a.from_city ?? '').toLowerCase()
      const cityB = (b.from_city ?? '').toLowerCase()
      if (cityA !== cityB) return cityA.localeCompare(cityB, 'sv')
      const addrA = (a.pickup_address ?? '').toLowerCase()
      const addrB = (b.pickup_address ?? '').toLowerCase()
      return addrA.localeCompare(addrB, 'sv')
    })

    const stops = sorted.map((pkg: PkgRow, idx: number) => ({
      package_id: pkg.id,
      pickup_address: pkg.pickup_address ?? null,
      from_city: pkg.from_city,
      to_city: pkg.to_city,
      weight_kg: pkg.weight_kg ?? 0,
      description: pkg.description ?? null,
      suggested_order: idx + 1,
    }))

    return NextResponse.json({ opportunity: opp, stops })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
