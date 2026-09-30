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
import { Search, Plus, Eye, Download, Trash2, Filter, ReceiptText } from 'lucide-react'

const col = createColumnHelper<InvoiceSummary>()

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 border border-slate-200',
  issued: 'bg-blue-50 text-blue-700 border border-blue-200',
  void: 'bg-red-50 text-red-600 border border-red-200',
}

const PAYMENT_BADGE: Record<string, string> = {
  unpaid: 'bg-orange-50 text-orange-700 border border-orange-200',
  partially_paid: 'bg-amber-50 text-amber-700 border border-amber-200',
  paid: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
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
        <Link href={`/invoices/${info.row.original.id}`} className="text-blue-600 hover:text-blue-700 hover:underline font-semibold">
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
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${PAYMENT_BADGE[info.getValue()] ?? ''}`}>
          {info.getValue().replace('_', ' ')}
        </span>
      ),
    }),
    col.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${STATUS_BADGE[info.getValue()] ?? ''}`}>
          {info.getValue()}
        </span>
      ),
    }),
    col.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end items-center">
          <Link 
            href={`/invoices/${row.original.id}`} 
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            title="View Invoice"
          >
            <Eye className="w-4 h-4" />
          </Link>
          {row.original.status === 'issued' && (
            <a
              href={`/api/pdf/${row.original.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
              title="Download PDF"
            >
              <Download className="w-4 h-4" />
            </a>
          )}
          {role === 'admin' && (
            <button
              onClick={() => setInvoiceToDelete(row.original.id)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Delete Invoice"
            >
              <Trash2 className="w-4 h-4" />
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
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and track your customer invoices.</p>
        </div>
        <Link
          href="/invoices/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-sm hover:shadow transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          Create Invoice
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <form
          onSubmit={(e) => { e.preventDefault(); applyFilters() }}
          className="flex flex-1 gap-2 min-w-[280px]"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice #, customer..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-sm">
            Search
          </button>
        </form>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); applyFilters({ status: e.target.value }) }}
              className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="void">Void</option>
            </select>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={payment}
              onChange={(e) => { setPayment(e.target.value); applyFilters({ payment: e.target.value }) }}
              className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            >
              <option value="">All Payments</option>
              <option value="unpaid">Unpaid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {invoices.length === 0 ? (
          <div className="p-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4">
              <ReceiptText className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-base font-medium text-slate-900">No invoices found</p>
            <p className="text-sm text-slate-500 mt-1">Get started by creating a new invoice.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => (
                      <th key={header.id} className="px-5 py-4 font-semibold text-slate-600 text-xs tracking-wider uppercase">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors group">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-5 py-4 text-slate-700 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500 pt-2">
          <span>
            Showing <span className="font-medium text-slate-900">{(page - 1) * pageSize + 1}</span> to <span className="font-medium text-slate-900">{Math.min(page * pageSize, total)}</span> of <span className="font-medium text-slate-900">{total}</span> results
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => applyFilters({ page: page - 1 })}
              className="px-4 py-2 bg-white border border-slate-200 font-medium rounded-lg disabled:opacity-50 hover:bg-slate-50 shadow-sm transition-colors"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => applyFilters({ page: page + 1 })}
              className="px-4 py-2 bg-white border border-slate-200 font-medium rounded-lg disabled:opacity-50 hover:bg-slate-50 shadow-sm transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border border-slate-100">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <div className="p-2 bg-red-50 rounded-full">
                <Trash2 className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Delete Invoice</h2>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete this invoice permanently? This action cannot be undone and will remove it from all records.
            </p>
            {deleteError && <p className="text-sm text-red-600 mb-4 bg-red-50 p-3 rounded-md">{deleteError}</p>}
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => { setInvoiceToDelete(null); setDeleteError(null) }} 
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors shadow-sm"
              >
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
