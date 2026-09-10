import { requireRestaurantContext } from '@/lib/context';
import { integrationsOverview } from '@leeva/shared/integrations';
import { INTEGRATION_STATUS_LABELS } from '@leeva/shared';
import { ConnectMenu } from './ConnectMenu';
import { IfoodLink } from './IfoodLink';

export const dynamic = 'force-dynamic';

const STATUS_PILL: Record<string, string> = {
  implemented: 'green',
  prepared: 'amber',
  mock: 'blue',
  disabled: 'gray',
};

export default async function IntegracoesPage() {
  await requireRestaurantContext();
  const overview = integrationsOverview();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const deliveriesUrl = `${base}/api/v1/deliveries`;

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Integrações</h1>
          <div className="sub">De onde chegam seus pedidos de entrega.</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Como um pedido chega no Leeva</div>
        <ul className="muted" style={{ fontSize: 13, lineHeight: 1.9, margin: 0, paddingLeft: 18 }}>
          <li><b>Digitando no painel</b> — aba Pedidos → Nova entrega. Serve pra qualquer um.</li>
          <li><b>Do seu cardápio digital / PDV / site</b> — pela chave de conexão (abaixo). Cobre a maioria das plataformas.</li>
          <li><b>Por WhatsApp</b> — a IA lê a mensagem do cliente e monta o pedido pra você confirmar.</li>
          <li><b>Do iFood</b> — conector próprio (abaixo), depende da homologação do iFood.</li>
        </ul>
      </div>

      <ConnectMenu deliveriesUrl={deliveriesUrl} />

      <IfoodLink />

      <details className="panel">
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          Detalhes técnicos (para o seu desenvolvedor)
        </summary>

        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th>Integração</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Configurada?</th>
                <th>O que falta</th>
              </tr>
            </thead>
            <tbody>
              {overview.map((i) => (
                <tr key={`${i.kind}-${i.provider}`}>
                  <td>{String(i.provider)}</td>
                  <td className="muted">{i.kind}</td>
                  <td>
                    <span className={`pill ${STATUS_PILL[i.status]}`}>
                      {INTEGRATION_STATUS_LABELS[i.status]}
                    </span>
                  </td>
                  <td>{i.configured ? 'sim' : '—'}</td>
                  <td style={{ fontSize: 12 }}>{i.requires.length ? i.requires.join(', ') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 style={{ fontSize: 14, marginBottom: 4 }}>Endpoints</h3>
        <ul className="muted" style={{ fontSize: 13, lineHeight: 1.8 }}>
          <li><b>Entrada de entregas (recomendado):</b> <code>POST {deliveriesUrl}</code> — header <code>x-leeva-api-key</code>, idempotente por <code>external_order_id</code></li>
          <li><b>Cardápio próprio (formato aninhado):</b> <code>POST {base}/api/integrations/orders</code> — header <code>x-leeva-api-key</code></li>
          <li><b>Webhook WhatsApp:</b> <code>{base}/api/webhooks/whatsapp?restaurant=&lt;id&gt;</code> (GET valida <code>hub.challenge</code>)</li>
          <li><b>Sincronização iFood (polling):</b> <code>POST {base}/api/cron/ifood-poll?restaurant=&lt;id&gt;</code> — header <code>x-cron-secret</code></li>
        </ul>
        <p className="muted" style={{ fontSize: 12 }}>Documentação completa: <code>docs/INTEGRATIONS.md</code>.</p>
      </details>
    </div>
  );
}
