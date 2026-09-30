/**
 * InvoiceTemplate — Single source of truth for invoice layout.
 *
 * Used for:
 *  1. Browser preview (wrapped in InvoicePreview with CSS scale)
 *  2. PDF generation via @react-pdf/renderer (separate PDF-specific version)
 *
 * All 10 sections from the reference image are reproduced in order.
 * Uses inline styles only (no Tailwind) for PDF compatibility.
 * Column widths match the design document specification.
 */

import type { InvoiceData, InvoiceLineItem } from '@/lib/invoice-types'
import { formatINR, formatNumber, formatDate } from '@/lib/invoice-types'

// ----------------------------------------------------------------
// Style constants (A4 = 794px wide at 96dpi)
// ----------------------------------------------------------------
const BORDER = '1px solid #9ca3af'
const FONT = 'Arial, Helvetica, sans-serif'
const BG_HEADER = '#f3f4f6'

const styles = {
  page: {
    width: '794px',
    minHeight: '1123px',
    backgroundColor: '#ffffff',
    fontFamily: FONT,
    fontSize: '9px',
    color: '#111827',
    border: BORDER,
    boxSizing: 'border-box' as const,
  },
  row: {
    display: 'flex',
    flexDirection: 'row' as const,
    borderBottom: BORDER,
  },
  col: (widthPct: number, extra?: object) => ({
    width: `${widthPct}%`,
    padding: '4px 6px',
    boxSizing: 'border-box' as const,
    ...extra,
  }),
  label: {
    fontWeight: 'bold' as const,
    color: '#374151',
    fontSize: '8px',
  },
  value: {
    marginTop: '1px',
    color: '#111827',
  },
  sectionHeader: {
    backgroundColor: BG_HEADER,
    fontWeight: 'bold' as const,
    fontSize: '8px',
    color: '#374151',
    padding: '3px 6px',
    borderBottom: BORDER,
  },
  tableHeader: {
    display: 'flex',
    flexDirection: 'row' as const,
    backgroundColor: BG_HEADER,
    fontWeight: 'bold' as const,
    fontSize: '8px',
    borderBottom: BORDER,
  },
  tableCell: (widthPct: number, align: 'left' | 'right' | 'center' = 'left') => ({
    width: `${widthPct}%`,
    padding: '3px 4px',
    boxSizing: 'border-box' as const,
    textAlign: align,
    borderRight: BORDER,
  }),
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '2px 8px',
    fontSize: '9px',
  },
}

// Column widths (must sum to 100)
const COL = { sr: 4, desc: 27, hsn: 11, qty: 6, unit: 7, price: 12, disc: 9, tax: 8, amt: 16 }

interface Props {
  data: InvoiceData
}

export function InvoiceTemplate({ data }: Props) {
  const isDraft = data.status === 'draft'

  return (
    <div style={styles.page}>
      {/* ── Section 1: Top header strip ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderBottom: BORDER, backgroundColor: BG_HEADER }}>
        <span style={{ fontSize: '8px', color: '#6b7280' }}>
          Page {data.page_number} of {data.total_pages}
        </span>
        <span style={{ fontWeight: 'bold', fontSize: '12px', letterSpacing: '2px' }}>
          TAX INVOICE{isDraft && ' (DRAFT)'}
        </span>
        <span style={{ fontSize: '8px', color: '#6b7280' }}>{data.copy_label}</span>
      </div>

      {/* ── Section 2: Seller/Company header ── */}
      <div style={{ display: 'flex', borderBottom: BORDER, minHeight: '70px' }}>
        {/* Logo */}
        <div style={{ width: '15%', borderRight: BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
          {data.seller_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.seller_logo_url} alt="Logo" style={{ maxWidth: '80px', maxHeight: '55px', objectFit: 'contain' }} />
          ) : (
            <div style={{ width: '55px', height: '45px', backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', color: '#9ca3af' }}>LOGO</div>
          )}
        </div>
        {/* Company details */}
        <div style={{ flex: 1, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#111827' }}>{data.seller_name ?? 'Company Name'}</div>
          {data.seller_address && <div style={{ fontSize: '8px', marginTop: '2px', color: '#374151' }}>{data.seller_address}</div>}
          <div style={{ marginTop: '3px', fontSize: '8px', color: '#374151' }}>
            {data.seller_mobile && <span>Mob: {data.seller_mobile}</span>}
            {data.seller_mobile && data.seller_email && <span> | </span>}
            {data.seller_email && <span>Email: {data.seller_email}</span>}
          </div>
          <div style={{ marginTop: '2px', fontSize: '8px' }}>
            {data.seller_gstin && <span><b>GSTIN:</b> {data.seller_gstin}</span>}
            {data.seller_gstin && data.seller_pan && <span> | </span>}
            {data.seller_pan && <span><b>PAN:</b> {data.seller_pan}</span>}
          </div>
        </div>
      </div>

      {/* ── Section 3: Invoice details + Transport ── */}
      <div style={{ ...styles.row, minHeight: '70px' }}>
        {/* Left: Invoice info */}
        <div style={{ width: '50%', borderRight: BORDER, padding: '4px 6px' }}>
          <LabelValue label="Invoice No." value={data.invoice_number ?? '—'} />
          <LabelValue label="Invoice Date" value={formatDate(data.invoice_date)} />
          <LabelValue label="Due Date" value={formatDate(data.due_date)} />
          <LabelValue label="Place of Supply" value={data.place_of_supply ?? '—'} />
          <LabelValue label="Reverse Charge" value={data.reverse_charge ? 'Yes' : 'No'} />
        </div>
        {/* Right: Transport info */}
        <div style={{ width: '50%', padding: '4px 6px' }}>
          {data.transporter_name && <LabelValue label="Transporter" value={data.transporter_name} />}
          {data.vehicle_number && <LabelValue label="Vehicle No." value={data.vehicle_number} />}
          {data.transport_doc_number && <LabelValue label="Transport Doc No." value={data.transport_doc_number} />}
          {data.transport_doc_date && <LabelValue label="Transport Doc Date" value={formatDate(data.transport_doc_date)} />}
          {data.eway_bill_number && <LabelValue label="E-Way Bill No." value={data.eway_bill_number} />}
          {data.eway_bill_date && <LabelValue label="E-Way Bill Date" value={formatDate(data.eway_bill_date)} />}
          {!data.transporter_name && !data.vehicle_number && !data.eway_bill_number && (
            <div style={{ fontSize: '8px', color: '#9ca3af', paddingTop: '8px' }}>No transport details</div>
          )}
        </div>
      </div>

      {/* ── Section 4: Billing + Shipping ── */}
      <div style={{ ...styles.row }}>
        <div style={{ width: '50%', borderRight: BORDER }}>
          <div style={styles.sectionHeader}>BILLING DETAILS</div>
          <div style={{ padding: '4px 6px', minHeight: '60px' }}>
            {data.customer_name && <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{data.customer_name}</div>}
            {data.customer_gstin && <div><b>GSTIN:</b> {data.customer_gstin}</div>}
            {data.customer_mobile && <div><b>Mob:</b> {data.customer_mobile}</div>}
            {data.customer_email && <div><b>Email:</b> {data.customer_email}</div>}
            {data.customer_billing_addr && <div style={{ marginTop: '2px' }}>{data.customer_billing_addr}</div>}
          </div>
        </div>
        <div style={{ width: '50%' }}>
          <div style={styles.sectionHeader}>SHIPPING DETAILS</div>
          <div style={{ padding: '4px 6px', minHeight: '60px' }}>
            {data.customer_name && <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{data.customer_name}</div>}
            {data.customer_gstin && <div><b>GSTIN:</b> {data.customer_gstin}</div>}
            {data.customer_shipping_addr
              ? <div style={{ marginTop: '2px' }}>{data.customer_shipping_addr}</div>
              : data.customer_billing_addr
                ? <div style={{ marginTop: '2px' }}>{data.customer_billing_addr}</div>
                : null}
          </div>
        </div>
      </div>

      {/* ── Section 5: IRN strip ── */}
      {(data.irn || data.ack_number) && (
        <div style={{ ...styles.row, padding: '3px 6px', fontSize: '8px', backgroundColor: BG_HEADER }}>
          {data.irn && <span><b>IRN:</b> {data.irn}</span>}
          {data.irn && data.ack_number && <span style={{ margin: '0 12px' }}>|</span>}
          {data.ack_number && <span><b>Ack No:</b> {data.ack_number}</span>}
          {data.ack_date && <span style={{ marginLeft: '12px' }}><b>Ack Date:</b> {formatDate(data.ack_date)}</span>}
        </div>
      )}

      {/* ── Section 6: Product table ── */}
      <div style={styles.tableHeader}>
        <div style={styles.tableCell(COL.sr, 'center')}>Sr.</div>
        <div style={styles.tableCell(COL.desc)}>Item Description</div>
        <div style={styles.tableCell(COL.hsn, 'center')}>HSN/SAC</div>
        <div style={styles.tableCell(COL.qty, 'right')}>Qty</div>
        <div style={styles.tableCell(COL.unit, 'center')}>Unit</div>
        <div style={styles.tableCell(COL.price, 'right')}>List Price</div>
        <div style={styles.tableCell(COL.disc, 'right')}>Disc.</div>
        <div style={styles.tableCell(COL.tax, 'center')}>Tax %</div>
        <div style={{ ...styles.tableCell(COL.amt, 'right'), borderRight: 'none' }}>Amount (₹)</div>
      </div>

      {/* Product rows */}
      <div style={{ minHeight: '120px', borderBottom: BORDER }}>
        {data.line_items.map((item, idx) => (
          <ProductRow key={idx} item={item} index={idx + 1} isInterState={data.is_inter_state} />
        ))}
      </div>

      {/* ── Section 7: Totals ── */}
      <TotalsSection data={data} />

      {/* ── Section 8: Amount in words + payment summary ── */}
      <div style={{ borderBottom: BORDER, padding: '5px 8px' }}>
        <div style={{ fontSize: '9px' }}>
          <b>Amount in Words:</b> {data.amount_in_words}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '9px' }}>
          <span><b>Amount Paid:</b> {formatINR(data.amount_paid)}</span>
          <span><b>Balance Due:</b> {formatINR(data.balance_due)}</span>
        </div>
      </div>

      {/* ── Section 9: Footer panels ── */}
      <FooterSection data={data} />

      {/* ── Section 10: Bottom footer line ── */}
      {data.footer_text && (
        <div style={{ textAlign: 'center', padding: '4px', fontSize: '8px', color: '#6b7280', borderTop: BORDER }}>
          {data.footer_text}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------

function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: '2px', fontSize: '8px' }}>
      <span style={styles.label}>{label}: </span>
      <span style={styles.value}>{value}</span>
    </div>
  )
}

function ProductRow({ item, index, isInterState }: { item: InvoiceLineItem; index: number; isInterState: boolean }) {
  const taxLabel = isInterState
    ? `${item.igst_rate}% IGST`
    : `${item.cgst_rate}%+${item.sgst_rate}%`

  return (
    <div style={{ display: 'flex', flexDirection: 'row', borderBottom: '1px solid #e5e7eb', fontSize: '9px' }}>
      <div style={styles.tableCell(COL.sr, 'center')}>{index}</div>
      <div style={styles.tableCell(COL.desc)}>{item.description}</div>
      <div style={styles.tableCell(COL.hsn, 'center')}>{item.hsn_sac ?? '—'}</div>
      <div style={styles.tableCell(COL.qty, 'right')}>{formatNumber(item.quantity, 2)}</div>
      <div style={styles.tableCell(COL.unit, 'center')}>{item.unit ?? '—'}</div>
      <div style={styles.tableCell(COL.price, 'right')}>{formatNumber(item.unit_price)}</div>
      <div style={styles.tableCell(COL.disc, 'right')}>
        {item.discount_amount > 0
          ? item.discount_type === 'percent'
            ? `${item.discount_value}%`
            : formatNumber(item.discount_amount)
          : '—'}
      </div>
      <div style={styles.tableCell(COL.tax, 'center')}>{taxLabel}</div>
      <div style={{ ...styles.tableCell(COL.amt, 'right'), borderRight: 'none' }}>
        {formatNumber(item.line_total)}
      </div>
    </div>
  )
}

function TotalsSection({ data }: { data: InvoiceData }) {
  return (
    <div style={{ borderBottom: BORDER }}>
      {/* Discount */}
      {data.total_discount > 0 && (
        <div style={{ ...styles.totalRow, color: '#374151' }}>
          <span>Discount</span>
          <span>- {formatINR(data.total_discount)}</span>
        </div>
      )}
      {/* Subtotal */}
      <div style={styles.totalRow}>
        <span>Subtotal (Taxable Value)</span>
        <span>{formatINR(data.subtotal)}</span>
      </div>
      {/* Tax rows */}
      {data.is_inter_state ? (
        <div style={styles.totalRow}>
          <span>IGST</span>
          <span>{formatINR(data.total_igst)}</span>
        </div>
      ) : (
        <>
          <div style={styles.totalRow}>
            <span>CGST</span>
            <span>{formatINR(data.total_cgst)}</span>
          </div>
          <div style={styles.totalRow}>
            <span>SGST</span>
            <span>{formatINR(data.total_sgst)}</span>
          </div>
        </>
      )}
      {/* Round off */}
      {data.round_off !== 0 && (
        <div style={styles.totalRow}>
          <span>Round Off</span>
          <span>{data.round_off >= 0 ? '+' : ''}{formatNumber(data.round_off)}</span>
        </div>
      )}
      {/* Grand total */}
      <div style={{ ...styles.totalRow, fontWeight: 'bold', fontSize: '11px', borderTop: BORDER, paddingTop: '4px', backgroundColor: '#f9fafb' }}>
        <span>Grand Total</span>
        <span>{formatINR(data.grand_total)}</span>
      </div>
    </div>
  )
}

function FooterSection({ data }: { data: InvoiceData }) {
  return (
    <div style={{ display: 'flex', borderBottom: BORDER, minHeight: '100px' }}>
      {/* Panel 1: Terms */}
      <div style={{ width: '30%', borderRight: BORDER, padding: '5px 6px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '8px', marginBottom: '4px' }}>Terms & Conditions</div>
        <div style={{ fontSize: '7.5px', color: '#374151', whiteSpace: 'pre-wrap' }}>
          {data.terms_conditions ?? 'Payment due within 15 days of invoice date.'}
        </div>
      </div>
      {/* Panel 2: Bank details */}
      <div style={{ width: '30%', borderRight: BORDER, padding: '5px 6px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '8px', marginBottom: '4px' }}>Bank Details</div>
        {data.bank_account_holder && <div style={{ fontSize: '8px' }}><b>A/C Name:</b> {data.bank_account_holder}</div>}
        {data.bank_account_number && <div style={{ fontSize: '8px' }}><b>A/C No:</b> {data.bank_account_number}</div>}
        {data.bank_name && <div style={{ fontSize: '8px' }}><b>Bank:</b> {data.bank_name}</div>}
        {data.bank_ifsc && <div style={{ fontSize: '8px' }}><b>IFSC:</b> {data.bank_ifsc}</div>}
        {data.bank_branch && <div style={{ fontSize: '8px' }}><b>Branch:</b> {data.bank_branch}</div>}
        {data.bank_qr_data && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.bank_qr_data} alt="Bank QR" style={{ width: '60px', height: '60px', marginTop: '4px' }} />
        )}
      </div>
      {/* Panel 3: E-invoice QR */}
      <div style={{ width: '20%', borderRight: BORDER, padding: '5px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontWeight: 'bold', fontSize: '8px', marginBottom: '4px' }}>E-Invoice QR</div>
        {data.einvoice_qr_data ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.einvoice_qr_data} alt="E-Invoice QR" style={{ width: '65px', height: '65px' }} />
        ) : (
          <div style={{ width: '65px', height: '65px', backgroundColor: '#f3f4f6', border: '1px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '7px', color: '#9ca3af', textAlign: 'center' }}>Available after e-invoice generation</span>
          </div>
        )}
      </div>
      {/* Panel 4: Authorised signatory */}
      <div style={{ width: '20%', padding: '5px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 'bold', fontSize: '8px', alignSelf: 'flex-start' }}>For {data.seller_name ?? 'Company'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {data.signature_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.signature_url} alt="Signature" style={{ maxWidth: '80px', maxHeight: '40px', objectFit: 'contain' }} />
          ) : (
            <div style={{ width: '80px', height: '35px', borderBottom: '1px solid #9ca3af' }} />
          )}
          <div style={{ fontSize: '8px', marginTop: '2px', color: '#374151' }}>Authorised Signatory</div>
        </div>
      </div>
    </div>
  )
}
