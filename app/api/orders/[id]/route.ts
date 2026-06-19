import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select('*, trips(from_city, to_city, departure_at, carrier_id)')
    .eq('id', id)
    .single()

  if (error || !order) return NextResponse.json({ error: 'Order hittades inte' }, { status: 404 })

  const carrierId = order.trips?.carrier_id ?? order.receiver_id ?? order.carrier_id
  const [carrierRes, senderRes] = await Promise.all([
    carrierId ? supabase.from('users').select('name').eq('id', carrierId).single() : Promise.resolve({ data: null }),
    order.sender_id ? supabase.from('users').select('name').eq('id', order.sender_id).single() : Promise.resolve({ data: null }),
  ])

  let recipient = null
  if (order.booking_request_id) {
    const { data: br } = await supabase
      .from('booking_requests')
      .select('recipient_name, recipient_phone')
      .eq('id', order.booking_request_id)
      .single()
    if (br?.recipient_name) recipient = { name: br.recipient_name, phone: br.recipient_phone ?? undefined }
  }

  return NextResponse.json({
    order,
    carrier: carrierRes.data ?? null,
    sender: senderRes.data ?? null,
    recipient,
  })
}
