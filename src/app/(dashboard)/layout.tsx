import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from '@/components/ui/sign-out-button'
import type { UserRole } from '@/lib/types'

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
  icon: string
}

const baseNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/invoices', label: 'Invoices', icon: '🧾' },
  { href: '/products', label: 'Products', icon: '📦' },
  { href: '/customers', label: 'Customers', icon: '👥' },
  { href: '/reports', label: 'Reports', icon: '📊' },
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
      ? [{ href: '/settings', label: 'Settings', icon: '⚙️' }]
      : []),
  ]

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        {/* Company name */}
        <div className="px-4 py-4 border-b border-gray-200">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Company
          </p>
          <p className="mt-1 text-sm font-medium text-gray-900 truncate">
            {companyName}
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700
                hover:bg-gray-100 hover:text-gray-900 rounded-md transition-colors"
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          ))}

          {/* Create Invoice — hidden for viewers */}
          {role !== 'viewer' && (
            <div className="pt-2 border-t border-gray-100 mt-2">
              <Link
                href="/invoices/new"
                className="flex items-center gap-3 px-3 py-2 text-sm font-medium
                  text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                <span className="text-base leading-none">＋</span>
                New Invoice
              </Link>
            </div>
          )}
        </nav>

        {/* User info + Sign out */}
        <div className="px-3 py-4 border-t border-gray-200 space-y-1">
          <div className="px-3 py-1">
            <p className="text-xs text-gray-500 truncate">{email}</p>
            <p className="text-xs font-medium text-gray-400 capitalize">{role.replace('_', ' ')}</p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
