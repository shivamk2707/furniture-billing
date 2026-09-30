'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/require-role'
import { customerSchema } from '@/lib/validations/customer'
import type { ActionResult } from '@/lib/types'

export interface Customer {
  id: string
  company_id: string
  name: string
  gstin: string | null
  pan: string | null
  mobile: string | null
  email: string | null
  billing_address: string | null
  shipping_address: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function getCustomers(search?: string): Promise<Customer[]> {
  const supabase = await createClient()
  const { companyId } = await requireRole(['admin', 'billing_staff', 'viewer'])

  let query = supabase
    .from('customers')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (search?.trim()) {
    query = query.or(
      `name.ilike.%${search}%,mobile.ilike.%${search}%,gstin.ilike.%${search}%`
    )
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Customer[]
}

export async function upsertCustomer(
  formData: unknown,
  customerId?: string
): Promise<ActionResult<Customer>> {
  const { companyId } = await requireRole(['admin', 'billing_staff'])

  const parsed = customerSchema.safeParse(formData)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: `${firstError.path.join('.')}: ${firstError.message}` }
  }

  const supabase = await createClient()

  if (customerId) {
    const { data, error } = await supabase
      .from('customers')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', customerId)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    revalidatePath('/customers')
    return { success: true, data: data as Customer }
  } else {
    const { data, error } = await supabase
      .from('customers')
      .insert({ ...parsed.data, company_id: companyId })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    revalidatePath('/customers')
    return { success: true, data: data as Customer }
  }
}

export async function archiveCustomer(customerId: string): Promise<ActionResult> {
  const { companyId } = await requireRole(['admin', 'billing_staff'])
  const supabase = await createClient()

  const { error } = await supabase
    .from('customers')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', customerId)
    .eq('company_id', companyId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/customers')
  return { success: true }
}
