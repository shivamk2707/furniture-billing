'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { draftInvoiceSchema, type DraftInvoiceFormValues, GST_STATE_CODES } from '@/lib/validations/invoice'
import { saveDraftInvoice, issueInvoice } from '@/actions/invoices'
import { calculateInvoice } from '@/lib/calculation-engine'
import { CustomerSelector } from './customer-selector'
import { LineItemTable } from './line-item-table'
import { InvoicePreview } from './invoice-preview'
import { buildInvoiceData, type DbInvoice, type DbInvoiceItem } from '@/lib/build-invoice-data'
import type { Customer } from '@/actions/customers'
import type { InvoiceData } from '@/lib/invoice-types'
import type { CompanySettings } from '@/lib/types'

interface Props {
  invoiceId?: string
  initialData?: Partial<DraftInvoiceFormValues>
  initialItems?: DbInvoiceItem[]
  companySettings: CompanySettings | null
}

export function InvoiceEditor({ invoiceId, initialData, initialItems, companySettings }: Props) {
  const router = useRouter()
  const [draftId, setDraftId] = useState<string | undefined>(invoiceId)
  const [previewData, setPreviewData] = useState<InvoiceData | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [issueError, setIssueError] = useState<string | null>(null)
  const [issuing, setIssuing] = useState(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const methods = useForm<DraftInvoiceFormValues>({
    resolver: zodResolver(draftInvoiceSchema),
    defaultValues: {
      invoice_date: initialData?.invoice_date ?? new Date().toISOString().split('T')[0],
      due_date: initialData?.due_date ?? null,
      place_of_supply: initialData?.place_of_supply ?? companySettings?.state_code ?? null,
      reverse_charge: initialData?.reverse_charge ?? false,
      customer_id: initialData?.customer_id ?? null,
      customer_name: initialData?.customer_name ?? null,
      customer_gstin: initialData?.customer_gstin ?? null,
      customer_mobile: initialData?.customer_mobile ?? null,
      customer_billing_addr: initialData?.customer_billing_addr ?? null,
      customer_shipping_addr: initialData?.customer_shipping_addr ?? null,
      line_items: initialData?.line_items ?? [],
    },
  })

  const { watch, setValue, handleSubmit, formState: { isSubmitting } } = methods
  const watchedValues = watch()

  // Update live preview whenever form values change
  useEffect(() => {
    const updatePreview = async () => {
      const items = watchedValues.line_items
      const companyStateCode = companySettings?.state_code ?? null
      const placeOfSupply = watchedValues.place_of_supply
      const isInterState = companyStateCode && placeOfSupply
        ? companyStateCode !== placeOfSupply.split(' ')[0]
        : false

      let calcResult = null
      if (items.length > 0) {
        try {
          calcResult = calculateInvoice(
            items
              .filter((li) => li.description && li.quantity > 0)
              .map((li) => ({
                quantity: Number(li.quantity) || 0,
                unitPrice: Number(li.unit_price) || 0,
                discountType: li.discount_type,
                discountValue: Number(li.discount_value) || 0,
                taxRate: Number(li.tax_rate) || 0,
              })),
            isInterState
          )
        } catch { /* ignore calc errors during typing */ }
      }

      // Build a partial DbInvoice for preview
      const previewInvoice: DbInvoice = {
        id: draftId ?? 'draft',
        invoice_number: null,
        status: 'draft',
        invoice_date: watchedValues.invoice_date ?? null,
        due_date: watchedValues.due_date ?? null,
        place_of_supply: watchedValues.place_of_supply ?? null,
        is_inter_state: isInterState,
        reverse_charge: watchedValues.reverse_charge ?? false,
        customer_name: watchedValues.customer_name ?? null,
        customer_gstin: watchedValues.customer_gstin ?? null,
        customer_pan: null,
        customer_mobile: watchedValues.customer_mobile ?? null,
        customer_email: null,
        customer_billing_addr: watchedValues.customer_billing_addr ?? null,
        customer_shipping_addr: watchedValues.customer_shipping_addr ?? null,
        seller_name: companySettings?.legal_name ?? companySettings?.display_name ?? null,
        seller_gstin: companySettings?.gstin ?? null,
        seller_address: companySettings?.address ?? null,
        seller_mobile: companySettings?.mobile ?? null,
        seller_email: companySettings?.email ?? null,
        seller_pan: companySettings?.pan ?? null,
        transporter_name: watchedValues.transporter_name ?? null,
        vehicle_number: watchedValues.vehicle_number ?? null,
        transport_doc_number: watchedValues.transport_doc_number ?? null,
        transport_doc_date: watchedValues.transport_doc_date ?? null,
        eway_bill_number: watchedValues.eway_bill_number ?? null,
        eway_bill_date: watchedValues.eway_bill_date ?? null,
        irn: watchedValues.irn ?? null,
        ack_number: watchedValues.ack_number ?? null,
        ack_date: watchedValues.ack_date ?? null,
        subtotal: calcResult?.subtotal ?? 0,
        total_discount: calcResult?.totalDiscount ?? 0,
        total_cgst: calcResult?.totalCgst ?? 0,
        total_sgst: calcResult?.totalSgst ?? 0,
        total_igst: calcResult?.totalIgst ?? 0,
        total_tax: calcResult?.totalTax ?? 0,
        round_off: 0,
        grand_total: calcResult?.grandTotal ?? 0,
        amount_in_words: calcResult?.amountInWords ?? '',
        amount_paid: 0,
        balance_due: calcResult?.grandTotal ?? 0,
      }

      const previewItems: DbInvoiceItem[] = items
        .filter((li) => li.description)
        .map((li, idx) => {
          const calc = calcResult?.lineItems[idx]
          return {
            sort_order: idx + 1,
            description: li.description,
            hsn_sac: li.hsn_sac ?? null,
            quantity: Number(li.quantity) || 0,
            unit: li.unit ?? 'Pcs',
            unit_price: Number(li.unit_price) || 0,
            discount_type: li.discount_type,
            discount_value: Number(li.discount_value) || 0,
            discount_amount: calc?.discountAmount ?? 0,
            tax_rate: Number(li.tax_rate) || 0,
            taxable_amount: calc?.taxableAmount ?? 0,
            cgst_rate: calc?.cgstRate ?? 0,
            cgst_amount: calc?.cgstAmount ?? 0,
            sgst_rate: calc?.sgstRate ?? 0,
            sgst_amount: calc?.sgstAmount ?? 0,
            igst_rate: calc?.igstRate ?? 0,
            igst_amount: calc?.igstAmount ?? 0,
            line_total: calc?.lineTotal ?? 0,
          }
        })

      const data = await buildInvoiceData(previewInvoice, previewItems, companySettings as never)
      setPreviewData(data)
    }

    updatePreview()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(watchedValues)])

  // Auto-save draft with debounce
  const triggerAutoSave = useCallback((values: DraftInvoiceFormValues) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      setSaveError(null)
      const valuesToSave = {
        ...values,
        line_items: values.line_items?.filter(li => li.description?.trim()) ?? []
      }
      const result = await saveDraftInvoice(valuesToSave, draftId)
      if (result.success && result.data) {
        setDraftId(result.data.id)
      } else if (!result.success) {
        setSaveError(result.error ?? 'Auto-save failed')
      }
      autoSaveTimer.current = null
    }, 1500)
  }, [draftId])

  // Watch for changes and trigger auto-save
  useEffect(() => {
    const subscription = methods.watch((values) => {
      triggerAutoSave(values as DraftInvoiceFormValues)
    })
    return () => subscription.unsubscribe()
  }, [methods, triggerAutoSave])

  const handleCustomerSelect = (customer: Customer) => {
    setValue('customer_id', customer.id)
    setValue('customer_name', customer.name)
    setValue('customer_gstin', customer.gstin ?? null)
    setValue('customer_mobile', customer.mobile ?? null)
    setValue('customer_billing_addr', customer.billing_address ?? null)
    setValue('customer_shipping_addr', customer.shipping_address ?? null)
  }

  const handleIssue = async () => {
    setIssuing(true)
    setIssueError(null)

    // Ensure all changes are saved before issuing
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = null
    }

    const values = methods.getValues()
    const valuesToSave = {
      ...values,
      line_items: values.line_items?.filter(li => li.description?.trim()) ?? []
    }

    setSaveError(null)
    const saveResult = await saveDraftInvoice(valuesToSave, draftId)
    let finalDraftId = draftId

    if (saveResult.success && saveResult.data) {
      setDraftId(saveResult.data.id)
      finalDraftId = saveResult.data.id
    } else if (!saveResult.success) {
      setIssuing(false)
      setIssueError(saveResult.error ?? 'Failed to save draft before issuing')
      return
    }

    if (!finalDraftId) {
      setIssuing(false)
      setIssueError('Please wait for the draft to save first')
      return
    }

    const result = await issueInvoice(finalDraftId)
    setIssuing(false)
    if (result.success) {
      router.push(`/invoices`)
    } else {
      setIssueError(result.error ?? 'Failed to issue invoice')
    }
  }

  const lineItems = watchedValues.line_items ?? []
  const hasItems = lineItems.some((li) => li.description?.trim())

  return (
    <FormProvider {...methods}>
      <div className="flex gap-4 h-full">
        {/* ── Left: Form ── */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-2">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">
              {draftId ? 'Edit Invoice' : 'New Invoice'}
            </h1>
            <div className="flex items-center gap-3">
              {saveError && <span className="text-xs text-red-500">{saveError}</span>}
              <span className="text-xs text-gray-400">{draftId ? 'Auto-saving…' : 'Unsaved'}</span>
            </div>
          </div>

          {/* Customer */}
          <CustomerSelector
            onSelect={handleCustomerSelect}
            selectedName={watchedValues.customer_name}
          />

          {/* Invoice Header Fields */}
          <InvoiceHeaderFields methods={methods} />

          {/* Line Items */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Items</h2>
            <LineItemTable />
          </div>

          {/* Issue button */}
          {issueError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {issueError}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleIssue}
              disabled={!hasItems || issuing}
              title={!hasItems ? 'Add at least one item to issue the invoice' : undefined}
              className="px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-md
                hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {issuing ? 'Issuing…' : 'Issue Invoice'}
            </button>
          </div>
        </div>

        {/* ── Right: A4 Preview ── */}
        <div className="w-[440px] flex-shrink-0 bg-gray-100 rounded-lg p-3 overflow-y-auto">
          <p className="text-xs text-gray-500 mb-2 text-center">Live Preview</p>
          {previewData ? (
            <InvoicePreview data={previewData} containerWidth={414} />
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
              Loading preview…
            </div>
          )}
        </div>
      </div>
    </FormProvider>
  )
}

function InvoiceHeaderFields({ methods }: { methods: ReturnType<typeof useForm<DraftInvoiceFormValues>> }) {
  const { register, watch } = methods
  const [showTransport, setShowTransport] = useState(false)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Invoice Date *</label>
          <input type="date" {...register('invoice_date')} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
          <input type="date" {...register('due_date')} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Place of Supply</label>
          <select {...register('place_of_supply')} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400">
            <option value="">— Select state —</option>
            {Object.entries(GST_STATE_CODES).map(([code, name]) => (
              <option key={code} value={code}>{code} - {name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="reverse_charge" {...register('reverse_charge')} className="rounded" />
        <label htmlFor="reverse_charge" className="text-sm text-gray-700">Reverse Charge Applicable</label>
      </div>

      <button
        type="button"
        onClick={() => setShowTransport((v) => !v)}
        className="text-xs text-blue-600 hover:underline"
      >
        {showTransport ? '▼ Hide transport & e-invoice details' : '▶ Add transport & e-invoice details'}
      </button>

      {showTransport && (
        <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded border border-gray-200">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Transporter Name</label>
            <input {...register('transporter_name')} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle Number</label>
            <input {...register('vehicle_number')} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">E-Way Bill Number</label>
            <input {...register('eway_bill_number')} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">E-Way Bill Date</label>
            <input type="date" {...register('eway_bill_date')} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">IRN</label>
            <input {...register('irn')} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Acknowledgment Number</label>
            <input {...register('ack_number')} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400" />
          </div>
        </div>
      )}
    </div>
  )
}
