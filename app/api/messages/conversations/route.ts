import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'

type ConversationRow = {
  id: string
  context_type: string
  context_route: string | null
  unread_count: number
  last_message: string | null
  last_message_at: string | null
  other_user: {
    id: string
    name: string
    avatar_url: string | null
    phone?: string | null
  }
}

export async function GET(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorized()
  const userId = user.id

  const base = new URL('/api/conversations', req.url)
  const forwarded = await fetch(base, { cache: 'no-store', headers: { Authorization: req.headers.get('Authorization')! } })
  const json = await forwarded.json().catch(() => ({})) as { conversations?: ConversationRow[]; error?: string }

  if (!forwarded.ok) {
    return NextResponse.json({ error: json.error ?? 'Kunde inte läsa konversationer.' }, { status: forwarded.status })
  }

  const conversations = (json.conversations ?? []).map((conv) => ({
    id: conv.id,
    other_user_id: conv.other_user.id,
    other_user_name: conv.other_user.name ?? 'Okänd',
    other_avatar: conv.other_user.avatar_url ?? null,
    other_phone: conv.other_user.phone ?? null,
    last_message: conv.last_message ?? '',
    last_at: conv.last_message_at ?? '',
    last_sender_id: (conv.unread_count ?? 0) > 0 ? conv.other_user.id : userId,
    unread_count: conv.unread_count ?? 0,
    context_type: conv.context_type,
    context_route: conv.context_route,
  }))

  return NextResponse.json({ conversations })
}
