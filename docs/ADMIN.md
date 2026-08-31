# Painel administrativo da plataforma (Fase 3.5)

App separado: **`apps/admin`** (porta 3002). Pertence ao operador do Leeva.
Restaurante e motoboy **não** têm acesso.

## Autorização

- Tabela `platform_admins(user_id, email, name, active)`.
- Helper SQL `is_platform_admin()` (SECURITY DEFINER) — usado nas policies RLS.
- Validação no **backend**: `apps/admin/lib/context.ts` consulta `platform_admins`
  com `service_role` a cada request (server component ou rota de API). Nunca uma
  flag de cliente.
- O login (`app/login/actions.ts`) recusa quem não está em `platform_admins` e
  desloga na hora.
- Cookie de sessão próprio: `sb-leeva-admin`.

Criar um admin em dev: `npm run seed:admin` → `admin@leeva.dev` / `leeva123`.
Em produção: inserir a linha manualmente após criar o usuário no Supabase Auth.

## Páginas

| Rota | Conteúdo | Serviço |
|---|---|---|
| `/visao-geral` | MRR, receita SaaS/variável/total, custo de entregadores, margem, restaurantes ativos/trial, entregas hoje/7d, motoboys cadastrados/online, entregas sem entregador + comparação com período anterior | `getAdminOverview` |
| `/operacao` | Mapa geral da rede: restaurantes, entregadores com posição recente, entregas ativas, concentração de demanda, áreas com falta de entregador. Filtros: região, restaurante, status | `getNetworkOperation` |
| `/restaurantes` | Tabela (plano, status, entregas, MRR, variável, cadastro, última atividade) + filtros (ativos/trial/inadimplentes/cancelados/plano). Clique → detalhe | `listRestaurants` |
| `/restaurantes/[id]` | Dados, assinatura, utilização 30d, config logística, política de payout, integrações, faturamento recente | `getRestaurantDetail` |
| `/entregadores` | Tabela com aceitação, finalização, pontualidade, avaliação, confiabilidade + totais (online/offline/em entrega/disponíveis/bloqueados) | `listDrivers` |
| `/entregadores/[id]` | Desempenho detalhado, componentes do índice, histórico de ofertas (qualidade/valor/resultado), incidentes com origem. Botão **bloquear/desbloquear** | `getDriverPerformance` |
| `/financeiro` | Receita SaaS × variável × total, custos (payouts + externos), margem. Unit economics: receita/custo/margem por restaurante e por entrega, MRR, churn, LTV (com aviso se amostra pequena) | `getAdminFinance` |
| `/planos` | Editor do catálogo `plans`: nome, mensalidade, taxa por entrega, features (JSON), trial, ordem, ativo. Sem deploy | `POST /api/plans` |
| `/reputacao` | Editor de `reputation_config`: pesos dos componentes, penalidade por incidente, limiares | `POST /api/reputation-config` |

## Rotas de API do admin

Todas exigem `getAdminApiContext()` (401 caso contrário).

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/operation` | dados do mapa da rede (polling da tela Operação) |
| POST | `/api/plans` | upsert de plano por `code` |
| GET/POST | `/api/reputation-config` | ler / salvar pesos e limiares |
| POST | `/api/drivers/[id]/block` | bloquear/desbloquear entregador (`{ blocked, reason }`) |

## Isolamento

O admin **lê** tudo (policies `... admin lê todos` nas migrations `0016`), para
suporte e operação. Escrita continua restrita: planos e `reputation_config` só
pelo admin; dados de restaurante continuam passando pelos fluxos normais. O
bloqueio de entregador tira do pool de despacho (`scoreCandidatesForOrder` filtra
`blocked = false`).
