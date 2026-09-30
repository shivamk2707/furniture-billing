import { z } from 'zod'

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

export const companySettingsSchema = z.object({
  // Business info
  legal_name: z.string().min(1, 'Legal name is required'),
  display_name: z.string().optional(),
  address: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  gstin: z
    .string()
    .optional()
    .refine((v) => !v || GSTIN_PATTERN.test(v), {
      message: 'Invalid GSTIN format (e.g. 09AAACP1234A1Z5)',
    }),
  pan: z.string().optional(),
  state_code: z.string().length(2, 'State code must be 2 digits').or(z.literal('')).optional(),

  // Bank details
  bank_account_holder: z.string().optional(),
  bank_account_number: z.string().optional(),
  bank_name: z.string().optional(),
  bank_ifsc: z.string().optional(),
  bank_branch: z.string().optional(),
  upi_id: z.string().optional(),

  // Invoice config
  invoice_prefix: z.string().min(1, 'Invoice prefix is required').max(10),
  due_date_offset_days: z.coerce.number().int().min(0).max(365),
  terms_conditions: z.string().optional(),
  footer_text: z.string().optional(),
})

export type CompanySettingsFormValues = z.infer<typeof companySettingsSchema>

// Standalone GSTIN validator (used in property tests)
export function isValidGstin(value: string): boolean {
  return GSTIN_PATTERN.test(value)
}
