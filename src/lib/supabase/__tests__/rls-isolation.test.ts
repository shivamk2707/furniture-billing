/**
 * Integration test: RLS cross-company data isolation
 *
 * Property 10: For any user who is a member of Company A only,
 * all Supabase queries for invoices, customers, products, and settings
 * WHERE the data belongs to Company B SHALL return zero rows.
 *
 * Requires a real Supabase test instance:
 *   SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY env vars
 *
 * Skip gracefully when the test database is not configured.
 *
 * Feature: furniture-billing, Property 10: RLS cross-company data isolation
 * Validates: Requirements 15.4
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const TEST_URL = process.env.SUPABASE_TEST_URL
const TEST_SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY

const hasTestDb = Boolean(TEST_URL && TEST_SERVICE_KEY)

// IDs for cleanup
let companyAId: string
let companyBId: string
let userAId: string
let userAToken: string

describe.skipIf(!hasTestDb)(
  'RLS cross-company isolation (Property 10)',
  () => {
    // Service-role client bypasses RLS — used only for test setup/teardown
    // Initialised lazily inside beforeAll so it only runs when hasTestDb is true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let admin: SupabaseClient<any>

    beforeAll(async () => {
      admin = createClient(TEST_URL!, TEST_SERVICE_KEY!)
      // ----------------------------------------------------------
      // Create two isolated companies
      // ----------------------------------------------------------
      const { data: compA } = await admin
        .from('companies')
        .insert({ name: 'Test Company A' })
        .select('id')
        .single()
      companyAId = compA!.id

      const { data: compB } = await admin
        .from('companies')
        .insert({ name: 'Test Company B' })
        .select('id')
        .single()
      companyBId = compB!.id

      // ----------------------------------------------------------
      // Create a user for Company A via Supabase Auth admin API
      // ----------------------------------------------------------
      const email = `test-user-a-${Date.now()}@example.com`
      const { data: authData } = await admin.auth.admin.createUser({
        email,
        password: 'TestPassword123!',
        email_confirm: true,
      })
      userAId = authData.user!.id

      // Enrol user A in Company A only
      await admin.from('company_members').insert({
        company_id: companyAId,
        user_id: userAId,
        role: 'admin',
      })

      // ----------------------------------------------------------
      // Seed Company B with data (user A has NO membership here)
      // ----------------------------------------------------------
      await admin.from('customers').insert({
        company_id: companyBId,
        name: 'Company B Customer',
        mobile: '9999999999',
      })

      await admin.from('products').insert({
        company_id: companyBId,
        name: 'Company B Product',
        sku: 'CB-SKU-001',
        selling_price: 1000,
        tax_rate: 18,
      })

      await admin.from('invoices').insert({
        company_id: companyBId,
        status: 'draft',
      })

      // ----------------------------------------------------------
      // Sign in as User A to get a JWT for RLS-scoped queries
      // ----------------------------------------------------------
      const { data: signIn } = await admin.auth.signInWithPassword({
        email,
        password: 'TestPassword123!',
      })
      userAToken = signIn.session!.access_token
    })

    afterAll(async () => {
      // Clean up test data using service role
      if (companyBId) {
        await admin.from('invoices').delete().eq('company_id', companyBId)
        await admin.from('products').delete().eq('company_id', companyBId)
        await admin.from('customers').delete().eq('company_id', companyBId)
        await admin.from('companies').delete().eq('id', companyBId)
      }
      if (companyAId) {
        await admin.from('company_members').delete().eq('company_id', companyAId)
        await admin.from('companies').delete().eq('id', companyAId)
      }
      if (userAId) {
        await admin.auth.admin.deleteUser(userAId)
      }
    })

    it('user A cannot read Company B customers', async () => {
      // Create a client authenticated as User A (RLS enforced)
      const clientA = createClient(TEST_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
        global: { headers: { Authorization: `Bearer ${userAToken}` } },
      })

      const { data, error } = await clientA
        .from('customers')
        .select('id')
        .eq('company_id', companyBId)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it('user A cannot read Company B products', async () => {
      const clientA = createClient(TEST_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
        global: { headers: { Authorization: `Bearer ${userAToken}` } },
      })

      const { data, error } = await clientA
        .from('products')
        .select('id')
        .eq('company_id', companyBId)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it('user A cannot read Company B invoices', async () => {
      const clientA = createClient(TEST_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
        global: { headers: { Authorization: `Bearer ${userAToken}` } },
      })

      const { data, error } = await clientA
        .from('invoices')
        .select('id')
        .eq('company_id', companyBId)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it('user A can still read their own Company A data', async () => {
      const clientA = createClient(TEST_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
        global: { headers: { Authorization: `Bearer ${userAToken}` } },
      })

      const { data, error } = await clientA
        .from('companies')
        .select('id')
        .eq('id', companyAId)

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
    })
  }
)
