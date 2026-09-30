-- ============================================================
-- Migration: 003_invoice_number_function
-- Description: Atomic, race-safe invoice number generation.
--
-- Uses INSERT … ON CONFLICT DO UPDATE with RETURNING to
-- atomically increment the per-company, per-financial-year
-- counter in a single statement. Because PostgreSQL evaluates
-- the DO UPDATE atomically under a row-level lock, concurrent
-- calls will serialize naturally — no explicit FOR UPDATE needed.
-- ============================================================

CREATE OR REPLACE FUNCTION generate_invoice_number(
  p_company_id    UUID,
  p_prefix        TEXT,
  p_financial_year TEXT   -- e.g. '25-26'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER  -- runs with owner privileges so RLS does not block it
AS $$
DECLARE
  v_seq    INT;
  v_number TEXT;
BEGIN
  -- Atomically insert or increment the counter row and get the new sequence
  INSERT INTO invoice_counters (company_id, financial_year, current_seq)
  VALUES (p_company_id, p_financial_year, 1)
  ON CONFLICT (company_id, financial_year)
  DO UPDATE
    SET current_seq = invoice_counters.current_seq + 1
  RETURNING current_seq INTO v_seq;

  -- Format: PREFIX/001/25-26
  v_number := p_prefix
    || '/'
    || LPAD(v_seq::TEXT, 3, '0')
    || '/'
    || p_financial_year;

  RETURN v_number;
END;
$$;

-- Revoke direct public execution; only the service role (via Server Actions)
-- or other SECURITY DEFINER functions should call this.
REVOKE ALL ON FUNCTION generate_invoice_number(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_invoice_number(UUID, TEXT, TEXT)
  TO service_role;
