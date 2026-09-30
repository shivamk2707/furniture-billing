'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { deleteInvoice } from '@/actions/invoices'
import type { InvoiceSummary } from '@/actions/invoices'
import { formatDate } from '@/lib/invoice-types'

const col = createColumnHelper<InvoiceSummary>()

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  issued: 'bg-blue-100 text-blue-700',
  void: 'bg-red-100 text-red-600',
}

const PAYMENT_BADGE: Record<string, string> = {
  unpaid: 'bg-orange-100 text-orange-700',
  partially_paid: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
}

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n)
}

interface Props {
  invoices: InvoiceSummary[]
  total: number
  page: number
  pageSize: number
  searchQuery: string
  statusFilter: string
  paymentFilter: string
  role: string
}

export function InvoicesClient({
  invoices,
  total,
  page,
  pageSize,
  searchQuery,
  statusFilter,
  paymentFilter,
  role,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState(searchQuery)
  const [status, setStatus] = useState(statusFilter)
  const [payment, setPayment] = useState(paymentFilter)
  
  // Deletion state
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const totalPages = Math.ceil(total / pageSize)

  const columns = [
    col.accessor('invoice_number', {
      header: 'Invoice #',
      cell: (info) => (
        <Link href={`/invoices/${info.row.original.id}`} className="text-blue-600 hover:underline font-medium">
          {info.getValue() ?? '(Draft)'}
        </Link>
      ),
    }),
    col.accessor('invoice_date', {
      header: 'Date',
      cell: (info) => formatDate(info.getValue()),
    }),
    col.accessor('customer_name', {
      header: 'Customer',
      cell: (info) => info.getValue() ?? '—',
    }),
    col.accessor('customer_mobile', {
      header: 'Mobile',
      cell: (info) => info.getValue() ?? '—',
    }),
    col.accessor('grand_total', {
      header: 'Total',
      cell: (info) => formatINR(Number(info.getValue())),
    }),
    col.accessor('amount_paid', {
      header: 'Paid',
      cell: (info) => formatINR(Number(info.getValue())),
    }),
    col.accessor('balance_due', {
      header: 'Balance',
      cell: (info) => formatINR(Number(info.getValue())),
    }),
    col.accessor('payment_status', {
      header: 'Payment',
      cell: (info) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${PAYMENT_BADGE[info.getValue()] ?? ''}`}>
          {info.getValue().replace('_', ' ')}
        </span>
      ),
    }),
    col.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[info.getValue()] ?? ''}`}>
          {info.getValue()}
        </span>
      ),
    }),
    col.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex gap-3 justify-end items-center">
          <Link href={`/invoices/${row.original.id}`} className="text-xs text-blue-600 hover:underline">
            View
          </Link>
          {row.original.status === 'issued' && (
            <a
              href={`/api/pdf/${row.original.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-green-600 hover:underline"
            >
              PDF
            </a>
          )}
          {role === 'admin' && (
            <button
              onClick={() => setInvoiceToDelete(row.original.id)}
              className="text-xs text-red-600 hover:underline"
            >
              Delete
            </button>
          )}
        </div>
      ),
    }),
  ]

  const table = useReactTable({
    data: invoices,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const applyFilters = (overrides?: Partial<{ q: string; status: string; payment: string; page: number }>) => {
    startTransition(() => {
      const params = new URLSearchParams()
      const q = overrides?.q ?? search
      const s = overrides?.status ?? status
      const p = overrides?.payment ?? payment
      const pg = overrides?.page ?? 1
      if (q) params.set('q', q)
      if (s) params.set('status', s)
      if (p) params.set('payment', p)
      if (pg > 1) params.set('page', String(pg))
      router.push(`/invoices?${params.toString()}`)
    })
  }

  const handleDelete = async () => {
    if (!invoiceToDelete) return
    setDeleting(true)
    setDeleteError(null)
    const result = await deleteInvoice(invoiceToDelete)
    setDeleting(false)
    if (result.success) {
      setInvoiceToDelete(null)
      router.refresh()
    } else {
      setDeleteError(result.error ?? 'Failed to delete invoice')
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <Link
          href="/invoices/new"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          + New Invoice
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <form
          onSubmit={(e) => { e.preventDefault(); applyFilters() }}
          className="flex gap-2"
        >
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice #, customer, phone…"
            className="w-64 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" className="px-3 py-2 bg-gray-100 border border-gray-300 text-sm rounded-md hover:bg-gray-200">
            Search
          </button>
        </form>

        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); applyFilters({ status: e.target.value }) }}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="issued">Issued</option>
          <option value="void">Void</option>
        </select>

        <select
          value={payment}
          onChange={(e) => { setPayment(e.target.value); applyFilters({ payment: e.target.value }) }}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none"
        >
          <option value="">All Payments</option>
          <option value="unpaid">Unpaid</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {invoices.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-base">No invoices found.</p>
            <p className="text-sm mt-1">Create your first invoice to get started.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th key={header.id} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => applyFilters({ page: page - 1 })}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => applyFilters({ page: page + 1 })}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Delete Invoice</h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this invoice permanently? This action cannot be undone.
            </p>
            {deleteError && <p className="text-sm text-red-600 mb-3">{deleteError}</p>}
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => { setInvoiceToDelete(null); setDeleteError(null) }} 
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
