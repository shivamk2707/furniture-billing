'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/require-role'
import Decimal from 'decimal.js'
import type { ActionResult } from '@/lib/types'

const paymentSchema = z.object({
  invoice_id: z.string().uuid(),
  payment_date: z.string().min(1, 'Payment date is required'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  payment_mode: z.enum(['cash', 'upi', 'bank_transfer', 'cheque', 'other']),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
})

export type PaymentFormValues = z.infer<typeof paymentSchema>

export interface PaymentRecord {
  id: string
  invoice_id: string
  payment_date: string
  amount: number
  payment_mode: string
  reference_number: string | null
  notes: string | null
  recorded_by: string | null
  created_at: string
}

export async function getPayments(invoiceId: string): Promise<PaymentRecord[]> {
  const supabase = await createClient()
  await requireRole(['admin', 'billing_staff', 'viewer'])

  const { data, error } = await supabase
    .from('invoice_payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('payment_date', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as PaymentRecord[]
}

export async function recordPayment(formData: unknown): Promise<ActionResult<PaymentRecord>> {
  const { companyId, userId } = await requireRole(['admin', 'billing_staff'])

  const parsed = paymentSchema.safeParse(formData)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { success: false, error: firstError.message }
  }

  const supabase = await createClient()
  const { invoice_id, amount, payment_date, payment_mode, reference_number, notes } = parsed.data

  // Fetch the invoice to validate and check ownership
  const { data: invoice } = await supabase
    .from('invoices')
    .select('company_id, status, grand_total, amount_paid')
    .eq('id', invoice_id)
    .eq('company_id', companyId)
    .single()

  if (!invoice) return { success: false, error: 'Invoice not found' }
  if (invoice.status !== 'issued') return { success: false, error: 'Payments can only be recorded on issued invoices' }

  // Validate: payment must not cause overpayment
  const grandTotal = new Decimal(invoice.grand_total)
  const existingPaid = new Decimal(invoice.amount_paid)
  const newPayment = new Decimal(amount)
  const totalAfter = existingPaid.plus(newPayment)

  if (totalAfter.greaterThan(grandTotal)) {
    return {
      success: false,
      error: `Payment of ₹${amount.toFixed(2)} would exceed the balance due of ₹${grandTotal.minus(existingPaid).toFixed(2)}`,
    }
  }

  // Insert payment record
  const { data: payment, error: paymentError } = await supabase
    .from('invoice_payments')
    .insert({
      invoice_id,
      company_id: companyId,
      payment_date,
      amount,
      payment_mode,
      reference_number: reference_number ?? null,
      notes: notes ?? null,
      recorded_by: userId,
    })
    .select()
    .single()

  if (paymentError) return { success: false, error: paymentError.message }

  // Update invoice amount_paid, balance_due, and payment_status
  const newAmountPaid = totalAfter.toDecimalPlaces(2).toNumber()
  const newBalanceDue = grandTotal.minus(totalAfter).toDecimalPlaces(2).toNumber()
  const paymentStatus =
    totalAfter.equals(grandTotal) ? 'paid' :
    totalAfter.greaterThan(0) ? 'partially_paid' : 'unpaid'

  await supabase
    .from('invoices')
    .update({
      amount_paid: newAmountPaid,
      balance_due: newBalanceDue,
      payment_status: paymentStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoice_id)

  // Audit log
  await supabase.from('audit_logs').insert({
    company_id: companyId,
    user_id: userId,
    action: 'payment.recorded',
    entity_type: 'invoice',
    entity_id: invoice_id,
    metadata: { amount, payment_mode, payment_status: paymentStatus },
  })

  revalidatePath(`/invoices/${invoice_id}`)
  revalidatePath('/invoices')
  return { success: true, data: payment as PaymentRecord }
}
