'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { saveCompanySettings } from '@/actions/settings'
import {
  companySettingsSchema,
  type CompanySettingsFormValues,
} from '@/lib/validations/settings'
import { FormField, TextareaField } from '@/components/ui/form-field'
import type { CompanySettings } from '@/lib/types'
import { LogoUpload } from './logo-upload'

type Tab = 'business' | 'bank' | 'invoice'

const TABS: { id: Tab; label: string }[] = [
  { id: 'business', label: 'Business Info' },
  { id: 'bank', label: 'Bank Details' },
  { id: 'invoice', label: 'Invoice Config' },
]

interface Props {
  initialValues: CompanySettings | null
}

export function SettingsForm({ initialValues }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('business')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CompanySettingsFormValues>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      legal_name: initialValues?.legal_name ?? '',
      display_name: initialValues?.display_name ?? '',
      address: initialValues?.address ?? '',
      mobile: initialValues?.mobile ?? '',
      email: initialValues?.email ?? '',
      gstin: initialValues?.gstin ?? '',
      pan: initialValues?.pan ?? '',
      state_code: initialValues?.state_code ?? '',
      bank_account_holder: initialValues?.bank_account_holder ?? '',
      bank_account_number: initialValues?.bank_account_number ?? '',
      bank_name: initialValues?.bank_name ?? '',
      bank_ifsc: initialValues?.bank_ifsc ?? '',
      bank_branch: initialValues?.bank_branch ?? '',
      upi_id: initialValues?.upi_id ?? '',
      invoice_prefix: initialValues?.invoice_prefix ?? 'INV',
      due_date_offset_days: initialValues?.due_date_offset_days ?? 15,
      terms_conditions: initialValues?.terms_conditions ?? '',
      footer_text: initialValues?.footer_text ?? '',
    },
  })

  const onSubmit = async (values: CompanySettingsFormValues) => {
    setSaveStatus('idle')
    const result = await saveCompanySettings(values)
    if (result.success) {
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } else {
      setSaveStatus('error')
      setErrorMsg(result.error ?? 'Failed to save settings')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Tab bar */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1" aria-label="Settings tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Business Info */}
      {activeTab === 'business' && (
        <div className="space-y-4">
          <LogoUpload initialLogoUrl={initialValues?.logo_url ?? null} />
          <FormField
            label="Legal Name"
            {...register('legal_name')}
            error={errors.legal_name?.message}
            placeholder="Prakash Furniture Pvt. Ltd."
          />
          <FormField
            label="Display Name"
            {...register('display_name')}
            placeholder="Prakash Furniture"
          />
          <FormField
            label="GSTIN"
            {...register('gstin')}
            error={errors.gstin?.message}
            placeholder="09AAACP1234A1Z5"
            hint="15-character GST Identification Number"
          />
          <FormField label="PAN" {...register('pan')} placeholder="AAACP1234A" />
          <FormField
            label="GST State Code"
            {...register('state_code')}
            error={errors.state_code?.message}
            placeholder="09"
            hint="2-digit GST state code (e.g. 09 for Uttar Pradesh)"
          />
          <FormField label="Mobile" {...register('mobile')} placeholder="+91 98765 43210" />
          <FormField
            label="Email"
            type="email"
            {...register('email')}
            error={errors.email?.message}
            placeholder="billing@yourcompany.com"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              rows={3}
              {...register('address')}
              placeholder="123, Street, City, State - PIN"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      )}

      {/* Bank Details */}
      {activeTab === 'bank' && (
        <div className="space-y-4">
          <FormField
            label="Account Holder Name"
            {...register('bank_account_holder')}
            placeholder="Prakash Furniture Pvt. Ltd."
          />
          <FormField
            label="Account Number"
            {...register('bank_account_number')}
            placeholder="1234567890"
          />
          <FormField
            label="Bank Name"
            {...register('bank_name')}
            placeholder="State Bank of India"
          />
          <FormField
            label="IFSC Code"
            {...register('bank_ifsc')}
            placeholder="SBIN0001234"
          />
          <FormField
            label="Branch"
            {...register('bank_branch')}
            placeholder="Hazratganj Branch, Lucknow"
          />
          <FormField
            label="UPI ID"
            {...register('upi_id')}
            placeholder="yourname@upi"
            hint="Used to generate bank payment QR code on invoices"
          />
        </div>
      )}

      {/* Invoice Config */}
      {activeTab === 'invoice' && (
        <div className="space-y-4">
          <FormField
            label="Invoice Prefix"
            {...register('invoice_prefix')}
            error={errors.invoice_prefix?.message}
            placeholder="INV"
            hint="Short prefix for invoice numbers (e.g. PP produces PP/001/25-26)"
          />
          <FormField
            label="Default Due Date (days after invoice date)"
            type="number"
            {...register('due_date_offset_days')}
            error={errors.due_date_offset_days?.message}
            min={0}
            max={365}
          />
          <TextareaField
            label="Terms & Conditions"
            {...register('terms_conditions')}
            rows={5}
            placeholder="1. Payment due within 15 days&#10;2. Goods once sold will not be taken back"
          />
          <FormField
            label="Invoice Footer Text"
            {...register('footer_text')}
            placeholder="This is a computer generated invoice."
          />
        </div>
      )}

      {/* Status messages */}
      {saveStatus === 'success' && (
        <p className="mt-4 text-sm text-green-600">Settings saved successfully.</p>
      )}
      {saveStatus === 'error' && (
        <p className="mt-4 text-sm text-red-600">{errorMsg}</p>
      )}

      {/* Save button */}
      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-md
            hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
            focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </form>
  )
}
