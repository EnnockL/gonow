import { createServiceClient } from '@/lib/supabase'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'
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
      .select('id, status, sender_id')
      .eq('id', id)
      .single()

    if (!pkg) return NextResponse.json({ error: 'Paket hittades inte.' }, { status: 404 })
    if (pkg.sender_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (['in_transit', 'delivered', 'confirmed', 'cancelled'].includes(pkg.status)) {
      return NextResponse.json(
        { error: `Kan inte avboka paket med status "${pkg.status}".` },
        { status: 409 },
      )
    }

    const { data: updated, error } = await supabase
      .from('packages')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ package: updated })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
