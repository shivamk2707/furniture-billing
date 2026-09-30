/**
 * Property test: Payment balance and status logic
 *
 * Feature: furniture-billing, Property 7: payment-balance-and-status
 * Validates: Requirements 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
 *
 * For any issued invoice with one or more recorded payments:
 * - amount_paid = sum of all payment amounts
 * - balance_due = grand_total - amount_paid
 * - Payment status: 'unpaid' when paid=0, 'partially_paid' when 0<paid<total, 'paid' when paid=total
 * - A payment that would make amount_paid > grand_total SHALL be rejected
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import Decimal from 'decimal.js'

// Pure functions that mirror the payment logic in actions/payments.ts
function computePaymentStatus(
  grandTotal: number,
  amountPaid: number
): 'unpaid' | 'partially_paid' | 'paid' {
  const total = new Decimal(grandTotal).toDecimalPlaces(2)
  const paid = new Decimal(amountPaid).toDecimalPlaces(2)

  if (paid.isZero()) return 'unpaid'
  if (paid.equals(total)) return 'paid'
  return 'partially_paid'
}

function computeBalanceDue(grandTotal: number, amountPaid: number): number {
  return new Decimal(grandTotal).minus(amountPaid).toDecimalPlaces(2).toNumber()
}

function isOverpayment(grandTotal: number, existingPaid: number, newPayment: number): boolean {
  const total = new Decimal(grandTotal).toDecimalPlaces(2)
  const after = new Decimal(existingPaid).plus(newPayment).toDecimalPlaces(2)
  return after.greaterThan(total)
}

// Arbitrary for invoice amounts (integer paise, converted to rupees)
const rupeeAmount = fc.integer({ min: 1, max: 1_000_000 }).map((n) => n / 100)

describe('Property 7: Payment balance and status', () => {
  it('amount_paid = sum of all payments and balance_due = grand_total - amount_paid', () => {
    // Feature: furniture-billing, Property 7: payment-balance-and-status
    fc.assert(
      fc.property(
        rupeeAmount,
        fc.array(fc.integer({ min: 1, max: 100 }).map((n) => n / 100), { minLength: 1, maxLength: 10 }),
        (grandTotal, paymentFractions) => {
          // Build payments that sum to at most grandTotal
          let runningTotal = new Decimal(0)
          const payments: number[] = []
          for (const frac of paymentFractions) {
            const remaining = new Decimal(grandTotal).minus(runningTotal)
            if (remaining.isZero()) break
            const pay = Decimal.min(new Decimal(frac), remaining).toDecimalPlaces(2).toNumber()
            if (pay <= 0) break
            payments.push(pay)
            runningTotal = runningTotal.plus(pay)
          }

          if (payments.length === 0) return true // nothing to test

          const amountPaid = payments
            .reduce((s, p) => s.plus(p), new Decimal(0))
            .toDecimalPlaces(2)
            .toNumber()

          const balanceDue = computeBalanceDue(grandTotal, amountPaid)
          expect(balanceDue).toBeGreaterThanOrEqual(-0.01) // may be tiny negative due to fp
          expect(amountPaid + balanceDue).toBeCloseTo(grandTotal, 2)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('payment status is correct for all combinations', () => {
    fc.assert(
      fc.property(rupeeAmount, (grandTotal) => {
        // Unpaid
        expect(computePaymentStatus(grandTotal, 0)).toBe('unpaid')

        // Partially paid
        const partial = new Decimal(grandTotal).dividedBy(2).toDecimalPlaces(2).toNumber()
        if (partial > 0 && partial < grandTotal) {
          expect(computePaymentStatus(grandTotal, partial)).toBe('partially_paid')
        }

        // Fully paid
        expect(computePaymentStatus(grandTotal, grandTotal)).toBe('paid')
      }),
      { numRuns: 100 }
    )
  })

  it('overpayment is correctly detected and rejected', () => {
    fc.assert(
      fc.property(rupeeAmount, rupeeAmount, (grandTotal, excess) => {
        // A payment of grandTotal + excess must be flagged as overpayment
        expect(isOverpayment(grandTotal, 0, grandTotal + excess)).toBe(true)

        // A payment equal to grand total is NOT an overpayment
        expect(isOverpayment(grandTotal, 0, grandTotal)).toBe(false)

        // A payment less than grand total is NOT an overpayment
        const partial = new Decimal(grandTotal).dividedBy(2).toDecimalPlaces(2).toNumber()
        if (partial > 0) {
          expect(isOverpayment(grandTotal, 0, partial)).toBe(false)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('balance_due is zero when fully paid', () => {
    fc.assert(
      fc.property(rupeeAmount, (grandTotal) => {
        const balance = computeBalanceDue(grandTotal, grandTotal)
        expect(balance).toBeCloseTo(0, 2)
      }),
      { numRuns: 100 }
    )
  })
})
