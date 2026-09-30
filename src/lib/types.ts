// Shared types for the furniture billing system

export type UserRole = 'admin' | 'billing_staff' | 'viewer'

export interface CompanyMember {
  id: string
  company_id: string
  user_id: string
  role: UserRole
  created_at: string
}

export interface Company {
  id: string
  name: string
  created_at: string
}

export interface CompanySettings {
  id: string
  company_id: string
  legal_name: string | null
  display_name: string | null
  address: string | null
  mobile: string | null
  email: string | null
  gstin: string | null
  pan: string | null
  logo_url: string | null
  signature_url: string | null
  state_code: string | null
  bank_account_holder: string | null
  bank_account_number: string | null
  bank_name: string | null
  bank_ifsc: string | null
  bank_branch: string | null
  upi_id: string | null
  invoice_prefix: string
  due_date_offset_days: number
  terms_conditions: string | null
  footer_text: string | null
  updated_at: string
}

export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}
