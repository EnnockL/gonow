import { Pool } from 'pg'

let _pool: Pool | null = null

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gonow',
      max: 10,
    })
  }
  return _pool
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const pool = getPool()
  const result = await pool.query(sql, params)
  return result.rows as T[]
}
