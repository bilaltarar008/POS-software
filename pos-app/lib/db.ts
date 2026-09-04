import Dexie, { Table } from 'dexie'

export interface LocalProduct {
  id: string
  category_id: string
  name: string
  price_per_maund: number
  cost_price_per_maund: number
  category_name?: string // denormalized for easy offline display
}

export interface LocalCategory {
  id: string
  name: string
}

export interface PendingOp {
  id?: number // auto-incremented local id
  table: string
  operation: 'insert' | 'update'
  payload: any
  created_at: string
}

class LocalDB extends Dexie {
  products!: Table<LocalProduct, string>
  categories!: Table<LocalCategory, string>
  pending_ops!: Table<PendingOp, number>

  constructor() {
    super('pos_app_db')
    this.version(1).stores({
      products: 'id, category_id, name',
      pending_ops: '++id, table, created_at',
    })
    this.version(2).stores({
      products: 'id, category_id, name',
      categories: 'id, name',
      pending_ops: '++id, table, created_at',
    })
  }
}

export const localDb = new LocalDB()