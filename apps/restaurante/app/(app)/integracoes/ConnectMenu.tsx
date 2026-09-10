'use client';

import { useEffect, useState } from 'react';

type KeyRow = {
  id: string;
  name: string;
  last4: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* seleção manual */
        }
      }}
    >
      {done ? 'Copiado!' : label}
    </button>
  );
}

export function ConnectMenu({ deliveriesUrl }: { deliveriesUrl: string }) {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [fresh, setFresh] = useState<{ key: string; name: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<{ ok?: string; err?: string } | null>(null);

  async function load() {
    const res = await fetch('/api/api-keys', { cache: 'no-store' });
    const d = await res.json().catch(() => ({ keys: [] }));
    if (res.ok) setKeys(d.keys ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  const activeKeys = keys.filter((k) => !k.revoked_at);

  async function generate() {
    setBusy('gen');
    setErr(null);
    setFresh(null);
    try {
      const name = window.prompt('Um nome pra essa chave (ex: "Cardápio Goomer"):') ?? 'Chave de integração';
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'erro');
      setFresh({ key: d.key, name: d.name });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'erro');
    } finally {
      setBusy(null);
    }
  }

  async function revoke(id: string) {
    if (!window.confirm('Desligar esta chave? A plataforma que usa ela para de mandar pedidos.')) return;
    setBusy(id);
    try {
      await fetch('/api/api-keys', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function runTest() {
    setBusy('test');
    setTestMsg(null);
    try {
      const res = await fetch('/api/integrations/test', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'erro');
      setTestMsg({ ok: `Pedido de teste #${d.orderNumber} criado. Abra a aba Pedidos — ele aparece como "aguardando você chamar". Pode recusar depois.` });
    } catch (e) {
      setTestMsg({ err: e instanceof Error ? e.message : 'erro' });
    } finally {
      setBusy(null);
    }
  }

  const supportMessage = `Olá! Quero enviar os pedidos do meu cardápio para o meu sistema de entregas (Leeva).

Vocês têm como configurar um webhook / integração de "enviar pedido para sistema externo"? Os dados são:

- Endereço (URL): ${deliveriesUrl}
- Método: POST
- Cabeçalho de autenticação: x-leeva-api-key: [a chave que eu gerei]
- Formato do corpo (JSON):
{
  "external_order_id": "<id do pedido de vocês>",
  "customer_name": "<nome do cliente>",
  "customer_phone": "<telefone>",
  "address": "<endereço completo de entrega>",
  "payment_method": "online | cash | card_on_delivery | pix",
  "payment_status": "paid | pending",
  "order_value": 0,
  "notes": "<observações>"
}

Só preciso que, quando entrar um pedido de entrega, vocês façam essa chamada. Obrigada!`;

  return (
    <section className="panel" style={{ display: 'grid', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 16, margin: 0 }}>Conectar seu cardápio digital</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Tem cardápio digital ou PDV (Goomer, Anota AI, Cardápio na Web, Saipos, site próprio…)? Faça os
          pedidos de entrega caírem direto aqui, em 3 passos.
        </p>
      </div>

      {/* passo 1 */}
      <div className="section" style={{ display: 'grid', gap: 8 }}>
        <strong style={{ fontSize: 14 }}>1. Gere a chave de conexão</strong>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          É a senha que liga sua plataforma ao Leeva. Aparece <b>uma vez</b> — copie e guarde.
        </p>
        <div>
          <button className="btn primary" disabled={busy === 'gen'} onClick={generate}>
            {busy === 'gen' ? '…' : activeKeys.length ? 'Gerar outra chave' : 'Gerar minha chave'}
          </button>
        </div>
        {fresh && (
          <div className="op-alert ok" style={{ wordBreak: 'break-all', display: 'grid', gap: 6 }}>
            <span><b>{fresh.name}</b> — copie agora:</span>
            <code style={{ fontSize: 13 }}>{fresh.key}</code>
            <div><CopyButton text={fresh.key} label="Copiar chave" /></div>
          </div>
        )}
        {err && <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{err}</p>}
      </div>

      {/* passo 2 */}
      <div className="section" style={{ display: 'grid', gap: 8 }}>
        <strong style={{ fontSize: 14 }}>2. Cole o endereço do Leeva na sua plataforma</strong>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          Na sua plataforma, procure por <i>Integrações</i>, <i>Webhook</i>, <i>API de entrega</i> ou{' '}
          <i>Enviar pedido para sistema externo</i>. Cole:
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <code style={{ fontSize: 13 }}>{deliveriesUrl}</code>
          <CopyButton text={deliveriesUrl} label="Copiar endereço" />
        </div>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          E no cabeçalho de autenticação: <code>x-leeva-api-key</code> = a chave do passo 1.
        </p>
      </div>

      {/* passo 3 */}
      <div className="section" style={{ display: 'grid', gap: 8 }}>
        <strong style={{ fontSize: 14 }}>3. Não sabe fazer? Manda isso pro suporte da sua plataforma</strong>
        <textarea readOnly value={supportMessage} style={{ width: '100%', minHeight: 220, fontSize: 12 }} />
        <div><CopyButton text={supportMessage} label="Copiar mensagem" /></div>
      </div>

      {/* teste */}
      <div className="section" style={{ display: 'grid', gap: 8 }}>
        <strong style={{ fontSize: 14 }}>Testar a conexão</strong>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          Cria um pedido de teste (sem custo, sem entregador) só pra você ver que a porta está funcionando.
        </p>
        <div>
          <button className="btn" disabled={busy === 'test'} onClick={runTest}>
            {busy === 'test' ? '…' : 'Criar pedido de teste'}
          </button>
        </div>
        {testMsg?.ok && <div className="op-alert ok" style={{ fontSize: 13 }}>{testMsg.ok}</div>}
        {testMsg?.err && <div className="op-alert critical" style={{ fontSize: 13 }}>{testMsg.err}</div>}
      </div>

      {/* chaves ativas */}
      {keys.length > 0 && (
        <div>
          <strong style={{ fontSize: 13 }}>Chaves</strong>
          <table className="data" style={{ marginTop: 6, fontSize: 13 }}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Final</th>
                <th>Último uso</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td>{k.name}</td>
                  <td>…{k.last4}</td>
                  <td className="muted">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleString('pt-BR') : 'nunca'}
                  </td>
                  <td>
                    {k.revoked_at ? (
                      <span className="pill gray">desligada</span>
                    ) : (
                      <span className="pill green">ativa</span>
                    )}
                  </td>
                  <td>
                    {!k.revoked_at && (
                      <button className="btn sm" disabled={busy === k.id} onClick={() => revoke(k.id)}>
                        Desligar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
