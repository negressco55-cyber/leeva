# Pendências que dependem da sua conta / cartão

Coisas que **não dá pra eu fazer** (precisam de você logado no painel, ou de
um plano pago). Cada uma tem o passo a passo. Nenhuma é urgente pra funcionar —
são reforços pra quando tiver o primeiro restaurante real usando.

---

## 1. Confirmação de e-mail no Supabase Auth + SMTP

**Por quê:** hoje, quando um restaurante ou motoboy se cadastra, a conta já
fica ativa sem confirmar o e-mail. Ligar a confirmação evita cadastro com
e-mail errado/falso e é boa prática de segurança.

**O catch:** o Supabase tem um servidor de e-mail *de teste* embutido, mas ele
só manda pra e-mails da sua própria equipe e tem limite baixíssimo
(3–4 e-mails/hora). Pra valer em produção você precisa plugar um **SMTP**
próprio — de graça dá pra usar **Resend** (3.000 e-mails/mês grátis) ou
**Brevo** (300/dia grátis).

### Passo a passo

**a) Criar o SMTP (exemplo com Resend — grátis):**

1. Conta em https://resend.com → verifique um domínio seu (ex.: `leeva.com.br`)
   seguindo as instruções deles (uns registros DNS). Sem domínio próprio dá
   pra testar com `onboarding@resend.dev`, mas o ideal é o seu.
2. Em Resend → **API Keys** → crie uma. Guarde.
3. Anote os dados SMTP do Resend:
   - Host: `smtp.resend.com`
   - Porta: `465` (SSL) ou `587` (TLS)
   - Usuário: `resend`
   - Senha: a API key que você criou

**b) Ligar no Supabase:**

1. Painel do Supabase → **Project Settings → Authentication → SMTP Settings**
   → **Enable Custom SMTP** → preencha host/porta/usuário/senha acima +
   "Sender email" (ex.: `nao-responda@leeva.com.br`) e "Sender name" (`Leeva`).
2. **Authentication → Providers → Email** → ligue **"Confirm email"**.
3. **Authentication → URL Configuration** → confira o **Site URL** e adicione
   os **Redirect URLs**:
   - `https://leeva-restaurante.vercel.app/**`
   - `https://leeva-motoboy.vercel.app/**`
4. **Authentication → Email Templates** → dá pra traduzir os textos pro
   português (opcional).

**c) No código:** o fluxo de signup já lida com "conta criada, confirme o
e-mail" (o Supabase devolve a sessão como `null` até confirmar). Se algum
texto de tela ficar estranho depois de ligar, me avise que ajusto — mas não
deve precisar de mudança.

> ⚠️ Se ligar a confirmação **sem** o SMTP, os cadastros vão travar (o e-mail
> nunca chega). Faça o (a) antes do (b).

---

## 2. Backup automático do banco

**Estado atual:** o plano **gratuito** do Supabase faz backup só uma vez por
dia e guarda por **7 dias**, e **não** dá pra restaurar sozinho pelo painel
(precisa abrir ticket). Não tem "point-in-time recovery".

**Quando você assinar o Supabase Pro (US$ 25/mês):**

1. Painel do Supabase → **Project Settings → Add-ons** (ou **Database →
   Backups**) → ative **Point-in-Time Recovery (PITR)**.
   - Com PITR você restaura o banco pra *qualquer minuto* dos últimos 7 dias
     (ou mais, conforme o add-on).
2. Enquanto não assina: dá pra fazer um dump manual de vez em quando —

   ```bash
   # precisa do Postgres client instalado (pg_dump)
   pg_dump "postgresql://postgres:[SENHA]@db.hqulvdxqivavhjpxguos.supabase.co:5432/postgres" \
     -Fc -f leeva-backup-$(date +%Y%m%d).dump
   ```

   (a senha do banco está em Project Settings → Database → Connection string).
   Guarde os `.dump` num lugar seguro (não no git).

3. **Recomendado quando tiver clientes reais:** agendar esse dump num
   cron/GitHub Action semanal, subindo o arquivo pra um bucket privado
   (Supabase Storage, S3, Google Drive). Me peça que eu monto isso.

---

## 3. Proteção extra no painel admin

**Por quê:** `leeva-admin.vercel.app` já exige login e valida `platform_admins`
no backend — quem não é admin é deslogado. Mas é bom ter uma segunda camada
pra nem carregar a página.

### Opção A — Vercel Authentication (mais simples, plano Pro da Vercel)

1. Painel da Vercel → projeto **leeva-admin** → **Settings → Deployment
   Protection → Vercel Authentication** → ative "Standard Protection" (ou
   "Only Preview Deployments" se quiser deixar produção aberta).
2. Aí só quem está no seu time da Vercel abre o site. Simples, mas amarra o
   acesso à conta Vercel (não serve se você quiser dar acesso a alguém sem
   conta Vercel).

### Opção B — Cloudflare Access (grátis até 50 usuários, mais flexível)

1. Ponha o domínio (ou um subdomínio, ex.: `admin.leeva.com.br`) no
   **Cloudflare** (grátis).
2. Aponte esse subdomínio pro `leeva-admin.vercel.app` (CNAME) e adicione o
   domínio custom no projeto da Vercel.
3. Cloudflare → **Zero Trust → Access → Applications** → **Add an application**
   → Self-hosted → domínio `admin.leeva.com.br` → política: "e-mails que
   terminam em `@leeva.com.br`" ou uma lista de e-mails.
4. Agora, antes de chegar na Vercel, o Cloudflare pede login (por e-mail com
   código, Google, etc.).

**Recomendo a B** quando tiver domínio próprio — é grátis e você controla quem
entra por e-mail.

### Opção C — HTTP Basic Auth no middleware (rápido, sem conta nenhuma)

Se quiser algo hoje, sem depender de plano: dá pra pôr um usuário/senha fixo
no `middleware.ts` do admin (lido de env vars). Me peça que eu implemento em
10 min. É menos elegante mas funciona.

---

## 4. Upgrade pros planos pagos (Vercel / Supabase)

**Quando:** quando o uso real passar dos limites gratuitos. Sinais:

| Serviço | Limite grátis | Sinal de que passou |
|---|---|---|
| **Vercel Hobby** | uso "não comercial", 100 GB banda/mês, funções com timeout curto | e-mail da Vercel avisando de uso comercial; builds/funções sendo limitados |
| **Supabase Free** | 500 MB banco, 5 GB banda, 50k usuários auth, pausa após 1 semana sem uso | banco chegando perto de 500 MB; projeto sendo pausado por inatividade |

### Vercel Pro (US$ 20/mês por membro)

- Painel Vercel → **Settings → Billing → Upgrade to Pro**.
- Você **precisa** disto pra uso comercial (os termos do Hobby proíbem).
  Antes de vender pro primeiro restaurante, suba pro Pro.
- Habilita também a "Vercel Authentication" da opção 3A.

### Supabase Pro (US$ 25/mês)

- Painel Supabase → **Settings → Billing → Change subscription plan → Pro**.
- Ganha: projeto nunca pausa, 8 GB banco, backups PITR (opção 2), 7 dias de
  logs, e-mail de suporte.
- **Faça isso junto com o primeiro cliente real** (não antes — é dinheiro
  parado).

### Ordem recomendada

1. **Vercel Pro** — assim que for cobrar de alguém (obrigatório pelos termos).
2. **Supabase Pro** — no mesmo momento, pelo backup e por não pausar.
3. OSRM próprio (não é plano pago, é um servidorzinho — ver
   `docs/RESUMO-DA-NOITE.md`) — quando o volume de entregas crescer.

---

## Resumo — o que fazer e quando

| Item | Custo | Fazer quando |
|---|---|---|
| SMTP + confirmação de e-mail | grátis (Resend) | antes do 1º restaurante real |
| Vercel Pro | US$ 20/mês | antes de cobrar de alguém (obrigatório) |
| Supabase Pro + PITR | US$ 25/mês | junto com o 1º cliente |
| Proteção do admin | grátis (Cloudflare) ou incluso no Vercel Pro | quando tiver domínio próprio |
| Backup semanal automatizado | grátis | quando tiver dados de clientes reais |
