/**
 * Applies all Supabase migrations + seed using the Supabase Management API
 * Run: node scripts/apply-migrations.mjs
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

async function runSQL(sql, label) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`❌ ${label} failed:`, body)
    process.exit(1)
  }
  console.log(`✅ ${label}`)
}

const files = [
  'supabase/migrations/001_initial_schema.sql',
  'supabase/migrations/002_indexes.sql',
  'supabase/migrations/003_invoice_number_function.sql',
  'supabase/migrations/004_rls_policies.sql',
  'supabase/seed.sql',
]

for (const file of files) {
  const sql = readFileSync(join(root, file), 'utf8')
  await runSQL(sql, file)
}
