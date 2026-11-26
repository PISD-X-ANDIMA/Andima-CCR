import { readFileSync } from 'fs';
import pg from 'pg';

const { Client } = pg;

// Read env from .env file
const env = {};
try {
  const content = readFileSync('.env', 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || '';
const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
const dbPassword = env.SUPABASE_DB_PASSWORD || '';
// Try direct connection (port 5432, not pooler)
const connStr = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`;
console.log('Connecting to: direct connection to db.' + projectRef + '.supabase.co:5432');

const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
await client.connect();

// Check triggers on c1_assignment
const trig = await client.query(`
  select trigger_name, event_manipulation, action_statement 
  from information_schema.triggers 
  where event_object_table = 'c1_assignment' and trigger_schema = 'public'
`);
console.log('TRIGGERS on c1_assignment:', JSON.stringify(trig.rows, null, 2));

// Check all functions that reference b2_register
const fns = await client.query(`
  select p.proname, left(pg_get_functiondef(p.oid), 500) as def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and pg_get_functiondef(p.oid) ilike '%b2_register%'
`);
console.log('\nFUNCTIONS referencing b2_register:', fns.rows.map(r => r.proname));

// Check if there are any other triggers anywhere that might fire
const allTrig = await client.query(`
  select trigger_name, event_object_table, event_manipulation, action_statement
  from information_schema.triggers
  where trigger_schema = 'public'
  order by event_object_table
`);
console.log('\nALL triggers in public schema:', JSON.stringify(allTrig.rows, null, 2));

await client.end();
