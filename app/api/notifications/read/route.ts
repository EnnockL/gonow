import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getRequestUser, unauthorized } from '@/lib/auth/require-auth'

export async function POST(req: NextRequest) {
  const user = await getRequestUser(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => ({})) as { notification_id?: string }
  const supabase = createServiceClient()

  if (body.notification_id) {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', body.notification_id)
      .eq('user_id', user.id)
      .eq('read', false)
  } else {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
  }

  return NextResponse.json({ ok: true })
}
