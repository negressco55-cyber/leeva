'use client';

import { CopyButton } from './ConnectMenu';

/**
 * Open Delivery (padrão da Abrasel): o cardápio/PDV chama o Leeva como
 * "empresa de logística". Usa a mesma chave de conexão do card de cima.
 */
export function OpenDeliveryCard({ baseUrl }: { baseUrl: string }) {
  const apiUrl = `${baseUrl}/api/opendelivery`;
  const tokenUrl = `${apiUrl}/oauth/token`;
  const supportMessage = `Olá! Uso o Leeva pra organizar meus motoboys e quero que os pedidos de entrega do meu cardápio caiam lá automaticamente, pelo padrão Open Delivery (logística).

- URL base da API de logística: ${apiUrl}
  (pedido de entrega: POST ${apiUrl}/v1/logistics/delivery)
- Token (OAuth2 client_credentials): ${tokenUrl}
- client_id: leeva
- client_secret: [a chave que eu gerei no Leeva]

Conseguem ativar pra minha loja? Obrigado!`;

  return (
    <section className="panel" style={{ display: 'grid', gap: 12 }}>
      <div>
        <h2 style={{ fontSize: 16, margin: 0 }}>Open Delivery (Cardápio Web, Saipos e outros)</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Se o seu cardápio ou PDV tem <b>Integrações → Open Delivery → Logística</b>, ele manda o pedido de entrega
          direto pro Leeva quando você chamar o entregador. Use a <b>mesma chave</b> gerada acima.
        </p>
      </div>
      <div className="section" style={{ display: 'grid', gap: 8, fontSize: 13 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="muted">URL da API:</span>
          <code>{apiUrl}</code>
          <CopyButton text={apiUrl} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="muted">URL do token:</span>
          <code>{tokenUrl}</code>
          <CopyButton text={tokenUrl} />
        </div>
        <div className="muted">
          client_id: <code>leeva</code> · client_secret: <b>sua chave de conexão</b>
        </div>
      </div>
      <div className="section" style={{ display: 'grid', gap: 8 }}>
        <strong style={{ fontSize: 14 }}>Não achou? Manda isso pro suporte do seu cardápio</strong>
        <textarea readOnly value={supportMessage} style={{ width: '100%', minHeight: 170, fontSize: 12 }} />
        <div>
          <CopyButton text={supportMessage} label="Copiar mensagem" />
        </div>
      </div>
    </section>
  );
}
