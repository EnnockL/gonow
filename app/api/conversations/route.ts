import { createServiceClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'

type ConversationRow = {
  id: string
  context_type: string
  context_id: string
  participant_a: string
  participant_b: string
  last_message: string | null
  last_message_at: string | null
  created_at: string
}

type UserRow = {
  id: string
  name: string
  avatar_url: string | null
}

type ContextRow = {
  id: string
  from_city: string
  to_city: string
}

type MessageCountRow = {
  conversation_id: string
  count: string
}

function contextIcon(type: string): string {
  if (type === 'package')  return '📦'
  if (type === 'lift')     return '👤'
  if (type === 'delivery') return '🚚'
  return '💬'
}

function contextLabel(type: string): string {
  if (type === 'package')  return 'Paket'
  if (type === 'lift')     return 'Lift'
  if (type === 'delivery') return 'Leverans'
  return 'Meddelande'
}

export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req)
    if (!user) return unauthorized()
    const userId = user.id

    const supabase = createServiceClient()

    // Backfill the conversation link for matched packages created before
    // automatic conversation creation was introduced.
    const { data: matchedPackages } = await supabase
      .from('packages')
      .select('id, sender_id, matched_carrier_id, from_city, to_city, created_at')
      .or(`sender_id.eq.${userId},matched_carrier_id.eq.${userId}`)
      .not('matched_carrier_id', 'is', null)
      .in('status', ['matched', 'paid', 'picked_up', 'in_transit', 'delivered', 'confirmed'])

    const packageRows = (matchedPackages ?? []) as Array<{ id: string; sender_id: string | null; matched_carrier_id: string | null; from_city: string; to_city: string; created_at: string }>
    if (packageRows.length > 0) {
      const packageIds = packageRows.map(pkg => pkg.id)
      const { data: linkedRows } = await supabase
        .from('conversations')
        .select('context_id')
        .eq('context_type', 'package')
        .in('context_id', packageIds)
      const linkedIds = new Set((linkedRows ?? []).map((row: { context_id: string }) => row.context_id))
      const missing = packageRows
        .filter(pkg => pkg.sender_id && pkg.matched_carrier_id && pkg.sender_id !== pkg.matched_carrier_id && !linkedIds.has(pkg.id))
        .map(pkg => ({ context_type: 'package', context_id: pkg.id, participant_a: pkg.sender_id!, participant_b: pkg.matched_carrier_id! }))
      if (missing.length > 0) await supabase.from('conversations').insert(missing)
    }

    // 1. Fetch all conversations where user is a participant
    const { data: convRows, error: convErr } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (convErr?.message.includes("Could not find the table 'public.conversations'")) {
      const otherIds = [...new Set(packageRows.map(pkg => pkg.sender_id === userId ? pkg.matched_carrier_id : pkg.sender_id).filter(Boolean))] as string[]
      const { data: fallbackUsers } = otherIds.length
        ? await supabase.from('users').select('id, name, avatar_url, phone').in('id', otherIds)
        : { data: [] }
      const userMap = new Map(((fallbackUsers ?? []) as Array<UserRow & { phone?: string | null }>).map(row => [row.id, row]))
      const conversations = packageRows.map(pkg => {
        const otherId = pkg.sender_id === userId ? pkg.matched_carrier_id! : pkg.sender_id!
        return {
          id: `package:${pkg.id}`,
          context_type: 'package',
          context_label: '📦 Paket',
          context_route: `${pkg.from_city?.split(',')[0] ?? ''} → ${pkg.to_city?.split(',')[0] ?? ''}`,
          other_user: userMap.get(otherId) ?? { id: otherId, name: 'Transportkontakt', avatar_url: null, phone: null },
          last_message: null,
          last_message_at: pkg.created_at,
          unread_count: 0,
        }
      })
      return NextResponse.json({ conversations })
    }
    if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 })
    const convs = (convRows ?? []) as ConversationRow[]
    if (convs.length === 0) return NextResponse.json({ conversations: [] })

    // 2. Batch-fetch other users
    const otherUserIds = [...new Set(convs.map(c =>
      c.participant_a === userId ? c.participant_b : c.participant_a,
    ))]
    const { data: userRows } = await supabase
      .from('users')
      .select('id, name, avatar_url')
      .in('id', otherUserIds)
    const usersById = new Map<string, UserRow>(
      ((userRows ?? []) as UserRow[]).map(u => [u.id, u]),
    )

    // 3. Batch-fetch unread counts
    const convIds = convs.map(c => c.id)
    const { data: unreadRows } = await supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', convIds)
      .neq('sender_id', userId)
      .is('read_at', null)
    const unreadByConv = new Map<string, number>()
    for (const row of ((unreadRows ?? []) as MessageCountRow[])) {
      const key = row.conversation_id
      unreadByConv.set(key, (unreadByConv.get(key) ?? 0) + 1)
    }

    // 4. Batch-fetch context routes (packages + lift_requests)
    const packageIds  = convs.filter(c => c.context_type === 'package').map(c => c.context_id)
    const liftIds     = convs.filter(c => c.context_type === 'lift').map(c => c.context_id)

    const packageMap  = new Map<string, ContextRow>()
    const liftMap     = new Map<string, ContextRow>()

    if (packageIds.length > 0) {
      const { data: pkgs } = await supabase
        .from('packages')
        .select('id, from_city, to_city')
        .in('id', packageIds)
      for (const p of ((pkgs ?? []) as ContextRow[])) packageMap.set(p.id, p)
    }
    if (liftIds.length > 0) {
      const { data: lifts } = await supabase
        .from('lift_requests')
        .select('id, from_city, to_city')
        .in('id', liftIds)
      for (const l of ((lifts ?? []) as ContextRow[])) liftMap.set(l.id, l)
    }

    // 5. Assemble result
    const conversations = convs.map(c => {
      const otherId   = c.participant_a === userId ? c.participant_b : c.participant_a
      const otherUser = usersById.get(otherId) ?? { id: otherId, name: 'Okänd', avatar_url: null }
      const ctx       = c.context_type === 'package' ? packageMap.get(c.context_id)
                      : c.context_type === 'lift'    ? liftMap.get(c.context_id)
                      : null
      return {
        id:              c.id,
        context_type:    c.context_type,
        context_label:   `${contextIcon(c.context_type)} ${contextLabel(c.context_type)}`,
        context_route:   ctx ? `${ctx.from_city.split(',')[0]} → ${ctx.to_city.split(',')[0]}` : null,
        other_user:      otherUser,
        last_message:    c.last_message,
        last_message_at: c.last_message_at,
        unread_count:    unreadByConv.get(c.id) ?? 0,
      }
    })

    return NextResponse.json({ conversations })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req)
    if (!user) return unauthorized()
    const body = await req.json() as {
      context_type: string
      context_id:   string
      participant_b?: string
    }
    const { context_type, context_id } = body
    if (!context_type || !context_id) {
      return NextResponse.json({ error: 'Saknade fält' }, { status: 400 })
    }

    const supabase = createServiceClient()
    if (context_type !== 'package') {
      return NextResponse.json({ error: 'Konversationen måste startas från ett giltigt uppdrag.' }, { status: 403 })
    }
    const { data: pkg } = await supabase
      .from('packages')
      .select('id, sender_id, matched_carrier_id')
      .eq('id', context_id)
      .maybeSingle()
    if (!pkg?.sender_id || !pkg.matched_carrier_id ||
        (user.id !== pkg.sender_id && user.id !== pkg.matched_carrier_id)) {
      return NextResponse.json({ error: 'Du har inte tillgång till paketkonversationen.' }, { status: 403 })
    }
    const participant_b = user.id === pkg.sender_id ? pkg.matched_carrier_id : pkg.sender_id

    // Check for existing conversation between same participants for same context
    const { data: existing, error: existingError } = await supabase
      .from('conversations')
      .select('*')
      .eq('context_type', context_type)
      .eq('context_id', context_id)
      .or(
        `and(participant_a.eq.${user.id},participant_b.eq.${participant_b}),` +
        `and(participant_a.eq.${participant_b},participant_b.eq.${user.id})`,
      )
      .maybeSingle()

    if (existing) return NextResponse.json({ conversation: existing })

    if (existingError?.message.includes("Could not find the table 'public.conversations'") && context_type === 'package') {
      return NextResponse.json({ conversation: {
        id: `package:${context_id}`,
        context_type: 'package',
        context_id,
        participant_a: pkg.sender_id,
        participant_b: pkg.matched_carrier_id,
      } })
    }

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        context_type,
        context_id,
        participant_a: user.id,
        participant_b,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ conversation: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
