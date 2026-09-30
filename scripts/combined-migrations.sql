-- ============================================================
-- COMBINED MIGRATIONS + SEED
-- Paste this entire file into:
--   Supabase Dashboard → SQL Editor → Run
--
-- Safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT).
-- ============================================================

-- ======================== 001_initial_schema ========================

CREATE TABLE IF NOT EXISTS companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'billing_staff', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

CREATE TABLE IF NOT EXISTS company_settings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  legal_name           TEXT,
  display_name         TEXT,
  address              TEXT,
  mobile               TEXT,
  email                TEXT,
  gstin                TEXT,
  pan                  TEXT,
  logo_url             TEXT,
  signature_url        TEXT,
  state_code           TEXT,
  bank_account_holder  TEXT,
  bank_account_number  TEXT,
  bank_name            TEXT,
  bank_ifsc            TEXT,
  bank_branch          TEXT,
  upi_id               TEXT,
  invoice_prefix       TEXT NOT NULL DEFAULT 'INV',
  due_date_offset_days INT  NOT NULL DEFAULT 15,
  terms_conditions     TEXT,
  footer_text          TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
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

CREATE TABLE IF NOT EXISTS products (
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

CREATE TABLE IF NOT EXISTS invoice_counters (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  financial_year TEXT NOT NULL,
  current_seq    INT  NOT NULL DEFAULT 0 CHECK (current_seq >= 0),
  UNIQUE (company_id, financial_year)
);

CREATE TABLE IF NOT EXISTS invoices (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number         TEXT,
  status                 TEXT NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'issued', 'void')),
  invoice_date           DATE,
  due_date               DATE,
  place_of_supply        TEXT,
  is_inter_state         BOOLEAN,
  reverse_charge         BOOLEAN NOT NULL DEFAULT false,
  customer_id            UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name          TEXT,
  customer_gstin         TEXT,
  customer_pan           TEXT,
  customer_mobile        TEXT,
  customer_email         TEXT,
  customer_billing_addr  TEXT,
  customer_shipping_addr TEXT,
  seller_name            TEXT,
  seller_gstin           TEXT,
  seller_address         TEXT,
  seller_mobile          TEXT,
  seller_email           TEXT,
  seller_pan             TEXT,
  seller_state_code      TEXT,
  transporter_name       TEXT,
  vehicle_number         TEXT,
  transport_doc_number   TEXT,
  transport_doc_date     DATE,
  eway_bill_number       TEXT,
  eway_bill_date         DATE,
  irn                    TEXT,
  ack_number             TEXT,
  ack_date               DATE,
  subtotal               NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  total_discount         NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (total_discount >= 0),
  total_cgst             NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (total_cgst >= 0),
  total_sgst             NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (total_sgst >= 0),
  total_igst             NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (total_igst >= 0),
  total_tax              NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (total_tax >= 0),
  round_off              NUMERIC(15, 2) NOT NULL DEFAULT 0,
  grand_total            NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
  amount_in_words        TEXT,
  amount_paid            NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  balance_due            NUMERIC(15, 2) NOT NULL DEFAULT 0,
  payment_status         TEXT NOT NULL DEFAULT 'unpaid'
                           CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid')),
  issued_at              TIMESTAMPTZ,
  issued_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  void_at                TIMESTAMPTZ,
  void_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason            TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sort_order      INT  NOT NULL DEFAULT 0,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  description     TEXT NOT NULL,
  hsn_sac         TEXT,
  quantity        NUMERIC(15, 3) NOT NULL CHECK (quantity > 0),
  unit            TEXT,
  unit_price      NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
  discount_type   TEXT CHECK (discount_type IN ('amount', 'percent')),
  discount_value  NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
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

CREATE TABLE IF NOT EXISTS invoice_payments (
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

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE SET NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ======================== 002_indexes ========================

CREATE INDEX IF NOT EXISTS idx_invoices_company_id      ON invoices (company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id     ON invoices (customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status          ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date    ON invoices (invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status  ON invoices (payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_company_date    ON invoices (company_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON invoice_payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_company_id ON invoice_payments (company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id     ON customers (company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_name   ON customers (company_id, name);
CREATE INDEX IF NOT EXISTS idx_products_company_id      ON products (company_id);
CREATE INDEX IF NOT EXISTS idx_products_company_sku     ON products (company_id, sku);
CREATE INDEX IF NOT EXISTS idx_company_members_user_id  ON company_members (user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON company_members (company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id    ON audit_logs (company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity        ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at    ON audit_logs (created_at DESC);

-- ======================== 003_invoice_number_function ========================

CREATE OR REPLACE FUNCTION generate_invoice_number(
  p_company_id     UUID,
  p_prefix         TEXT,
  p_financial_year TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seq    INT;
  v_number TEXT;
BEGIN
  INSERT INTO invoice_counters (company_id, financial_year, current_seq)
  VALUES (p_company_id, p_financial_year, 1)
  ON CONFLICT (company_id, financial_year)
  DO UPDATE SET current_seq = invoice_counters.current_seq + 1
  RETURNING current_seq INTO v_seq;

  v_number := p_prefix
    || '/'
    || LPAD(v_seq::TEXT, 3, '0')
    || '/'
    || p_financial_year;

  RETURN v_number;
END;
$$;

REVOKE ALL ON FUNCTION generate_invoice_number(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_invoice_number(UUID, TEXT, TEXT) TO service_role;

-- ======================== 004_rls_policies ========================

CREATE OR REPLACE FUNCTION auth_user_company_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT company_id FROM company_members WHERE user_id = auth.uid();
$$;

ALTER TABLE companies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_counters  ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first so this file is idempotent
DO $$ BEGIN
  DROP POLICY IF EXISTS "members can view their company" ON companies;
  DROP POLICY IF EXISTS "members can view company members" ON company_members;
  DROP POLICY IF EXISTS "members can view company settings" ON company_settings;
  DROP POLICY IF EXISTS "admins can upsert company settings" ON company_settings;
  DROP POLICY IF EXISTS "members can view customers" ON customers;
  DROP POLICY IF EXISTS "billing staff and admins can manage customers" ON customers;
  DROP POLICY IF EXISTS "members can view products" ON products;
  DROP POLICY IF EXISTS "billing staff and admins can manage products" ON products;
  DROP POLICY IF EXISTS "members can view invoice counters" ON invoice_counters;
  DROP POLICY IF EXISTS "members can view invoices" ON invoices;
  DROP POLICY IF EXISTS "billing staff and admins can manage invoices" ON invoices;
  DROP POLICY IF EXISTS "members can view invoice items" ON invoice_items;
  DROP POLICY IF EXISTS "billing staff and admins can manage invoice items" ON invoice_items;
  DROP POLICY IF EXISTS "members can view payments" ON invoice_payments;
  DROP POLICY IF EXISTS "billing staff and admins can record payments" ON invoice_payments;
  DROP POLICY IF EXISTS "members can view their audit logs" ON audit_logs;
  DROP POLICY IF EXISTS "authenticated users can insert audit logs" ON audit_logs;
END $$;

CREATE POLICY "members can view their company"
  ON companies FOR SELECT USING (id IN (SELECT auth_user_company_ids()));

CREATE POLICY "members can view company members"
  ON company_members FOR SELECT USING (company_id IN (SELECT auth_user_company_ids()));

CREATE POLICY "members can view company settings"
  ON company_settings FOR SELECT USING (company_id IN (SELECT auth_user_company_ids()));

CREATE POLICY "admins can upsert company settings"
  ON company_settings FOR ALL
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "members can view customers"
  ON customers FOR SELECT USING (company_id IN (SELECT auth_user_company_ids()));

CREATE POLICY "billing staff and admins can manage customers"
  ON customers FOR ALL
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('admin','billing_staff')))
  WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('admin','billing_staff')));

CREATE POLICY "members can view products"
  ON products FOR SELECT USING (company_id IN (SELECT auth_user_company_ids()));

CREATE POLICY "billing staff and admins can manage products"
  ON products FOR ALL
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('admin','billing_staff')))
  WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('admin','billing_staff')));

CREATE POLICY "members can view invoice counters"
  ON invoice_counters FOR SELECT USING (company_id IN (SELECT auth_user_company_ids()));

CREATE POLICY "members can view invoices"
  ON invoices FOR SELECT USING (company_id IN (SELECT auth_user_company_ids()));

CREATE POLICY "billing staff and admins can manage invoices"
  ON invoices FOR ALL
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('admin','billing_staff')))
  WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('admin','billing_staff')));

CREATE POLICY "members can view invoice items"
  ON invoice_items FOR SELECT
  USING (invoice_id IN (SELECT id FROM invoices WHERE company_id IN (SELECT auth_user_company_ids())));

CREATE POLICY "billing staff and admins can manage invoice items"
  ON invoice_items FOR ALL
  USING (invoice_id IN (SELECT id FROM invoices WHERE company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('admin','billing_staff'))))
  WITH CHECK (invoice_id IN (SELECT id FROM invoices WHERE company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('admin','billing_staff'))));

CREATE POLICY "members can view payments"
  ON invoice_payments FOR SELECT USING (company_id IN (SELECT auth_user_company_ids()));

CREATE POLICY "billing staff and admins can record payments"
  ON invoice_payments FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role IN ('admin','billing_staff')));

CREATE POLICY "members can view their audit logs"
  ON audit_logs FOR SELECT USING (company_id IN (SELECT auth_user_company_ids()));

CREATE POLICY "authenticated users can insert audit logs"
  ON audit_logs FOR INSERT WITH CHECK (company_id IN (SELECT auth_user_company_ids()));

-- ======================== seed (dev data) ========================

INSERT INTO companies (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Prakash Furniture')
ON CONFLICT (id) DO NOTHING;

INSERT INTO company_settings (
  company_id, legal_name, display_name, address, mobile, email,
  gstin, pan, invoice_prefix, due_date_offset_days, state_code,
  terms_conditions, footer_text,
  bank_account_holder, bank_account_number, bank_name, bank_ifsc, bank_branch, upi_id
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Prakash Furniture Pvt. Ltd.', 'Prakash Furniture',
  '123, Furniture Market, Sector 5, Lucknow, Uttar Pradesh - 226001',
  '+91 98765 43210', 'billing@prakashfurniture.com',
  '09AAACP1234A1Z5', 'AAACP1234A', 'PP', 15, '09',
  E'1. Payment due within 15 days of invoice date.\n2. Goods once sold will not be taken back.\n3. Subject to Lucknow jurisdiction.',
  'This is a computer generated invoice.',
  'Prakash Furniture Pvt. Ltd.', '1234567890', 'State Bank of India',
  'SBIN0001234', 'Hazratganj Branch, Lucknow', 'prakashfurniture@upi'
) ON CONFLICT (company_id) DO NOTHING;

INSERT INTO products (id, company_id, name, sku, description, hsn_sac, unit, selling_price, tax_rate)
VALUES
  ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Wooden Study Table','WST-001','Solid sheesham wood study table with 2 drawers','94031090','Pcs',8500.00,18.00),
  ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Office Chair','OC-002','Ergonomic mesh back office chair with lumbar support','94013000','Pcs',5200.00,18.00),
  ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','3-Seater Sofa','SF-003','Premium fabric 3-seater sofa in grey colour','94016100','Set',22000.00,18.00),
  ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','Wooden Wardrobe','WW-004','4-door sliding wardrobe with mirror panel','94031090','Pcs',18500.00,18.00),
  ('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','Dining Table Set','DT-005','6-seater dining table set with chairs','94035010','Set',35000.00,12.00)
ON CONFLICT (company_id, sku) DO NOTHING;

INSERT INTO customers (id, company_id, name, gstin, mobile, email, billing_address, shipping_address)
VALUES
  ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Ramesh Kumar',NULL,'9876543210','ramesh.kumar@email.com','45, Gandhi Nagar, Lucknow, UP - 226002','45, Gandhi Nagar, Lucknow, UP - 226002'),
  ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Sunita Enterprises','09BBBCS5678B2Z4','9123456780','accounts@sunitaenterprises.com','Shop No. 12, Commercial Complex, Gomti Nagar, Lucknow - 226010','Warehouse, Industrial Area Phase 2, Lucknow - 226011'),
  ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Anil Interior Design','27CCCAI9012C3Z3','9012345678','anil@anilinteriors.com','78, MG Road, Mumbai, Maharashtra - 400001','78, MG Road, Mumbai, Maharashtra - 400001')
ON CONFLICT (id) DO NOTHING;
