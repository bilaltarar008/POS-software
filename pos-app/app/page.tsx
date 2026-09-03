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
      <a href="/products/new" style={{ display: 'inline-block', marginBottom: 16, padding: '8px 16px', background: '#0070f3', color: 'white', textDecoration: 'none', borderRadius: 4 }}>
        + Add Product
      </a>
      <a href="/invoices/new" style={{ display: 'inline-block', marginBottom: 16, marginLeft: 8, padding: '8px 16px', background: '#22c55e', color: 'white', textDecoration: 'none', borderRadius: 4 }}>
  + New Invoice
</a>
      {error && <p style={{ color: 'red' }}>Error: {error.message}</p>}
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
        {/* <tbody>
          {products.map((p: any) => (
            <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
              <td>{p.categories?.name}</td>
              <td>{p.name}</td>
              <td>Rs. {p.price_per_maund}</td>
            </tr>
          ))}
        </tbody> */}
      </table>
    </main>
  )
}