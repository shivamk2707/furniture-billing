'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { upsertProduct, type Product } from '@/actions/products'
import { productSchema, type ProductFormValues } from '@/lib/validations/product'
import { FormField } from '@/components/ui/form-field'

const COMMON_UNITS = ['Pcs', 'Box', 'Set', 'Pair', 'Dozen', 'Kg', 'Meter', 'Sq.Ft', 'Litre']
const TAX_RATES = [0, 5, 12, 18, 28]

interface Props {
  product: Product | null  // null = create mode
  onClose: () => void
  onSaved: () => void
}

export function ProductModal({ product, onClose, onSaved }: Props) {
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? '',
      sku: product?.sku ?? '',
      description: product?.description ?? '',
      hsn_sac: product?.hsn_sac ?? '',
      unit: product?.unit ?? 'Pcs',
      selling_price: product?.selling_price ?? 0,
      tax_rate: product?.tax_rate ?? 18,
    },
  })

  const onSubmit = async (values: ProductFormValues) => {
    setServerError(null)
    const result = await upsertProduct(values, product?.id)
    if (result.success) {
      onSaved()
    } else {
      setServerError(result.error ?? 'Failed to save product')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {product ? 'Edit Product' : 'Add Product'}
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

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FormField
                label="Product Name"
                {...register('name')}
                error={errors.name?.message}
                placeholder="Wooden Study Table"
              />
            </div>
            <FormField
              label="SKU / Product Code"
              {...register('sku')}
              error={errors.sku?.message}
              placeholder="WST-001"
            />
            <FormField
              label="HSN / SAC Code"
              {...register('hsn_sac')}
              placeholder="94031090"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={2}
              {...register('description')}
              placeholder="Brief product description"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Unit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select
                {...register('unit')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            {/* Tax Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
              <select
                {...register('tax_rate')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TAX_RATES.map((r) => (
                  <option key={r} value={r}>{r}%</option>
                ))}
              </select>
              {errors.tax_rate && (
                <p className="mt-1 text-xs text-red-600">{errors.tax_rate.message}</p>
              )}
            </div>

            {/* Selling Price */}
            <div className="col-span-2">
              <FormField
                label="Selling Price (₹)"
                type="number"
                step="0.01"
                min="0"
                {...register('selling_price')}
                error={errors.selling_price?.message}
                placeholder="0.00"
              />
            </div>
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
              {isSubmitting ? 'Saving…' : product ? 'Save Changes' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
