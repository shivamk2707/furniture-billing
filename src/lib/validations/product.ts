import { z } from 'zod'

export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  sku: z.string().min(1, 'SKU is required'),
  description: z.string().optional(),
  hsn_sac: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  selling_price: z.coerce
    .number({ invalid_type_error: 'Price must be a number' })
    .min(0, 'Price must be 0 or more'),
  tax_rate: z.coerce
    .number({ invalid_type_error: 'Tax rate must be a number' })
    .min(0)
    .max(100, 'Tax rate must be between 0 and 100'),
})

export type ProductFormValues = z.infer<typeof productSchema>
