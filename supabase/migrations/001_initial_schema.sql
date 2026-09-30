-- ============================================================
-- Migration: 001_initial_schema
-- Description: Core tables for the furniture billing system
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Companies (top-level multi-tenancy unit)
-- ----------------------------------------------------------------
CREATE TABLE companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------
-- 2. Company Members (users ↔ companies with roles)
-- ----------------------------------------------------------------
CREATE TABLE company_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'billing_staff', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

-- ----------------------------------------------------------------
-- 3. Company Settings (business info, bank details, invoice config)
-- ----------------------------------------------------------------
CREATE TABLE company_settings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  -- Business information
  legal_name           TEXT,
  display_name         TEXT,
  address              TEXT,
  mobile               TEXT,
  email                TEXT,
  gstin                TEXT,
  pan                  TEXT,
  logo_url             TEXT,
  signature_url        TEXT,
  -- GST state code (2-digit, e.g. "09" for Uttar Pradesh)
  state_code           TEXT,
  -- Bank details
  bank_account_holder  TEXT,
  bank_account_number  TEXT,
  bank_name            TEXT,
  bank_ifsc            TEXT,
  bank_branch          TEXT,
  upi_id               TEXT,
  -- Invoice configuration
  invoice_prefix       TEXT NOT NULL DEFAULT 'INV',
  due_date_offset_days INT  NOT NULL DEFAULT 15,
  terms_conditions     TEXT,
  footer_text          TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------
-- 4. Customers
-- ----------------------------------------------------------------
CREATE TABLE customers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  gstin            TEXT,
  pan              TEXT,
  mobile           TEXT,
  email            TEXT,
  billing_address  TEXT,
  shipping_address TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------
-- 5. Products
-- ----------------------------------------------------------------
CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  sku           TEXT NOT NULL,
  description   TEXT,
  hsn_sac       TEXT,
  unit          TEXT NOT NULL DEFAULT 'Pcs',
  selling_price NUMERIC(15, 2) NOT NULL CHECK (selling_price >= 0),
  tax_rate      NUMERIC(5, 2)  NOT NULL CHECK (tax_rate >= 0 AND tax_rate <= 100),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, sku)
);

-- ----------------------------------------------------------------
-- 6. Invoice Counters (per-company, per-financial-year sequences)
-- ----------------------------------------------------------------
CREATE TABLE invoice_counters (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  financial_year TEXT NOT NULL,   -- e.g. "25-26"
  current_seq    INT  NOT NULL DEFAULT 0 CHECK (current_seq >= 0),
  UNIQUE (company_id, financial_year)
);

-- ----------------------------------------------------------------
-- 7. Invoices (with customer + seller snapshots stored at issue time)
-- ----------------------------------------------------------------
CREATE TABLE invoices (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Lifecycle
  invoice_number         TEXT,          -- NULL until issued
  status                 TEXT NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'issued', 'void')),

  -- Invoice header
  invoice_date           DATE,
  due_date               DATE,
  place_of_supply        TEXT,          -- GST state code, e.g. "09"
  is_inter_state         BOOLEAN,
  reverse_charge         BOOLEAN NOT NULL DEFAULT false,

  -- Customer reference (live FK, kept for history queries)
  customer_id            UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Customer snapshot (immutable after issue)
  customer_name          TEXT,
  customer_gstin         TEXT,
  customer_pan           TEXT,
  customer_mobile        TEXT,
  customer_email         TEXT,
  customer_billing_addr  TEXT,
  customer_shipping_addr TEXT,

  -- Seller snapshot (immutable after issue)
  seller_name            TEXT,
  seller_gstin           TEXT,
  seller_address         TEXT,
  seller_mobile          TEXT,
  seller_email           TEXT,
  seller_pan             TEXT,
  seller_state_code      TEXT,

  -- Transport / logistics details
  transporter_name       TEXT,
  vehicle_number         TEXT,
  transport_doc_number   TEXT,
  transport_doc_date     DATE,
  eway_bill_number       TEXT,
  eway_bill_date         DATE,

  -- E-invoice details
  irn                    TEXT,
  ack_number             TEXT,
  ack_date               DATE,

  -- Calculated totals (immutable after issue)
  subtotal               NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  total_discount         NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (total_discount >= 0),
  total_cgst             NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (total_cgst >= 0),
  total_sgst             NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (total_sgst >= 0),
  total_igst             NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (total_igst >= 0),
  total_tax              NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (total_tax >= 0),
  round_off              NUMERIC(15, 2) NOT NULL DEFAULT 0,
  grand_total            NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
  amount_in_words        TEXT,

  -- Payment tracking
  amount_paid            NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  balance_due            NUMERIC(15, 2) NOT NULL DEFAULT 0,
  payment_status         TEXT NOT NULL DEFAULT 'unpaid'
                           CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid')),

  -- Audit metadata
  issued_at              TIMESTAMPTZ,
  issued_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  void_at                TIMESTAMPTZ,
  void_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason            TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (company_id, invoice_number)
);

-- ----------------------------------------------------------------
-- 8. Invoice Items (line-item snapshots, immutable after issue)
-- ----------------------------------------------------------------
CREATE TABLE invoice_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sort_order      INT  NOT NULL DEFAULT 0,

  -- Product snapshot
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  description     TEXT NOT NULL,
  hsn_sac         TEXT,
  quantity        NUMERIC(15, 3) NOT NULL CHECK (quantity > 0),
  unit            TEXT,

  -- Pricing snapshot
  unit_price      NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
  discount_type   TEXT CHECK (discount_type IN ('amount', 'percent')),
  discount_value  NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),

  -- Tax snapshot
  tax_rate        NUMERIC(5, 2)  NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  taxable_amount  NUMERIC(15, 2) NOT NULL CHECK (taxable_amount >= 0),
  cgst_rate       NUMERIC(5, 2)  NOT NULL DEFAULT 0 CHECK (cgst_rate >= 0),
  cgst_amount     NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (cgst_amount >= 0),
  sgst_rate       NUMERIC(5, 2)  NOT NULL DEFAULT 0 CHECK (sgst_rate >= 0),
  sgst_amount     NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (sgst_amount >= 0),
  igst_rate       NUMERIC(5, 2)  NOT NULL DEFAULT 0 CHECK (igst_rate >= 0),
  igst_amount     NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (igst_amount >= 0),
  line_total      NUMERIC(15, 2) NOT NULL CHECK (line_total >= 0)
);

-- ----------------------------------------------------------------
-- 9. Invoice Payments
-- ----------------------------------------------------------------
CREATE TABLE invoice_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payment_date     DATE NOT NULL,
  amount           NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  payment_mode     TEXT NOT NULL
                     CHECK (payment_mode IN ('cash', 'upi', 'bank_transfer', 'cheque', 'other')),
  reference_number TEXT,
  notes            TEXT,
  recorded_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------
-- 10. Audit Logs
-- ----------------------------------------------------------------
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE SET NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,        -- e.g. 'invoice.issued', 'payment.recorded'
  entity_type TEXT NOT NULL,        -- e.g. 'invoice', 'product'
  entity_id   UUID,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
