'use client'

import { signOut } from '@/actions/auth'

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut()}
      className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-100
        hover:text-gray-900 rounded-md transition-colors"
    >
      Sign out
    </button>
  )
}
