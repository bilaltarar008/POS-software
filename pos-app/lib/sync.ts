import { supabase } from './supabase'
import { localDb } from './db'

export async function isOnline(): Promise<boolean> {
  if (!navigator.onLine) return false
  try {
    // A lightweight real check — navigator.onLine can lie (e.g. connected to wifi with no internet)
    const { error } = await supabase.from('categories').select('id').limit(1)
    return !error
  } catch {
    return false
  }
}

export async function queueOp(table: string, operation: 'insert' | 'update', payload: any) {
  await localDb.pending_ops.add({
    table,
    operation,
    payload,
    created_at: new Date().toISOString(),
  })
}

export async function flushPendingOps(): Promise<{ synced: number; failed: number }> {
  const ops = await localDb.pending_ops.orderBy('created_at').toArray()
  let synced = 0
  let failed = 0

  for (const op of ops) {
    try {
      if (op.operation === 'insert') {
        const { error } = await supabase.from(op.table).insert(op.payload)
        if (error) throw error
      } else if (op.operation === 'update') {
        const { id, ...fields } = op.payload
        const { error } = await supabase.from(op.table).update(fields).eq('id', id)
        if (error) throw error
      }
      // Success: remove from queue
      await localDb.pending_ops.delete(op.id!)
      synced++
    } catch (err) {
      // Leave it in the queue, try again next time
      failed++
    }
  }

  return { synced, failed }
}