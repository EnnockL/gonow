import fs from 'node:fs'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(line => line && !line.trimStart().startsWith('#') && line.includes('='))
  .map(line => { const at = line.indexOf('='); return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '')] }))
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const runId = crypto.randomUUID()
const password = `Messaging-${crypto.randomBytes(18).toString('base64url')}!`
const users = []
let packageId = null
let messageId = null

async function makeUser(role) {
  const email = `codex-${role}-${runId}@example.invalid`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw error ?? new Error(`Kunde inte skapa ${role}.`)
  const id = data.user.id
  users.push(id)
  const { error: profileError } = await admin.from('users').insert({ id, email, name: `QA ${role}`, phone: '0700000000' })
  if (profileError) throw profileError
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anon, { auth: { persistSession: false } })
  const { data: login, error: loginError } = await client.auth.signInWithPassword({ email, password })
  if (loginError || !login.session) throw loginError ?? new Error(`Kunde inte logga in ${role}.`)
  return { id, token: login.session.access_token }
}

const call = (path, token, init = {}) => fetch(`http://localhost:3000${path}`, {
  ...init,
  headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
})

try {
  const [sender, driver, outsider] = await Promise.all([makeUser('sender'), makeUser('driver'), makeUser('outsider')])
  const { data: pkg, error } = await admin.from('packages').insert({
    sender_id: sender.id, matched_carrier_id: driver.id, status: 'matched',
    from_city: 'Örebro', from_address: 'Örebro', to_city: 'Umeå', to_address: 'Umeå',
    description: 'Säkerhetskontroll', weight_kg: 2, receiver_name: 'QA mottagare', receiver_phone: '0700000001',
  }).select('id').single()
  if (error || !pkg) throw error ?? new Error('Kunde inte skapa testpaket.')
  packageId = pkg.id
  const conversation = `package:${packageId}`

  const unauth = await call(`/api/conversations/${conversation}/messages`, null)
  const outsiderRead = await call(`/api/conversations/${conversation}/messages`, outsider.token)
  const forged = await call(`/api/conversations/${conversation}/messages`, sender.token, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender_id: outsider.id, body: 'Verifierat meddelande' }),
  })
  const forgedJson = await forged.json()
  messageId = forgedJson.message?.id ?? null
  const driverRead = await call(`/api/conversations/${conversation}/messages`, driver.token)
  const driverJson = await driverRead.json()
  const stored = driverJson.messages?.find(message => message.id === messageId)

  if (unauth.status !== 401) throw new Error(`Oautentiserad läsning gav ${unauth.status}, väntade 401.`)
  if (outsiderRead.status !== 403) throw new Error(`Utomstående läsning gav ${outsiderRead.status}, väntade 403.`)
  if (forged.status !== 201 || stored?.sender_id !== sender.id) throw new Error('API:t litade fortfarande på förfalskat sender_id.')
  if (!driverRead.ok) throw new Error('Giltig paketdeltagare kunde inte läsa tråden.')

  console.log(JSON.stringify({ ok: true, unauthenticatedBlocked: true, outsiderBlocked: true, forgedSenderIgnored: true, participantCanRead: true }))
} finally {
  if (messageId) await admin.from('messages').delete().eq('id', messageId)
  if (packageId) await admin.from('packages').delete().eq('id', packageId)
  for (const id of users) {
    await admin.from('users').delete().eq('id', id)
    await admin.auth.admin.deleteUser(id)
  }
}
