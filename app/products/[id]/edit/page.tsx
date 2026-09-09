'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useSyncStatus } from '@/lib/useSyncStatus'
import { localDb } from '@/lib/db'
import { withTimeout, isOnline, queueOp } from '@/lib/sync'

export default function EditProductPage() {
  const { id } = useParams()
  const router = useRouter()
  const [categories, setCategories] = useState<any[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [name, setName] = useState('')
    const pendingCount = useSyncStatus()
  const [price, setPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [offline, setOffline] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      // Categories
      try {
        const { data, error } = await withTimeout(
          supabase.from('categories').select('id, name').order('name')
        )
        if (error) throw error
        setCategories(data || [])
        await localDb.categories.bulkPut(data || [])
      } catch {
        const cached = await localDb.categories.toArray()
        setCategories(cached)
      }

      // This specific product
      try {
        const { data: product, error } = await withTimeout(
          supabase.from('products').select('*').eq('id', id).single()
        )
        if (error) throw error

        setOffline(false)
        setCategoryId(product.category_id)
        setName(product.name)
        setPrice(product.price_per_maund.toString())
        setCostPrice(product.cost_price_per_maund.toString())

        // Cache this product for offline editing later
        await localDb.products.put({
          id: product.id,
          category_id: product.category_id,
          name: product.name,
          price_per_maund: product.price_per_maund,
          cost_price_per_maund: product.cost_price_per_maund,
        })
      } catch {
        setOffline(true)
        const cached = await localDb.products.get(id as string)
        if (cached) {
          setCategoryId(cached.category_id)
          setName(cached.name)
          setPrice(cached.price_per_maund.toString())
          setCostPrice(cached.cost_price_per_maund.toString())
        } else {
          setError('This product is not available offline yet — open it once while online first.')
        }
      }
      setLoading(false)
    }
    fetchData()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const updatedProduct = {
      category_id: categoryId,
      name: name,
      price_per_maund: parseFloat(price),
      cost_price_per_maund: parseFloat(costPrice) || 0,
    }

    const online = await isOnline()

    if (online) {
      const { error } = await supabase
        .from('products')
        .update(updatedProduct)
        .eq('id', id)

      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
      router.push('/')
    } else {
      // Offline: update the local copy immediately, and queue the change to sync later
      await localDb.products.update(id as string, updatedProduct)
      await queueOp('products', 'update', { id, ...updatedProduct })
      setSavedOffline(true)
      setSaving(false)
    }
  }

  if (loading) return <main style={{ padding: '2rem' }}>Loading...</main>

    if (savedOffline) {
    return (
      <main style={{ padding: '2rem', maxWidth: 400 }}>
        <h1>Saved Offline</h1>
        {pendingCount !== null && pendingCount > 0 && (
          <p style={{ background: '#fef3c7', padding: 12, borderRadius: 4 }}>
            No internet connection — this product was saved on your device and will sync to the cloud automatically once you're back online.
          </p>
        )}
        {pendingCount === 0 && (
          <p style={{ background: '#dcfce7', padding: 12, borderRadius: 4 }}>
            ✅ Synced! This product has been saved to the cloud.
          </p>
        )}
        <a href="/">← Back to Products</a>
      </main>
    )
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 400 }}>
      <h1>Edit Product</h1>
      {offline && (
        <p style={{ background: '#fef3c7', padding: 8, borderRadius: 4, marginBottom: 16 }}>
          ⚠️ You're offline. Showing last saved data.
        </p>
      )}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', marginBottom: 4 }}>Category</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
          style={{ display: 'block', marginBottom: 12, width: '100%', padding: 8 }}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <label style={{ display: 'block', marginBottom: 4 }}>Product Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ display: 'block', marginBottom: 12, width: '100%', padding: 8 }}
        />

        <label style={{ display: 'block', marginBottom: 4 }}>Price per Maund (40kg)</label>
        <input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
          style={{ display: 'block', marginBottom: 12, width: '100%', padding: 8 }}
        />

        <label style={{ display: 'block', marginBottom: 4 }}>Cost Price per Maund (what you pay)</label>
        <input
          type="number"
          step="0.01"
          value={costPrice}
          onChange={(e) => setCostPrice(e.target.value)}
          required
          style={{ display: 'block', marginBottom: 12, width: '100%', padding: 8 }}
        />

        <button type="submit" disabled={saving} style={{ padding: '8px 16px' }}>
          {saving ? 'Saving...' : 'Update Product'}
        </button>
      </form>
    </main>
  )
}