import Dexie, { Table } from 'dexie'

export interface LocalProduct {
  id: string
  category_id: string
  name: string
  price_per_maund: number
  cost_price_per_maund: number
  category_name?: string // denormalized for easy offline display
}

export interface LocalParty {
  id: string
  name: string
  type: string
  brokerage_fee_percent?: number

}

export interface LocalInvoice {
  id: string
  party_id: string
  broker_id: string | null
  invoice_date: string
  total: number
  amount_paid: number
  brokerage_amount: number
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
  parties!: Table<LocalParty, string>
  invoices!: Table<LocalInvoice, string>
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
    this.version(3).stores({
      products: 'id, category_id, name',
      categories: 'id, name',
      parties: 'id, name, type',
      pending_ops: '++id, table, created_at',
    })
    this.version(4).stores({
      products: 'id, category_id, name',
      categories: 'id, name',
      parties: 'id, name, type',
      invoices: 'id, party_id, invoice_date',
      pending_ops: '++id, table, created_at',
    })
  }
}



export const localDb = new LocalDB()