'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { useMe } from '@/lib/hooks'

export default function MyPage() {
  const router = useRouter()
  const { isLoggedIn } = useAuthStore()
  const { data: me } = useMe()

  useEffect(() => {
    if (!isLoggedIn) { router.push('/login'); return }
    if (me?.username) router.replace(`/users/${me.username}`)
  }, [isLoggedIn, me, router])

  return null
}
