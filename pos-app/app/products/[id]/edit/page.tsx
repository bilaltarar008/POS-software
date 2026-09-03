'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function EditProductPage() {
  const { id } = useParams()
  const router = useRouter()
  const [categories, setCategories] = useState<any[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const { data: cats } = await supabase.from('categories').select('id, name').order('name')
      setCategories(cats || [])

      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        setError(error.message)
      } else if (product) {
        setCategoryId(product.category_id)
        setName(product.name)
        setPrice(product.price_per_maund.toString())
      }
      setLoading(false)
    }
    fetchData()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { error } = await supabase
      .from('products')
      .update({
        category_id: categoryId,
        name: name,
        price_per_maund: parseFloat(price),
      })
      .eq('id', id)

    if (error) {
      setError(error.message)
      setSaving(false)
    } else {
      router.push('/')
    }
  }

  if (loading) return <main style={{ padding: '2rem' }}>Loading...</main>

  return (
    <main style={{ padding: '2rem', maxWidth: 400 }}>
      <h1>Edit Product</h1>
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

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <button type="submit" disabled={saving} style={{ padding: '8px 16px' }}>
          {saving ? 'Saving...' : 'Update Product'}
        </button>
      </form>
    </main>
  )
}