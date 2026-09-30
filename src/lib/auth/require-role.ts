import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/types'

export class AuthError extends Error {
  constructor(
    message: string,
    public code: 'UNAUTHENTICATED' | 'UNAUTHORIZED' | 'NO_COMPANY'
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

/**
 * Verifies the current user is authenticated and has one of the required roles
 * for the given company. Throws AuthError on failure.
 *
 * Usage in Server Actions:
 *   const { user, companyId } = await requireRole(['admin', 'billing_staff'])
 */
export async function requireRole(
  allowedRoles: UserRole[],
  companyId?: string
): Promise<{ userId: string; companyId: string; role: UserRole }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new AuthError('Not authenticated', 'UNAUTHENTICATED')
  }

  // Determine company: use provided ID or pick the user's first company
  let resolvedCompanyId = companyId
  if (!resolvedCompanyId) {
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership) {
      throw new AuthError('User does not belong to any company', 'NO_COMPANY')
    }
    resolvedCompanyId = membership.company_id
  }

  const { data: member } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', resolvedCompanyId)
    .eq('user_id', user.id)
    .single()

  if (!member) {
    throw new AuthError('Not a member of this company', 'UNAUTHORIZED')
  }

  const role = member.role as UserRole
  if (!allowedRoles.includes(role)) {
    throw new AuthError(
      `Role '${role}' is not authorized. Required: ${allowedRoles.join(', ')}`,
      'UNAUTHORIZED'
    )
  }

  return { userId: user.id, companyId: resolvedCompanyId!, role }
}

/**
 * Returns the user's active company ID and role, or null if not authenticated.
 * Safe to call from Server Components (does not throw).
 */
export async function getActiveCompany(): Promise<{
  userId: string
  companyId: string
  role: UserRole
} | null> {
  try {
    return await requireRole(['admin', 'billing_staff', 'viewer'])
  } catch {
    return null
  }
}
