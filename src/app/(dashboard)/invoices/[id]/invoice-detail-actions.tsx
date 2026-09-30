'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { voidInvoice, deleteInvoice } from '@/actions/invoices'
import { PaymentModal } from '@/components/invoice/payment-modal'
import type { UserRole } from '@/lib/types'
import { ArrowLeft, CreditCard, Download, Printer, XCircle, Trash2 } from 'lucide-react'

interface Props {
  invoiceId: string
  status: string
  invoiceNumber: string | null
  role: UserRole
  balanceDue?: number
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 border border-slate-200',
  issued: 'bg-blue-50 text-blue-700 border border-blue-200',
  void: 'bg-red-50 text-red-600 border border-red-200',
}

export function InvoiceDetailActions({ invoiceId, status, invoiceNumber, role, balanceDue = 0 }: Props) {
  const router = useRouter()
  const [voiding, setVoiding] = useState(false)
  const [showVoidForm, setShowVoidForm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleVoid = async () => {
    if (!voidReason.trim()) { setError('Please provide a reason'); return }
    setVoiding(true)
    setError(null)
    const result = await voidInvoice(invoiceId, voidReason)
    setVoiding(false)
    if (result.success) {
      router.refresh()
      setShowVoidForm(false)
    } else {
      setError(result.error ?? 'Failed to void invoice')
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    const result = await deleteInvoice(invoiceId)
    setDeleting(false)
    if (result.success) {
      router.push('/invoices')
    } else {
      setError(result.error ?? 'Failed to delete invoice')
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      <div className="flex flex-col gap-2">
        <Link href="/invoices" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Invoices
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {invoiceNumber ?? 'Draft Invoice'}
          </h1>
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${STATUS_BADGE[status] ?? ''}`}>
            {status}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Record Payment */}
        {status === 'issued' && balanceDue > 0 && role !== 'viewer' && (
          <button
            onClick={() => setShowPaymentModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm hover:shadow transition-all duration-200"
          >
            <CreditCard className="w-4 h-4" />
            Record Payment
          </button>
        )}

        {/* PDF Download */}
        {status === 'issued' && (
          <a
            href={`/api/pdf/${invoiceId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </a>
        )}

        {/* Print */}
        {status === 'issued' && (
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        )}

        {/* Void (admin only, issued invoices) */}
        {status === 'issued' && role === 'admin' && (
          <button
            onClick={() => setShowVoidForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors shadow-sm"
          >
            <XCircle className="w-4 h-4" />
            Void Invoice
          </button>
        )}

        {/* Delete (admin only) */}
        {role === 'admin' && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          invoiceId={invoiceId}
          balanceDue={balanceDue}
          onClose={() => setShowPaymentModal(false)}
          onRecorded={() => { setShowPaymentModal(false); router.refresh() }}
        />
      )}

      {/* Void confirmation dialog */}
      {showVoidForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border border-slate-100">
            <div className="flex items-center gap-3 mb-4 text-amber-600">
              <div className="p-2 bg-amber-50 rounded-full">
                <XCircle className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Void Invoice</h2>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              This will mark the invoice as void. It will be excluded from sales totals. This action cannot be undone.
            </p>
            {error && <p className="text-sm text-red-600 mb-4 bg-red-50 p-3 rounded-md">{error}</p>}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Reason for voiding *</label>
              <textarea
                rows={3}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Incorrect customer details, duplicate invoice…"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowVoidForm(false)} 
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                disabled={voiding}
              >
                Cancel
              </button>
              <button
                onClick={handleVoid}
                disabled={voiding}
                className="px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-60 transition-colors shadow-sm"
              >
                {voiding ? 'Voiding…' : 'Void Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border border-slate-100">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <div className="p-2 bg-red-50 rounded-full">
                <Trash2 className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Delete Invoice</h2>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete this invoice permanently? This action cannot be undone.
            </p>
            {error && <p className="text-sm text-red-600 mb-4 bg-red-50 p-3 rounded-md">{error}</p>}
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(false)} 
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
