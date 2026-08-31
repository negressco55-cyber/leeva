# Retenção de dados e privacidade

## Localização do motoboy (`driver_locations`)

- Só é gravada **enquanto há entrega ativa** (status `assigned|picked_up|in_route`).
  Offline ou sem entrega → o app não envia e a rota `/api/location` não grava.
- Frequência: `watchPosition` do navegador com throttle de **20 s** entre envios
  (bateria + dados).
- **Retenção: 24 h.** A função `cleanup_driver_locations(interval)` apaga rastros
  mais antigos. A posição "atual" fica em `motoboys.current_*` (sobrescrita, não
  acumula histórico).
- O cliente no rastreamento só vê a posição do motoboy se ela tiver **< 5 min**.

### Agendar a limpeza

Opção A — cron externo chamando a rota:
```
POST https://SEU_APP/api/cron/cleanup
Header: x-cron-secret: $CRON_SECRET
```
(ex: Vercel Cron `0 * * * *`, GitHub Actions, cron do servidor).

Opção B — `pg_cron` no Supabase:
```sql
select cron.schedule('leeva-cleanup', '0 * * * *',
  $$ select public.cleanup_driver_locations('24 hours') $$);
```

## Tokens de rastreamento (`tracking_tokens`)
- 64 caracteres hex aleatórios (`gen_random_uuid` × 2). Impossível adivinhar.
- `expires_at` = criação + 2 dias. Podem ser revogados (`revoked = true`).
- Não expõem id interno, custo, telefone do motoboy nem outros pedidos.

## Logs (`integration_events`, `order_events`, `notifications`)
- `integration_events.payload` guarda o corpo do webhook para auditoria —
  **segredos/headers de autenticação não são gravados**.
- `notifications` guarda o texto enviado e o status; não guarda tokens de canal.

## Dados pessoais do cliente
Ficam em `customers` e `orders` (nome, telefone, endereço), isolados por
`restaurant_id` via RLS. Não há compilação de dados entre restaurantes.
