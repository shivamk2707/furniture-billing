'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/require-role'
import { productSchema } from '@/lib/validations/product'
import type { ActionResult } from '@/lib/types'

export interface Product {
  id: string
  company_id: string
  name: string
  sku: string
  description: string | null
  hsn_sac: string | null
  unit: string
  selling_price: number
  tax_rate: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function getProducts(search?: string): Promise<Product[]> {
  const supabase = await createClient()
  const { companyId } = await requireRole(['admin', 'billing_staff', 'viewer'])

  let query = supabase
    .from('products')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (search?.trim()) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Product[]
}

export async function upsertProduct(
  formData: unknown,
  productId?: string
): Promise<ActionResult<Product>> {
  const { companyId } = await requireRole(['admin', 'billing_staff'])

  const parsed = productSchema.safeParse(formData)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: `${firstError.path.join('.')}: ${firstError.message}` }
  }

  const supabase = await createClient()

  if (productId) {
    // Update existing product
    const { data, error } = await supabase
      .from('products')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') return { success: false, error: 'A product with this SKU already exists.' }
      return { success: false, error: error.message }
    }
    revalidatePath('/products')
    return { success: true, data: data as Product }
  } else {
    // Create new product
    const { data, error } = await supabase
      .from('products')
      .insert({ ...parsed.data, company_id: companyId })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') return { success: false, error: 'A product with this SKU already exists.' }
      return { success: false, error: error.message }
    }
    revalidatePath('/products')
    return { success: true, data: data as Product }
  }
}

export async function archiveProduct(productId: string): Promise<ActionResult> {
  const { companyId } = await requireRole(['admin'])
  const supabase = await createClient()

  const { error } = await supabase
    .from('products')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .eq('company_id', companyId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/products')
  return { success: true }
}
