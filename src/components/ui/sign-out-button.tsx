'use client'

import { signOut } from '@/actions/auth'
import { LogOut } from 'lucide-react'

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut()}
      className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800
        hover:text-white rounded-md transition-colors"
    >
      <LogOut className="w-4 h-4" />
      Sign out
    </button>
  )
}
