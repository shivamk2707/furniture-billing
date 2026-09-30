/**
 * Integration test: SKU uniqueness per company
 *
 * Property 9: For any company, attempting to insert two products with
 * the same SKU within the same company SHALL be rejected by the
 * database unique constraint.
 *
 * Requires SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY.
 * Skips gracefully when not configured.
 *
 * Feature: furniture-billing, Property 9: SKU uniqueness per company
 * Validates: Requirements 3.2
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const TEST_URL = process.env.SUPABASE_TEST_URL
const TEST_SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY
const hasTestDb = Boolean(TEST_URL && TEST_SERVICE_KEY)

let companyId: string

describe.skipIf(!hasTestDb)('SKU uniqueness per company (Property 9)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: SupabaseClient<any>

  beforeAll(async () => {
    admin = createClient(TEST_URL!, TEST_SERVICE_KEY!)

    // Create a test company
    const { data } = await admin
      .from('companies')
      .insert({ name: 'SKU Test Company' })
      .select('id')
      .single()
    companyId = data!.id
  })

  afterAll(async () => {
    if (companyId) {
      await admin.from('products').delete().eq('company_id', companyId)
      await admin.from('companies').delete().eq('id', companyId)
    }
  })

  it('first insert succeeds', async () => {
    const { error } = await admin.from('products').insert({
      company_id: companyId,
      name: 'Test Chair',
      sku: 'TC-001',
      selling_price: 1000,
      tax_rate: 18,
    })
    expect(error).toBeNull()
  })

  it('second insert with the same SKU and company is rejected (unique constraint)', async () => {
    const { error } = await admin.from('products').insert({
      company_id: companyId,
      name: 'Another Chair',
      sku: 'TC-001',  // duplicate SKU
      selling_price: 1500,
      tax_rate: 18,
    })
    expect(error).not.toBeNull()
    // PostgreSQL unique violation code
    expect(error!.code).toBe('23505')
  })

  it('same SKU in a different company is allowed', async () => {
    // Create a second company
    const { data: company2 } = await admin
      .from('companies')
      .insert({ name: 'SKU Test Company 2' })
      .select('id')
      .single()
    const company2Id = company2!.id

    const { error } = await admin.from('products').insert({
      company_id: company2Id,
      name: 'Chair Copy',
      sku: 'TC-001',  // same SKU but different company — allowed
      selling_price: 1000,
      tax_rate: 18,
    })

    // Cleanup
    await admin.from('products').delete().eq('company_id', company2Id)
    await admin.from('companies').delete().eq('id', company2Id)

    expect(error).toBeNull()
  })
})
