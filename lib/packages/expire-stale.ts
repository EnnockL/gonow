import { createServiceClient } from '../supabase'
import { notify } from '../notify'

export async function expireStalePackages(): Promise<void> {
  const supabase = createServiceClient()
  const now = new Date().toISOString()

  const { data: stale } = await supabase
    .from('packages')
    .select('id, sender_id, from_city, to_city')
    .eq('status', 'open')
    .not('expires_at', 'is', null)
    .lt('expires_at', now)

  if (!stale?.length) return

  const staleTyped = stale as { id: string; sender_id: string | null; from_city: string; to_city: string }[]

  await supabase
    .from('packages')
    .update({ status: 'expired' })
    .in('id', staleTyped.map(p => p.id))

  for (const pkg of staleTyped) {
    if (!pkg.sender_id) continue
    const route = `${pkg.from_city} → ${pkg.to_city}`
    notify({
      user_id: pkg.sender_id,
      type: 'package_expired',
      title: 'Paketet hittade ingen transport',
      message: `Ditt paket ${route} har gått ut utan att hittas av en förare. Publicera det igen om du fortfarande vill skicka.`,
      related_type: 'package',
      related_id: pkg.id,
    }).catch(() => {})
  }
}
