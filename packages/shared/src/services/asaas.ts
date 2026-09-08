/**
 * ASAAS — gateway de pagamento (cobrança + transferência Pix).
 *
 * PREPARADO. Sem `ASAAS_API_KEY` no ambiente, `getAsaasClient()` devolve null
 * e os fluxos que dependem dele entram em MODO SIMULAÇÃO (claramente marcado).
 *
 * Bloco 3 (cobrança) e a transferência real do Bloco 4 ligam a partir daqui,
 * só configurando a credencial — nada de código novo espalhado.
 */

const BASE = {
  production: 'https://api.asaas.com/v3',
  sandbox: 'https://api-sandbox.asaas.com/v3',
} as const;

export type AsaasTransfer = {
  pixAddressKey: string;
  pixAddressKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
  value: number;
  description?: string;
};

export type AsaasResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

export interface AsaasClient {
  /** transferência Pix para uma chave (repasse ao motoboy) */
  transferPix(t: AsaasTransfer): Promise<AsaasResult<{ id: string; status: string }>>;
  /** cria (ou acha) o cliente Asaas de quem vai pagar — exigido pela cobrança */
  createCustomer(input: {
    name: string;
    cpfCnpj: string;
    email?: string;
    mobilePhone?: string;
  }): Promise<AsaasResult<{ id: string }>>;
  /** cobrança Pix avulsa (compra de crédito — Bloco 3) */
  createPixCharge(input: {
    customer: string;
    value: number;
    description: string;
    externalReference?: string;
    dueInDays?: number;
  }): Promise<AsaasResult<{ id: string; invoiceUrl: string; pixCopyPaste?: string; pixQrImage?: string }>>;
}

class HttpAsaasClient implements AsaasClient {
  constructor(
    private readonly key: string,
    private readonly base: string,
  ) {}

  private async req<T>(path: string, body: unknown, method: 'POST' | 'GET' = 'POST'): Promise<AsaasResult<T>> {
    try {
      const res = await fetch(`${this.base}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', access_token: this.key },
        body: method === 'GET' ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        const msg =
          (json.errors as { description?: string }[] | undefined)?.[0]?.description ??
          `Asaas ${res.status}`;
        return { ok: false, error: String(msg), status: res.status };
      }
      return { ok: true, data: json as T };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'falha de rede' };
    }
  }

  transferPix(t: AsaasTransfer) {
    return this.req<{ id: string; status: string }>('/transfers', {
      value: t.value,
      pixAddressKey: t.pixAddressKey,
      pixAddressKeyType: t.pixAddressKeyType,
      description: t.description,
      operationType: 'PIX',
    });
  }

  createCustomer(input: { name: string; cpfCnpj: string; email?: string; mobilePhone?: string }) {
    return this.req<{ id: string }>('/customers', {
      name: input.name,
      cpfCnpj: input.cpfCnpj.replace(/\D/g, ''),
      email: input.email,
      mobilePhone: input.mobilePhone?.replace(/\D/g, ''),
      notificationDisabled: true,
    });
  }

  async createPixCharge(input: {
    customer: string;
    value: number;
    description: string;
    externalReference?: string;
    dueInDays?: number;
  }): Promise<AsaasResult<{ id: string; invoiceUrl: string; pixCopyPaste?: string; pixQrImage?: string }>> {
    const due = new Date(Date.now() + (input.dueInDays ?? 1) * 86400_000).toISOString().slice(0, 10);
    const created = await this.req<{ id: string; invoiceUrl: string }>('/payments', {
      customer: input.customer,
      billingType: 'PIX',
      value: input.value,
      description: input.description,
      externalReference: input.externalReference,
      dueDate: due,
    });
    if (!created.ok) return created;

    // o copia-e-cola e a imagem do QR vêm de um endpoint separado
    let pixCopyPaste: string | undefined;
    let pixQrImage: string | undefined;
    const qr = await this.req<{ payload?: string; encodedImage?: string }>(
      `/payments/${created.data.id}/pixQrCode`,
      null,
      'GET',
    );
    if (qr.ok) {
      pixCopyPaste = qr.data.payload;
      pixQrImage = qr.data.encodedImage ? `data:image/png;base64,${qr.data.encodedImage}` : undefined;
    }

    return { ok: true, data: { id: created.data.id, invoiceUrl: created.data.invoiceUrl, pixCopyPaste, pixQrImage } };
  }
}

let injected: AsaasClient | null | undefined;

/** Só para testes: injeta um cliente Asaas fake (ou null para forçar simulação). */
export function __setAsaasClient(client: AsaasClient | null | undefined): void {
  injected = client;
}

/** Devolve o cliente Asaas se configurado, senão null (modo simulação). */
export function getAsaasClient(): AsaasClient | null {
  if (injected !== undefined) return injected;
  const key = process.env.ASAAS_API_KEY;
  if (!key) return null;
  const env = process.env.ASAAS_ENV === 'sandbox' ? 'sandbox' : 'production';
  return new HttpAsaasClient(key, BASE[env]);
}

/** mapeia o tipo de chave interno para o formato Asaas */
export function pixKeyTypeToAsaas(type: string | null): AsaasTransfer['pixAddressKeyType'] {
  switch ((type ?? '').toLowerCase()) {
    case 'cpf':
      return 'CPF';
    case 'cnpj':
      return 'CNPJ';
    case 'email':
      return 'EMAIL';
    case 'phone':
      return 'PHONE';
    default:
      return 'EVP'; // chave aleatória
  }
}
