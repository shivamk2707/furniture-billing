'use client'

import { useFieldArray, useFormContext } from 'react-hook-form'
import { useState, useCallback } from 'react'
import { getProducts, type Product } from '@/actions/products'
import type { DraftInvoiceFormValues } from '@/lib/validations/invoice'

const TAX_RATES = [0, 5, 12, 18, 28]

export function LineItemTable() {
  const { register, control, setValue, watch } = useFormContext<DraftInvoiceFormValues>()
  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' })

  const handleAddRow = () => {
    append({
      description: '',
      hsn_sac: '',
      quantity: 1,
      unit: 'Pcs',
      unit_price: 0,
      discount_type: 'amount',
      discount_value: 0,
      tax_rate: 18,
      sort_order: fields.length + 1,
    })
  }

  return (
    <div>
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-2 py-2 text-left w-6">#</th>
              <th className="px-2 py-2 text-left">Description</th>
              <th className="px-2 py-2 text-left w-24">HSN/SAC</th>
              <th className="px-2 py-2 text-right w-16">Qty</th>
              <th className="px-2 py-2 text-left w-16">Unit</th>
              <th className="px-2 py-2 text-right w-24">Price (₹)</th>
              <th className="px-2 py-2 text-right w-20">Discount</th>
              <th className="px-2 py-2 text-center w-20">Tax %</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-gray-400 text-sm">
                  No items added yet. Click "Add Item" to get started.
                </td>
              </tr>
            )}
            {fields.map((field, index) => (
              <LineItemRow
                key={field.id}
                index={index}
                onRemove={() => remove(index)}
                register={register}
                setValue={setValue}
                watch={watch}
              />
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={handleAddRow}
        className="mt-2 px-3 py-1.5 text-sm text-blue-600 border border-blue-300 rounded
          hover:bg-blue-50 transition-colors"
      >
        + Add Item
      </button>
    </div>
  )
}

interface RowProps {
  index: number
  onRemove: () => void
  register: ReturnType<typeof useFormContext<DraftInvoiceFormValues>>['register']
  setValue: ReturnType<typeof useFormContext<DraftInvoiceFormValues>>['setValue']
  watch: ReturnType<typeof useFormContext<DraftInvoiceFormValues>>['watch']
}

function LineItemRow({ index, onRemove, register, setValue, watch }: RowProps) {
  const [productResults, setProductResults] = useState<Product[]>([])
  const [searchOpen, setSearchOpen] = useState(false)

  const discountType = watch(`line_items.${index}.discount_type`)

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) { setProductResults([]); return }
    const products = await getProducts(q)
    setProductResults(products)
    setSearchOpen(true)
  }, [])

  const selectProduct = (product: Product) => {
    setValue(`line_items.${index}.description`, product.name)
    setValue(`line_items.${index}.hsn_sac`, product.hsn_sac ?? '')
    setValue(`line_items.${index}.unit`, product.unit)
    setValue(`line_items.${index}.unit_price`, product.selling_price)
    setValue(`line_items.${index}.tax_rate`, product.tax_rate)
    setValue(`line_items.${index}.product_id`, product.id)
    setSearchOpen(false)
    setProductResults([])
  }

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-2 py-1.5 text-gray-400 text-center">{index + 1}</td>

      {/* Description with product search */}
      <td className="px-2 py-1.5 relative">
        <input
          {...register(`line_items.${index}.description`)}
          placeholder="Description or search product…"
          onChange={(e) => {
            register(`line_items.${index}.description`).onChange(e)
            searchProducts(e.target.value)
          }}
          onFocus={() => productResults.length > 0 && setSearchOpen(true)}
          onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
          className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-400"
        />
        {searchOpen && productResults.length > 0 && (
          <div className="absolute z-30 left-0 right-0 bg-white border border-gray-200 rounded shadow-md max-h-40 overflow-y-auto">
            {productResults.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={() => selectProduct(p)}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-sm"
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-gray-400 ml-2">₹{p.selling_price} • {p.tax_rate}%</span>
              </button>
            ))}
          </div>
        )}
      </td>

      <td className="px-2 py-1.5">
        <input
          {...register(`line_items.${index}.hsn_sac`)}
          placeholder="HSN/SAC"
          className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-400"
        />
      </td>

      <td className="px-2 py-1.5">
        <input
          {...register(`line_items.${index}.quantity`)}
          type="number"
          step="0.01"
          min="0.01"
          className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:border-blue-400"
        />
      </td>

      <td className="px-2 py-1.5">
        <input
          {...register(`line_items.${index}.unit`)}
          placeholder="Pcs"
          className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-400"
        />
      </td>

      <td className="px-2 py-1.5">
        <input
          {...register(`line_items.${index}.unit_price`)}
          type="number"
          step="0.01"
          min="0"
          className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:border-blue-400"
        />
      </td>

      {/* Discount: type toggle + value */}
      <td className="px-2 py-1.5">
        <div className="flex gap-1">
          <select
            {...register(`line_items.${index}.discount_type`)}
            className="w-12 px-1 py-1 border border-gray-200 rounded text-xs focus:outline-none"
          >
            <option value="amount">₹</option>
            <option value="percent">%</option>
          </select>
          <input
            {...register(`line_items.${index}.discount_value`)}
            type="number"
            step="0.01"
            min="0"
            placeholder={discountType === 'percent' ? '0' : '0.00'}
            className="w-16 px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:border-blue-400"
          />
        </div>
      </td>

      <td className="px-2 py-1.5">
        <select
          {...register(`line_items.${index}.tax_rate`)}
          className="w-full px-1 py-1 border border-gray-200 rounded text-sm focus:outline-none"
        >
          {TAX_RATES.map((r) => (
            <option key={r} value={r}>{r}%</option>
          ))}
        </select>
      </td>

      <td className="px-2 py-1.5 text-center">
        <button
          type="button"
          onClick={onRemove}
          className="text-red-400 hover:text-red-600 text-lg leading-none"
          aria-label="Remove item"
        >
          ×
        </button>
      </td>
    </tr>
  )
}
