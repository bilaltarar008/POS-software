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
            .select('id, category_id, name, price_per_maund, cost_price_per_maund, is_active, categories(name)')
            .order('name')
        )
        if (error) throw error

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
        setOffline(true)
        const cached = await localDb.products.toArray()
        setProducts(cached.map((p) => ({ ...p, categories: { name: p.category_name } })))
      }
      setLoading(false)
    }

    fetchProducts()
  }, [])

  if (loading) return <main className="page-container">Loading...</main>

  return (
    <main className="page-container">
      <h1 className="text-2xl font-bold mb-4">Products</h1>
      {offline && (
        <p className="bg-amber-100 text-amber-800 p-2 rounded mb-4 text-sm">
          ⚠️ You're offline. Showing last saved data.
        </p>
      )}
      <a href="/products/new" className="btn-primary mb-4 inline-block">
        + Add Product
      </a>
      {error && <p className="text-red-600">Error: {error}</p>}
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Category</th>
              <th>Product</th>
              <th>Price / Maund (40kg)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
              {products.map((p: any) => (
              <tr key={p.id} className={p.is_active === false ? 'opacity-50' : ''}>
                <td>{p.categories?.name}</td>
                <td>{p.name}{p.is_active === false ? ' (Inactive)' : ''}</td>
                <td>Rs. {p.price_per_maund}</td>
                <td><a href={`/products/${p.id}/edit`} className="text-blue-600 hover:underline">Edit</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}