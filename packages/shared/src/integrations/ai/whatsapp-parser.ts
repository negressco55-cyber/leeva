/**
 * Camada de IA para interpretar mensagens de WhatsApp e transformar em
 * rascunho de pedido.
 *
 *   "Quero dois brownies e um copo supremo para entregar no Bessa"
 *      → Brownie x2, Copo Supremo x1, endereço: Bessa
 *
 * Duas implementações:
 *  - LLM (Anthropic) — IMPLEMENTADO se ANTHROPIC_API_KEY estiver setada.
 *  - Heurística (regex/keywords) — SEMPRE disponível como fallback,
 *    marcada como best-effort.
 *
 * REGRA DE SEGURANÇA: a IA só produz um RASCUNHO. Nunca cria pedido
 * irreversível. O restaurante confirma antes (createOrderFromNormalized
 * é chamado só depois da confirmação humana no fluxo do WhatsApp).
 */

export type OrderDraft = {
  items: { name: string; quantity: number; unitPrice: number; notes?: string }[];
  address: string | null;
  region: string | null;
  rawInterpretation: string;
  confidence: number; // 0..1
  needsConfirmation: true;
};

export type ParseResult = { ok: true; draft: OrderDraft } | { ok: false; error: string };

const NUM_WORDS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, três: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
};

export async function parseWhatsAppOrder(
  message: string,
  ctx: { customerName?: string; menu?: { name: string; price: number }[] } = {},
): Promise<ParseResult> {
  if (process.env.ANTHROPIC_API_KEY) {
    const llm = await parseWithLLM(message, ctx);
    if (llm.ok) return llm;
    // se o LLM falhar, cai na heurística
  }
  return parseHeuristic(message, ctx);
}

async function parseWithLLM(
  message: string,
  ctx: { customerName?: string; menu?: { name: string; price: number }[] },
): Promise<ParseResult> {
  try {
    const sys =
      'Você extrai pedidos de delivery de mensagens em português. Responda SOMENTE JSON no formato ' +
      '{"items":[{"name":string,"quantity":number,"notes":string?}],"address":string|null,"region":string|null,"interpretation":string,"confidence":number}. ' +
      'Não invente itens que não estão na mensagem.' +
      (ctx.menu?.length ? ` Cardápio disponível: ${ctx.menu.map((m) => m.name).join(', ')}.` : '');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: sys,
        messages: [{ role: 'user', content: message }],
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { ok: false, error: `LLM ${res.status}` };
    const json = (await res.json()) as { content?: { text?: string }[] };
    const text = json.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    const menu = ctx.menu ?? [];
    return {
      ok: true,
      draft: {
        items: (parsed.items ?? []).map((i: { name: string; quantity?: number; notes?: string }) => ({
          name: i.name,
          quantity: i.quantity ?? 1,
          unitPrice: menu.find((m) => m.name.toLowerCase() === i.name?.toLowerCase())?.price ?? 0,
          notes: i.notes,
        })),
        address: parsed.address ?? null,
        region: parsed.region ?? null,
        rawInterpretation: parsed.interpretation ?? message,
        confidence: parsed.confidence ?? 0.6,
        needsConfirmation: true,
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function parseHeuristic(
  message: string,
  ctx: { menu?: { name: string; price: number }[] },
): ParseResult {
  const text = message.toLowerCase();
  const menu = ctx.menu ?? [];
  const items: OrderDraft['items'] = [];

  // 1. tenta casar itens do cardápio
  for (const m of menu) {
    const idx = text.indexOf(m.name.toLowerCase());
    if (idx >= 0) {
      const before = text.slice(Math.max(0, idx - 20), idx);
      const qty = extractQtyNear(before);
      items.push({ name: m.name, quantity: qty, unitPrice: m.price });
    }
  }

  // 2. sem cardápio: pega padrões "<n> <coisa>"
  if (!items.length) {
    const re = /(\d+|um|uma|dois|duas|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez)\s+([a-záàâãéêíóôõúç]+(?:\s+[a-záàâãéêíóôõúç]+){0,2})/gi;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(text)) && items.length < 8) {
      const qty = /^\d+$/.test(mm[1]!) ? parseInt(mm[1]!, 10) : NUM_WORDS[mm[1]!.replace('ê', 'e')] ?? 1;
      const name = mm[2]!.replace(/\b(para|pra|no|na|de|em|com|e)\b.*/, '').trim();
      if (name && !['reais', 'real', 'minutos'].includes(name)) {
        items.push({ name: capitalize(name), quantity: qty, unitPrice: 0 });
      }
    }
  }

  // 3. endereço / região: trecho depois de "entregar no/na/em" ou "endereço"
  let address: string | null = null;
  let region: string | null = null;
  const addrMatch = message.match(/(?:entregar?|entrega|endere[çc]o|levar)\s+(?:para|pra|no|na|em|:)?\s*(.+)$/i);
  if (addrMatch) address = addrMatch[1]!.trim();
  const regionMatch = message.match(/\b(?:no|na|bairro)\s+([A-ZÁ-Ú][a-zá-ú]+(?:\s+[A-ZÁ-Ú][a-zá-ú]+)?)\b/);
  if (regionMatch) region = regionMatch[1]!.trim();

  if (!items.length) {
    return { ok: false, error: 'Não consegui identificar itens na mensagem. Encaminhe para atendimento manual.' };
  }

  return {
    ok: true,
    draft: {
      items,
      address,
      region,
      rawInterpretation: `Heurística: ${items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}${address ? ` — ${address}` : ''}`,
      confidence: menu.length ? 0.55 : 0.35,
      needsConfirmation: true,
    },
  };
}

function extractQtyNear(s: string): number {
  const digit = s.match(/(\d+)\s*$/);
  if (digit) return parseInt(digit[1]!, 10);
  for (const [w, n] of Object.entries(NUM_WORDS)) if (s.includes(w)) return n;
  return 1;
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
