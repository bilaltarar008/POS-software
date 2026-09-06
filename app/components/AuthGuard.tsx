'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false)
  const [authed, setAuthed] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession()
      const hasSession = !!data.session

      setAuthed(hasSession)
      setChecked(true)

      if (!hasSession && pathname !== '/login') {
        router.push('/login')
      }
    }
    checkAuth()

    // Also react to login/logout happening in this tab
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session)
      if (!session && pathname !== '/login') {
        router.push('/login')
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [pathname, router])

  // Login page itself always renders normally, no gate needed
  if (pathname === '/login') {
    return <>{children}</>
  }

  // Still checking session — show nothing (or a blank loading state) to avoid a flash of content
  if (!checked) {
    return <main style={{ padding: '2rem' }}>Loading...</main>
  }

  // Checked, but not logged in — we're already redirecting; render nothing meanwhile
  if (!authed) {
    return null
  }

  // Logged in — show the actual page
  return <>{children}</>
}