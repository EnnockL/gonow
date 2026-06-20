import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: package_id } = await params
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('package_offers')
      .select('*, users(name, rating_avg, avatar_url)')
      .eq('package_id', package_id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ offers: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: package_id } = await params
    const body = await req.json()
    const supabase = createServiceClient()

    // Enforce price ceiling
    const { data: pkg } = await supabase
      .from('packages')
      .select('price_ceiling')
      .eq('id', package_id)
      .single()

    if (pkg && body.offered_price && body.offered_price > pkg.price_ceiling) {
      return NextResponse.json(
        { error: 'Erbjudandet får inte överstiga Gonows maxpris.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('package_offers')
      .insert({
        package_id,
        carrier_id: body.carrier_id ?? null,
        trip_id: body.trip_id ?? null,
        offered_price: body.offered_price ?? (pkg?.price_ceiling ?? 0),
        message: body.message ?? null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ offer: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
