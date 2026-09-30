/**
 * Multi-page invoice pagination.
 *
 * Splits InvoiceData into multiple page-specific InvoiceData objects.
 * Each page has:
 *  - Its own subset of line_items
 *  - Correct page_number / total_pages
 *  - Totals only on the last page (other pages show items only)
 */

import type { InvoiceData, InvoiceLineItem } from './invoice-types'

/** Maximum line items that fit on page 1 (includes header sections) */
const ITEMS_PER_FIRST_PAGE = 8

/** Maximum line items that fit on subsequent pages (no header) */
const ITEMS_PER_CONTINUATION_PAGE = 15

/**
 * Splits an invoice into page-sized chunks.
 * Returns an array of InvoiceData, one per page.
 */
export function paginateInvoice(data: InvoiceData): InvoiceData[] {
  const allItems = data.line_items

  if (allItems.length === 0) {
    return [{ ...data, page_number: 1, total_pages: 1 }]
  }

  // Split items into pages
  const pages: InvoiceLineItem[][] = []
  let remaining = [...allItems]

  // First page
  pages.push(remaining.splice(0, ITEMS_PER_FIRST_PAGE))

  // Continuation pages
  while (remaining.length > 0) {
    pages.push(remaining.splice(0, ITEMS_PER_CONTINUATION_PAGE))
  }

  const totalPages = pages.length

  return pages.map((pageItems, idx) => {
    const isLastPage = idx === totalPages - 1
    return {
      ...data,
      line_items: pageItems,
      page_number: idx + 1,
      total_pages: totalPages,
      copy_label: data.copy_label,
      // Only show totals and footer on the last page
      subtotal: isLastPage ? data.subtotal : 0,
      total_discount: isLastPage ? data.total_discount : 0,
      total_cgst: isLastPage ? data.total_cgst : 0,
      total_sgst: isLastPage ? data.total_sgst : 0,
      total_igst: isLastPage ? data.total_igst : 0,
      total_tax: isLastPage ? data.total_tax : 0,
      round_off: isLastPage ? data.round_off : 0,
      grand_total: isLastPage ? data.grand_total : 0,
      amount_in_words: isLastPage ? data.amount_in_words : '',
      amount_paid: isLastPage ? data.amount_paid : 0,
      balance_due: isLastPage ? data.balance_due : 0,
      terms_conditions: isLastPage ? data.terms_conditions : null,
      footer_text: isLastPage ? data.footer_text : null,
      bank_qr_data: isLastPage ? data.bank_qr_data : null,
      einvoice_qr_data: isLastPage ? data.einvoice_qr_data : null,
      signature_url: isLastPage ? data.signature_url : null,
    }
  })
}

/** Multi-page browser preview component helper */
export function getPageCount(itemCount: number): number {
  if (itemCount === 0) return 1
  if (itemCount <= ITEMS_PER_FIRST_PAGE) return 1
  const overflow = itemCount - ITEMS_PER_FIRST_PAGE
  return 1 + Math.ceil(overflow / ITEMS_PER_CONTINUATION_PAGE)
}
