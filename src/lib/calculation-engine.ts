/**
 * Calculation Engine
 *
 * All monetary arithmetic uses decimal.js to avoid floating-point drift.
 * Internally works in full precision; rounds to 2 decimal places only at
 * the final display/storage step.
 */

import Decimal from 'decimal.js'

// Configure decimal.js for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

// ----------------------------------------------------------------
// Public interfaces
// ----------------------------------------------------------------

export interface LineItemInput {
  quantity: number          // must be > 0
  unitPrice: number         // must be >= 0
  discountType: 'amount' | 'percent'
  discountValue: number     // must be >= 0
  taxRate: number           // e.g. 18 for 18%
}

export interface LineItemResult {
  grossAmount: number       // quantity × unitPrice
  discountAmount: number    // computed from discountType + discountValue
  taxableAmount: number     // grossAmount − discountAmount
  cgstRate: number          // taxRate / 2 for intra-state, else 0
  sgstRate: number          // taxRate / 2 for intra-state, else 0
  igstRate: number          // taxRate for inter-state, else 0
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  taxAmount: number         // cgst + sgst + igst
  lineTotal: number         // taxableAmount + taxAmount
}

export interface InvoiceCalculationResult {
  lineItems: LineItemResult[]
  subtotal: number          // sum of taxableAmounts
  totalDiscount: number     // sum of discountAmounts
  totalCgst: number
  totalSgst: number
  totalIgst: number
  totalTax: number
  roundOff: number          // optional ±0.50 rounding adjustment
  grandTotal: number        // subtotal + totalTax + roundOff
  amountInWords: string
}

// ----------------------------------------------------------------
// Core calculation
// ----------------------------------------------------------------

/**
 * Calculates all line item values and invoice totals.
 *
 * @param items       Array of line item inputs
 * @param isInterState  true = IGST; false = CGST + SGST
 * @param applyRoundOff If true, rounds grandTotal to nearest rupee
 */
export function calculateInvoice(
  items: LineItemInput[],
  isInterState: boolean,
  applyRoundOff = false
): InvoiceCalculationResult {
  const lineItems: LineItemResult[] = items.map((item) =>
    calculateLineItem(item, isInterState)
  )

  const subtotal = lineItems
    .reduce((sum, li) => sum.plus(li.taxableAmount), new Decimal(0))
    .toDecimalPlaces(2)

  const totalDiscount = lineItems
    .reduce((sum, li) => sum.plus(li.discountAmount), new Decimal(0))
    .toDecimalPlaces(2)

  const totalCgst = lineItems
    .reduce((sum, li) => sum.plus(li.cgstAmount), new Decimal(0))
    .toDecimalPlaces(2)

  const totalSgst = lineItems
    .reduce((sum, li) => sum.plus(li.sgstAmount), new Decimal(0))
    .toDecimalPlaces(2)

  const totalIgst = lineItems
    .reduce((sum, li) => sum.plus(li.igstAmount), new Decimal(0))
    .toDecimalPlaces(2)

  const totalTax = totalCgst.plus(totalSgst).plus(totalIgst).toDecimalPlaces(2)

  const rawGrandTotal = subtotal.plus(totalTax)

  let roundOff = new Decimal(0)
  let grandTotal: Decimal

  if (applyRoundOff) {
    const rounded = rawGrandTotal.toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    roundOff = rounded.minus(rawGrandTotal).toDecimalPlaces(2)
    grandTotal = rounded
  } else {
    grandTotal = rawGrandTotal.toDecimalPlaces(2)
  }

  return {
    lineItems,
    subtotal: subtotal.toNumber(),
    totalDiscount: totalDiscount.toNumber(),
    totalCgst: totalCgst.toNumber(),
    totalSgst: totalSgst.toNumber(),
    totalIgst: totalIgst.toNumber(),
    totalTax: totalTax.toNumber(),
    roundOff: roundOff.toNumber(),
    grandTotal: grandTotal.toNumber(),
    amountInWords: amountToWords(grandTotal.toNumber()),
  }
}

// ----------------------------------------------------------------
// Single line item calculation
// ----------------------------------------------------------------

function calculateLineItem(
  item: LineItemInput,
  isInterState: boolean
): LineItemResult {
  const qty       = new Decimal(item.quantity)
  const price     = new Decimal(item.unitPrice)
  const taxRate   = new Decimal(item.taxRate)
  const discVal   = new Decimal(item.discountValue)

  const grossAmount = qty.times(price).toDecimalPlaces(2)

  // Discount
  let discountAmount: Decimal
  if (item.discountType === 'percent') {
    discountAmount = grossAmount.times(discVal).dividedBy(100).toDecimalPlaces(2)
  } else {
    discountAmount = discVal.toDecimalPlaces(2)
  }

  // Clamp discount to not exceed gross amount
  if (discountAmount.greaterThan(grossAmount)) {
    discountAmount = grossAmount
  }

  const taxableAmount = grossAmount.minus(discountAmount).toDecimalPlaces(2)

  // Tax split
  let cgstRate = new Decimal(0)
  let sgstRate = new Decimal(0)
  let igstRate = new Decimal(0)

  if (isInterState) {
    igstRate = taxRate
  } else {
    cgstRate = taxRate.dividedBy(2)
    sgstRate = taxRate.dividedBy(2)
  }

  const cgstAmount = taxableAmount.times(cgstRate).dividedBy(100).toDecimalPlaces(2)
  const sgstAmount = taxableAmount.times(sgstRate).dividedBy(100).toDecimalPlaces(2)
  const igstAmount = taxableAmount.times(igstRate).dividedBy(100).toDecimalPlaces(2)

  const taxAmount  = cgstAmount.plus(sgstAmount).plus(igstAmount).toDecimalPlaces(2)
  const lineTotal  = taxableAmount.plus(taxAmount).toDecimalPlaces(2)

  return {
    grossAmount:    grossAmount.toNumber(),
    discountAmount: discountAmount.toNumber(),
    taxableAmount:  taxableAmount.toNumber(),
    cgstRate:       cgstRate.toNumber(),
    sgstRate:       sgstRate.toNumber(),
    igstRate:       igstRate.toNumber(),
    cgstAmount:     cgstAmount.toNumber(),
    sgstAmount:     sgstAmount.toNumber(),
    igstAmount:     igstAmount.toNumber(),
    taxAmount:      taxAmount.toNumber(),
    lineTotal:      lineTotal.toNumber(),
  }
}

// ----------------------------------------------------------------
// Amount in words (Indian English)
// ----------------------------------------------------------------

const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]

const tens = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
  'Sixty', 'Seventy', 'Eighty', 'Ninety',
]

function numberToWords(n: number): string {
  if (n === 0) return ''

  if (n < 20) return ones[n]

  if (n < 100) {
    const t = Math.floor(n / 10)
    const o = n % 10
    return tens[t] + (o ? ' ' + ones[o] : '')
  }

  if (n < 1000) {
    const h = Math.floor(n / 100)
    const rest = n % 100
    return ones[h] + ' Hundred' + (rest ? ' ' + numberToWords(rest) : '')
  }

  // Indian number system: use lakhs and crores
  if (n < 100000) {
    const th = Math.floor(n / 1000)
    const rest = n % 1000
    return numberToWords(th) + ' Thousand' + (rest ? ' ' + numberToWords(rest) : '')
  }

  if (n < 10000000) {
    const lakh = Math.floor(n / 100000)
    const rest = n % 100000
    return numberToWords(lakh) + ' Lakh' + (rest ? ' ' + numberToWords(rest) : '')
  }

  const crore = Math.floor(n / 10000000)
  const rest = n % 10000000
  return numberToWords(crore) + ' Crore' + (rest ? ' ' + numberToWords(rest) : '')
}

/**
 * Converts a rupee amount (with paise) to Indian English words.
 * Example: 10564.00 → "Rupees Ten Thousand Five Hundred Sixty Four Only"
 */
export function amountToWords(amount: number): string {
  if (amount === 0) return 'Zero Rupees Only'

  const d = new Decimal(amount).toDecimalPlaces(2)
  const rupees = Math.floor(d.toNumber())
  const paiseDecimal = d.minus(rupees).times(100).toDecimalPlaces(0)
  const paise = paiseDecimal.toNumber()

  let result = 'Rupees ' + numberToWords(rupees)

  if (paise > 0) {
    result += ' and ' + numberToWords(paise) + ' Paise'
  }

  return result + ' Only'
}

// ----------------------------------------------------------------
// Financial year helper
// ----------------------------------------------------------------

/**
 * Returns the Indian financial year string for a given date.
 * e.g. 2025-04-22 → "25-26", 2025-01-15 → "24-25"
 */
export function getFinancialYear(date: Date): string {
  const month = date.getMonth() + 1 // 1-indexed
  const year  = date.getFullYear()

  const startYear = month >= 4 ? year : year - 1
  const endYear   = startYear + 1

  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`
}
