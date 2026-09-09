'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Nav() {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav style={{ display: 'flex', gap: 16, padding: '12px 24px', borderBottom: '1px solid #ddd', background: '#fafafa', alignItems: 'center' }}>
      <Link href="/">Products</Link>
      <Link href="/invoices/new">New Invoice</Link>
      <Link href="/invoices">All Invoices</Link>
      <Link href="/payments/new">Record Payment</Link>
      <Link href="/capital/new">Record Capital</Link>
      <Link href="/parties">Balances</Link>
      <Link href="/dashboard">Dashboard</Link>
      <button
        onClick={handleLogout}
        style={{ marginLeft: 'auto', padding: '6px 12px', border: '1px solid #ccc', borderRadius: 4, background: 'white', cursor: 'pointer' }}
      >
        Log Out
      </button>
    </nav>
  )
}