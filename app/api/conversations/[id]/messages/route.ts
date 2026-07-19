import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'

type Params = { params: Promise<{ id: string }> }

type PackageParticipant = {
  id: string
  sender_id: string
  matched_carrier_id: string
  created_at: string
}

const syntheticPackageId = (conversationId: string) =>
  conversationId.startsWith('package:') ? conversationId.slice('package:'.length) : null

async function getPackageParticipant(
  supabase: ReturnType<typeof createServiceClient>,
  packageId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .eq('id', packageId)
    .maybeSingle()

  if (error || !data) return { error: 'Not found' as const, status: 404 }
  const pkg = data as PackageParticipant & Record<string, unknown>
  if (!pkg.sender_id || !pkg.matched_carrier_id ||
      (pkg.sender_id !== userId && pkg.matched_carrier_id !== userId)) {
    return { error: 'Unauthorized' as const, status: 403 }
  }
  return { pkg, otherId: pkg.sender_id === userId ? pkg.matched_carrier_id : pkg.sender_id }
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getRequestUser(req)
    if (!user) return unauthorized()
    const { id: convId } = await params
    const userId = user.id

    const supabase = createServiceClient()
    const packageId = syntheticPackageId(convId)

    if (packageId) {
      const access = await getPackageParticipant(supabase, packageId, userId)
      if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
      const { pkg, otherId } = access

      const [{ data: otherUser }, { data: rows, error: messagesError }] = await Promise.all([
        supabase.from('users').select('id, name, avatar_url, phone').eq('id', otherId).maybeSingle(),
        supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${pkg.sender_id},receiver_id.eq.${pkg.matched_carrier_id}),and(sender_id.eq.${pkg.matched_carrier_id},receiver_id.eq.${pkg.sender_id})`)
          .gte('created_at', pkg.created_at)
          .order('created_at', { ascending: true }),
      ])
      if (messagesError) return NextResponse.json({ error: messagesError.message }, { status: 500 })

      await supabase.from('messages').update({ read: true }).eq('receiver_id', userId).eq('read', false)

      const messages = (rows ?? []).map((row: Record<string, unknown> & { content?: string; read?: boolean; created_at?: string }) => ({
        ...row,
        conversation_id: convId,
        body: row.content,
        read_at: row.read ? row.created_at : null,
      }))

      return NextResponse.json({
        messages,
        other_user: otherUser ?? { id: otherId, name: 'Transportkontakt', avatar_url: null, phone: null },
        context: { context_type: 'package', context_id: packageId, participant_a: pkg.sender_id, participant_b: pkg.matched_carrier_id },
        context_data: pkg,
      })
    }

    const { data: conv, error: convErr } = await supabase.from('conversations').select('*').eq('id', convId).single()
    if (convErr || !conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const c = conv as { context_type: string; context_id: string; participant_a: string; participant_b: string }
    if (c.participant_a !== userId && c.participant_b !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    const otherId = c.participant_a === userId ? c.participant_b : c.participant_a
    const [{ data: otherUser }, { data: msgs }] = await Promise.all([
      supabase.from('users').select('id, name, avatar_url, phone').eq('id', otherId).single(),
      supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true }),
    ])
    let contextData: Record<string, unknown> | null = null
    const table = c.context_type === 'package' ? 'packages' : c.context_type === 'lift' ? 'lift_requests' : null
    if (table) contextData = (await supabase.from(table).select('*').eq('id', c.context_id).maybeSingle()).data
    await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('conversation_id', convId).neq('sender_id', userId).is('read_at', null)
    return NextResponse.json({ messages: msgs ?? [], other_user: otherUser, context: c, context_data: contextData })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getRequestUser(req)
    if (!user) return unauthorized()
    const { id: convId } = await params
    const body = await req.json() as { body: string }
    if (!body.body?.trim()) return NextResponse.json({ error: 'Saknade fält' }, { status: 400 })

    const supabase = createServiceClient()
    const text = body.body.trim()
    const packageId = syntheticPackageId(convId)
    if (packageId) {
      const access = await getPackageParticipant(supabase, packageId, user.id)
      if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
      const { data, error } = await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: access.otherId,
        trip_id: null,
        content: text,
        read: false,
      }).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ message: { ...data, conversation_id: convId, body: data.content, read_at: null } }, { status: 201 })
    }

    const { data: conv } = await supabase.from('conversations').select('participant_a, participant_b').eq('id', convId).maybeSingle()
    if (!conv || (conv.participant_a !== user.id && conv.participant_b !== user.id)) {
      return NextResponse.json({ error: 'Du har inte tillgång till konversationen.' }, { status: 403 })
    }
    const { data, error } = await supabase.from('messages').insert({ conversation_id: convId, sender_id: user.id, body: text }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from('conversations').update({ last_message: text, last_message_at: new Date().toISOString() }).eq('id', convId)
    return NextResponse.json({ message: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
