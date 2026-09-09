'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Nav() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const links = [
    { href: '/', label: 'Products' },
    { href: '/invoices/new', label: 'New Invoice' },
    { href: '/invoices', label: 'All Invoices' },
    { href: '/payments/new', label: 'Record Payment' },
    { href: '/capital/new', label: 'Record Capital' },
    { href: '/parties', label: 'Balances' },
    { href: '/dashboard', label: 'Dashboard' },
  ]

  return (
    <nav className="border-b border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <span className="font-semibold text-gray-800">POS Software</span>
        <button
          className="sm:hidden text-gray-700 border border-gray-300 rounded px-2 py-1"
          onClick={() => setOpen(!open)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
        <div className="hidden sm:flex sm:items-center sm:gap-4">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-gray-700 hover:text-blue-600 text-sm">
              {link.label}
            </Link>
          ))}
          <button onClick={handleLogout} className="btn-secondary text-sm py-1">
            Log Out
          </button>
        </div>
      </div>

      {open && (
        <div className="sm:hidden flex flex-col gap-2 px-4 pb-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-gray-700 hover:text-blue-600 py-1"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <button onClick={handleLogout} className="btn-secondary text-sm mt-2 w-fit">
            Log Out
          </button>
        </div>
      )}
    </nav>
  )
}