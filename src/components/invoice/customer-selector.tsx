'use client'

import { useState, useEffect, useRef } from 'react'
import { getCustomers, type Customer } from '@/actions/customers'
import { upsertCustomer } from '@/actions/customers'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { customerSchema, type CustomerFormValues } from '@/lib/validations/customer'

interface Props {
  onSelect: (customer: Customer) => void
  selectedName?: string | null
}

export function CustomerSelector({ onSelect, selectedName }: Props) {
  const [query, setQuery] = useState(selectedName ?? '')
  const [results, setResults] = useState<Customer[]>([])
  const [open, setOpen] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Search customers with debounce
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await getCustomers(query)
        setResults(data)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, open])

  const handleSelect = (customer: Customer) => {
    setQuery(customer.name)
    setOpen(false)
    onSelect(customer)
  }

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search customer by name, mobile, GSTIN…"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => setShowNewForm(true)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 whitespace-nowrap"
        >
          + New
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-sm text-gray-500">Searching…</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">No customers found. Click "+ New" to add one.</div>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
              >
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-gray-500">{[c.mobile, c.gstin].filter(Boolean).join(' • ')}</div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Inline new customer form */}
      {showNewForm && (
        <InlineCustomerForm
          onSaved={(customer) => {
            handleSelect(customer)
            setShowNewForm(false)
          }}
          onCancel={() => setShowNewForm(false)}
        />
      )}
    </div>
  )
}

function InlineCustomerForm({
  onSaved,
  onCancel,
}: {
  onSaved: (c: Customer) => void
  onCancel: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
  })

  const onSubmit = async (values: CustomerFormValues) => {
    setError(null)
    const result = await upsertCustomer(values)
    if (result.success && result.data) {
      onSaved(result.data)
    } else {
      setError(result.error ?? 'Failed to save customer')
    }
  }

  return (
    <div className="mt-2 p-4 border border-blue-200 rounded-md bg-blue-50">
      <p className="text-sm font-medium text-blue-800 mb-3">New Customer</p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
        <input {...register('name')} placeholder="Customer name *" className="w-full px-2 py-1.5 text-sm border rounded" />
        {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
        <div className="grid grid-cols-2 gap-2">
          <input {...register('mobile')} placeholder="Mobile" className="px-2 py-1.5 text-sm border rounded" />
          <input {...register('gstin')} placeholder="GSTIN" className="px-2 py-1.5 text-sm border rounded" />
        </div>
        {errors.gstin && <p className="text-xs text-red-600">{errors.gstin.message}</p>}
        <textarea {...register('billing_address')} placeholder="Billing address" rows={2} className="w-full px-2 py-1.5 text-sm border rounded" />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60">
            {isSubmitting ? 'Saving…' : 'Save & Select'}
          </button>
        </div>
      </form>
    </div>
  )
}
