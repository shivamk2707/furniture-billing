# Furniture Billing & Business Reporting Software

A production-grade, multi-tenant furniture billing system built with **Next.js 16**, **Supabase**, and **@react-pdf/renderer**.

## Features

- GST-compliant A4 invoice generation (CGST/SGST and IGST)
- Exact reproduction of the supplied invoice reference layout
- Real-time invoice preview alongside the form editor
- Atomic invoice number generation (race-safe)
- Immutable invoice snapshots at issue time
- Payment tracking with balance calculation
- Dashboard with KPI metrics (current financial year)
- Date-wise and customer-wise sales reports with CSV export
- Role-based access control (Admin / Billing Staff / Viewer)
- Row Level Security on all company-scoped tables

---

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: for Server Action closure encryption across instances
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=

# Optional: for integration tests against a separate test database
SUPABASE_TEST_URL=
SUPABASE_TEST_SERVICE_ROLE_KEY=

# Optional: for E2E tests
E2E_BASE_URL=http://localhost:3000
E2E_EMAIL=admin@example.com
E2E_PASSWORD=YourPassword123!
```

---

## Database Setup

Apply all migrations to your Supabase project:

1. Open: https://supabase.com/dashboard/project/YOUR_PROJECT_REF/sql/new
2. Open `scripts/combined-migrations.sql` in your editor
3. Copy all contents and paste into the SQL Editor
4. Click **Run**

This creates all 10 tables, indexes, RLS policies, the invoice number function, and seeds development data.

---

## Local Development

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open http://localhost:3000. You will be redirected to `/login`.

---

## Running Tests

```bash
# Unit and property-based tests (Vitest)
npm test

# Watch mode
npm run test:watch

# E2E tests (requires dev server running + Playwright browsers)
npx playwright install chromium
npm run test:e2e
```

Integration tests (RLS isolation, snapshot immutability, SKU uniqueness, concurrent invoice numbering) require `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY` to be set. They skip gracefully when not configured.

---

## Production Build

```bash
npm run build
npm start
```

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/          # Login page
│   ├── (dashboard)/           # Protected routes (sidebar layout)
│   │   ├── dashboard/         # KPI dashboard
│   │   ├── invoices/          # Invoice history + detail + new
│   │   ├── products/          # Product catalogue
│   │   ├── customers/         # Customer directory
│   │   ├── reports/           # Sales reports
│   │   └── settings/          # Company settings
│   └── api/pdf/[id]/          # PDF generation endpoint
├── components/invoice/        # Invoice template, editor, preview, PDF
├── lib/
│   ├── calculation-engine.ts  # Financial calculation logic (decimal.js)
│   ├── invoice-types.ts       # Shared invoice data interfaces
│   ├── invoice-pages.ts       # Multi-page pagination
│   ├── qr-code.ts             # UPI QR code generation
│   └── supabase/              # Supabase clients (browser + server)
├── actions/                   # Server Actions (auth, invoices, payments, etc.)
└── proxy.ts                   # Next.js 16 Proxy (replaces middleware.ts)

supabase/
├── migrations/                # Version-controlled SQL migrations
└── seed.sql                   # Development seed data

e2e/                           # Playwright E2E tests
scripts/
└── combined-migrations.sql    # Single-file migration for Supabase Dashboard
```

---

## Known Limitations & Pending Decisions

1. **PDF renderer**: `@react-pdf/renderer` v3 conflicts with React 19 in Vitest. PDF rendering is tested via the `buildInvoiceData` layer in unit tests; full PDF output is verified by running the app and downloading a PDF manually.

2. **E2E tests**: Playwright E2E tests require the dev server to be running. The `webServer` option in `playwright.config.ts` is commented out — uncomment it to auto-start the server during CI.

3. **Supabase migrations**: The CLI `link` command requires a personal access token. Use the Supabase Dashboard SQL Editor with `scripts/combined-migrations.sql` as the migration method.

4. **Tax rules**: Implemented as CGST+SGST (intra-state) vs IGST (inter-state) based on company `state_code` vs invoice `place_of_supply`. Reverse charge is tracked as a boolean flag only.

5. **E-invoice QR code**: The e-invoice QR placeholder is shown for draft invoices. Real IRN-based QR codes require integration with the government IRP portal, which is outside the scope of this implementation.

---

## Environment Variables to Configure

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Optional: stable encryption key for multi-instance deployments |
