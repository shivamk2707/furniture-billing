-- ============================================================
-- Migration: 002_indexes
-- Description: Performance indexes for all company-owned tables
-- ============================================================

-- Invoices
CREATE INDEX idx_invoices_company_id   ON invoices (company_id);
CREATE INDEX idx_invoices_customer_id  ON invoices (customer_id);
CREATE INDEX idx_invoices_status       ON invoices (status);
CREATE INDEX idx_invoices_invoice_date ON invoices (invoice_date);
CREATE INDEX idx_invoices_payment_status ON invoices (payment_status);

-- Composite index for the most common history query:
-- company + date range + status filter
CREATE INDEX idx_invoices_company_date ON invoices (company_id, invoice_date DESC);

-- Invoice items
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items (invoice_id);

-- Invoice payments
CREATE INDEX idx_invoice_payments_invoice_id ON invoice_payments (invoice_id);
CREATE INDEX idx_invoice_payments_company_id ON invoice_payments (company_id);

-- Customers
CREATE INDEX idx_customers_company_id ON customers (company_id);
CREATE INDEX idx_customers_company_name ON customers (company_id, name);

-- Products
CREATE INDEX idx_products_company_id  ON products (company_id);
CREATE INDEX idx_products_company_sku ON products (company_id, sku);

-- Company members — used in every RLS policy check
CREATE INDEX idx_company_members_user_id    ON company_members (user_id);
CREATE INDEX idx_company_members_company_id ON company_members (company_id);

-- Audit logs
CREATE INDEX idx_audit_logs_company_id  ON audit_logs (company_id);
CREATE INDEX idx_audit_logs_entity      ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at  ON audit_logs (created_at DESC);
