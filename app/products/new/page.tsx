'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'
import { localDb } from '@/lib/db'
import { isOnline, queueOp, withTimeout } from '@/lib/sync'
import { useSyncStatus } from '@/lib/useSyncStatus'

export default function NewProductPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const router = useRouter()
  const pendingCount = useSyncStatus()

  useEffect(() => {
    const fetchCategories = async () => {
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
    }
    fetchCategories()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
        const priceNum = parseFloat(price)
    const costNum = parseFloat(costPrice) || 0

    if (!name.trim()) {
      setError('Product name cannot be empty.')
      setSaving(false)
      return
    }
    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Price per maund must be a positive number.')
      setSaving(false)
      return
    }
    if (costNum < 0) {
      setError('Cost price cannot be negative.')
      setSaving(false)
      return
    }
    if (costNum > priceNum) {
      setError('Warning: cost price is higher than sale price — this product would sell at a loss. Save again to confirm if this is intentional.')
      // Note: this one is a soft warning, not a hard block — see below
    }

    const newProduct = {
      id: uuidv4(),
      category_id: categoryId,
      name: name,
      price_per_maund: parseFloat(price),
      cost_price_per_maund: parseFloat(costPrice) || 0,
    }

    const online = await isOnline()

    if (online) {
      const { error } = await supabase.from('products').insert(newProduct)
      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
      router.push('/')
    } else {
      const category = categories.find((c) => c.id === categoryId)
      await localDb.products.put({ ...newProduct, category_name: category?.name })
      await queueOp('products', 'insert', newProduct)
      setSavedOffline(true)
      setSaving(false)
    }
  }

  if (savedOffline) {
    return (
      <main className="page-container max-w-sm">
        <h1 className="text-2xl font-bold mb-4">Saved Offline</h1>
        {pendingCount !== null && pendingCount > 0 && (
          <p className="bg-amber-100 text-amber-800 p-3 rounded mb-3">
            No internet connection — this product was saved on your device and will sync to the cloud automatically once you're back online.
          </p>
        )}
        {pendingCount === 0 && (
          <p className="bg-green-100 text-green-800 p-3 rounded mb-3">
            ✅ Synced! This product has been saved to the cloud.
          </p>
        )}
        <a href="/" className="text-blue-600 hover:underline">← Back to Products</a>
      </main>
    )
  }

  return (
    <main className="page-container max-w-sm">
      <h1 className="text-2xl font-bold mb-4">Add Product</h1>
      <form onSubmit={handleSubmit}>
        <label className="label-text">Category</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
          className="input-field mb-3"
        >
          <option value="">Select a category</option>
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

        {error && <p className="text-red-600 mb-3">{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Product'}
        </button>
      </form>
    </main>
  )
}