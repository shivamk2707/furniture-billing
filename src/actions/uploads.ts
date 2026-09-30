'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/require-role'
import type { ActionResult } from '@/lib/types'

const BUCKET = 'company-assets'
const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']

type AssetType = 'logo' | 'signature'

/**
 * Uploads a company logo or signature image to Supabase Storage.
 * Returns the public URL stored in company_settings.
 */
export async function uploadCompanyAsset(
  formData: FormData,
  assetType: AssetType
): Promise<ActionResult<string>> {
  const { companyId } = await requireRole(['admin'])
  const supabase = await createClient()

  const file = formData.get('file') as File | null
  if (!file) return { success: false, error: 'No file provided' }
  if (file.size > MAX_SIZE_BYTES) return { success: false, error: 'File exceeds 2 MB limit' }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { success: false, error: 'Only JPEG, PNG, WebP, or SVG images are allowed' }
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${companyId}/${assetType}.${ext}`

  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) return { success: false, error: uploadError.message }

  // Get a long-lived signed URL (10 years)
  const { data: signedData, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10)

  if (signError || !signedData) return { success: false, error: signError?.message ?? 'Failed to create URL' }

  const urlColumn = assetType === 'logo' ? 'logo_url' : 'signature_url'

  // Save URL to company_settings
  const { error: dbError } = await supabase
    .from('company_settings')
    .upsert(
      { company_id: companyId, [urlColumn]: signedData.signedUrl, updated_at: new Date().toISOString() },
      { onConflict: 'company_id' }
    )

  if (dbError) return { success: false, error: dbError.message }

  revalidatePath('/', 'layout')

  return { success: true, data: signedData.signedUrl }
}
