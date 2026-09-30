/**
 * PDF Invoice Template
 *
 * Uses @react-pdf/renderer primitives (Document, Page, View, Text, Image).
 * Mirrors the layout of invoice-template.tsx but uses PDF-specific APIs.
 * All measurements are in points (pt): A4 = 595.28 × 841.89 pt.
 */

import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type { InvoiceData, InvoiceLineItem } from '@/lib/invoice-types'
import { formatINR, formatNumber, formatDate } from '@/lib/invoice-types'
import { paginateInvoice } from '@/lib/invoice-pages'

// Register a standard font (built-in PDF font)
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'Helvetica' },
    { src: 'Helvetica-Bold', fontWeight: 'bold' },
  ],
})

// ----------------------------------------------------------------
// Styles
// ----------------------------------------------------------------
const BORDER_COLOR = '#9ca3af'
const HEADER_BG = '#f3f4f6'
const TEXT_COLOR = '#111827'

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: TEXT_COLOR,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  border: { border: `1pt solid ${BORDER_COLOR}` },
  row: {
    flexDirection: 'row',
    borderBottom: `1pt solid ${BORDER_COLOR}`,
  },
  headerStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: HEADER_BG,
    borderBottom: `1pt solid ${BORDER_COLOR}`,
    padding: '4pt 8pt',
  },
  smallText: { fontSize: 7, color: '#6b7280' },
  titleText: { fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  bold: { fontWeight: 'bold' },
  sectionHeader: {
    backgroundColor: HEADER_BG,
    fontWeight: 'bold',
    fontSize: 7,
    color: '#374151',
    padding: '3pt 5pt',
    borderBottom: `1pt solid ${BORDER_COLOR}`,
  },
  pad: { padding: '4pt 6pt' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: HEADER_BG,
    fontWeight: 'bold',
    fontSize: 7,
    borderBottom: `1pt solid ${BORDER_COLOR}`,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: '2pt 8pt',
    fontSize: 8,
  },
})

// Column widths in % (must sum to 100)
const COL = { sr: 4, desc: 27, hsn: 11, qty: 6, unit: 7, price: 12, disc: 9, tax: 8, amt: 16 }

function cell(pct: number, align: 'left' | 'right' | 'center' = 'left', extra?: object) {
  return {
    width: `${pct}%`,
    padding: '2pt 3pt',
    borderRight: `1pt solid ${BORDER_COLOR}`,
    textAlign: align,
    ...extra,
  }
}

// ----------------------------------------------------------------
// Main PDF Document
// ----------------------------------------------------------------

interface Props {
  data: InvoiceData
}

export function InvoicePdf({ data }: Props) {
  const pages = paginateInvoice(data)

  return (
    <Document>
      {pages.map((pageData, i) => (
        <Page key={i} size="A4" style={s.page}>
          <View style={s.border}>
            {/* Section 1: Header strip */}
            <View style={s.headerStrip}>
              <Text style={s.smallText}>Page {pageData.page_number} of {pageData.total_pages}</Text>
              <Text style={s.titleText}>
                TAX INVOICE{pageData.status === 'draft' ? ' (DRAFT)' : ''}
              </Text>
              <Text style={s.smallText}>{pageData.copy_label}</Text>
            </View>

            {/* Section 2: Seller header */}
            <View style={{ ...s.row, minHeight: 55 }}>
              <View style={{ width: '15%', borderRight: `1pt solid ${BORDER_COLOR}`, alignItems: 'center', justifyContent: 'center', padding: 4 }}>
                {pageData.seller_logo_url
                  ? <Image src={pageData.seller_logo_url} style={{ width: 50, height: 40, objectFit: 'contain' }} />
                  : <Text style={{ fontSize: 6, color: '#9ca3af' }}>LOGO</Text>}
              </View>
              <View style={{ flex: 1, alignItems: 'center', padding: '5pt 8pt' }}>
                <Text style={{ ...s.bold, fontSize: 13 }}>{pageData.seller_name ?? 'Company'}</Text>
                {pageData.seller_address && <Text style={{ fontSize: 7, marginTop: 2 }}>{pageData.seller_address}</Text>}
                <Text style={{ fontSize: 7, marginTop: 2 }}>
                  {pageData.seller_mobile ? `Mob: ${pageData.seller_mobile}` : ''}
                  {pageData.seller_mobile && pageData.seller_email ? ' | ' : ''}
                  {pageData.seller_email ? `Email: ${pageData.seller_email}` : ''}
                </Text>
                <Text style={{ fontSize: 7, marginTop: 2 }}>
                  {pageData.seller_gstin ? `GSTIN: ${pageData.seller_gstin}` : ''}
                  {pageData.seller_gstin && pageData.seller_pan ? ' | ' : ''}
                  {pageData.seller_pan ? `PAN: ${pageData.seller_pan}` : ''}
                </Text>
              </View>
            </View>

            {/* Section 3: Invoice + Transport details */}
            <View style={{ ...s.row, minHeight: 50 }}>
              <View style={{ width: '50%', borderRight: `1pt solid ${BORDER_COLOR}`, ...s.pad }}>
                <LV label="Invoice No." value={pageData.invoice_number ?? '—'} />
                <LV label="Invoice Date" value={formatDate(pageData.invoice_date)} />
                <LV label="Due Date" value={formatDate(pageData.due_date)} />
                <LV label="Place of Supply" value={pageData.place_of_supply ?? '—'} />
                <LV label="Reverse Charge" value={pageData.reverse_charge ? 'Yes' : 'No'} />
              </View>
              <View style={{ width: '50%', ...s.pad }}>
                {pageData.transporter_name && <LV label="Transporter" value={pageData.transporter_name} />}
                {pageData.vehicle_number && <LV label="Vehicle No." value={pageData.vehicle_number} />}
                {pageData.eway_bill_number && <LV label="E-Way Bill No." value={pageData.eway_bill_number} />}
                {pageData.eway_bill_date && <LV label="E-Way Bill Date" value={formatDate(pageData.eway_bill_date)} />}
                {!pageData.transporter_name && <Text style={{ fontSize: 7, color: '#9ca3af' }}>No transport details</Text>}
              </View>
            </View>

            {/* Section 4: Billing + Shipping */}
            <View style={s.row}>
              <View style={{ width: '50%', borderRight: `1pt solid ${BORDER_COLOR}` }}>
                <Text style={s.sectionHeader}>BILLING DETAILS</Text>
                <View style={{ ...s.pad, minHeight: 50 }}>
                  {pageData.customer_name && <Text style={{ ...s.bold, marginBottom: 2 }}>{pageData.customer_name}</Text>}
                  {pageData.customer_gstin && <Text>GSTIN: {pageData.customer_gstin}</Text>}
                  {pageData.customer_mobile && <Text>Mob: {pageData.customer_mobile}</Text>}
                  {pageData.customer_billing_addr && <Text style={{ marginTop: 2 }}>{pageData.customer_billing_addr}</Text>}
                </View>
              </View>
              <View style={{ width: '50%' }}>
                <Text style={s.sectionHeader}>SHIPPING DETAILS</Text>
                <View style={{ ...s.pad, minHeight: 50 }}>
                  {pageData.customer_name && <Text style={{ ...s.bold, marginBottom: 2 }}>{pageData.customer_name}</Text>}
                  <Text>{pageData.customer_shipping_addr ?? pageData.customer_billing_addr ?? ''}</Text>
                </View>
              </View>
            </View>

            {/* Section 5: IRN strip */}
            {(pageData.irn || pageData.ack_number) && (
              <View style={{ ...s.row, padding: '3pt 6pt', backgroundColor: HEADER_BG, fontSize: 7 }}>
                {pageData.irn && <Text>IRN: {pageData.irn}  </Text>}
                {pageData.ack_number && <Text>Ack No: {pageData.ack_number}  </Text>}
                {pageData.ack_date && <Text>Ack Date: {formatDate(pageData.ack_date)}</Text>}
              </View>
            )}

            {/* Section 6: Product table header */}
            <View style={s.tableHeader}>
              <Text style={cell(COL.sr, 'center')}>Sr.</Text>
              <Text style={cell(COL.desc)}>Item Description</Text>
              <Text style={cell(COL.hsn, 'center')}>HSN/SAC</Text>
              <Text style={cell(COL.qty, 'right')}>Qty</Text>
              <Text style={cell(COL.unit, 'center')}>Unit</Text>
              <Text style={cell(COL.price, 'right')}>List Price</Text>
              <Text style={cell(COL.disc, 'right')}>Disc.</Text>
              <Text style={cell(COL.tax, 'center')}>Tax %</Text>
              <Text style={{ ...cell(COL.amt, 'right'), borderRight: undefined }}>Amount (₹)</Text>
            </View>

            {/* Product rows */}
            <View style={{ minHeight: 80, borderBottom: `1pt solid ${BORDER_COLOR}` }}>
              {pageData.line_items.map((item, idx) => (
                <PdfProductRow
                  key={idx}
                  item={item}
                  index={idx + 1}
                  isInterState={pageData.is_inter_state}
                />
              ))}
            </View>

            {/* Section 7: Totals (last page only) */}
            {pageData.grand_total > 0 && (
              <View style={{ borderBottom: `1pt solid ${BORDER_COLOR}` }}>
                {pageData.total_discount > 0 && (
                  <View style={s.totalRow}>
                    <Text>Discount</Text>
                    <Text>- {formatINR(pageData.total_discount)}</Text>
                  </View>
                )}
                <View style={s.totalRow}>
                  <Text>Subtotal (Taxable Value)</Text>
                  <Text>{formatINR(pageData.subtotal)}</Text>
                </View>
                {pageData.is_inter_state ? (
                  <View style={s.totalRow}>
                    <Text>IGST</Text>
                    <Text>{formatINR(pageData.total_igst)}</Text>
                  </View>
                ) : (
                  <>
                    <View style={s.totalRow}>
                      <Text>CGST</Text>
                      <Text>{formatINR(pageData.total_cgst)}</Text>
                    </View>
                    <View style={s.totalRow}>
                      <Text>SGST</Text>
                      <Text>{formatINR(pageData.total_sgst)}</Text>
                    </View>
                  </>
                )}
                {pageData.round_off !== 0 && (
                  <View style={s.totalRow}>
                    <Text>Round Off</Text>
                    <Text>{pageData.round_off >= 0 ? '+' : ''}{formatNumber(pageData.round_off)}</Text>
                  </View>
                )}
                <View style={{ ...s.totalRow, ...s.bold, fontSize: 11, borderTop: `1pt solid ${BORDER_COLOR}`, paddingTop: 3, backgroundColor: '#f9fafb' }}>
                  <Text>Grand Total</Text>
                  <Text>{formatINR(pageData.grand_total)}</Text>
                </View>
              </View>
            )}

            {/* Section 8: Amount in words */}
            {pageData.amount_in_words && (
              <View style={{ borderBottom: `1pt solid ${BORDER_COLOR}`, padding: '4pt 8pt' }}>
                <Text><Text style={s.bold}>Amount in Words: </Text>{pageData.amount_in_words}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
                  <Text><Text style={s.bold}>Amount Paid: </Text>{formatINR(pageData.amount_paid)}</Text>
                  <Text><Text style={s.bold}>Balance Due: </Text>{formatINR(pageData.balance_due)}</Text>
                </View>
              </View>
            )}

            {/* Section 9: Footer panels (last page only) */}
            {pageData.terms_conditions !== null && (
              <View style={{ flexDirection: 'row', borderBottom: `1pt solid ${BORDER_COLOR}`, minHeight: 80 }}>
                {/* Terms */}
                <View style={{ width: '30%', borderRight: `1pt solid ${BORDER_COLOR}`, padding: '4pt 5pt' }}>
                  <Text style={{ ...s.bold, fontSize: 7, marginBottom: 3 }}>Terms & Conditions</Text>
                  <Text style={{ fontSize: 7, color: '#374151' }}>{pageData.terms_conditions ?? 'Payment due within 15 days.'}</Text>
                </View>
                {/* Bank details */}
                <View style={{ width: '30%', borderRight: `1pt solid ${BORDER_COLOR}`, padding: '4pt 5pt' }}>
                  <Text style={{ ...s.bold, fontSize: 7, marginBottom: 3 }}>Bank Details</Text>
                  {pageData.bank_account_holder && <Text>A/C Name: {pageData.bank_account_holder}</Text>}
                  {pageData.bank_account_number && <Text>A/C No: {pageData.bank_account_number}</Text>}
                  {pageData.bank_name && <Text>Bank: {pageData.bank_name}</Text>}
                  {pageData.bank_ifsc && <Text>IFSC: {pageData.bank_ifsc}</Text>}
                  {pageData.bank_qr_data && <Image src={pageData.bank_qr_data} style={{ width: 50, height: 50, marginTop: 3 }} />}
                </View>
                {/* E-invoice QR */}
                <View style={{ width: '20%', borderRight: `1pt solid ${BORDER_COLOR}`, padding: '4pt 5pt', alignItems: 'center' }}>
                  <Text style={{ ...s.bold, fontSize: 7, marginBottom: 3 }}>E-Invoice QR</Text>
                  {pageData.einvoice_qr_data
                    ? <Image src={pageData.einvoice_qr_data} style={{ width: 55, height: 55 }} />
                    : <View style={{ width: 55, height: 55, backgroundColor: '#f3f4f6', border: `1pt dashed ${BORDER_COLOR}` }} />}
                </View>
                {/* Signature */}
                <View style={{ width: '20%', padding: '4pt 5pt', justifyContent: 'space-between' }}>
                  <Text style={s.bold}>For {pageData.seller_name ?? 'Company'}</Text>
                  <View style={{ alignItems: 'center' }}>
                    {pageData.signature_url
                      ? <Image src={pageData.signature_url} style={{ width: 70, height: 35, objectFit: 'contain' }} />
                      : <View style={{ width: 70, height: 30, borderBottom: `1pt solid ${BORDER_COLOR}` }} />}
                    <Text style={{ fontSize: 7, marginTop: 2 }}>Authorised Signatory</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Section 10: Footer text */}
            {pageData.footer_text && (
              <View style={{ padding: '3pt', alignItems: 'center' }}>
                <Text style={{ fontSize: 7, color: '#6b7280' }}>{pageData.footer_text}</Text>
              </View>
            )}
          </View>
        </Page>
      ))}
    </Document>
  )
}

// ----------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------

function LV({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
      <Text style={{ ...s.bold, fontSize: 7 }}>{label}: </Text>
      <Text style={{ fontSize: 7 }}>{value}</Text>
    </View>
  )
}

function PdfProductRow({
  item,
  index,
  isInterState,
}: {
  item: InvoiceLineItem
  index: number
  isInterState: boolean
}) {
  const taxLabel = isInterState
    ? `${item.igst_rate}%`
    : `${item.cgst_rate}%+${item.sgst_rate}%`

  return (
    <View style={{ flexDirection: 'row', borderBottom: `0.5pt solid #e5e7eb`, fontSize: 8 }}>
      <Text style={cell(COL.sr, 'center')}>{index}</Text>
      <Text style={cell(COL.desc)}>{item.description}</Text>
      <Text style={cell(COL.hsn, 'center')}>{item.hsn_sac ?? '—'}</Text>
      <Text style={cell(COL.qty, 'right')}>{formatNumber(item.quantity, 2)}</Text>
      <Text style={cell(COL.unit, 'center')}>{item.unit ?? '—'}</Text>
      <Text style={cell(COL.price, 'right')}>{formatNumber(item.unit_price)}</Text>
      <Text style={cell(COL.disc, 'right')}>
        {item.discount_amount > 0
          ? item.discount_type === 'percent'
            ? `${item.discount_value}%`
            : formatNumber(item.discount_amount)
          : '—'}
      </Text>
      <Text style={cell(COL.tax, 'center')}>{taxLabel}</Text>
      <Text style={{ ...cell(COL.amt, 'right'), borderRight: undefined }}>
        {formatNumber(item.line_total)}
      </Text>
    </View>
  )
}
