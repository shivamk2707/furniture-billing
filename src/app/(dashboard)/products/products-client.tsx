'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { archiveProduct, type Product } from '@/actions/products'
import { ProductModal } from './product-modal'

const col = createColumnHelper<Product>()

interface Props {
  products: Product[]
  searchQuery: string
}

export function ProductsClient({ products, searchQuery }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState(searchQuery)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [showModal, setShowModal] = useState(false)

  const columns = [
    col.accessor('sku', {
      header: 'SKU',
      cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
    }),
    col.accessor('name', { header: 'Product Name' }),
    col.accessor('hsn_sac', {
      header: 'HSN/SAC',
      cell: (info) => info.getValue() ?? '—',
    }),
    col.accessor('unit', { header: 'Unit' }),
    col.accessor('selling_price', {
      header: 'Price (₹)',
      cell: (info) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
          info.getValue()
        ),
    }),
    col.accessor('tax_rate', {
      header: 'Tax %',
      cell: (info) => `${info.getValue()}%`,
    }),
    col.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => { setEditProduct(row.original); setShowModal(true) }}
            className="text-xs text-blue-600 hover:underline"
          >
            Edit
          </button>
          <button
            onClick={() => handleArchive(row.original.id)}
            className="text-xs text-red-500 hover:underline"
          >
            Archive
          </button>
        </div>
      ),
    }),
  ]

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(() => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      router.push(`/products?${params.toString()}`)
    })
  }

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this product? It will no longer appear in new invoices.')) return
    await archiveProduct(id)
    router.refresh()
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <button
          onClick={() => { setEditProduct(null); setShowModal(true) }}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md
            hover:bg-blue-700 transition-colors"
        >
          + Add Product
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or SKU…"
          className="flex-1 max-w-sm px-3 py-2 border border-gray-300 rounded-md text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-gray-100 border border-gray-300 text-sm rounded-md
            hover:bg-gray-200 transition-colors"
        >
          Search
        </button>
      </form>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {products.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-base">No products found.</p>
            <p className="text-sm mt-1">Add your first product to get started.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500
                        uppercase tracking-wide"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-100">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-gray-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <ProductModal
          product={editProduct}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); router.refresh() }}
        />
      )}
    </>
  )
}
