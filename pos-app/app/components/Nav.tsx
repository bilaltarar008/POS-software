import Link from 'next/link'

export default function Nav() {
  return (
    <nav style={{ display: 'flex', gap: 16, padding: '12px 24px', borderBottom: '1px solid #ddd', background: '#fafafa' }}>
      <Link href="/">Products</Link>
      <Link href="/invoices/new">New Invoice</Link>
      <Link href="/payments/new">Record Payment</Link>
      <Link href="/capital/new">Record Capital</Link>
      <Link href="/parties">Balances</Link>
      <Link href="/dashboard">Dashboard</Link>
    </nav>
  )
}