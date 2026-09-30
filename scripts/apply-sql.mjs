/**
 * Applies combined-migrations.sql to Supabase via the pg_net / direct REST approach.
 * Splits the SQL file into individual statements and executes each via a helper RPC.
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, '..')

const envContent = readFileSync(join(root, '.env.local'), 'utf8')
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => { const idx = l.indexOf('='); return [l.slice(0,idx).trim(), l.slice(idx+1).trim()] })
)

const URL   = env['NEXT_PUBLIC_SUPABASE_URL']
const KEY   = env['SUPABASE_SERVICE_ROLE_KEY']

// Use Supabase's direct database REST endpoint for executing SQL
// This works by calling the PostgREST /rpc endpoint if a function exists,
// OR by using the Supabase edge function approach.
// The simplest working method: POST to /pg endpoint with SQL as body.

async function execSQL(sql) {
  const res = await fetch(`${URL}/pg`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'Authorization': `Bearer ${KEY}`,
    },
    body: sql,
  })
  return { status: res.status, body: await res.text() }
}

const sql = readFileSync(join(root, 'scripts/combined-migrations.sql'), 'utf8')
const result = await execSQL(sql)
console.log('Status:', result.status)
console.log('Response:', result.body.slice(0, 500))
