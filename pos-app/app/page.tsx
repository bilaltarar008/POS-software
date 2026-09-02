'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [products, setProducts] = useState<any[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price_per_maund, categories(name)')
        .order('name')

      if (error) setError(error.message)
      else setProducts(data || [])
      setLoading(false)
    }

    fetchProducts()
  }, [])

  if (loading) return <main style={{ padding: '2rem' }}>Loading...</main>

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Products</h1>
      {error && <p style={{ color: 'red' }}>Error: {error.message}</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
            <th>Category</th>
            <th>Product</th>
            <th>Price / Maund (40kg)</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p: any) => (
            <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
              <td>{p.categories?.name}</td>
              <td>{p.name}</td>
              <td>Rs. {p.price_per_maund}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}