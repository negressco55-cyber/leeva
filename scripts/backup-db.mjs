/**
 * Backup do banco Supabase via pg_dump. Gera um arquivo custom-format
 * (`-Fc`), que é o formato que o `pg_restore` entende e que dá pra restaurar
 * tabela por tabela.
 *
 * Uso local:
 *   SUPABASE_DB_URL="postgresql://postgres:SENHA@db.<ref>.supabase.co:5432/postgres" \
 *     node scripts/backup-db.mjs
 *
 * Roda semanalmente no GitHub Actions (.github/workflows/backup-db.yml),
 * subindo o .dump como artefato (retido 90 dias). Ver docs/BACKUP.md.
 *
 * Requer o `pg_dump` instalado (client do Postgres). Na Action já vem.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  // Sem o secret configurado o backup automático fica "pulado" (verde), não
  // falha toda semana. Ver docs/BACKUP.md pra ligar (2 min).
  console.log('SUPABASE_DB_URL não definido — backup pulado. Ver docs/BACKUP.md.');
  process.exit(0);
}

const outDir = process.env.BACKUP_DIR || 'backups';
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const file = `${outDir}/leeva-${stamp}.dump`;

console.log(`pg_dump → ${file}`);
try {
  execFileSync(
    'pg_dump',
    [
      url,
      '--format=custom',
      '--no-owner',
      '--no-privileges',
      '--exclude-schema=auth',        // gerido pela Supabase, não restauramos
      '--exclude-schema=storage',
      '--exclude-schema=realtime',
      '--exclude-schema=supabase_functions',
      '--file', file,
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  );
} catch (e) {
  console.error('pg_dump falhou:', e.message);
  process.exit(1);
}

const size = statSync(file).size;
console.log(`✅ backup ok — ${(size / 1024 / 1024).toFixed(1)} MB`);
if (size < 10_000) {
  console.error('⚠️  arquivo suspeito de tão pequeno — confira a connection string.');
  process.exit(1);
}
