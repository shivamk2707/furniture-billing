'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/require-role'
import { companySettingsSchema } from '@/lib/validations/settings'
import type { ActionResult, CompanySettings } from '@/lib/types'

export async function getCompanySettings(): Promise<CompanySettings | null> {
  const supabase = await createClient()
  const { companyId } = await requireRole(['admin', 'billing_staff', 'viewer'])

  const { data } = await supabase
    .from('company_settings')
    .select('*')
    .eq('company_id', companyId)
    .single()

  return data as CompanySettings | null
}

export async function saveCompanySettings(
  formData: unknown
): Promise<ActionResult<CompanySettings>> {
  // Only admins can change company settings
  const { companyId } = await requireRole(['admin'])

  const parsed = companySettingsSchema.safeParse(formData)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: `${firstError.path.join('.')}: ${firstError.message}` }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('company_settings')
    .upsert(
      { company_id: companyId, ...parsed.data, updated_at: new Date().toISOString() },
      { onConflict: 'company_id' }
    )
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/settings')
  return { success: true, data: data as CompanySettings }
}
