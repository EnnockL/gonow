import fs from 'node:fs'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter(line => line && !line.trimStart().startsWith('#') && line.includes('='))
    .map(line => {
      const at = line.indexOf('=')
      return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '')]
    }),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !anon || !service) throw new Error('Supabase-miljön saknar nödvändiga nycklar.')

const admin = createClient(url, service, { auth: { persistSession: false } })
const client = createClient(url, anon, { auth: { persistSession: false } })
const runId = crypto.randomUUID()
const email = `codex-smoke-${runId}@example.invalid`
const password = `Smoke-${crypto.randomBytes(18).toString('base64url')}!`
let userId = null
let driverUserId = null
let tripId = null
let packageId = null

async function cleanup() {
  if (packageId) {
    await admin.from('package_matches').delete().eq('package_id', packageId)
    await admin.from('package_offers').delete().eq('package_id', packageId)
    await admin.from('packages').delete().eq('id', packageId)
  }
  if (tripId) await admin.from('trips').delete().eq('id', tripId)
  if (userId) {
    await admin.from('users').delete().eq('id', userId)
    await admin.auth.admin.deleteUser(userId)
  }
  if (driverUserId) {
    await admin.from('users').delete().eq('id', driverUserId)
    await admin.auth.admin.deleteUser(driverUserId)
  }
}

try {
  const driverEmail = `codex-driver-${runId}@example.invalid`
  const { data: driverCreated, error: driverCreateError } = await admin.auth.admin.createUser({
    email: driverEmail, password, email_confirm: true, user_metadata: { name: 'Codex QA Transportör' },
  })
  if (driverCreateError || !driverCreated.user) throw driverCreateError ?? new Error('QA-transportören kunde inte skapas.')
  driverUserId = driverCreated.user.id
  const { error: driverProfileError } = await admin.from('users').insert({
    id: driverUserId, email: driverEmail, name: 'Codex QA Transportör', phone: '0700000002',
  })
  if (driverProfileError) throw driverProfileError

  const departure = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  const { data: trip, error: tripError } = await admin.from('trips').insert({
    carrier_id: driverUserId,
    from_city: 'Stockholm',
    to_city: 'Uppsala',
    departure_at: departure,
    weight_capacity_kg: 50,
    allows_packages: true,
    status: 'active',
  }).select('id, from_city, to_city, carrier_id').single()
  if (tripError || !trip) throw tripError ?? new Error('QA-resan kunde inte skapas.')
  tripId = trip.id

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: 'Codex Smoke Test' },
  })
  if (createError || !created.user) throw createError ?? new Error('QA-användaren kunde inte skapas.')
  userId = created.user.id

  const { error: profileError } = await admin.from('users').insert({
    id: userId,
    email,
    name: 'Codex Smoke Test',
    phone: '0700000000',
  })
  if (profileError) throw profileError

  const { data: session, error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError || !session.session?.access_token) throw signInError ?? new Error('QA-inloggningen misslyckades.')

  const requestId = crypto.randomUUID()
  const body = {
    service_type: 'package',
    package_type: 'package',
    from_city: trip.from_city,
    from_address: trip.from_city,
    to_city: trip.to_city,
    to_address: trip.to_city,
    description: 'Automatiskt verifieringspaket',
    weight_kg: 2,
    deadline: 'flexible',
    receiver_name: 'QA Mottagare',
    receiver_phone: '0700000001',
  }
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.session.access_token}`,
    'Idempotency-Key': requestId,
  }

  const firstResponse = await fetch('http://localhost:3000/api/packages', { method: 'POST', headers, body: JSON.stringify(body) })
  const first = await firstResponse.json()
  if (!firstResponse.ok || !first.package?.id) throw new Error(first.error ?? `Första submit misslyckades (${firstResponse.status}).`)
  packageId = first.package.id

  const secondResponse = await fetch('http://localhost:3000/api/packages', { method: 'POST', headers, body: JSON.stringify(body) })
  const second = await secondResponse.json()
  if (!secondResponse.ok || second.package?.id !== packageId || second.idempotent_replay !== true) {
    throw new Error('Dubbel-submit återanvände inte samma package-id.')
  }

  const [{ data: storedPackage, error: packageError }, { data: matches, error: matchError }] = await Promise.all([
    admin.from('packages').select('id, sender_id, receiver_name, receiver_phone, tags, status').eq('id', packageId).single(),
    admin.from('package_matches').select('id, package_id, trip_id, driver_id, status').eq('package_id', packageId),
  ])
  if (packageError || !storedPackage) throw packageError ?? new Error('Paketet saknas efter skapandet.')
  if (matchError) throw matchError
  if (storedPackage.sender_id !== userId || storedPackage.receiver_name !== body.receiver_name || storedPackage.receiver_phone !== body.receiver_phone) {
    throw new Error('Det sparade paketkontraktet tappade kontaktuppgifter eller ägare.')
  }
  const directed = matches?.find(match => match.trip_id === trip.id && match.driver_id === trip.carrier_id)
  if (!directed) throw new Error('Ingen riktad package_match skapades för den aktiva resan.')

  console.log(JSON.stringify({
    ok: true,
    samePackageOnRetry: second.package.id === packageId,
    idempotentReplay: second.idempotent_replay === true,
    contactContractStored: true,
    directedMatchCreated: true,
    packageStatus: storedPackage.status,
    matchStatus: directed.status,
  }))
} finally {
  await cleanup()
}
