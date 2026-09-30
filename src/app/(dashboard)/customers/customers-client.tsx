'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { archiveCustomer, type Customer } from '@/actions/customers'
import { CustomerModal } from './customer-modal'

const col = createColumnHelper<Customer>()

interface Props {
  customers: Customer[]
  searchQuery: string
}

export function CustomersClient({ customers, searchQuery }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState(searchQuery)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [showModal, setShowModal] = useState(false)

  const columns = [
    col.accessor('name', { header: 'Name' }),
    col.accessor('gstin', {
      header: 'GSTIN',
      cell: (info) => <span className="font-mono text-xs">{info.getValue() ?? '—'}</span>,
    }),
    col.accessor('mobile', {
      header: 'Mobile',
      cell: (info) => info.getValue() ?? '—',
    }),
    col.accessor('email', {
      header: 'Email',
      cell: (info) => info.getValue() ?? '—',
    }),
    col.accessor('billing_address', {
      header: 'City',
      cell: (info) => {
        const addr = info.getValue()
        if (!addr) return '—'
        // Show last meaningful part (city)
        const parts = addr.split(',')
        return parts[parts.length - 1]?.trim() ?? '—'
      },
    }),
    col.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => { setEditCustomer(row.original); setShowModal(true) }}
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
    data: customers,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(() => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      router.push(`/customers?${params.toString()}`)
    })
  }

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this customer?')) return
    await archiveCustomer(id)
    router.refresh()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <button
          onClick={() => { setEditCustomer(null); setShowModal(true) }}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md
            hover:bg-blue-700 transition-colors"
        >
          + Add Customer
        </button>
      </div>

      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, mobile, or GSTIN…"
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

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {customers.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-base">No customers found.</p>
            <p className="text-sm mt-1">Add your first customer to get started.</p>
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

      {showModal && (
        <CustomerModal
          customer={editCustomer}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); router.refresh() }}
        />
      )}
    </>
  )
}
