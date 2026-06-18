import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

const IS_SIM = process.env.NEXT_PUBLIC_SIMULATION_MODE === 'true'

// Singleton for browser client — prevents multiple GoTrueClient instances
let browserClient: SupabaseClient | null = null

export function createClient() {
  if (IS_SIM) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { makeSimulationClient } = require('./simulation/client')
    return makeSimulationClient()
  }
  if (typeof window !== 'undefined') {
    if (!browserClient) {
      browserClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            detectSessionInUrl: true,
            flowType: 'implicit',
            persistSession: true,
            autoRefreshToken: true,
            storageKey: 'gonow-auth',
            storage: window.localStorage,
          },
        }
      )
    }
    return browserClient
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
