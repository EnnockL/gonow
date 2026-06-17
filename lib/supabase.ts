import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const IS_SIM = process.env.NEXT_PUBLIC_SIMULATION_MODE === 'true'

// Lazily imported so the server bundle doesn't pull simulation code into client chunks unnecessarily
export function createClient() {
  if (IS_SIM) {
    // Dynamic import would be async; for the sync interface we use a require-style approach.
    // The simulation module is only bundled when the flag is set.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { makeSimulationClient } = require('./simulation/client')
    return makeSimulationClient()
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export function createServiceClient() {
  if (IS_SIM) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { makeSimulationClient } = require('./simulation/client')
    return makeSimulationClient()
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
