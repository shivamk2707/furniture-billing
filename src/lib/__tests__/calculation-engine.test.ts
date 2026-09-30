/**
 * Property-based tests for the Calculation Engine
 *
 * Feature: furniture-billing
 * Validates: Requirements 6.1–6.13
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import Decimal from 'decimal.js'
import {
  calculateInvoice,
  amountToWords,
  getFinancialYear,
  type LineItemInput,
} from '../calculation-engine'

// ----------------------------------------------------------------
// Arbitraries
// ----------------------------------------------------------------

// Generate amounts as integers (paise/units scaled) to avoid 32-bit float constraint
const positiveAmount = fc.integer({ min: 1, max: 10_000_000 }).map((n) => n / 100)
const nonNegativeAmount = fc.integer({ min: 0, max: 10_000_000 }).map((n) => n / 100)
const validTaxRate = fc.oneof(
  fc.constant(0),
  fc.constant(5),
  fc.constant(12),
  fc.constant(18),
  fc.constant(28)
)
const discountType = fc.oneof(fc.constant('amount' as const), fc.constant('percent' as const))

const lineItemArb: fc.Arbitrary<LineItemInput> = fc.record({
  quantity: positiveAmount,
  unitPrice: nonNegativeAmount,
  discountType,
  discountValue: nonNegativeAmount,
  taxRate: validTaxRate,
})

const lineItemsArb = fc.array(lineItemArb, { minLength: 1, maxLength: 20 })

// ----------------------------------------------------------------
// Property 1: Line item calculation pipeline
//
// Feature: furniture-billing, Property 1: line-item-calculation-pipeline
// Validates: Requirements 6.1, 6.2, 6.4, 6.5
// ----------------------------------------------------------------
describe('Property 1: Line item calculation pipeline', () => {
  it('all 5 derived values are mutually consistent for any valid line item', () => {
    fc.assert(
      fc.property(lineItemArb, fc.boolean(), (item, isInterState) => {
        const result = calculateInvoice([item], isInterState)
        const li = result.lineItems[0]

        const qty   = new Decimal(item.quantity)
        const price = new Decimal(item.unitPrice)

        // 1. grossAmount = quantity × unitPrice (rounded to 2dp)
        const expectedGross = qty.times(price).toDecimalPlaces(2).toNumber()
        expect(li.grossAmount).toBeCloseTo(expectedGross, 2)

        // 2. discountAmount derived from type and value (clamped to grossAmount)
        let expectedDiscount: number
        if (item.discountType === 'percent') {
          const raw = new Decimal(li.grossAmount)
            .times(item.discountValue)
            .dividedBy(100)
            .toDecimalPlaces(2)
            .toNumber()
          expectedDiscount = Math.min(raw, li.grossAmount)
        } else {
          expectedDiscount = Math.min(
            new Decimal(item.discountValue).toDecimalPlaces(2).toNumber(),
            li.grossAmount
          )
        }
        expect(li.discountAmount).toBeCloseTo(expectedDiscount, 2)

        // 3. taxableAmount = grossAmount − discountAmount
        const expectedTaxable = new Decimal(li.grossAmount)
          .minus(li.discountAmount)
          .toDecimalPlaces(2)
          .toNumber()
        expect(li.taxableAmount).toBeCloseTo(expectedTaxable, 2)
        expect(li.taxableAmount).toBeGreaterThanOrEqual(0)

        // 4. lineTotal = taxableAmount + taxAmount
        const expectedLineTotal = new Decimal(li.taxableAmount)
          .plus(li.taxAmount)
          .toDecimalPlaces(2)
          .toNumber()
        expect(li.lineTotal).toBeCloseTo(expectedLineTotal, 2)
      }),
      { numRuns: 100 }
    )
  })
})

// ----------------------------------------------------------------
// Property 2: Invoice aggregate totals
//
// Feature: furniture-billing, Property 2: invoice-aggregate-totals
// Validates: Requirements 6.6, 6.7, 6.8
// ----------------------------------------------------------------
describe('Property 2: Invoice aggregate totals consistency', () => {
  it('subtotal = sum(taxableAmounts), totalTax = sum(taxAmounts), grandTotal = subtotal + totalTax', () => {
    fc.assert(
      fc.property(lineItemsArb, fc.boolean(), (items, isInterState) => {
        const result = calculateInvoice(items, isInterState)

        // subtotal = Σ taxableAmount
        const expectedSubtotal = result.lineItems
          .reduce((s, li) => s.plus(li.taxableAmount), new Decimal(0))
          .toDecimalPlaces(2)
          .toNumber()
        expect(result.subtotal).toBeCloseTo(expectedSubtotal, 2)

        // totalTax = Σ taxAmount
        const expectedTotalTax = result.lineItems
          .reduce((s, li) => s.plus(li.taxAmount), new Decimal(0))
          .toDecimalPlaces(2)
          .toNumber()
        expect(result.totalTax).toBeCloseTo(expectedTotalTax, 2)

        // grandTotal = subtotal + totalTax + roundOff
        const expectedGrandTotal = new Decimal(result.subtotal)
          .plus(result.totalTax)
          .plus(result.roundOff)
          .toDecimalPlaces(2)
          .toNumber()
        expect(result.grandTotal).toBeCloseTo(expectedGrandTotal, 2)
      }),
      { numRuns: 100 }
    )
  })

  it('grandTotal = sum of all lineTotals (no roundOff)', () => {
    fc.assert(
      fc.property(lineItemsArb, fc.boolean(), (items, isInterState) => {
        const result = calculateInvoice(items, isInterState, false)

        const sumOfLineTotals = result.lineItems
          .reduce((s, li) => s.plus(li.lineTotal), new Decimal(0))
          .toDecimalPlaces(2)
          .toNumber()

        expect(result.grandTotal).toBeCloseTo(sumOfLineTotals, 2)
      }),
      { numRuns: 100 }
    )
  })
})

// ----------------------------------------------------------------
// Property 3: Tax mode determination (CGST/SGST vs IGST)
//
// Feature: furniture-billing, Property 3: tax-mode-determination
// Validates: Requirements 6.3, 8.5
// ----------------------------------------------------------------
describe('Property 3: Tax mode determination', () => {
  it('intra-state: cgstRate = sgstRate = taxRate/2, igstRate = 0', () => {
    fc.assert(
      fc.property(lineItemArb, (item) => {
        const result = calculateInvoice([item], false) // intra-state
        const li = result.lineItems[0]

        expect(li.igstRate).toBe(0)
        expect(li.igstAmount).toBe(0)
        expect(li.cgstRate).toBeCloseTo(item.taxRate / 2, 4)
        expect(li.sgstRate).toBeCloseTo(item.taxRate / 2, 4)
        // cgst + sgst + igst = taxAmount
        const reconstructed = new Decimal(li.cgstAmount)
          .plus(li.sgstAmount)
          .plus(li.igstAmount)
          .toDecimalPlaces(2)
          .toNumber()
        expect(li.taxAmount).toBeCloseTo(reconstructed, 2)
      }),
      { numRuns: 100 }
    )
  })

  it('inter-state: igstRate = taxRate, cgstRate = sgstRate = 0', () => {
    fc.assert(
      fc.property(lineItemArb, (item) => {
        const result = calculateInvoice([item], true) // inter-state
        const li = result.lineItems[0]

        expect(li.cgstRate).toBe(0)
        expect(li.sgstRate).toBe(0)
        expect(li.cgstAmount).toBe(0)
        expect(li.sgstAmount).toBe(0)
        expect(li.igstRate).toBeCloseTo(item.taxRate, 4)
        expect(li.taxAmount).toBeCloseTo(li.igstAmount, 2)
      }),
      { numRuns: 100 }
    )
  })
})

// ----------------------------------------------------------------
// Property 4: Amount in words format
//
// Feature: furniture-billing, Property 4: amount-in-words-format
// Validates: Requirements 6.10
// ----------------------------------------------------------------
describe('Property 4: Amount in words correctness', () => {
  it('output starts with "Rupees" (or "Zero"), ends with "Only", no double spaces', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 9_999_999 }), (n) => {
        const words = amountToWords(n)

        expect(words.trim()).toBe(words) // no leading/trailing whitespace

        const startsCorrectly =
          words.startsWith('Rupees') || words.startsWith('Zero Rupees')
        expect(startsCorrectly).toBe(true)

        expect(words.endsWith('Only')).toBe(true)
        expect(words).not.toMatch(/  /) // no double spaces
        expect(words.length).toBeGreaterThan(0)
      }),
      { numRuns: 100 }
    )
  })

  it('known exact conversions', () => {
    expect(amountToWords(0)).toBe('Zero Rupees Only')
    expect(amountToWords(1)).toBe('Rupees One Only')
    expect(amountToWords(100)).toBe('Rupees One Hundred Only')
    expect(amountToWords(1000)).toBe('Rupees One Thousand Only')
    expect(amountToWords(10564)).toBe('Rupees Ten Thousand Five Hundred Sixty Four Only')
    expect(amountToWords(100000)).toBe('Rupees One Lakh Only')
    expect(amountToWords(1000000)).toBe('Rupees Ten Lakh Only')
  })

  it('handles paise correctly', () => {
    expect(amountToWords(10.5)).toBe('Rupees Ten and Fifty Paise Only')
    expect(amountToWords(1.01)).toBe('Rupees One and One Paise Only')
  })
})

// ----------------------------------------------------------------
// Financial year helper examples
// ----------------------------------------------------------------
describe('getFinancialYear', () => {
  it('April onwards = new financial year', () => {
    expect(getFinancialYear(new Date('2025-04-01'))).toBe('25-26')
    expect(getFinancialYear(new Date('2025-12-31'))).toBe('25-26')
    expect(getFinancialYear(new Date('2025-03-31'))).toBe('24-25')
    expect(getFinancialYear(new Date('2026-03-31'))).toBe('25-26')
  })
})
