/**
 * "Colar pedido": lê o TEXTO de um pedido copiado de qualquer cardápio
 * digital (Anota AI, Goomer, Cardápio Web, Saipos, WhatsApp, impressão do
 * PDV…) e devolve os dados de ENTREGA para preencher o formulário.
 *
 * Serve pra quem não tem integração automática: o dono copia o pedido e
 * cola no Leeva. Nada é criado aqui — o formulário abre preenchido e o
 * restaurante confere (endereço ainda passa pelo "Localizar no mapa").
 *
 *  - LLM (Anthropic Haiku) se ANTHROPIC_API_KEY existir;
 *  - heurística (rótulos comuns "Cliente:", "Endereço:", "Total:"…) sempre,
 *    e preenche o que o LLM deixar vazio.
 */
import type { PaymentMethod, PaymentStatus } from '../../types';

export type OrderTextDraft = {
  externalId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  address: string | null;
  /** valor total do pedido (R$), quando aparece */
  total: number | null;
  deliveryFee: number | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** troco para quanto (dinheiro) */
  changeFor: number | null;
  notes: string | null;
  /** de onde parece ter vindo (só informativo) */
  sourceHint: string | null;
  via: 'ai' | 'heuristic';
};

const LABEL = String.raw`[\t ]*[:\-–][\t ]*`;

/** "R$ 1.234,56" | "45,90" | "45.90" → número */
export function parseMoney(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = s.match(/\d[\d.,]*/);
  if (!m) return null;
  let v = m[0];
  if (/,\d{1,2}$/.test(v)) v = v.replace(/\./g, '').replace(',', '.');
  else if (/\.\d{3}$/.test(v) && !/\.\d{1,2}$/.test(v)) v = v.replace(/\./g, '');
  else v = v.replace(/,/g, '');
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function clean(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[*_~`]/g, '') // negrito/itálico do WhatsApp
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ') // emojis
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .join('\n');
}

function field(text: string, labels: string): string | null {
  const re = new RegExp(String.raw`^(?:${labels})${LABEL}(.+)$`, 'im');
  const m = text.match(re);
  return m?.[1]?.trim() || null;
}

function lastMatch(text: string, re: RegExp): RegExpMatchArray | null {
  let last: RegExpMatchArray | null = null;
  for (const m of text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) last = m;
  return last;
}

export function parseOrderTextHeuristic(input: string): OrderTextDraft {
  const t = clean(input);
  const lower = t.toLowerCase();

  const externalId =
    t.match(/pedido\s*(?:n[º°o.]*|número|numero)?\s*#?\s*(\d{2,})/i)?.[1] ?? t.match(/#\s?(\d{3,})/)?.[1] ?? null;

  const customerName = field(t, 'cliente|nome do cliente|nome|destinat[aá]rio');

  const phoneRaw =
    field(t, 'telefone|tel|celular|whats(?:app)?|fone|contato') ??
    t.match(/(\+?55\s?)?\(?\d{2}\)?\s?9?\s?\d{4}[-\s]?\d{4}/)?.[0] ??
    null;
  const phoneDigits = phoneRaw?.replace(/\D/g, '') ?? '';
  const customerPhone = phoneDigits.length >= 10 ? phoneDigits : null;

  // endereço: linha "Endereço:" ou peças separadas (Rua/Número/Bairro/Complemento)
  let address = field(t, String.raw`endere[cç]o(?: de entrega)?|entregar (?:em|no|na)|local de entrega|entrega em`);
  const street = field(t, 'rua|logradouro|avenida|av');
  const number = field(t, 'n[uú]mero|n[º°o]');
  const district = field(t, 'bairro');
  const complement = field(t, 'complemento|compl|apto|apartamento|bloco');
  const city = field(t, 'cidade');
  if (!address && street) address = [street, number].filter(Boolean).join(', ');
  if (address) {
    const parts = [address];
    if (number && !address.includes(number)) parts.push(number);
    if (district && !address.toLowerCase().includes(district.toLowerCase())) parts.push(district);
    if (city && !address.toLowerCase().includes(city.toLowerCase())) parts.push(city);
    address = parts.join(', ');
    if (complement && !address.toLowerCase().includes(complement.toLowerCase())) address += ` (${complement})`;
  }

  const deliveryFee = parseMoney(field(t, 'taxa de entrega|taxa entrega|frete'));
  const totalLine = lastMatch(t, /^(?:valor\s+)?total(?:\s+(?:a pagar|do pedido|geral))?[\t ]*[:\-–]?[\t ]*(?:R\$)?[\t ]*([\d.,]+)/im);
  const total = parseMoney(totalLine?.[1]);
  const changeFor = parseMoney(t.match(/troco\s*(?:para|pra|p\/)?\s*:?\s*(?:R\$)?\s*([\d.,]+)/i)?.[1]);

  const payLine = (field(t, 'pagamento|forma de pagamento|pagar com|m[eé]todo de pagamento') ?? '').toLowerCase();
  const payText = payLine || lower;
  const paidOnline = /(pago|paga) (online|pelo app|no app|antecipado)|j[aá] pago|pagamento online|pago via|pagamento aprovado|pix pago|pago com pix/.test(lower);
  let paymentMethod: PaymentMethod = 'unknown';
  if (/dinheiro|esp[eé]cie/.test(payText) || changeFor) paymentMethod = 'cash';
  else if (/pix/.test(payText)) paymentMethod = paidOnline ? 'online' : 'pix';
  else if (/cart[aã]o|cr[eé]dito|d[eé]bito|maquin|vale.?refei|vr\b|va\b|alelo|sodexo|ticket/.test(payText))
    paymentMethod = paidOnline ? 'online' : 'card_on_delivery';
  else if (paidOnline || /online/.test(payText)) paymentMethod = 'online';
  const paymentStatus: PaymentStatus = paymentMethod === 'online' || paidOnline ? 'paid' : 'pending';

  const notesParts = [
    field(t, 'observa[cç][aã]o|observa[cç][oõ]es|obs'),
    field(t, 'refer[eê]ncia|ponto de refer[eê]ncia'),
    changeFor ? `Troco para R$ ${changeFor.toFixed(2).replace('.', ',')}` : null,
  ].filter(Boolean);

  const sourceHint = /anota\s?a[ií]/i.test(t)
    ? 'Anota AI'
    : /goomer/i.test(t)
      ? 'Goomer'
      : /card[aá]pio\s?web/i.test(t)
        ? 'Cardápio Web'
        : /saipos/i.test(t)
          ? 'Saipos'
          : /ifood/i.test(t)
            ? 'iFood'
            : null;

  return {
    externalId,
    customerName: customerName ? customerName.slice(0, 120) : null,
    customerPhone,
    address: address ? address.slice(0, 300) : null,
    total,
    deliveryFee,
    paymentMethod,
    paymentStatus,
    changeFor,
    notes: notesParts.length ? notesParts.join(' · ').slice(0, 500) : null,
    sourceHint,
    via: 'heuristic',
  };
}

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card_on_delivery', 'online', 'pix', 'other', 'unknown'];

async function parseWithLLM(text: string): Promise<Partial<OrderTextDraft> | null> {
  try {
    const sys =
      'Você lê o texto de UM pedido de delivery copiado de um cardápio digital brasileiro e extrai os dados da ENTREGA. ' +
      'Responda SOMENTE JSON: {"externalId":string|null,"customerName":string|null,"customerPhone":string|null,' +
      '"address":string|null,"total":number|null,"deliveryFee":number|null,' +
      '"paymentMethod":"cash"|"card_on_delivery"|"online"|"pix"|"unknown","paid":boolean,"changeFor":number|null,"notes":string|null}. ' +
      'address = rua, número, bairro, complemento e cidade numa linha só. total = valor total do pedido em reais. ' +
      'paymentMethod: "online" se já foi pago pelo app/site; "pix" se o cliente vai pagar Pix na entrega; "card_on_delivery" se é maquininha. ' +
      'notes = observações de entrega e ponto de referência (não os itens). Não invente: campo ausente = null.';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: sys,
        messages: [{ role: 'user', content: text.slice(0, 6000) }],
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { content?: { text?: string }[] };
    const out = json.content?.[0]?.text ?? '';
    const p = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : parseMoney(str(v)));
    const method = PAYMENT_METHODS.includes(p.paymentMethod as PaymentMethod) ? (p.paymentMethod as PaymentMethod) : 'unknown';
    const phone = str(p.customerPhone)?.replace(/\D/g, '') ?? '';
    return {
      externalId: str(p.externalId),
      customerName: str(p.customerName),
      customerPhone: phone.length >= 10 ? phone : null,
      address: str(p.address),
      total: num(p.total),
      deliveryFee: num(p.deliveryFee),
      paymentMethod: method,
      paymentStatus: p.paid === true || method === 'online' ? 'paid' : 'pending',
      changeFor: num(p.changeFor),
      notes: str(p.notes),
    };
  } catch {
    return null;
  }
}

export async function parseOrderText(text: string): Promise<OrderTextDraft> {
  const h = parseOrderTextHeuristic(text);
  if (!process.env.ANTHROPIC_API_KEY) return h;
  const ai = await parseWithLLM(text);
  if (!ai) return h;
  const pick = <K extends keyof OrderTextDraft>(k: K) => (ai[k] ?? h[k]) as OrderTextDraft[K];
  return {
    externalId: pick('externalId'),
    customerName: pick('customerName'),
    customerPhone: pick('customerPhone'),
    address: pick('address'),
    total: pick('total'),
    deliveryFee: pick('deliveryFee'),
    paymentMethod: ai.paymentMethod && ai.paymentMethod !== 'unknown' ? ai.paymentMethod : h.paymentMethod,
    paymentStatus: ai.paymentMethod && ai.paymentMethod !== 'unknown' ? (ai.paymentStatus ?? h.paymentStatus) : h.paymentStatus,
    changeFor: pick('changeFor'),
    notes: pick('notes'),
    sourceHint: h.sourceHint,
    via: 'ai',
  };
}
