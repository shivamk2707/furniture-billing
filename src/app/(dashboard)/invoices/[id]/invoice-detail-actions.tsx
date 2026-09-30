'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { voidInvoice, deleteInvoice } from '@/actions/invoices'
import { PaymentModal } from '@/components/invoice/payment-modal'
import type { UserRole } from '@/lib/types'

interface Props {
  invoiceId: string
  status: string
  invoiceNumber: string | null
  role: UserRole
  balanceDue?: number
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
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Link href="/invoices" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Invoices
        </Link>
        <h1 className="text-xl font-bold text-gray-900">
          {invoiceNumber ?? 'Draft Invoice'}
        </h1>
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
          status === 'issued' ? 'bg-blue-100 text-blue-700' :
          status === 'void' ? 'bg-red-100 text-red-600' :
          'bg-gray-100 text-gray-600'
        }`}>
          {status}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Record Payment */}
        {status === 'issued' && balanceDue > 0 && role !== 'viewer' && (
          <button
            onClick={() => setShowPaymentModal(true)}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            + Record Payment
          </button>
        )}

        {/* PDF Download */}
        {status === 'issued' && (
          <a
            href={`/api/pdf/${invoiceId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            ↓ Download PDF
          </a>
        )}

        {/* Print */}
        {status === 'issued' && (
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            🖨 Print
          </button>
        )}

        {/* Void (admin only, issued invoices) */}
        {status === 'issued' && role === 'admin' && (
          <button
            onClick={() => setShowVoidForm(true)}
            className="px-3 py-1.5 text-sm text-yellow-600 border border-yellow-300 rounded-md hover:bg-yellow-50 transition-colors"
          >
            Void Invoice
          </button>
        )}

        {/* Delete (admin only) */}
        {role === 'admin' && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
          >
            Delete Invoice
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Void Invoice</h2>
            <p className="text-sm text-gray-600 mb-4">
              This will mark the invoice as void. It will be excluded from sales totals. This action cannot be undone.
            </p>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason for voiding *</label>
              <textarea
                rows={3}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Incorrect customer details, duplicate invoice…"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowVoidForm(false)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleVoid}
                disabled={voiding}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-60"
              >
                {voiding ? 'Voiding…' : 'Void Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Delete Invoice</h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this invoice permanently? This action cannot be undone.
            </p>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
