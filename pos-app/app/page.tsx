'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { localDb } from '@/lib/db'
import { withTimeout } from '@/lib/sync'

export default function Home() {
  const [products, setProducts] = useState<any[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('products')
            .select('id, category_id, name, price_per_maund, cost_price_per_maund, categories(name)')
            .order('name')
        )
        if (error) throw error

        // Success: show the fresh data AND save a local copy for offline use
        setProducts(data || [])
        setOffline(false)

        const localCopies = (data || []).map((p: any) => ({
          id: p.id,
          category_id: p.category_id,
          name: p.name,
          price_per_maund: p.price_per_maund,
          cost_price_per_maund: p.cost_price_per_maund,
          category_name: p.categories?.name,
        }))
        await localDb.products.bulkPut(localCopies)
      } catch (err) {
        // Failed (likely offline): fall back to whatever we last saved locally
        setOffline(true)
        const cached = await localDb.products.toArray()
        setProducts(
          cached.map((p) => ({ ...p, categories: { name: p.category_name } }))
        )
      }
      setLoading(false)
    }

    fetchProducts()
  }, [])

  if (loading) return <main style={{ padding: '2rem' }}>Loading...</main>

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Products</h1>
      {offline && (
        <p style={{ background: '#fef3c7', padding: 8, borderRadius: 4, marginBottom: 16 }}>
          ⚠️ You're offline. Showing last saved data.
        </p>
      )}
      <a href="/products/new" style={{ display: 'inline-block', marginBottom: 16, padding: '8px 16px', background: '#0070f3', color: 'white', textDecoration: 'none', borderRadius: 4 }}>
        + Add Product
      </a>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
            <th>Category</th>
            <th>Product</th>
            <th>Price / Maund (40kg)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p: any) => (
            <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
              <td>{p.categories?.name}</td>
              <td>{p.name}</td>
              <td>Rs. {p.price_per_maund}</td>
              <td><a href={`/products/${p.id}/edit`}>Edit</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}