import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getRequestUser } from './require-auth'
import { reportAuthFailure } from '@/lib/system-guardian/report-auth-failure'

type AdminGuardOptions = {
  requireMfa?: boolean
  endpoint: string
}

function tokenAal(req: NextRequest): string | null {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as { aal?: string }
    return payload.aal ?? null
  } catch {
    return null
  }
}

export async function requireAdmin(
  req: NextRequest,
  { requireMfa = true, endpoint }: AdminGuardOptions,
) {
  const user = await getRequestUser(req)
  if (!user) {
    await reportAuthFailure(req, {
      endpoint,
      method: req.method,
      message: 'Nekat försök att använda en skyddad adminfunktion',
    })
    return {
      user: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const db = createServiceClient()
  const { data: profile } = await db.from('users').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') {
    await reportAuthFailure(req, {
      endpoint,
      method: req.method,
      message: 'Användare utan adminroll försökte använda en skyddad adminfunktion',
      userId: user.id,
    })
    return {
      user: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  if (requireMfa && tokenAal(req) !== 'aal2') {
    await reportAuthFailure(req, {
      endpoint,
      method: req.method,
      message: 'Adminfunktion stoppad eftersom MFA-verifiering saknades',
      userId: user.id,
    })
    return {
      user: null,
      response: NextResponse.json(
        { error: 'MFA verification required', code: 'mfa_required' },
        { status: 403 },
      ),
    }
  }

  return { user, response: null }
}
