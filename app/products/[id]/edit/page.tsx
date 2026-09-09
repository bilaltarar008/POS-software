'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { localDb } from '@/lib/db'
import { withTimeout, isOnline, queueOp } from '@/lib/sync'
import { useSyncStatus } from '@/lib/useSyncStatus'

export default function EditProductPage() {
  const { id } = useParams()
  const router = useRouter()
  const [categories, setCategories] = useState<any[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [offline, setOffline] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const pendingCount = useSyncStatus()

  useEffect(() => {
    const fetchData = async () => {
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
      const { error } = await supabase.from('products').update(updatedProduct).eq('id', id)
      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
      router.push('/')
    } else {
      await localDb.products.update(id as string, updatedProduct)
      await queueOp('products', 'update', { id, ...updatedProduct })
      setSavedOffline(true)
      setSaving(false)
    }
  }

  if (loading) return <main className="page-container">Loading...</main>

  if (savedOffline) {
    return (
      <main className="page-container max-w-sm">
        <h1 className="text-2xl font-bold mb-4">Saved Offline</h1>
        {pendingCount !== null && pendingCount > 0 && (
          <p className="bg-amber-100 text-amber-800 p-3 rounded mb-3">
            No internet connection — this update was saved on your device and will sync to the cloud automatically once you're back online.
          </p>
        )}
        {pendingCount === 0 && (
          <p className="bg-green-100 text-green-800 p-3 rounded mb-3">
            ✅ Synced! This update has been saved to the cloud.
          </p>
        )}
        <a href="/" className="text-blue-600 hover:underline">← Back to Products</a>
      </main>
    )
  }

  return (
    <main className="page-container max-w-sm">
      <h1 className="text-2xl font-bold mb-4">Edit Product</h1>
      {offline && (
        <p className="bg-amber-100 text-amber-800 p-2 rounded mb-4 text-sm">
          ⚠️ You're offline. Showing last saved data.
        </p>
      )}
      {error && <p className="text-red-600 mb-3">{error}</p>}
      <form onSubmit={handleSubmit}>
        <label className="label-text">Category</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
          className="input-field mb-3"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <label className="label-text">Product Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="input-field mb-3"
        />

        <label className="label-text">Price per Maund (40kg)</label>
        <input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
          className="input-field mb-3"
        />

        <label className="label-text">Cost Price per Maund (what you pay)</label>
        <input
          type="number"
          step="0.01"
          value={costPrice}
          onChange={(e) => setCostPrice(e.target.value)}
          required
          className="input-field mb-3"
        />

        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? 'Saving...' : 'Update Product'}
        </button>
      </form>
    </main>
  )
}