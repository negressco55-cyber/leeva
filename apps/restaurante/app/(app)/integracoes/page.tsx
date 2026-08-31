import { requireRestaurantContext } from '@/lib/context';
import { integrationsOverview } from '@leeva/shared/integrations';
import { INTEGRATION_STATUS_LABELS } from '@leeva/shared';
import { ApiKeys } from './ApiKeys';

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

  return (
    <div className="grid" style={{ gap: 20 }}>
      <h1 style={{ margin: 0 }}>Integrações</h1>
      <p className="muted" style={{ fontSize: 13 }}>
        Estado real de cada integração. <b>Implementado</b> = funcionando.{' '}
        <b>Preparado</b> = código e webhooks prontos, falta credencial/config externa.{' '}
        <b>Mock</b> = só desenvolvimento. Detalhes em <code>docs/INTEGRATIONS.md</code>.
      </p>

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
              <td>{i.configured ? '✅' : '—'}</td>
              <td style={{ fontSize: 12 }}>{i.requires.length ? i.requires.join(', ') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ApiKeys />

      <section className="panel">
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Endpoints</h2>
        <ul className="muted" style={{ fontSize: 13, lineHeight: 1.8 }}>
          <li>
            <b>Webhook iFood:</b> <code>{base}/api/webhooks/ifood?restaurant=&lt;id&gt;</code>
          </li>
          <li>
            <b>Webhook WhatsApp:</b> <code>{base}/api/webhooks/whatsapp?restaurant=&lt;id&gt;</code>{' '}
            (GET valida <code>hub.challenge</code>)
          </li>
          <li>
            <b>Cardápio / API própria:</b> <code>POST {base}/api/integrations/orders</code> com header{' '}
            <code>x-leeva-api-key</code>
          </li>
          <li>
            <b>Retenção (cron):</b> <code>POST {base}/api/cron/cleanup</code> com{' '}
            <code>x-cron-secret</code>
          </li>
        </ul>
      </section>
    </div>
  );
}
