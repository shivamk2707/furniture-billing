-- ============================================================
-- Migration: 004_rls_policies
-- Description: Row Level Security for all company-owned tables.
--
-- Access pattern: a user can only see/modify rows for companies
-- they belong to, as recorded in company_members.
--
-- Helper: we create an immutable security-definer function
-- to look up the caller's company IDs so the subquery is
-- evaluated once per statement rather than once per row.
-- ============================================================

-- ----------------------------------------------------------------
-- Helper function: returns the set of company IDs the current
-- authenticated user belongs to. SECURITY DEFINER bypasses RLS
-- on company_members itself (avoids recursive policy evaluation).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth_user_company_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT company_id
  FROM company_members
  WHERE user_id = auth.uid();
$$;

-- ----------------------------------------------------------------
-- Enable RLS on every company-scoped table
-- ----------------------------------------------------------------
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

-- ----------------------------------------------------------------
-- companies
-- Users can read any company they belong to.
-- Only admins can update their company row (handled in app layer;
-- RLS just ensures cross-company reads are blocked).
-- ----------------------------------------------------------------
CREATE POLICY "members can view their company"
  ON companies FOR SELECT
  USING (id IN (SELECT auth_user_company_ids()));

-- ----------------------------------------------------------------
-- company_members
-- Users can see the membership rows for their own companies.
-- Inserts/deletes are handled by the service role (admin actions).
-- ----------------------------------------------------------------
CREATE POLICY "members can view company members"
  ON company_members FOR SELECT
  USING (company_id IN (SELECT auth_user_company_ids()));

-- ----------------------------------------------------------------
-- company_settings
-- ----------------------------------------------------------------
CREATE POLICY "members can view company settings"
  ON company_settings FOR SELECT
  USING (company_id IN (SELECT auth_user_company_ids()));

CREATE POLICY "admins can upsert company settings"
  ON company_settings FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ----------------------------------------------------------------
-- customers
-- ----------------------------------------------------------------
CREATE POLICY "members can view customers"
  ON customers FOR SELECT
  USING (company_id IN (SELECT auth_user_company_ids()));

CREATE POLICY "billing staff and admins can manage customers"
  ON customers FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'billing_staff')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'billing_staff')
    )
  );

-- ----------------------------------------------------------------
-- products
-- ----------------------------------------------------------------
CREATE POLICY "members can view products"
  ON products FOR SELECT
  USING (company_id IN (SELECT auth_user_company_ids()));

CREATE POLICY "billing staff and admins can manage products"
  ON products FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'billing_staff')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'billing_staff')
    )
  );

-- ----------------------------------------------------------------
-- invoice_counters (managed only by the stored function)
-- Direct access requires service_role; anon/authenticated cannot
-- modify counters directly — all mutations go through
-- generate_invoice_number() which runs as SECURITY DEFINER.
-- ----------------------------------------------------------------
CREATE POLICY "members can view invoice counters"
  ON invoice_counters FOR SELECT
  USING (company_id IN (SELECT auth_user_company_ids()));

-- ----------------------------------------------------------------
-- invoices
-- ----------------------------------------------------------------
CREATE POLICY "members can view invoices"
  ON invoices FOR SELECT
  USING (company_id IN (SELECT auth_user_company_ids()));

CREATE POLICY "billing staff and admins can manage invoices"
  ON invoices FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'billing_staff')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'billing_staff')
    )
  );

-- ----------------------------------------------------------------
-- invoice_items (access derived via invoices)
-- ----------------------------------------------------------------
CREATE POLICY "members can view invoice items"
  ON invoice_items FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE company_id IN (SELECT auth_user_company_ids())
    )
  );

CREATE POLICY "billing staff and admins can manage invoice items"
  ON invoice_items FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE company_id IN (
        SELECT company_id FROM company_members
        WHERE user_id = auth.uid() AND role IN ('admin', 'billing_staff')
      )
    )
  )
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE company_id IN (
        SELECT company_id FROM company_members
        WHERE user_id = auth.uid() AND role IN ('admin', 'billing_staff')
      )
    )
  );

-- ----------------------------------------------------------------
-- invoice_payments
-- ----------------------------------------------------------------
CREATE POLICY "members can view payments"
  ON invoice_payments FOR SELECT
  USING (company_id IN (SELECT auth_user_company_ids()));

CREATE POLICY "billing staff and admins can record payments"
  ON invoice_payments FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'billing_staff')
    )
  );

-- ----------------------------------------------------------------
-- audit_logs (insert-only for authenticated users; no updates/deletes)
-- ----------------------------------------------------------------
CREATE POLICY "members can view their audit logs"
  ON audit_logs FOR SELECT
  USING (company_id IN (SELECT auth_user_company_ids()));

CREATE POLICY "authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));
