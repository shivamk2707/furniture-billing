-- ============================================================
-- Development Seed Data
-- WARNING: This file is for LOCAL DEVELOPMENT only.
--          Never run against a production database.
--
-- Usage:
--   supabase db reset   (resets and applies all migrations + seed)
--   -- or --
--   psql <connection> -f supabase/seed.sql
--
-- The seed creates:
--   - 1 demo company ("Prakash Furniture")
--   - 1 admin user membership (user must already exist in auth.users
--     OR create via: supabase auth users create)
--   - Company settings matching the sample invoice image
--   - 5 sample products
--   - 3 sample customers
--   - 2 draft invoices with line items
-- ============================================================

BEGIN;

-- ----------------------------------------------------------------
-- 1. Demo company
-- ----------------------------------------------------------------
INSERT INTO companies (id, name)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Prakash Furniture'
)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------
-- 2. Company settings (matches sample invoice: PP prefix, UP state)
-- ----------------------------------------------------------------
INSERT INTO company_settings (
  company_id,
  legal_name,
  display_name,
  address,
  mobile,
  email,
  gstin,
  pan,
  invoice_prefix,
  due_date_offset_days,
  state_code,
  terms_conditions,
  footer_text,
  bank_account_holder,
  bank_account_number,
  bank_name,
  bank_ifsc,
  bank_branch,
  upi_id
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Prakash Furniture Pvt. Ltd.',
  'Prakash Furniture',
  '123, Furniture Market, Sector 5, Lucknow, Uttar Pradesh - 226001',
  '+91 98765 43210',
  'billing@prakashfurniture.com',
  '09AAACP1234A1Z5',   -- sample GSTIN (not real)
  'AAACP1234A',         -- sample PAN (not real)
  'PP',
  15,
  '09',                -- Uttar Pradesh state code
  E'1. Payment due within 15 days of invoice date.\n2. Goods once sold will not be taken back.\n3. Subject to Lucknow jurisdiction.',
  'This is a computer generated invoice.',
  'Prakash Furniture Pvt. Ltd.',
  '1234567890',
  'State Bank of India',
  'SBIN0001234',
  'Hazratganj Branch, Lucknow',
  'prakashfurniture@upi'
)
ON CONFLICT (company_id) DO NOTHING;

-- ----------------------------------------------------------------
-- 3. Sample products (furniture items)
-- ----------------------------------------------------------------
INSERT INTO products (id, company_id, name, sku, description, hsn_sac, unit, selling_price, tax_rate)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Wooden Study Table',
    'WST-001',
    'Solid sheesham wood study table with 2 drawers',
    '94031090',
    'Pcs',
    8500.00,
    18.00
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Office Chair',
    'OC-002',
    'Ergonomic mesh back office chair with lumbar support',
    '94013000',
    'Pcs',
    5200.00,
    18.00
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '3-Seater Sofa',
    'SF-003',
    'Premium fabric 3-seater sofa in grey colour',
    '94016100',
    'Set',
    22000.00,
    18.00
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'Wooden Wardrobe',
    'WW-004',
    '4-door sliding wardrobe with mirror panel',
    '94031090',
    'Pcs',
    18500.00,
    18.00
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'Dining Table Set',
    'DT-005',
    '6-seater dining table set with chairs',
    '94035010',
    'Set',
    35000.00,
    12.00
  )
ON CONFLICT (company_id, sku) DO NOTHING;

-- ----------------------------------------------------------------
-- 4. Sample customers
-- ----------------------------------------------------------------
INSERT INTO customers (id, company_id, name, gstin, mobile, email, billing_address, shipping_address)
VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Ramesh Kumar',
    NULL,
    '9876543210',
    'ramesh.kumar@email.com',
    '45, Gandhi Nagar, Lucknow, UP - 226002',
    '45, Gandhi Nagar, Lucknow, UP - 226002'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Sunita Enterprises',
    '09BBBCS5678B2Z4',
    '9123456780',
    'accounts@sunitaenterprises.com',
    'Shop No. 12, Commercial Complex, Gomti Nagar, Lucknow - 226010',
    'Warehouse, Industrial Area Phase 2, Lucknow - 226011'
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Anil Interior Design',
    '27CCCAI9012C3Z3',
    '9012345678',
    'anil@anilinteriors.com',
    '78, MG Road, Mumbai, Maharashtra - 400001',
    '78, MG Road, Mumbai, Maharashtra - 400001'
  )
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------
-- 5. Draft invoice 1 (intra-state: seller UP, buyer UP)
-- ----------------------------------------------------------------
INSERT INTO invoices (
  id, company_id, status,
  invoice_date, due_date,
  place_of_supply, is_inter_state, reverse_charge,
  customer_id, customer_name, customer_mobile,
  customer_billing_addr, customer_shipping_addr
)
VALUES (
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'draft',
  CURRENT_DATE,
  CURRENT_DATE + 15,
  '09',       -- UP = same as seller state → intra-state
  false,
  false,
  '20000000-0000-0000-0000-000000000001',
  'Ramesh Kumar',
  '9876543210',
  '45, Gandhi Nagar, Lucknow, UP - 226002',
  '45, Gandhi Nagar, Lucknow, UP - 226002'
)
ON CONFLICT (id) DO NOTHING;

-- Line items for draft invoice 1
INSERT INTO invoice_items (
  invoice_id, sort_order,
  product_id, description, hsn_sac, quantity, unit,
  unit_price, discount_type, discount_value, discount_amount,
  tax_rate, taxable_amount,
  cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
  line_total
)
VALUES
  (
    '30000000-0000-0000-0000-000000000001', 1,
    '10000000-0000-0000-0000-000000000001',
    'Solid sheesham wood study table with 2 drawers',
    '94031090', 2.000, 'Pcs',
    8500.00, 'amount', 500.00, 500.00,
    18.00, 16500.00,
    9.00, 1485.00, 9.00, 1485.00, 0.00, 0.00,
    19470.00
  ),
  (
    '30000000-0000-0000-0000-000000000001', 2,
    '10000000-0000-0000-0000-000000000002',
    'Ergonomic mesh back office chair with lumbar support',
    '94013000', 1.000, 'Pcs',
    5200.00, 'percent', 5.00, 260.00,
    18.00, 4940.00,
    9.00, 444.60, 9.00, 444.60, 0.00, 0.00,
    5829.20
  )
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------
-- 6. Draft invoice 2 (inter-state: seller UP, buyer Maharashtra)
-- ----------------------------------------------------------------
INSERT INTO invoices (
  id, company_id, status,
  invoice_date, due_date,
  place_of_supply, is_inter_state, reverse_charge,
  customer_id, customer_name, customer_gstin, customer_mobile,
  customer_billing_addr, customer_shipping_addr
)
VALUES (
  '30000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'draft',
  CURRENT_DATE,
  CURRENT_DATE + 15,
  '27',       -- Maharashtra → inter-state
  true,
  false,
  '20000000-0000-0000-0000-000000000003',
  'Anil Interior Design',
  '27CCCAI9012C3Z3',
  '9012345678',
  '78, MG Road, Mumbai, Maharashtra - 400001',
  '78, MG Road, Mumbai, Maharashtra - 400001'
)
ON CONFLICT (id) DO NOTHING;

-- Line items for draft invoice 2
INSERT INTO invoice_items (
  invoice_id, sort_order,
  product_id, description, hsn_sac, quantity, unit,
  unit_price, discount_type, discount_value, discount_amount,
  tax_rate, taxable_amount,
  cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
  line_total
)
VALUES (
  '30000000-0000-0000-0000-000000000002', 1,
  '10000000-0000-0000-0000-000000000005',
  '6-seater dining table set with chairs',
  '94035010', 1.000, 'Set',
  35000.00, 'amount', 1000.00, 1000.00,
  12.00, 34000.00,
  0.00, 0.00, 0.00, 0.00, 12.00, 4080.00,
  38080.00
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
