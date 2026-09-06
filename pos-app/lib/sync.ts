import { supabase } from './supabase'
import { localDb } from './db'

export async function isOnline(): Promise<boolean> {
  if (!navigator.onLine) return false
  try {
    const { error } = await withTimeout(
      supabase.from('categories').select('id').limit(1)
    )
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

export async function withTimeout<T>(promise: Promise<T>, ms = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out')), ms)
    promise.then(
      (result) => {
        clearTimeout(timer)
        resolve(result)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

export async function flushPendingOps(): Promise<{ synced: number; failed: number }> {
  const ops = await localDb.pending_ops.orderBy('created_at').toArray()
  let synced = 0
  let failed = 0

  for (const op of ops) {
    try {
      if (op.operation === 'insert') {
        const { error } = await supabase.from(op.table).upsert(op.payload)
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