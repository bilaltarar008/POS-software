'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'
import { localDb } from '@/lib/db'
import { isOnline, queueOp } from '@/lib/sync'
import { withTimeout } from '@/lib/sync'

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
      <main style={{ padding: '2rem', maxWidth: 400 }}>
        <h1>Saved Offline</h1>
        <p style={{ background: '#fef3c7', padding: 12, borderRadius: 4 }}>
          No internet connection — this product was saved on your device and will sync to the cloud automatically once you're back online.
        </p>
        <a href="/">← Back to Products</a>
      </main>
    )
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 400 }}>
      <h1>Add Product</h1>
      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', marginBottom: 4 }}>Category</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
          style={{ display: 'block', marginBottom: 12, width: '100%', padding: 8 }}
        >
          <option value="">Select a category</option>
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

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <button type="submit" disabled={saving} style={{ padding: '8px 16px' }}>
          {saving ? 'Saving...' : 'Save Product'}
        </button>
      </form>
    </main>
  )
}
