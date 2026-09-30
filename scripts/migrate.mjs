/**
 * Apply migrations to Supabase using the service role client.
 * Run: node scripts/migrate.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, '..')

// Load env vars from .env.local manually (no dotenv needed)
const envContent = readFileSync(join(root, '.env.local'), 'utf8')
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => l.split('=').map((v, i) => i === 0 ? v.trim() : v.trim()))
    .filter(([k]) => k)
)

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY  = env['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
})

const sql = readFileSync(join(root, 'scripts/combined-migrations.sql'), 'utf8')

// Split on statement boundaries and run each one
// Supabase JS client doesn't have a raw SQL method in the anon client,
// but we can call a postgres function via rpc if it exists.
// For initial setup we use fetch against the /rest/v1/rpc endpoint.

const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
  method: 'GET',
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
  }
})

console.log('Connection test status:', res.status)
if (res.ok) {
  console.log('✅ Supabase project is reachable')
  console.log('')
  console.log('To apply migrations, please:')
  console.log('1. Open https://supabase.com/dashboard/project/bhxarqoibkuqnltetqip/sql')
  console.log('2. Paste the contents of: scripts/combined-migrations.sql')
  console.log('3. Click "Run"')
  console.log('')
  console.log('This applies all tables, indexes, RLS policies, and seed data.')
}
