/**
 * Applies all migrations + seed to your Supabase project.
 *
 * Prerequisites:
 *   1. Copy .env.local.example to .env.local and fill in your credentials
 *   2. Get your DB connection string from:
 *      Supabase Dashboard → Project Settings → Database → Connection string (URI)
 *      It looks like: postgresql://postgres:[password]@db.bhxarqoibkuqnltetqip.supabase.co:5432/postgres
 *   3. Set it as env var: DATABASE_URL=postgresql://...
 *   4. Run: node scripts/run-migrations.mjs
 *
 * Or simply open your Supabase Dashboard → SQL Editor and paste the
 * contents of scripts/combined-migrations.sql
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, '..')

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('Set DATABASE_URL env var to your Supabase connection string.')
  console.error('Find it in: Supabase Dashboard → Project Settings → Database → URI')
  process.exit(1)
}

// Dynamic import so the script fails gracefully if pg is not installed
let pg
try {
  pg = await import('pg')
} catch {
  console.error('Install pg first: npm install --save-dev pg')
  process.exit(1)
}

const { default: { Client } } = pg
const client = new Client({ connectionString: DATABASE_URL })
await client.connect()

const files = [
  'supabase/migrations/001_initial_schema.sql',
  'supabase/migrations/002_indexes.sql',
  'supabase/migrations/003_invoice_number_function.sql',
  'supabase/migrations/004_rls_policies.sql',
  'supabase/seed.sql',
]

for (const file of files) {
  const sql = readFileSync(join(root, file), 'utf8')
  try {
    await client.query(sql)
    console.log(`✅ Applied: ${file}`)
  } catch (err) {
    // Ignore "already exists" errors from re-runs — everything uses IF NOT EXISTS
    // or ON CONFLICT; other errors are fatal
    if (err.code === '42P07' || err.code === '42710') {
      console.log(`⏭  Skipped (already exists): ${file}`)
    } else {
      console.error(`❌ Failed: ${file}`)
      console.error(err.message)
      await client.end()
      process.exit(1)
    }
  }
}

await client.end()
console.log('\n🎉 All migrations applied successfully.')
