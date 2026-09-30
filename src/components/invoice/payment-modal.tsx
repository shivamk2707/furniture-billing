'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { recordPayment } from '@/actions/payments'
import { FormField } from '@/components/ui/form-field'

const paymentFormSchema = z.object({
  payment_date: z.string().min(1, 'Payment date is required'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  payment_mode: z.enum(['cash', 'upi', 'bank_transfer', 'cheque', 'other']),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
})

type PaymentFormValues = z.infer<typeof paymentFormSchema>

interface Props {
  invoiceId: string
  balanceDue: number
  onClose: () => void
  onRecorded: () => void
}

const MODE_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  other: 'Other',
}

export function PaymentModal({ invoiceId, balanceDue, onClose, onRecorded }: Props) {
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      payment_date: new Date().toISOString().split('T')[0],
      amount: balanceDue,
      payment_mode: 'cash',
    },
  })

  const onSubmit = async (values: PaymentFormValues) => {
    setServerError(null)
    const result = await recordPayment({ ...values, invoice_id: invoiceId })
    if (result.success) {
      onRecorded()
    } else {
      setServerError(result.error ?? 'Failed to record payment')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="p-6 space-y-4">
          {serverError && (
            <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {serverError}
            </div>
          )}

          <div className="p-3 bg-blue-50 rounded text-sm text-blue-700">
            Balance Due: <strong>₹{balanceDue.toFixed(2)}</strong>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
              <input
                type="date"
                {...register('payment_date')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.payment_date && <p className="mt-1 text-xs text-red-600">{errors.payment_date.message}</p>}
            </div>

            <FormField
              label="Amount (₹) *"
              type="number"
              step="0.01"
              min="0.01"
              {...register('amount')}
              error={errors.amount?.message}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode *</label>
            <select
              {...register('payment_mode')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(MODE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <FormField
            label="Transaction / Reference Number"
            {...register('reference_number')}
            placeholder="UTR, cheque no., etc."
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              rows={2}
              {...register('notes')}
              placeholder="Optional notes"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Recording…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
