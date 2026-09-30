'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { upsertCustomer, type Customer } from '@/actions/customers'
import { customerSchema, type CustomerFormValues } from '@/lib/validations/customer'
import { FormField } from '@/components/ui/form-field'

interface Props {
  customer: Customer | null
  onClose: () => void
  onSaved: (customer: Customer) => void
}

export function CustomerModal({ customer, onClose, onSaved }: Props) {
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: customer?.name ?? '',
      gstin: customer?.gstin ?? '',
      pan: customer?.pan ?? '',
      mobile: customer?.mobile ?? '',
      email: customer?.email ?? '',
      billing_address: customer?.billing_address ?? '',
      shipping_address: customer?.shipping_address ?? '',
    },
  })

  const onSubmit = async (values: CustomerFormValues) => {
    setServerError(null)
    const result = await upsertCustomer(values, customer?.id)
    if (result.success && result.data) {
      onSaved(result.data)
    } else {
      setServerError(result.error ?? 'Failed to save customer')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {customer ? 'Edit Customer' : 'Add Customer'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="p-6 space-y-4">
          {serverError && (
            <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {serverError}
            </div>
          )}

          <FormField
            label="Customer Name"
            {...register('name')}
            error={errors.name?.message}
            placeholder="Ramesh Kumar"
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="GSTIN"
              {...register('gstin')}
              error={errors.gstin?.message}
              placeholder="09AAACP1234A1Z5"
            />
            <FormField
              label="PAN"
              {...register('pan')}
              placeholder="AAACP1234A"
            />
            <FormField
              label="Mobile"
              {...register('mobile')}
              placeholder="+91 98765 43210"
            />
            <FormField
              label="Email"
              type="email"
              {...register('email')}
              error={errors.email?.message}
              placeholder="customer@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Billing Address</label>
            <textarea
              rows={2}
              {...register('billing_address')}
              placeholder="45, Gandhi Nagar, Lucknow, UP - 226002"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shipping Address{' '}
              <span className="text-gray-400 font-normal">(leave blank if same as billing)</span>
            </label>
            <textarea
              rows={2}
              {...register('shipping_address')}
              placeholder="Same as billing address"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md
                hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md
                hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Saving…' : customer ? 'Save Changes' : 'Add Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
