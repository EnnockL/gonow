import { createServiceClient } from '../supabase'
import { notify } from '../notify'

export interface MatchRow {
  id: string
  status: string
  expires_at: string | null
  package_id: string
  driver_id: string | null
  packages?: { sender_id: string | null; from_city: string; to_city: string } | null
}

export function isMatchExpired(match: MatchRow): boolean {
  return (
    match.status === 'driver_pending_confirmation' &&
    match.expires_at !== null &&
    new Date(match.expires_at) < new Date()
  )
}

export async function expirePendingMatches(): Promise<{ expired_count: number; expired_matches: MatchRow[] }> {
  const supabase = createServiceClient()

  const { data: pending, error: fetchErr } = await supabase
    .from('package_matches')
    .select('id, status, expires_at, package_id, driver_id, packages(sender_id, from_city, to_city)')
    .eq('status', 'driver_pending_confirmation')
    .not('expires_at', 'is', null)
    .lt('expires_at', new Date().toISOString())

  if (fetchErr || !pending?.length) {
    return { expired_count: 0, expired_matches: [] }
  }

  const ids = pending.map((m: MatchRow) => m.id)

  const { error: updateErr } = await supabase
    .from('package_matches')
    .update({ status: 'expired' })
    .in('id', ids)

  if (updateErr) {
    console.error('[match-expiry] update failed:', updateErr.message)
    return { expired_count: 0, expired_matches: [] }
  }

  // Reset packages to open so they can be re-matched or picked up by logistics
  const packageIds = [...new Set((pending as MatchRow[]).map(m => m.package_id))]
  if (packageIds.length > 0) {
    await supabase
      .from('packages')
      .update({ status: 'open', dispatcher_stage: null })
      .in('id', packageIds)
      .eq('status', 'open')
  }

  // Notify customers fire-and-forget
  for (const match of pending as MatchRow[]) {
    const pkg = match.packages
    if (pkg?.sender_id) {
      const route = `${pkg.from_city} → ${pkg.to_city}`
      notify({
        user_id: pkg.sender_id,
        type: 'match_expired',
        title: 'Föraren bekräftade inte i tid',
        message: `Transport ${route} gick ut. Gonow fortsätter söka efter en ny transport åt dig.`,
      }).catch(() => {})
    }
  }

  return { expired_count: ids.length, expired_matches: pending as MatchRow[] }
}
