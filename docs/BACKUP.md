# Backup do banco

## O que já existe (plano grátis da Supabase)

- Backup automático **1×/dia**, retido **7 dias**.
- **Não** dá pra restaurar sozinho pelo painel — precisa abrir ticket com a
  Supabase.
- Sem "point-in-time recovery" (voltar pra um minuto específico).

## O que este repo adiciona — backup semanal no GitHub

`.github/workflows/backup-db.yml` roda todo domingo (03:00 BRT) um `pg_dump`
completo e guarda o arquivo como **artefato do run**, retido **90 dias**. Você
baixa quando quiser pela aba **Actions** do GitHub.

Cobre o buraco do plano grátis: se algo der muito errado, você tem uma cópia
de até ~1 semana atrás que **você mesmo** controla, sem depender de ticket.

### Ligar (uma vez, 2 min)

1. Supabase → **Project Settings → Database → Connection string** → aba **URI**
   → copie (é `postgresql://postgres:SENHA@db.<ref>.supabase.co:5432/postgres`).
2. GitHub → repo → **Settings → Secrets and variables → Actions → New
   repository secret**:
   - Nome: `SUPABASE_DB_URL`
   - Valor: a connection string do passo 1.
3. Aba **Actions → "Backup do banco (semanal)" → Run workflow** pra testar
   agora. Se passar verde, está no ar (roda sozinho todo domingo).

### Rodar na mão (local)

```bash
SUPABASE_DB_URL="postgresql://postgres:SENHA@db.<ref>.supabase.co:5432/postgres" \
  node scripts/backup-db.mjs
# gera backups/leeva-AAAA-MM-DD-HH-MM-SS.dump
```

## Restaurar

O `.dump` é formato custom do Postgres (`pg_restore`).

```bash
# restaurar TUDO num banco novo/vazio
pg_restore --no-owner --no-privileges --clean --if-exists \
  -d "postgresql://postgres:SENHA@HOST:5432/postgres" \
  leeva-AAAA-MM-DD.dump

# ou só uma tabela
pg_restore --no-owner --table=orders -d "<url>" leeva-AAAA-MM-DD.dump
```

> O dump **exclui** os schemas `auth`, `storage`, `realtime` e
> `supabase_functions` — esses são geridos pela Supabase e não devem ser
> restaurados por cima. Ou seja: o backup cobre os **dados do produto**
> (restaurantes, pedidos, motoboys, etc.), não as contas de login em si.
> As contas ficam no backup diário da própria Supabase.

## Quando isso deixa de bastar

Quando tiver clientes reais, assine o **Supabase Pro** (US$ 25/mês) e ative o
**Point-in-Time Recovery** (Settings → Add-ons) — aí dá pra voltar o banco pra
qualquer minuto dos últimos 7 dias (ou mais), direto pelo painel. Ver
`docs/PENDENCIAS-DE-CONTA.md`.
