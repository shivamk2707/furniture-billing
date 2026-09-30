# Design Document: Furniture Billing & Business Reporting Software

## Overview

A production-grade, multi-tenant furniture billing system built on **Next.js 16 (App Router)**, **Supabase (PostgreSQL + Auth + RLS)**, and **@react-pdf/renderer** for A4 PDF generation. The system supports GST-compliant invoice creation with automatic tax calculations, an exact reproduction of the supplied A4 invoice template, searchable invoice history, payment tracking, and business reports — all enforced with server-side authorization.

The key design principle is **data immutability at issue time**: when an invoice is issued, snapshots of the seller, buyer, and all line items are saved atomically so that subsequent edits to products or customers never alter historical invoices.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (React)                       │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │ Invoice      │  │ Invoice     │  │ Data Tables    │  │
│  │ Editor Form  │  │ Live Preview│  │ (History/      │  │
│  │ (React Hook  │  │ (A4 Canvas) │  │  Products/     │  │
│  │  Form + Zod) │  │             │  │  Customers)    │  │
│  └──────┬───────┘  └──────┬──────┘  └───────┬────────┘  │
└─────────┼──────────────────┼────────────────┼───────────┘
          │                  │                │
          ▼                  ▼                ▼
┌─────────────────────────────────────────────────────────┐
│                Next.js Server (App Router)               │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │ Server       │  │ Calculation │  │ PDF Service    │  │
│  │ Actions      │  │ Engine      │  │ (@react-pdf)   │  │
│  │ (auth-gated) │  │ (server-    │  │ Route Handler  │  │
│  │              │  │  side only) │  │                │  │
│  └──────┬───────┘  └─────────────┘  └───────┬────────┘  │
└─────────┼──────────────────────────────────────────────┘
          │                                    │
          ▼                                    ▼
┌─────────────────────────────────────────────────────────┐
│                     Supabase                             │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │ PostgreSQL   │  │ Auth        │  │ Storage        │  │
│  │ (RLS-enabled)│  │ (JWT-based) │  │ (logos,        │  │
│  │              │  │             │  │  signatures)   │  │
│  └──────────────┘  └─────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Request Flow — Invoice Issue

```
Browser: [Issue Invoice] →
Server Action: validate fields →
Calculation Engine: re-compute all totals from stored line items →
DB Transaction (SERIALIZABLE):
  1. SELECT invoice_counters FOR UPDATE
  2. Increment counter, assign invoice_number
  3. INSERT invoice snapshot
  4. INSERT invoice_item snapshots
  5. INSERT audit_log entry
  6. COMMIT →
Server: return success + invoice_id →
Browser: show success, offer PDF download
```

---

## Components and Interfaces

### Frontend Components

| Component | Location | Responsibility |
|---|---|---|
| `InvoiceEditor` | `app/(dashboard)/invoices/new` | Full invoice creation form with live preview |
| `LineItemTable` | `components/invoice/line-item-table` | Dynamic rows for products; calls calc engine on change |
| `InvoicePreview` | `components/invoice/invoice-preview` | A4-scaled live preview using shared template |
| `InvoiceTemplate` | `components/invoice/invoice-template` | The single source-of-truth template used for preview AND PDF |
| `CustomerSelector` | `components/invoice/customer-selector` | Combobox for existing customers + inline new customer form |
| `ProductSelector` | `components/invoice/product-selector` | Searchable product combobox for line item rows |
| `InvoiceHistoryTable` | `app/(dashboard)/invoices` | Paginated, searchable, filterable invoice list |
| `PaymentModal` | `components/invoice/payment-modal` | Record payment against issued invoice |
| `DashboardMetrics` | `app/(dashboard)` | KPI cards derived from DB aggregate queries |

### Server Actions

| Action | File | Description |
|---|---|---|
| `saveDraftInvoice` | `actions/invoices.ts` | Create or update a draft invoice and its line items |
| `issueInvoice` | `actions/invoices.ts` | Atomic transaction: assign number, save snapshots |
| `voidInvoice` | `actions/invoices.ts` | Set status=VOID, record reason, log audit event |
| `recordPayment` | `actions/payments.ts` | Insert payment record, update invoice payment status |
| `generatePdfUrl` | `app/api/pdf/[id]/route.ts` | Route handler returning PDF binary stream |
| `saveCompanySettings` | `actions/settings.ts` | Upsert company_settings row |
| `upsertProduct` | `actions/products.ts` | Create or update a product |
| `upsertCustomer` | `actions/customers.ts` | Create or update a customer |

### Calculation Engine Interface

```typescript
// lib/calculation-engine.ts

export interface LineItemInput {
  quantity: number;          // must be > 0
  unitPrice: number;         // must be >= 0
  discountType: 'amount' | 'percent';
  discountValue: number;     // must be >= 0
  taxRate: number;           // e.g., 18 for 18%
}

export interface LineItemResult {
  grossAmount: number;       // quantity * unitPrice
  discountAmount: number;    // computed from discountType + discountValue
  taxableAmount: number;     // grossAmount - discountAmount
  cgstRate: number;          // taxRate / 2 if intra-state, else 0
  sgstRate: number;          // taxRate / 2 if intra-state, else 0
  igstRate: number;          // taxRate if inter-state, else 0
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxAmount: number;         // cgst + sgst + igst
  lineTotal: number;         // taxableAmount + taxAmount
}

export interface InvoiceCalculationResult {
  lineItems: LineItemResult[];
  subtotal: number;          // sum of taxableAmounts
  totalDiscount: number;     // sum of discountAmounts
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  grandTotal: number;        // subtotal + totalTax
  roundOff: number;          // optional ±0.50 rounding
  amountInWords: string;
}

export function calculateInvoice(
  lineItems: LineItemInput[],
  isInterState: boolean,
  roundOff?: boolean
): InvoiceCalculationResult
```

All arithmetic uses integer paise internally (multiply by 100, use integer math, divide by 100 at display time) to avoid floating-point drift.

---

## Data Models

### Database Schema

```sql
-- Core multi-tenancy
CREATE TABLE companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE company_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'billing_staff', 'viewer')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- Company configuration
CREATE TABLE company_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL UNIQUE REFERENCES companies(id),
  legal_name          TEXT,
  display_name        TEXT,
  address             TEXT,
  mobile              TEXT,
  email               TEXT,
  gstin               TEXT,
  pan                 TEXT,
  logo_url            TEXT,
  signature_url       TEXT,
  bank_account_holder TEXT,
  bank_account_number TEXT,
  bank_name           TEXT,
  bank_ifsc           TEXT,
  bank_branch         TEXT,
  upi_id              TEXT,
  invoice_prefix      TEXT DEFAULT 'INV',
  due_date_offset_days INT DEFAULT 15,
  terms_conditions    TEXT,
  footer_text         TEXT,
  state_code          TEXT,   -- 2-digit GST state code e.g. "09"
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Master data
CREATE TABLE customers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id),
  name             TEXT NOT NULL,
  gstin            TEXT,
  pan              TEXT,
  mobile           TEXT,
  email            TEXT,
  billing_address  TEXT,
  shipping_address TEXT,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id),
  name             TEXT NOT NULL,
  sku              TEXT NOT NULL,
  description      TEXT,
  hsn_sac          TEXT,
  unit             TEXT DEFAULT 'Pcs',
  selling_price    NUMERIC(15,2) NOT NULL,
  tax_rate         NUMERIC(5,2) NOT NULL,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, sku)
);

-- Invoice numbering with per-company, per-year counters
CREATE TABLE invoice_counters (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id),
  financial_year TEXT NOT NULL,  -- e.g. "25-26"
  current_seq  INT NOT NULL DEFAULT 0,
  UNIQUE(company_id, financial_year)
);

-- Invoices (snapshots at issue time)
CREATE TABLE invoices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id),
  invoice_number        TEXT,                -- NULL until issued
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','issued','void')),
  invoice_date          DATE,
  due_date              DATE,
  place_of_supply       TEXT,               -- state code e.g. "09"
  is_inter_state        BOOLEAN,
  reverse_charge        BOOLEAN DEFAULT false,

  -- Customer snapshot (immutable after issue)
  customer_id           UUID REFERENCES customers(id),
  customer_name         TEXT,
  customer_gstin        TEXT,
  customer_pan          TEXT,
  customer_mobile       TEXT,
  customer_email        TEXT,
  customer_billing_addr TEXT,
  customer_shipping_addr TEXT,

  -- Seller snapshot (immutable after issue)
  seller_name           TEXT,
  seller_gstin          TEXT,
  seller_address        TEXT,
  seller_mobile         TEXT,
  seller_email          TEXT,
  seller_pan            TEXT,
  seller_state_code     TEXT,

  -- Transport details
  transporter_name      TEXT,
  vehicle_number        TEXT,
  transport_doc_number  TEXT,
  transport_doc_date    DATE,
  eway_bill_number      TEXT,
  eway_bill_date        DATE,

  -- E-invoice details
  irn                   TEXT,
  ack_number            TEXT,
  ack_date              DATE,

  -- Calculated totals (immutable after issue)
  subtotal              NUMERIC(15,2) DEFAULT 0,
  total_discount        NUMERIC(15,2) DEFAULT 0,
  total_cgst            NUMERIC(15,2) DEFAULT 0,
  total_sgst            NUMERIC(15,2) DEFAULT 0,
  total_igst            NUMERIC(15,2) DEFAULT 0,
  total_tax             NUMERIC(15,2) DEFAULT 0,
  round_off             NUMERIC(15,2) DEFAULT 0,
  grand_total           NUMERIC(15,2) DEFAULT 0,
  amount_in_words       TEXT,

  -- Payment tracking
  amount_paid           NUMERIC(15,2) DEFAULT 0,
  balance_due           NUMERIC(15,2) DEFAULT 0,
  payment_status        TEXT DEFAULT 'unpaid'
                          CHECK (payment_status IN ('unpaid','partially_paid','paid')),

  -- Metadata
  issued_at             TIMESTAMPTZ,
  issued_by             UUID REFERENCES auth.users(id),
  void_at               TIMESTAMPTZ,
  void_by               UUID REFERENCES auth.users(id),
  void_reason           TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),

  UNIQUE(company_id, invoice_number)
);

-- Line item snapshots
CREATE TABLE invoice_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sort_order       INT NOT NULL DEFAULT 0,
  description      TEXT NOT NULL,
  hsn_sac          TEXT,
  quantity         NUMERIC(15,3) NOT NULL,
  unit             TEXT,
  unit_price       NUMERIC(15,2) NOT NULL,
  discount_type    TEXT CHECK (discount_type IN ('amount','percent')),
  discount_value   NUMERIC(15,2) DEFAULT 0,
  discount_amount  NUMERIC(15,2) DEFAULT 0,
  tax_rate         NUMERIC(5,2) DEFAULT 0,
  taxable_amount   NUMERIC(15,2) NOT NULL,
  cgst_rate        NUMERIC(5,2) DEFAULT 0,
  cgst_amount      NUMERIC(15,2) DEFAULT 0,
  sgst_rate        NUMERIC(5,2) DEFAULT 0,
  sgst_amount      NUMERIC(15,2) DEFAULT 0,
  igst_rate        NUMERIC(5,2) DEFAULT 0,
  igst_amount      NUMERIC(15,2) DEFAULT 0,
  line_total       NUMERIC(15,2) NOT NULL,
  product_id       UUID REFERENCES products(id)
);

-- Payment records
CREATE TABLE invoice_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       UUID NOT NULL REFERENCES invoices(id),
  company_id       UUID NOT NULL REFERENCES companies(id),
  payment_date     DATE NOT NULL,
  amount           NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  payment_mode     TEXT NOT NULL CHECK (payment_mode IN ('cash','upi','bank_transfer','cheque','other')),
  reference_number TEXT,
  notes            TEXT,
  recorded_by      UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Audit log
CREATE TABLE audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID REFERENCES companies(id),
  user_id      UUID REFERENCES auth.users(id),
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    UUID,
  metadata     JSONB,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

### Key Indexes

```sql
CREATE INDEX idx_invoices_company_id     ON invoices(company_id);
CREATE INDEX idx_invoices_customer_id    ON invoices(customer_id);
CREATE INDEX idx_invoices_status         ON invoices(status);
CREATE INDEX idx_invoices_invoice_date   ON invoices(invoice_date);
CREATE INDEX idx_invoice_items_invoice   ON invoice_items(invoice_id);
CREATE INDEX idx_customers_company_id    ON customers(company_id);
CREATE INDEX idx_products_company_id     ON products(company_id);
CREATE INDEX idx_products_company_sku    ON products(company_id, sku);
```

### Invoice Number Generation (Stored Function)

```sql
CREATE OR REPLACE FUNCTION generate_invoice_number(
  p_company_id UUID,
  p_prefix TEXT,
  p_financial_year TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seq INT;
  v_number TEXT;
BEGIN
  -- Serializable lock on counter row
  INSERT INTO invoice_counters (company_id, financial_year, current_seq)
  VALUES (p_company_id, p_financial_year, 1)
  ON CONFLICT (company_id, financial_year)
  DO UPDATE SET current_seq = invoice_counters.current_seq + 1
  RETURNING current_seq INTO v_seq;

  v_number := p_prefix || '/' || LPAD(v_seq::TEXT, 3, '0') || '/' || p_financial_year;
  RETURN v_number;
END;
$$;
```

---

## Invoice Template Layout

The invoice template is a single React component (`InvoiceTemplate`) shared between:
1. The **browser preview** (scaled to fit the editor sidebar using CSS transform)
2. The **PDF generation** via `@react-pdf/renderer` Document/Page/View/Text primitives

```
┌──────────────────────────────────────────────────────────┐  A4: 210×297mm
│  Page 1 of 1              TAX INVOICE        Original Copy│  ← Section 1
├──────────────────────────────────────────────────────────┤
│  [LOGO]   COMPANY NAME                    GSTIN: xxxxxxx  │  ← Section 2
│           Address • Mobile • Email • PAN                  │
├───────────────────────────┬──────────────────────────────┤
│  Invoice No: PP/001/25-26 │  Transporter: ...            │  ← Section 3
│  Invoice Date: 22-Apr-25  │  Vehicle No: ...             │
│  Due Date: 07-May-25      │  E-Way Bill: ...             │
│  Place of Supply: 09-UP   │                               │
│  Reverse Charge: No       │                               │
├───────────────────────────┼──────────────────────────────┤
│  BILLING DETAILS          │  SHIPPING DETAILS             │  ← Section 4
│  Name / GSTIN / Address   │  Name / GSTIN / Address       │
├──────────────────────────────────────────────────────────┤
│  IRN: xxxxxxxx  Ack No: xxxxxxxx  Ack Date: xx-xxx-xx    │  ← Section 5
├────┬──────────────────┬───────┬────┬──────┬──────┬───┬───┤
│ Sr │ Item Description │HSN/SAC│ Qty│ Unit │ListPr│Dis│Tax│Amt│ ← Section 6
├────┼──────────────────┼───────┼────┼──────┼──────┼───┼───┤
│  1 │ Item Desc 1      │8507.. │1.00│  Box │10,000│200│18%│9800│
│    │                  │       │    │      │      │   │   │    │
├──────────────────────────────────────────────────────────┤
│                               Discount:        ₹200.00   │  ← Section 7
│                               Subtotal:      ₹9,800.00   │
│                               CGST (9%):       ₹882.00   │
│                               SGST (9%):       ₹882.00   │
│                         ┌─── Grand Total:   ₹10,564.00 ──┤
├──────────────────────────────────────────────────────────┤
│  Amount in Words: Rupees Ten Thousand Five Hundred...    │  ← Section 8
│  Balance Due: ₹10,564.00   Amount Paid: ₹0.00           │
├─────────────────┬──────────────────┬──────────┬──────────┤
│ Terms &         │ Bank Details     │ E-Invoice│ Authorized│ ← Section 9
│ Conditions:     │ A/C: xxxxxxxx   │ QR Code  │ Signatory │
│ 1. Payment...   │ Bank: ...       │          │           │
│                 │ IFSC: ...       │          │ [Stamp]   │
│                 │ [QR Code]       │          │           │
├──────────────────────────────────────────────────────────┤
│           This is a computer generated invoice            │  ← Section 10
└──────────────────────────────────────────────────────────┘
```

### CSS / PDF Styling Approach

For the **browser preview**: Pure Tailwind CSS with `transform: scale()` to fit A4 in the sidebar.

For the **PDF**: `@react-pdf/renderer` with `StyleSheet.create()` mapping equivalent dimensions. Uses points (1 pt = 1/72 inch; A4 = 595.28 × 841.89 pt).

Column widths for the product table (percentage of content width):

| Column | Width |
|---|---|
| Sr. | 4% |
| Item Description | 28% |
| HSN/SAC | 12% |
| Qty | 6% |
| Unit | 7% |
| List Price | 12% |
| Disc. | 9% |
| Tax % | 8% |
| Amount (₹) | 14% |

---

## Folder Structure

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx           # Sidebar + auth guard
│   │   ├── page.tsx             # Dashboard
│   │   ├── invoices/
│   │   │   ├── page.tsx         # Invoice History
│   │   │   ├── new/page.tsx     # Invoice Editor
│   │   │   └── [id]/page.tsx    # Invoice Detail
│   │   ├── products/
│   │   ├── customers/
│   │   ├── reports/
│   │   └── settings/
│   └── api/
│       └── pdf/[id]/route.ts    # PDF generation endpoint
├── components/
│   ├── invoice/
│   │   ├── invoice-template.tsx # Shared template (browser + PDF)
│   │   ├── invoice-preview.tsx  # Scaled browser preview wrapper
│   │   ├── invoice-editor.tsx   # Full editor form
│   │   ├── line-item-table.tsx
│   │   ├── customer-selector.tsx
│   │   └── payment-modal.tsx
│   └── ui/                      # Shared UI primitives
├── lib/
│   ├── calculation-engine.ts    # Pure financial calculations
│   ├── amount-in-words.ts       # Number → Indian English words
│   ├── invoice-number.ts        # Financial year helpers
│   ├── supabase/
│   │   ├── client.ts            # Browser Supabase client
│   │   └── server.ts            # Server Supabase client (cookies)
│   └── validations/             # Zod schemas
├── actions/
│   ├── invoices.ts
│   ├── payments.ts
│   ├── products.ts
│   ├── customers.ts
│   └── settings.ts
└── supabase/
    ├── migrations/              # Version-controlled SQL migrations
    └── seed.sql                 # Development seed data
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property-Based Testing Overview

Property-based testing (PBT) validates software correctness by testing universal properties across many generated inputs. Each property is a formal specification that should hold for all valid inputs. We use **fast-check** (TypeScript PBT library) for all property tests.

**Configuration**: Each property test runs a minimum of 100 iterations.

---

**Property 1: Line Item Calculation Pipeline Correctness**

*For any* valid line item (positive quantity, non-negative unit price, valid discount type and value, non-negative tax rate), the Calculation Engine SHALL produce:
- `grossAmount = quantity * unitPrice`
- `discountAmount`: if type=`amount`, equals `discountValue`; if type=`percent`, equals `grossAmount * discountValue / 100`
- `taxableAmount = grossAmount - discountAmount` (must be >= 0)
- `taxAmount = taxableAmount * taxRate / 100`
- `lineTotal = taxableAmount + taxAmount`

All five values must hold simultaneously.

**Validates: Requirements 6.1, 6.2, 6.4, 6.5**

---

**Property 2: Invoice Aggregate Totals Consistency**

*For any* valid collection of line items (1–50 items), the Calculation Engine SHALL produce aggregate totals where:
- `subtotal = sum of all taxableAmounts`
- `totalTax = sum of all taxAmount values`
- `grandTotal = subtotal + totalTax + roundOff` (where roundOff is in range [-0.50, +0.50])

All three aggregates must hold simultaneously for the same input.

**Validates: Requirements 6.6, 6.7, 6.8**

---

**Property 3: Tax Mode Determination (CGST/SGST vs IGST)**

*For any* invoice and any company state code and place of supply:
- WHEN they are equal (intra-state), the Calculation Engine SHALL set `cgstRate = taxRate / 2`, `sgstRate = taxRate / 2`, `igstRate = 0`
- WHEN they differ (inter-state), the Calculation Engine SHALL set `cgstRate = 0`, `sgstRate = 0`, `igstRate = taxRate`
- In both cases, `cgstAmount + sgstAmount + igstAmount = taxAmount`

**Validates: Requirements 6.3, 8.5**

---

**Property 4: Amount in Words Correctness**

*For any* non-negative integer rupee amount from 0 to 9,999,999, the `amountToWords` function SHALL produce a non-empty string that:
- Starts with "Rupees" (or "Zero Rupees" for 0)
- Ends with "Only"
- Contains no leading or trailing whitespace
- Does not contain consecutive spaces

**Validates: Requirements 6.10**

---

**Property 5: Invoice Total Consistency (Calculation ↔ Database)**

*For any* issued invoice stored in the database, the stored `grand_total` column value SHALL equal the sum of the stored `line_total` column values across all associated `invoice_items` rows.

This verifies that the atomic issue transaction persists consistent values and that no rounding error accumulates between the calculation engine and the database write.

**Validates: Requirements 6.13, 15.9**

---

**Property 6: Snapshot Immutability After Post-Issue Edits**

*For any* issued invoice, after updating the corresponding customer's name/address OR the corresponding product's price/tax rate:
- The `customer_name`, `customer_billing_addr` columns on the `invoices` table SHALL remain unchanged
- The `unit_price`, `tax_rate`, `line_total` columns on the `invoice_items` rows SHALL remain unchanged

**Validates: Requirements 3.8, 4.7**

---

**Property 7: Payment Balance Calculation and Status**

*For any* issued invoice with one or more recorded payments:
- `amount_paid = sum of all payment.amount values for the invoice`
- `balance_due = grand_total - amount_paid`
- Payment status is exactly `"unpaid"` when `amount_paid = 0`, `"partially_paid"` when `0 < amount_paid < grand_total`, and `"paid"` when `amount_paid = grand_total`
- A payment that would make `amount_paid > grand_total` SHALL be rejected

**Validates: Requirements 11.2, 11.3, 11.4, 11.5, 11.6, 11.7**

---

**Property 8: GSTIN Validation**

*For any* input string, the GSTIN validator SHALL accept exactly those strings matching the pattern `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$` and reject all others.

**Validates: Requirements 2.7**

---

**Property 9: SKU Uniqueness Per Company**

*For any* company, attempting to insert two products with the same SKU (case-sensitive) within the same company SHALL result in the second insert being rejected by the database unique constraint.

**Validates: Requirements 3.2**

---

**Property 10: RLS Cross-Company Data Isolation**

*For any* user who is a member of Company A only, all Supabase queries for invoices, customers, products, and settings WHERE the data belongs to Company B SHALL return zero rows — regardless of the query filter.

**Validates: Requirements 15.4**

---

**Property 11: Invoice Number Uniqueness Under Concurrency**

*For any* batch of N concurrent invoice issue requests for the same company and financial year, all N requests SHALL succeed AND the resulting invoice numbers SHALL be globally unique with no duplicates.

**Validates: Requirements 7.4, 15.6**

---

## Error Handling

| Scenario | Handling |
|---|---|
| Supabase connection error | Server action returns typed error; UI shows toast with retry |
| Invoice issue transaction conflict | Return error code `INVOICE_NUMBER_CONFLICT`; client retries once |
| PDF generation failure | HTTP 500 with error body; invoice status unchanged; UI shows retry button |
| Unauthorized access | Server action throws `UNAUTHORIZED`; redirect to login if session expired |
| Missing company settings | Warning banner on invoice editor; link to settings page |
| Duplicate issue request (idempotency) | Check for existing issued invoice with same draft_id before starting transaction |
| Invalid discount (result < 0) | Zod validation on client + server; reject with field-level error message |
| Overpayment attempt | Server validates `existing_paid + new_payment <= grand_total`; returns error |

---

## Testing Strategy

### Unit Tests (Vitest)

Target the pure calculation functions with no I/O:

- `calculateInvoice()` — property and example tests
- `amountToWords()` — property tests for all ranges
- `determineInvoiceFinancialYear()` — example tests for April/March boundaries
- `formatInvoiceNumber()` — example tests
- `computePaymentStatus()` — example tests for each status transition

### Property-Based Tests (Vitest + fast-check)

One property-based test per property defined above (Properties 1–8). Properties 9–11 require database/integration setup.

**Configuration per test:**
```typescript
// Example tag format
// Feature: furniture-billing, Property 1: line-item-calculation-pipeline
fc.assert(fc.property(...), { numRuns: 100 })
```

### Integration Tests (Vitest + Supabase test instance)

- Product CRUD with uniqueness constraint (Property 9)
- Invoice issue atomic transaction (Requirement 7.3)
- Invoice counter uniqueness under 10 concurrent requests (Property 11)
- RLS cross-company isolation (Property 10)
- Payment recording and balance update (Property 7)
- Snapshot immutability (Property 6, Property 5)

### End-to-End Tests (Playwright)

Critical user journeys:
1. Login → Dashboard visible
2. Create product → appears in product list
3. Create customer → appears in customer list
4. Create draft invoice → add 3 products → verify calculated totals
5. Issue invoice → verify in history → download PDF
6. Record payment → verify payment status update
7. Void invoice → verify excluded from dashboard totals
8. Unauthorized access: Viewer cannot reach /invoices/new
9. Cross-company: User cannot view another company's invoice by URL

### PDF Visual Tests

Generate a PDF using the sample data from the reference image and verify:
- PDF dimensions are 595.28 × 841.89 pt (A4)
- All 10 sections are present
- Column headers match the reference
- Grand total matches the expected calculated value
- Footer QR section is rendered

---

## Dependencies to Add

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2",
    "@supabase/ssr": "^0.5",
    "@react-pdf/renderer": "^3",
    "react-hook-form": "^7",
    "@hookform/resolvers": "^3",
    "zod": "^3",
    "fast-check": "^3",
    "@tanstack/react-table": "^8",
    "date-fns": "^3",
    "qrcode": "^1",
    "decimal.js": "^10"
  },
  "devDependencies": {
    "vitest": "^1",
    "@vitejs/plugin-react": "^4",
    "playwright": "^1",
    "@playwright/test": "^1"
  }
}
```

`decimal.js` is used in the calculation engine for all monetary arithmetic to avoid floating-point issues.
