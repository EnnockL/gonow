import { SIM_TRIPS, SIM_USERS, SIM_ORDERS } from './data'

// Minimal mock that mimics the @supabase/supabase-js query builder interface.
// Only implements the methods actually used in this codebase.

type Row = Record<string, unknown>

class QueryBuilder {
  private _table: string
  private _filters: { col: string; op: string; val: unknown }[] = []
  private _selectCols = '*'
  private _orderCol?: string
  private _ascending = true
  private _limitN?: number
  private _single = false
  private _data: Row[] = []
  private _count: boolean | string = false

  constructor(table: string) {
    this._table = table
    this._data = this._tableData()
  }

  private _tableData(): Row[] {
    if (this._table === 'trips') return SIM_TRIPS as unknown as Row[]
    if (this._table === 'users') return SIM_USERS as unknown as Row[]
    if (this._table === 'orders') return SIM_ORDERS as unknown as Row[]
    if (this._table === 'waitlist') return []
    if (this._table === 'payouts') return []
    return []
  }

  select(cols?: string, opts?: { count?: string }) {
    this._selectCols = cols || '*'
    if (opts?.count) this._count = opts.count
    return this
  }

  eq(col: string, val: unknown) {
    this._filters.push({ col, op: 'eq', val })
    return this
  }

  gte(col: string, val: unknown) {
    this._filters.push({ col, op: 'gte', val })
    return this
  }

  lte(col: string, val: unknown) {
    this._filters.push({ col, op: 'lte', val })
    return this
  }

  or(_condition: string) { return this }

  order(col: string, opts?: { ascending?: boolean }) {
    this._orderCol = col
    this._ascending = opts?.ascending !== false
    return this
  }

  limit(n: number) {
    this._limitN = n
    return this
  }

  single() {
    this._single = true
    return this
  }

  async insert(_payload: unknown) {
    // Simulation: silently succeed
    return { data: null, error: null }
  }

  async update(_payload: unknown) {
    return { data: null, error: null }
  }

  private _resolve(): { data: Row[] | Row | null; error: null; count: number | null } {
    let rows = [...this._data]

    for (const f of this._filters) {
      rows = rows.filter((r) => {
        const v = r[f.col]
        if (f.op === 'eq') return String(v) === String(f.val)
        if (f.op === 'gte') return Number(v) >= Number(f.val)
        if (f.op === 'lte') return Number(v) <= Number(f.val)
        return true
      })
    }

    if (this._orderCol) {
      const col = this._orderCol
      const asc = this._ascending
      rows.sort((a, b) => {
        const av = a[col] as string | number
        const bv = b[col] as string | number
        return asc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
      })
    }

    if (this._limitN !== undefined) {
      rows = rows.slice(0, this._limitN)
    }

    const count = this._count ? rows.length : null

    if (this._single) {
      return { data: rows[0] ?? null, error: null, count }
    }
    return { data: rows, error: null, count }
  }

  // Thenable — so `await builder` works
  then(resolve: (v: ReturnType<typeof this._resolve>) => unknown) {
    return Promise.resolve(this._resolve()).then(resolve)
  }
}

function makeSimulationClient() {
  return {
    from: (table: string) => new QueryBuilder(table),
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: 'sim-user',
            email: 'demo@gonow.se',
            user_metadata: { full_name: 'Demo Användare' },
          },
        },
        error: null,
      }),
      signOut: async () => ({ error: null }),
    },
    channel: (_name: string) => ({
      on: (_event: string, _opts: unknown, _cb: unknown) => ({
        subscribe: () => ({}),
      }),
    }),
    removeChannel: (_ch: unknown) => {},
  }
}

export { makeSimulationClient }
