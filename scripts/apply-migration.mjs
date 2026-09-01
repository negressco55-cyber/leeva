/**
 * Aplica um arquivo .sql via Management API da Supabase.
 * Uso: node scripts/apply-migration.mjs supabase/migrations/00XX_...sql
 */
import { readFileSync } from 'node:fs';

const REF = process.env.LEEVA_PROJECT_ID || 'hqulvdxqivavhjpxguos';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const file = process.argv[2];
if (!TOKEN) {
  console.error('defina SUPABASE_ACCESS_TOKEN no ambiente');
  process.exit(1);
}
if (!file) {
  console.error('informe o arquivo .sql');
  process.exit(1);
}
const sql = readFileSync(file, 'utf8');
const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
const body = await res.text();
console.log(res.status, body.slice(0, 2000));
process.exit(res.ok ? 0 : 1);
