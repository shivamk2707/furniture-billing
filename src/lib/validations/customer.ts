import { z } from 'zod'

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

export const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  gstin: z
    .string()
    .optional()
    .refine((v) => !v || GSTIN_PATTERN.test(v), {
      message: 'Invalid GSTIN format (e.g. 09AAACP1234A1Z5)',
    }),
  pan: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  billing_address: z.string().optional(),
  shipping_address: z.string().optional(),
})

export type CustomerFormValues = z.infer<typeof customerSchema>
