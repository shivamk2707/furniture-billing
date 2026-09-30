# Requirements Document

## Introduction

A complete web-based furniture billing system built with Next.js, Supabase, and A4 PDF invoice generation. The application allows authorized staff to manage products and customers, create GST-compliant invoices with automatic calculations, generate pixel-accurate A4 PDF invoices matching the supplied reference layout, and view invoice history and sales reports. All data is stored in Supabase PostgreSQL with Row Level Security ensuring company-level data isolation.

### Design Decisions & Defaults

The following defaults are used where explicit business decisions were not provided:

- **Tax Mode**: Both CGST+SGST (intra-state) and IGST (inter-state) are supported. The system automatically selects the tax mode based on whether the Place of Supply state matches the seller's registered state.
- **Discount Type**: Line items support both fixed amount (₹) and percentage (%) discounts, selectable per line item with a toggle.
- **Invoice Numbering**: The prefix (e.g., `PP`) is configurable per company. Numbering resets each financial year (April–March). Format: `{PREFIX}/{SEQUENCE}/{FY}` e.g., `PP/001/25-26`.
- **PDF Renderer**: `@react-pdf/renderer` (pure JS, works on Vercel/serverless) is used for PDF generation. If Playwright is required, it must be deployed to a Node.js server environment.
- **Payment Tracking**: Included in MVP — basic payment recording with amount, mode, and date. Full payment history timeline is a future enhancement.

---

## Glossary

- **Company**: The furniture business using this application; all data is scoped to a company.
- **Company_Member**: A user who belongs to a company with a specific role.
- **Admin**: Company owner or administrator with full access.
- **Billing_Staff**: Staff who can create and issue invoices.
- **Viewer**: Read-only access to invoices and reports.
- **Invoice**: A GST-compliant tax invoice document issued to a customer.
- **Draft_Invoice**: An invoice in progress that has not been issued; fully editable.
- **Issued_Invoice**: A finalized, immutable invoice with a unique invoice number.
- **Line_Item**: A single product row within an invoice with quantity, price, discount, and tax.
- **Snapshot**: An immutable copy of seller, buyer, and product data captured at invoice issue time.
- **Calculation_Engine**: The server-side module that performs all financial calculations.
- **PDF_Service**: The server-side service that renders invoice data into an A4 PDF document.
- **HSN/SAC**: Harmonized System of Nomenclature / Service Accounting Code — the GST product classification code.
- **GSTIN**: Goods and Services Tax Identification Number.
- **CGST/SGST**: Central/State GST applied on intra-state transactions.
- **IGST**: Integrated GST applied on inter-state transactions.
- **Place_of_Supply**: The state where the supply is deemed to occur for GST purposes.
- **IRN**: Invoice Reference Number — a government-issued e-invoice identifier.
- **E-Way Bill**: Electronic way bill for goods transportation above a threshold value.
- **Financial_Year**: April 1 to March 31 in India.
- **RLS**: Row Level Security — Supabase/PostgreSQL feature ensuring data isolation.

---

## Requirements

### Requirement 1: Authentication and Authorization

**User Story:** As a business owner, I want secure login and role-based access control, so that only authorized users can access and modify business data.

#### Acceptance Criteria

1. WHEN a user visits a protected route without an active session, THE System SHALL redirect the user to the login page.
2. WHEN a user submits valid credentials, THE Auth_Service SHALL create a session and redirect the user to the dashboard.
3. IF a user submits invalid credentials, THEN THE Auth_Service SHALL display a descriptive error message and not create a session.
4. WHEN a user logs out, THE Auth_Service SHALL invalidate the session and redirect to the login page.
5. THE System SHALL enforce three roles: Admin, Billing_Staff, and Viewer, each with distinct permissions.
6. WHEN a Billing_Staff user attempts to access company settings, THE System SHALL deny access and return an unauthorized response.
7. WHEN a Viewer user attempts to create or modify an invoice, THE System SHALL deny access and return an unauthorized response.
8. THE System SHALL enforce all role permissions in server-side logic and RLS policies, not only in the UI.
9. WHEN a user belongs to multiple companies, THE System SHALL allow the user to switch between companies within their session.
10. THE System SHALL never expose the Supabase service-role key in client-side code or API responses.

---

### Requirement 2: Company Settings

**User Story:** As an Admin, I want to configure all company and invoice settings, so that invoices are populated with accurate business information.

#### Acceptance Criteria

1. THE Company_Settings_Module SHALL allow an Admin to save and update: company name, display name, address, mobile, email, GSTIN, PAN, and logo.
2. THE Company_Settings_Module SHALL allow an Admin to save and update bank details: account holder name, account number, bank name, IFSC, and branch.
3. THE Company_Settings_Module SHALL allow an Admin to configure invoice settings: prefix, numbering format, financial year reset, default due date offset (days), default tax mode, and terms and conditions text.
4. WHEN company settings are missing required fields and a user attempts to create an invoice, THE System SHALL display a warning and link to company settings.
5. THE Company_Settings_Module SHALL allow an Admin to upload and store a company logo image.
6. THE Company_Settings_Module SHALL allow an Admin to upload an authorized signatory image or signature.
7. WHEN company settings are saved, THE System SHALL validate that the GSTIN format matches the pattern `[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]`.
8. THE Company_Settings_Module SHALL allow an Admin to configure QR code settings for bank payment (UPI/VPA).

---

### Requirement 3: Product Management

**User Story:** As an Admin or Billing_Staff, I want to manage a product catalogue, so that products can be quickly selected when creating invoices.

#### Acceptance Criteria

1. THE Product_Module SHALL allow authorized users to create a product with: name, SKU, description, HSN/SAC code, unit, selling price, and tax rate.
2. WHEN a user attempts to create a product with a duplicate SKU within the same company, THE Product_Module SHALL reject the creation and display a descriptive error.
3. THE Product_Module SHALL allow authorized users to edit all product fields.
4. THE Product_Module SHALL allow authorized users to archive (soft-delete) a product, making it unavailable for new invoices while preserving historical records.
5. WHEN a product is selected in the invoice editor, THE Calculation_Engine SHALL auto-populate description, HSN/SAC, unit, price, and default tax rate from the product record.
6. THE Product_Module SHALL support searching products by name and SKU with results appearing within 500ms of input.
7. THE Product_Module SHALL display products in a paginated table with at least 20 rows per page.
8. WHEN a product price or tax rate is edited after an invoice is issued, THE issued invoice's line item values SHALL remain unchanged.

---

### Requirement 4: Customer Management

**User Story:** As an Admin or Billing_Staff, I want to manage a customer directory, so that customer details can be quickly selected when creating invoices.

#### Acceptance Criteria

1. THE Customer_Module SHALL allow authorized users to create a customer with: name, GSTIN, PAN, mobile, email, billing address, and shipping address.
2. THE Customer_Module SHALL allow authorized users to edit all customer fields.
3. THE Customer_Module SHALL allow authorized users to archive a customer, preserving historical invoice records.
4. WHEN a customer is selected in the invoice editor, THE Invoice_Editor SHALL auto-populate billing and shipping details from the customer record.
5. THE Customer_Module SHALL support searching customers by name, mobile, and GSTIN.
6. WHEN a customer is added from the invoice creation screen, THE Customer_Module SHALL save the customer record and immediately populate the invoice with their details.
7. WHEN a customer's details are edited after an invoice is issued, THE issued invoice's customer snapshot SHALL remain unchanged.

---

### Requirement 5: Invoice Creation — Draft Management

**User Story:** As a Billing_Staff or Admin, I want to create and edit draft invoices, so that I can build an invoice before finalizing it.

#### Acceptance Criteria

1. WHEN an authorized user initiates invoice creation, THE Invoice_Editor SHALL create a new draft invoice and present the invoice form alongside a live A4 preview.
2. THE Invoice_Editor SHALL allow the user to select an existing customer or add a new customer inline.
3. THE Invoice_Editor SHALL allow the user to set: invoice date, due date, place of supply, and reverse charge flag.
4. THE Invoice_Editor SHALL allow the user to optionally populate transport fields: transporter name, vehicle number, transport document number, transport document date, E-Way Bill number, and E-Way Bill date.
5. THE Invoice_Editor SHALL allow the user to optionally populate e-invoice fields: IRN, acknowledgment number, and acknowledgment date.
6. THE Invoice_Editor SHALL allow the user to add multiple product line items dynamically.
7. WHEN a line item is added, THE Invoice_Editor SHALL allow the user to enter or modify: description, HSN/SAC, quantity, unit, unit price, discount type (₹ or %), discount value, and tax rate.
8. THE Invoice_Editor SHALL allow the user to remove any line item from a draft invoice.
9. WHEN any line item field changes, THE Invoice_Editor SHALL recalculate and display updated totals in the live preview within 200ms.
10. THE Invoice_Editor SHALL persist draft invoice state to the database on each meaningful change so that drafts survive page refresh.
11. THE Invoice_Editor SHALL allow the user to save a draft explicitly without issuing it.
12. WHILE a draft invoice has no line items, THE Invoice_Editor SHALL disable the Issue Invoice action and display an explanatory message.

---

### Requirement 6: Invoice Calculations

**User Story:** As a Billing_Staff or Admin, I want all invoice calculations to be accurate and automatic, so that I never have to compute totals manually.

#### Acceptance Criteria

1. FOR each line item, THE Calculation_Engine SHALL compute: Gross Amount = Quantity × Unit Price.
2. FOR each line item, THE Calculation_Engine SHALL compute: Taxable Amount = Gross Amount − Discount (supporting both ₹ and % discount).
3. FOR each line item, THE Calculation_Engine SHALL determine the tax mode: WHEN Place of Supply state equals the company's registered state, THE Calculation_Engine SHALL split the tax as CGST + SGST (each at Tax Rate / 2); OTHERWISE THE Calculation_Engine SHALL apply IGST at the full tax rate.
4. FOR each line item, THE Calculation_Engine SHALL compute: Tax Amount = Taxable Amount × Applicable Tax Rate.
5. FOR each line item, THE Calculation_Engine SHALL compute: Line Total = Taxable Amount + Tax Amount.
6. THE Calculation_Engine SHALL compute: Invoice Subtotal = Sum of all line Taxable Amounts.
7. THE Calculation_Engine SHALL compute: Total Tax = Sum of all line Tax Amounts.
8. THE Calculation_Engine SHALL compute: Grand Total = Invoice Subtotal + Total Tax + any additional charges − any round-off adjustment.
9. THE Calculation_Engine SHALL compute: Balance Due = Grand Total − Amount Paid.
10. THE Calculation_Engine SHALL convert the Grand Total to a correctly formatted Indian-English amount in words (e.g., "Rupees Twelve Thousand Five Hundred and Forty Only").
11. THE Calculation_Engine SHALL use decimal arithmetic with at least 2 decimal places of precision throughout all calculations to prevent floating-point rounding errors.
12. WHEN an invoice is issued, THE Calculation_Engine SHALL re-execute all calculations server-side from the stored line items; browser-submitted totals SHALL NOT be trusted.
13. FOR ALL valid line items with valid inputs, THE Calculation_Engine SHALL produce a Grand Total equal to the sum of all Line Totals (verifiable by re-computation).

---

### Requirement 7: Invoice Issue Workflow

**User Story:** As a Billing_Staff or Admin, I want to issue a finalized invoice, so that it is saved permanently and a unique invoice number is assigned.

#### Acceptance Criteria

1. WHEN an authorized user triggers "Issue Invoice", THE System SHALL validate all required fields before proceeding.
2. IF required fields are missing or invalid, THEN THE System SHALL display field-level validation errors and not proceed with issuing.
3. WHEN all validations pass, THE System SHALL execute an atomic database transaction that: assigns a unique sequential invoice number, saves seller and buyer detail snapshots, saves all line item snapshots with calculated values, saves final calculated totals, records the issue timestamp and issuing user ID, and sets the invoice status to "Issued".
4. THE Invoice_Counter service SHALL use a database-level lock or serializable transaction to prevent duplicate invoice numbers during concurrent requests.
5. WHEN an invoice is successfully issued, THE System SHALL display a success confirmation and offer actions to download PDF and view the invoice.
6. WHEN a user attempts to edit an issued invoice, THE System SHALL reject the edit and explain that issued invoices are immutable.
7. IF the issue transaction fails for any reason, THEN THE System SHALL leave the draft in its prior state and display a descriptive error without creating a partial invoice record.
8. THE System SHALL implement idempotency: IF the same issue request is retried (e.g., network timeout then retry), THEN THE System SHALL not create a duplicate invoice.

---

### Requirement 8: Invoice Template — Exact Layout Reproduction

**User Story:** As a business owner, I want the invoice to exactly match the supplied reference image, so that it looks professional and consistent with our existing documents.

#### Acceptance Criteria

1. THE Invoice_Template SHALL reproduce all 10 sections from the reference image in the correct order: Top Header Strip, Seller/Company Header, Invoice and Transport Details, Billing and Shipping Details, IRN/Acknowledgment Strip, Product Table, Discount and Total Rows, Amount in Words and Payment Summary, Bottom Footer Panels, and Bottom Footer Line.
2. THE Invoice_Template SHALL use A4 portrait dimensions (210 × 297 mm) with thin gray outer and inner borders matching the reference.
3. THE Invoice_Template SHALL display the seller information from company settings in Section 2, never hardcoded values.
4. THE Invoice_Template SHALL display the product table with columns: Sr., Item Description, HSN/SAC, Qty, Unit, List Price, Disc., Tax %, and Amount (₹) in the exact proportions shown in the reference.
5. THE Invoice_Template SHALL display CGST and SGST as separate rows (each at half the tax rate) for intra-state invoices, and IGST as a single row for inter-state invoices.
6. THE Invoice_Template SHALL display the Grand Total in Indian number formatting (e.g., ₹1,23,456.78).
7. THE Invoice_Template SHALL display the amount in words below the total summary section.
8. THE Invoice_Template SHALL render the bottom footer with four panels: Terms and Conditions, Bank Details with QR code, E-Invoice QR code placeholder, and Authorized Signatory area.
9. WHEN the invoice preview is rendered in the browser, THE Invoice_Template SHALL use the identical layout and calculations as the generated PDF.
10. THE Invoice_Template SHALL support continuation pages: WHEN the number of line items exceeds the available space, THE Invoice_Template SHALL add a new A4 page with the table header repeated and correct page numbers (e.g., "Page 1 of 2").

---

### Requirement 9: A4 PDF Generation

**User Story:** As a Billing_Staff or Admin, I want to download and print an A4 PDF of any issued invoice, so that I can share it with customers.

#### Acceptance Criteria

1. WHEN a user requests a PDF for an issued invoice, THE PDF_Service SHALL generate a PDF from the saved invoice snapshot data, not from current product or customer records.
2. THE PDF_Service SHALL produce an A4 portrait PDF (210 × 297 mm) that faithfully renders the invoice template.
3. THE PDF_Service SHALL complete PDF generation and return the download within 10 seconds for an invoice with up to 20 line items.
4. IF PDF generation fails, THEN THE System SHALL display a retry action and SHALL NOT change the invoice's issued status.
5. THE PDF_Service SHALL support multi-page rendering with repeated table headers when line items overflow a single page.
6. THE generated PDF SHALL be downloadable by the user as a named file (e.g., `INV-PP-001-25-26.pdf`).
7. WHEN printed at 100% scale on A4 paper, THE generated PDF SHALL render all content within the printable area with no clipping.
8. THE System SHALL NOT store every generated PDF in Supabase Storage by default; PDFs SHALL be generated on demand from saved invoice data.

---

### Requirement 10: Invoice History

**User Story:** As any authorized user, I want to browse, search, and filter all issued invoices, so that I can quickly find and retrieve past invoices.

#### Acceptance Criteria

1. THE Invoice_History_Page SHALL display all invoices for the current company in a paginated table with at least 20 rows per page.
2. THE Invoice_History_Page SHALL show columns: Invoice Number, Invoice Date, Customer Name, Customer Phone, Total Amount, Amount Paid, Balance Due, Payment Status, Invoice Status, and Actions.
3. THE Invoice_History_Page SHALL support searching by invoice number, customer name, and customer phone number.
4. THE Invoice_History_Page SHALL support filtering by date range, invoice status (Draft, Issued, Void), and payment status (Unpaid, Partially Paid, Paid).
5. THE Invoice_History_Page SHALL support sorting by Invoice Date (default: newest first) and Total Amount.
6. WHEN a user clicks an invoice row, THE System SHALL navigate to an Invoice Detail page showing all invoice fields, line items, and calculated totals.
7. FROM the Invoice Detail page, an authorized user SHALL be able to download the PDF, print the invoice, and record a payment.
8. ALL invoice history data SHALL be fetched from Supabase PostgreSQL; no client-side array or localStorage SHALL serve as the authoritative invoice store.

---

### Requirement 11: Payment Tracking

**User Story:** As a Billing_Staff or Admin, I want to record payments against an issued invoice, so that I can track outstanding balances accurately.

#### Acceptance Criteria

1. WHEN an authorized user records a payment, THE Payment_Module SHALL capture: amount, payment date, payment mode (Cash, UPI, Bank Transfer, Cheque, Other), transaction/reference number, and notes.
2. THE Payment_Module SHALL compute: Amount Paid = Sum of all recorded payment amounts for the invoice.
3. THE Payment_Module SHALL compute: Balance Due = Grand Total − Amount Paid.
4. WHEN Amount Paid equals zero, THE Invoice SHALL display payment status "Unpaid".
5. WHEN Amount Paid is greater than zero but less than Grand Total, THE Invoice SHALL display payment status "Partially Paid".
6. WHEN Amount Paid equals Grand Total, THE Invoice SHALL display payment status "Paid".
7. IF a payment amount is entered that would cause Amount Paid to exceed Grand Total, THEN THE Payment_Module SHALL reject the entry and display a descriptive error.
8. THE Payment_Module SHALL maintain a payment history log per invoice that is viewable on the Invoice Detail page.

---

### Requirement 12: Dashboard

**User Story:** As any authorized user, I want a dashboard showing key business metrics, so that I can understand business performance at a glance.

#### Acceptance Criteria

1. THE Dashboard SHALL display: Total Sales (sum of Grand Totals of issued invoices), Invoice Count, Total Tax Collected, Total Amount Received, and Total Outstanding Balance for the selected period.
2. THE Dashboard SHALL support date-range filtering, defaulting to the current financial year.
3. THE Dashboard SHALL display a list of the 5 most recent issued invoices with customer name, amount, and payment status.
4. THE Dashboard SHALL provide a prominent "Create Invoice" quick action button.
5. ALL dashboard figures SHALL be derived from live database queries and SHALL NOT use hardcoded or mock values.
6. WHEN viewing the dashboard, THE System SHALL exclude voided invoices from sales totals.

---

### Requirement 13: Reports

**User Story:** As an Admin or Viewer, I want sales and tax reports, so that I can analyze business performance and prepare GST returns.

#### Acceptance Criteria

1. THE Reports_Module SHALL provide a Date-wise Sales Summary showing: date, invoice count, taxable sales, total CGST, total SGST, total IGST, and gross sales.
2. THE Reports_Module SHALL provide a Customer-wise Sales Summary showing: customer name, invoice count, taxable sales, total tax, and gross sales.
3. THE Reports_Module SHALL support date-range filtering on all reports.
4. THE Reports_Module SHALL exclude voided invoices from all standard sales and tax totals.
5. ALL report figures SHALL be derived from authorized Supabase database queries.
6. THE Reports_Module SHALL allow authorized users to export the currently displayed report as a CSV file.

---

### Requirement 14: Invoice Void / Cancellation

**User Story:** As an Admin, I want to void an incorrectly issued invoice, so that it is excluded from sales figures without deleting the audit trail.

#### Acceptance Criteria

1. WHEN an Admin voids an invoice, THE System SHALL set the invoice status to "Void" and record the voiding user, timestamp, and reason.
2. WHEN an invoice is voided, THE System SHALL NOT delete the invoice or any of its records.
3. WHEN an invoice is voided, THE System SHALL exclude it from sales totals, tax totals, and outstanding balance calculations.
4. WHEN a Billing_Staff user attempts to void an invoice, THE System SHALL deny the action and display an authorization error.
5. THE Invoice_History_Page SHALL display voided invoices with a "Void" badge and allow them to be viewed but not edited.

---

### Requirement 15: Database and Data Integrity

**User Story:** As a system operator, I want a robust, well-structured database, so that invoice data is never lost, corrupted, or accessible by unauthorized parties.

#### Acceptance Criteria

1. THE Database SHALL implement the following core tables: `companies`, `company_members`, `company_settings`, `customers`, `products`, `invoice_counters`, `invoices`, `invoice_items`, `invoice_payments`, and `audit_logs`.
2. THE Database SHALL use UUID primary keys for all tables.
3. THE Database SHALL use `NUMERIC(15,2)` or equivalent decimal types for all currency and tax amount columns.
4. THE Database SHALL enforce Row Level Security on all company-owned tables such that a user can only access records belonging to their company.
5. THE Database SHALL use version-controlled Supabase SQL migration files for all schema changes; no table SHALL be created manually without a migration.
6. THE invoice_counters table SHALL use a serializable transaction or SELECT FOR UPDATE lock when generating invoice numbers to prevent duplicates under concurrent load.
7. THE Database SHALL log audit events for: invoice creation, invoice issue, invoice void, payment recording, and company settings changes.
8. THE Database SHALL include indexes on: `invoices.company_id`, `invoices.customer_id`, `invoices.status`, `invoices.invoice_date`, `invoice_items.invoice_id`, `customers.company_id`, and `products.company_id`.
9. FOR ALL issued invoices in the database, the stored `grand_total` SHALL equal the sum of the stored `line_total` values across all associated `invoice_items` records (verifiable by query).
