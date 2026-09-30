# Implementation Plan: Furniture Billing & Business Reporting Software

## Overview

Incremental implementation of the furniture billing system. Each task builds on the previous, ending with all components wired together. Testing tasks are placed immediately after the functionality they validate to catch errors early.

## Tasks

- [x] 1. Project setup and dependencies
  - Install and configure: `@supabase/supabase-js`, `@supabase/ssr`, `@react-pdf/renderer`, `react-hook-form`, `@hookform/resolvers`, `zod`, `fast-check`, `@tanstack/react-table`, `date-fns`, `qrcode`, `decimal.js`, `vitest`, `@playwright/test`
  - Configure TypeScript strict mode in `tsconfig.json`
  - Configure Vitest with `vitest.config.ts`
  - Set up `.env.local` template with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - Create `src/lib/supabase/client.ts` (browser client) and `src/lib/supabase/server.ts` (server client using cookies)
  - Create the base folder structure: `src/actions/`, `src/lib/`, `src/components/ui/`, `src/components/invoice/`
  - _Requirements: 1.10, 15.5_

- [x] 2. Database schema and migrations
  - [x] 2.1 Create Supabase migration `001_initial_schema.sql` with all 10 tables: `companies`, `company_members`, `company_settings`, `customers`, `products`, `invoice_counters`, `invoices`, `invoice_items`, `invoice_payments`, `audit_logs`
    - Use `NUMERIC(15,2)` for all currency columns, `NUMERIC(5,2)` for tax rates, `NUMERIC(15,3)` for quantities
    - Add all CHECK constraints, UNIQUE constraints, and foreign keys as specified in the design
    - _Requirements: 15.1, 15.2, 15.3_

  - [x] 2.2 Create migration `002_indexes.sql` with all performance indexes listed in the design
    - _Requirements: 15.8_

  - [x] 2.3 Create migration `003_invoice_number_function.sql` with the `generate_invoice_number()` stored function using `ON CONFLICT DO UPDATE` for race safety
    - _Requirements: 7.4, 15.6_

  - [x] 2.4 Create migration `004_rls_policies.sql` with Row Level Security policies for all company-owned tables
    - Policy pattern: `company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())`
    - _Requirements: 15.4_

  - [x] 2.5 Write integration test: verify RLS cross-company isolation — a user of Company A receives zero rows when querying Company B's invoices, customers, and products
    - **Property 10: RLS cross-company data isolation**
    - **Validates: Requirements 15.4**

  - [x] 2.6 Create `supabase/seed.sql` with sample company, admin user membership, 5 sample products, 3 sample customers, and 2 draft invoices for development
    - _Requirements: 15.5_

- [x] 3. Authentication
  - [x] 3.1 Create login page at `app/(auth)/login/page.tsx` with email/password form, React Hook Form + Zod validation, and Supabase `signInWithPassword`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 3.2 Create middleware `src/middleware.ts` that checks session for all `/(dashboard)/*` routes and redirects unauthenticated users to `/login`
    - _Requirements: 1.1_

  - [x] 3.3 Create `app/(dashboard)/layout.tsx` with sidebar navigation and role-aware menu items (Settings hidden for non-Admin, Create Invoice hidden for Viewer)
    - _Requirements: 1.5, 1.6, 1.7_

  - [x] 3.4 Implement server-side role check helper `lib/auth/require-role.ts` used by all Server Actions to enforce Admin/Billing_Staff/Viewer permissions
    - _Requirements: 1.5, 1.6, 1.7, 1.8_

  - [x] 3.5 Implement logout action and button in sidebar
    - _Requirements: 1.4_

- [x] 4. Company settings
  - [x] 4.1 Create `app/(dashboard)/settings/page.tsx` with a tabbed form for: Business Info, Bank Details, and Invoice Config
    - Use React Hook Form + Zod; include GSTIN pattern validation
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 4.2 Create `actions/settings.ts` with `saveCompanySettings` Server Action (Admin-only via role check helper)
    - _Requirements: 2.1, 2.3, 1.6_

  - [x] 4.3 Implement logo and signature image upload to Supabase Storage with signed URLs
    - _Requirements: 2.5, 2.6_

  - [x] 4.4 Write unit test: GSTIN regex validator accepts valid GSTINs and rejects invalid ones using fast-check property test
    - **Property 8: GSTIN validation**
    - **Validates: Requirements 2.7**

- [x] 5. Calculation engine and amount in words
  - [x] 5.1 Create `lib/calculation-engine.ts` implementing `calculateInvoice()` with `decimal.js` for all arithmetic
    - Handle both `amount` and `percent` discount types
    - Determine intra/inter-state and split CGST+SGST or apply IGST
    - Aggregate subtotal, total tax, grand total, optional round-off
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.11_

  - [x] 5.2 Create `lib/amount-in-words.ts` implementing `amountToWords()` for Indian English number-to-words conversion
    - Handle lakhs and crores correctly; output format "Rupees X Only"
    - _Requirements: 6.10_

  - [x] 5.3 Write property test for line item calculation pipeline using fast-check
    - Generate random valid line item inputs; verify all 5 derived values simultaneously
    - **Property 1: Line item calculation pipeline**
    - **Validates: Requirements 6.1, 6.2, 6.4, 6.5**

  - [x] 5.4 Write property test for invoice aggregate totals using fast-check
    - Generate 1–20 random line items; verify subtotal, totalTax, grandTotal
    - **Property 2: Invoice aggregate totals**
    - **Validates: Requirements 6.6, 6.7, 6.8**

  - [x] 5.5 Write property test for tax mode determination using fast-check
    - Generate random state codes; verify CGST/SGST vs IGST assignment and that amounts sum to taxAmount
    - **Property 3: Tax mode determination**
    - **Validates: Requirements 6.3, 8.5**

  - [x] 5.6 Write property test for amount in words using fast-check
    - Generate integers 0–9,999,999; verify output starts with "Rupees", ends with "Only", no double spaces
    - **Property 4: Amount in words format**
    - **Validates: Requirements 6.10**

- [x] 6. Product management
  - [x] 6.1 Create `app/(dashboard)/products/page.tsx` with paginated product table using `@tanstack/react-table`, search by name/SKU, and archive action
    - _Requirements: 3.6, 3.7_

  - [x] 6.2 Create product create/edit form (modal or drawer) with Zod schema validation
    - Fields: name, SKU, description, HSN/SAC, unit, price, tax rate
    - _Requirements: 3.1, 3.3_

  - [x] 6.3 Create `actions/products.ts` with `upsertProduct` (Admin/Billing_Staff) and `archiveProduct` (Admin) Server Actions
    - _Requirements: 3.1, 3.3, 3.4_

  - [x] 6.4 Write integration test: attempting to insert two products with the same SKU for the same company is rejected by the database unique constraint
    - **Property 9: SKU uniqueness per company**
    - **Validates: Requirements 3.2**

- [x] 7. Customer management
  - [x] 7.1 Create `app/(dashboard)/customers/page.tsx` with paginated customer table, search by name/mobile/GSTIN, and archive action
    - _Requirements: 4.5_

  - [x] 7.2 Create customer create/edit form with Zod schema validation
    - Fields: name, GSTIN, PAN, mobile, email, billing address, shipping address
    - _Requirements: 4.1, 4.2_

  - [x] 7.3 Create `actions/customers.ts` with `upsertCustomer` and `archiveCustomer` Server Actions
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 8. Invoice template component
  - [x] 8.1 Create `components/invoice/invoice-template.tsx` — the single shared template used for both browser preview and PDF
    - Implement all 10 sections from the reference image in order
    - Accept an `InvoiceData` prop interface containing all snapshot fields, line items, and calculated totals
    - Use inline styles compatible with both React DOM and `@react-pdf/renderer` (no Tailwind inside the template)
    - Match column proportions from the design document
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.9_

  - [x] 8.2 Implement conditional tax row rendering in Section 7: show CGST+SGST rows for intra-state, IGST row for inter-state
    - _Requirements: 8.5, 6.3_

  - [x] 8.3 Implement multi-page support: when line items overflow, add new A4 page with repeated table header and page numbering
    - _Requirements: 8.10, 9.5_

  - [x] 8.4 Implement QR code generation for bank payment using `qrcode` library with UPI deep link payload from company settings
    - _Requirements: 8.8_

- [x] 9. PDF generation service
  - [x] 9.1 Create `app/api/pdf/[id]/route.ts` — a GET route handler that:
    - Authenticates the request and verifies company membership
    - Fetches the invoice and its items from the database by ID
    - Renders the invoice using `@react-pdf/renderer` with the shared `InvoiceTemplate`
    - Returns the PDF as a `application/pdf` response stream
    - Returns HTTP 404 if invoice not found, HTTP 403 if unauthorized
    - _Requirements: 9.1, 9.2, 9.4, 9.6_

  - [x] 9.2 Write PDF generation test: generate a PDF for a sample invoice and verify A4 dimensions and that all 10 section labels are present
    - **Validates: Requirements 9.1, 9.2, 9.7**

- [ ] 10. Invoice editor and draft management
  - [x] 10.1 Create `components/invoice/invoice-editor.tsx` with split layout: form on the left, scaled A4 preview on the right using `InvoicePreview` (wrapper around `InvoiceTemplate`)
    - _Requirements: 5.1_

  - [x] 10.2 Implement `components/invoice/customer-selector.tsx` — combobox to search and select existing customers or add a new one inline
    - _Requirements: 5.2, 4.6_

  - [x] 10.3 Implement invoice header form section: invoice date, due date, place of supply, reverse charge toggle, and optional transport fields
    - _Requirements: 5.3, 5.4, 5.5_

  - [x] 10.4 Implement `components/invoice/line-item-table.tsx` — dynamic rows with product search, auto-populate, quantity/price/discount/tax inputs
    - On any field change, call `calculateInvoice()` client-side and update the live preview
    - _Requirements: 5.6, 5.7, 5.9_

  - [x] 10.5 Create `app/(dashboard)/invoices/new/page.tsx` wiring the editor, auto-save to draft via `saveDraftInvoice` Server Action on significant changes
    - _Requirements: 5.10, 5.11_

  - [x] 10.6 Create `actions/invoices.ts` with `saveDraftInvoice` Server Action that creates or updates the draft invoice and line items in the database
    - _Requirements: 5.10, 5.12_

  - [x] 10.7 Implement "Issue Invoice" button: disabled when no line items; on click calls `issueInvoice` Server Action
    - _Requirements: 5.12, 7.1, 7.2_

- [x] 11. Invoice issue transaction
  - [x] 11.1 Implement `issueInvoice` Server Action in `actions/invoices.ts`:
    - Validate all required fields using Zod
    - Re-execute `calculateInvoice()` server-side from stored line items
    - Call `generate_invoice_number()` stored function
    - Write seller snapshot, customer snapshot, line item snapshots, and totals atomically
    - Set status to `"issued"`, record `issued_at` and `issued_by`
    - Insert audit log entry
    - Return success with the new invoice ID
    - _Requirements: 7.1, 7.2, 7.3, 6.12_

  - [x] 11.2 Implement idempotency check: before executing the issue transaction, verify the draft has not already been issued
    - _Requirements: 7.8_

  - [x] 11.3 Write integration test: concurrent issue requests for the same invoice ID produce exactly one issued invoice and one unique invoice number
    - **Property 11: Invoice number uniqueness under concurrency**
    - **Validates: Requirements 7.4, 15.6**

  - [x] 11.4 Write integration test: verify stored grand_total equals sum of stored line_total values after issue
    - **Property 5: Invoice total consistency (calculation ↔ database)**
    - **Validates: Requirements 6.13, 15.9**

- [x] 12. Invoice history and detail pages
  - [x] 12.1 Create `app/(dashboard)/invoices/page.tsx` with a paginated, searchable, sortable invoice table using `@tanstack/react-table`
    - Columns: Invoice Number, Date, Customer Name, Customer Phone, Total, Amount Paid, Balance Due, Payment Status, Status, Actions
    - Support search by invoice number, customer name, phone; filter by date range, status, payment status
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 12.2 Create `app/(dashboard)/invoices/[id]/page.tsx` showing full invoice details with all sections, and action buttons: Download PDF, Print, Record Payment, Void (Admin only)
    - _Requirements: 10.6, 10.7, 14.5_

  - [x] 12.3 Implement void invoice action in `actions/invoices.ts`: Admin-only, sets status=void, records reason, inserts audit log
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [x] 13. Checkpoint — Ensure all tests pass
  - Run `vitest --run` for all unit and property tests
  - Manually verify: login → create product → create customer → create invoice → issue → view in history → download PDF
  - Fix any failing tests or functional issues before proceeding

- [x] 14. Payment tracking
  - [x] 14.1 Create `components/invoice/payment-modal.tsx` with form: payment date, amount, mode (dropdown), reference number, notes
    - Validate amount does not exceed balance due
    - _Requirements: 11.1, 11.7_

  - [x] 14.2 Create `actions/payments.ts` with `recordPayment` Server Action:
    - Validate payment amount does not cause overpayment
    - Insert `invoice_payments` row
    - Update `invoices.amount_paid`, `balance_due`, and `payment_status` fields
    - _Requirements: 11.1, 11.2, 11.3, 11.7_

  - [x] 14.3 Write property test for payment balance and status logic using fast-check
    - Generate random grand totals and series of payments; verify amount_paid, balance_due, and payment_status are always consistent
    - **Property 7: Payment balance and status**
    - **Validates: Requirements 11.2, 11.3, 11.4, 11.5, 11.6, 11.7**

- [ ] 15. Snapshot immutability tests
  - [x] 15.1 Write integration test: after issuing an invoice and then updating the customer's name and address, re-fetching the invoice returns the original snapshot values
    - After issuing an invoice and then updating the product's price and tax rate, re-fetching the invoice items returns the original snapshot values
    - **Property 6: Snapshot immutability after post-issue edits**
    - **Validates: Requirements 3.8, 4.7**

- [x] 16. Dashboard
  - [x] 16.1 Create `app/(dashboard)/page.tsx` with KPI cards: Total Sales, Invoice Count, Total Tax, Amount Received, Outstanding Balance for selected period
    - Use Supabase aggregate queries, exclude voided invoices
    - Default date range: current financial year
    - _Requirements: 12.1, 12.2, 12.5, 12.6_

  - [x] 16.2 Add recent invoices list (5 most recent) and "Create Invoice" quick action button to dashboard
    - _Requirements: 12.3, 12.4_

- [ ] 17. Reports
  - [x] 17.1 Create `app/(dashboard)/reports/page.tsx` with Date-wise Sales Summary table (date, invoice count, taxable sales, CGST, SGST, IGST, gross sales)
    - Support date-range filter; exclude voided invoices
    - _Requirements: 13.1, 13.3, 13.4, 13.5_

  - [x] 17.2 Add Customer-wise Sales Summary tab to the reports page
    - _Requirements: 13.2_

  - [x] 17.3 Implement CSV export for both report types
    - _Requirements: 13.6_

- [ ] 18. End-to-end tests
  - [x] 18.1 Write Playwright E2E test: full invoice lifecycle — login → create customer → create product → create draft invoice with 3 products → verify calculated totals → issue invoice → download PDF → verify invoice appears in history
    - **Validates: Requirements 5.x, 6.x, 7.x, 9.x, 10.x**

  - [x] 18.2 Write Playwright E2E test: authorization boundaries — Viewer cannot access /invoices/new; Billing_Staff cannot access /settings; cross-company URL access returns 403
    - **Validates: Requirements 1.5, 1.6, 1.7, 15.4**

  - [x] 18.3 Write Playwright E2E test: payment recording — record a partial payment on an issued invoice, verify status changes to "Partially Paid", record remaining balance, verify status changes to "Paid"
    - **Validates: Requirements 11.x**

- [ ] 19. Final checkpoint — Ensure all tests pass
  - Run `vitest --run` (all unit, property, and integration tests)
  - Run `playwright test` (all E2E tests)
  - Verify PDF generation and A4 print layout manually
  - Verify all 11 correctness properties have a corresponding passing test
  - Fix all critical failures before declaring completion

## Notes

- All tasks are required — tests are placed immediately after the functionality they validate
- All tasks reference specific requirements for traceability
- Checkpoints at tasks 13 and 19 ensure incremental validation
- The `InvoiceTemplate` component (task 8) is the foundation for both preview and PDF — it must be completed before tasks 9, 10, and 11
- Property-based tests use `fast-check` with a minimum of 100 iterations per property
- Integration tests requiring a Supabase instance should use a separate test database configured via `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY` environment variables
