import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from '@/components/ui/sign-out-button'
import type { UserRole } from '@/lib/types'
import {
  LayoutDashboard,
  ReceiptText,
  Package,
  Users,
  BarChart3,
  Settings,
  Plus
} from 'lucide-react'

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get the user's company membership
  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role, companies(name)')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  return {
    email: user.email ?? '',
    role: (membership?.role ?? 'viewer') as UserRole,
    companyName: (membership?.companies as { name: string } | null | undefined)?.name ?? 'Your Company',
  }
}

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const baseNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/invoices', label: 'Invoices', icon: ReceiptText },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { email, role, companyName } = await getUser()

  const navItems = [
    ...baseNavItems,
    // Settings visible only to admins
    ...(role === 'admin'
      ? [{ href: '/settings', label: 'Settings', icon: Settings }]
      : []),
  ]

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-slate-900 text-slate-300 flex flex-col shadow-2xl z-20">
        {/* Company name */}
        <div className="px-6 py-6 border-b border-slate-800">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Workspace
          </p>
          <p className="text-base font-medium text-white truncate">
            {companyName}
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 hover:bg-slate-800 hover:text-white group"
            >
              <item.icon className="w-5 h-5 text-slate-400 group-hover:text-blue-400 transition-colors" />
              {item.label}
            </Link>
          ))}

          {/* Create Invoice — hidden for viewers */}
          {role !== 'viewer' && (
            <div className="pt-6 mt-4 border-t border-slate-800">
              <Link
                href="/invoices/new"
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-semibold
                  text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                New Invoice
              </Link>
            </div>
          )}
        </nav>

        {/* User info + Sign out */}
        <div className="px-6 py-5 bg-slate-950 border-t border-slate-800 space-y-3">
          <div>
            <p className="text-xs font-medium text-slate-400 truncate">{email}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{role.replace('_', ' ')}</p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-slate-50">
        <div className="mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  )
}
