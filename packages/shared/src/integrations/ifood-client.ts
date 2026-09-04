/**
 * Cliente OAuth + polling da API do iFood (Merchant API v1.0).
 *
 * O iFood NÃO envia webhook pro parceiro — o parceiro precisa:
 *   1. trocar client_id/client_secret por um access token (OAuth
 *      client_credentials), renovando antes de expirar;
 *   2. buscar (GET /events:polling) eventos periodicamente;
 *   3. confirmar o recebimento (POST /events/acknowledgment) — sem isso o
 *      iFood reenvia os mesmos eventos;
 *   4. buscar o pedido completo (GET /orders/{id}) quando o evento for de
 *      pedido novo.
 *
 * `ifood.ts` (IFoodOrderProvider) foi escrito para um modelo de webhook
 * push, que não é como a API do iFood funciona — por isso este cliente
 * existe separado: ele busca o evento/pedido e entrega pro
 * `IFoodOrderProvider.parse()` fazer a conversão (isso continua igual).
 */

export class IfoodApiError extends Error {
  status?: number;
  body?: unknown;
  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.name = 'IfoodApiError';
    this.status = status;
    this.body = body;
  }
}

const BASE = 'https://merchant-api.ifood.com.br';

type CachedToken = { accessToken: string; expiresAt: number };
let cached: CachedToken | null = null;

/** Reseta o cache do token (usado em testes). */
export function __resetIfoodTokenCache(): void {
  cached = null;
}

/**
 * Obtém um access token válido, renovando via OAuth quando necessário.
 * Cacheado em memória do processo — não é persistido no banco (o processo
 * do servidor é de curta duração/reaproveitado; a próxima chamada renova).
 */
export async function getIfoodAccessToken(opts: { force?: boolean } = {}): Promise<string> {
  if (!opts.force && cached && cached.expiresAt > Date.now() + 30_000) return cached.accessToken;

  const clientId = process.env.IFOOD_CLIENT_ID;
  const clientSecret = process.env.IFOOD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new IfoodApiError('IFOOD_CLIENT_ID / IFOOD_CLIENT_SECRET não configurados');
  }

  const body = new URLSearchParams({
    grantType: 'client_credentials',
    clientId,
    clientSecret,
  });

  let res: Response;
  try {
    res = await fetch(`${BASE}/authentication/v1.0/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    throw new IfoodApiError(`autenticação iFood: falha de rede (${(e as Error).message})`);
  }

  const json = (await res.json().catch(() => ({}))) as {
    accessToken?: string;
    access_token?: string;
    expiresIn?: number;
    expires_in?: number;
  };
  if (!res.ok) {
    throw new IfoodApiError(`autenticação iFood falhou (${res.status})`, res.status, json);
  }
  const accessToken = json.accessToken ?? json.access_token;
  if (!accessToken) throw new IfoodApiError('resposta de autenticação sem accessToken', res.status, json);
  const expiresIn = Number(json.expiresIn ?? json.expires_in ?? 21_600);

  cached = { accessToken, expiresAt: Date.now() + expiresIn * 1000 };
  return accessToken;
}

export type IfoodMerchant = { id: string; name?: string; corporateName?: string };

/** Lista os merchants associados ao app — usado quando IFOOD_MERCHANT_ID não está definido. */
export async function listIfoodMerchants(token: string): Promise<IfoodMerchant[]> {
  const res = await fetch(`${BASE}/merchant/v1.0/merchants`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  const json = await res.json().catch(() => []);
  if (!res.ok) throw new IfoodApiError(`listar merchants falhou (${res.status})`, res.status, json);
  return (Array.isArray(json) ? json : []) as IfoodMerchant[];
}

export type IfoodPollEvent = {
  id: string;
  code: string;
  fullCode?: string;
  orderId?: string;
  merchantId?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

/** GET /events:polling — 204 (sem corpo) quando não há evento novo. */
export async function pollIfoodEvents(token: string, merchantIds?: string[]): Promise<IfoodPollEvent[]> {
  const params = new URLSearchParams();
  if (merchantIds?.length) params.set('merchants', merchantIds.join(','));
  const qs = params.toString();
  const res = await fetch(`${BASE}/order/v1.0/events:polling${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 204) return [];
  const json = await res.json().catch(() => []);
  if (!res.ok) throw new IfoodApiError(`polling de eventos falhou (${res.status})`, res.status, json);
  return (Array.isArray(json) ? json : []) as IfoodPollEvent[];
}

/** POST /events/acknowledgment — obrigatório, senão o iFood reenvia os mesmos eventos. */
export async function acknowledgeIfoodEvents(token: string, eventIds: string[]): Promise<void> {
  if (!eventIds.length) return;
  const res = await fetch(`${BASE}/order/v1.0/events/acknowledgment`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(eventIds.map((id) => ({ id }))),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok && res.status !== 202) {
    const body = await res.json().catch(() => null);
    throw new IfoodApiError(`acknowledgment falhou (${res.status})`, res.status, body);
  }
}

/** GET /orders/{id} — payload completo, no formato que IFoodOrderProvider.parse() espera. */
export async function getIfoodOrder(token: string, orderId: string): Promise<unknown> {
  const res = await fetch(`${BASE}/order/v1.0/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new IfoodApiError(`buscar pedido ${orderId} falhou (${res.status})`, res.status, json);
  return json;
}

/** Código de evento que indica um pedido novo chegando. */
export const IFOOD_EVENT_NEW_ORDER = 'PLC';
