# Checklist de go-live

## Banco
- [ ] Migrations `0001` → `0018` aplicadas em produção
- [ ] `select * from cron.job` mostra `leeva-dispatch-tick` ativo (§4 do DEPLOY)
- [ ] Vault tem `leeva_cron_url` e `leeva_cron_secret`
- [ ] RLS ligado em todas as tabelas (as migrations garantem)
- [ ] Backups: PITR (Supabase Pro) ou dump agendado
- [ ] Auth: confirmação de e-mail configurada (SMTP) ou desligada conscientemente

## Apps
- [ ] `apps/restaurante`, `apps/motoboy`, `apps/admin` publicados, cada um no seu domínio
- [ ] `NEXT_PUBLIC_LEEVA_AUTH_COOKIE` diferente em cada app
- [ ] `CRON_SECRET` definido em `apps/restaurante` e igual ao usado no `configure_dispatch_cron`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` só no servidor, marcado como sensível
- [ ] `npm run build` verde para os três apps
- [ ] `npm run typecheck` verde

## Despacho automático
- [ ] Criar entrega de teste → em ~30 s vira `offered` sem ninguém abrir o painel
- [ ] `dispatch_runs` registra execuções periódicas
- [ ] Recusar oferta → reoferta automática para outro candidato
- [ ] Esgotar tentativas → `dispatch_state = failed` + alerta

## Reputação
- [ ] Oferta ruim classificada como `poor` (ver `dispatch_attempts.quality`)
- [ ] Recusar `poor` não mexe em `motoboys.offers_adequate`
- [ ] `reputation_config` acessível só no Admin
- [ ] Recomputo rodando no cron (`reputation` no retorno de `/api/cron/dispatch-tick`)

## Admin
- [ ] `platform_admins` tem o(s) operador(es) (`npm run seed:admin` em dev)
- [ ] Restaurante e motoboy **não** acessam `admin.` (redireciona para /login)
- [ ] Visão geral, Operação, Restaurantes, Entregadores, Financeiro, Planos, Reputação carregam

## Segurança
- [ ] Rate limit ativo: repetir `POST /api/v1/deliveries` além do limite → 429
- [ ] `/api/cron/dispatch-tick` sem `x-cron-secret` → 401
- [ ] Chaves de API por restaurante geradas na UI (Integrações); `LEEVA_API_KEY` global só em dev
- [ ] Tracking público não vaza telefone/endereço/custo (suite `test:security`)

## Testes (rodar antes de anunciar)
```
npm test                 # 25 unit
npm run test:integration # 14
npm run test:concurrency # 7
npm run test:security    # 23  (precisa do app no ar / dev server)
npm run test:fase3       # 14
npm run test:fase35      # 21
```

## Integrações (ativar quando tiver credencial)
- [ ] iFood: `IFOOD_*` + merchant homologado
- [ ] WhatsApp: `WHATSAPP_*` + número aprovado
- [ ] OSRM próprio (`OSRM_BASE_URL`) para ETA/rota reais
- [ ] Gateway de pagamento (cobrança SaaS real — fora do MVP)

## Monitoramento
- [ ] `error_events` sendo populado (ou Sentry plugado)
- [ ] Alerta se `dispatch_runs` parar de registrar (cron caiu)
