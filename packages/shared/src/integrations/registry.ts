/**
 * Registro central de provedores de pedido. Adicionar uma integração nova
 * = registrar aqui + implementar a interface OrderProvider. O resto do
 * sistema não muda.
 */
import type { OrderProvider } from './types';
import type { IntegrationProvider, IntegrationStatus, OrderSource } from '../types';
import { ManualOrderProvider } from './manual';
import { IFoodOrderProvider } from './ifood';
import { WhatsAppOrderProvider } from './whatsapp';
import { WebsiteOrderProvider } from './website';
import { channelStatuses } from '../services/notifications';

const providers: Record<OrderSource, OrderProvider> = {
  manual: new ManualOrderProvider(),
  ifood: new IFoodOrderProvider(),
  whatsapp: new WhatsAppOrderProvider(),
  menu: new WebsiteOrderProvider('menu'),
  api: new WebsiteOrderProvider('api'),
};

export function getOrderProvider(source: OrderSource): OrderProvider {
  return providers[source];
}

export type IntegrationInfo = {
  provider: IntegrationProvider | OrderSource;
  kind: 'order-source' | 'notification' | 'routing';
  status: IntegrationStatus;
  configured: boolean;
  requires: string[];
  docs: string;
};

/** Panorama de todas as integrações e o que falta em cada uma. */
export function integrationsOverview(): IntegrationInfo[] {
  const list: IntegrationInfo[] = [
    {
      provider: 'manual',
      kind: 'order-source',
      status: 'implemented',
      configured: true,
      requires: [],
      docs: 'docs/INTEGRATIONS.md#manual',
    },
    {
      provider: 'menu',
      kind: 'order-source',
      status: 'implemented',
      configured: true,
      requires: ['x-leeva-api-key (gerada no painel de integrações)'],
      docs: 'docs/INTEGRATIONS.md#cardapio-api',
    },
    {
      provider: 'ifood',
      kind: 'order-source',
      status: 'prepared',
      configured: Boolean(process.env.IFOOD_ACCESS_TOKEN && process.env.IFOOD_WEBHOOK_SECRET),
      requires: ['IFOOD_ACCESS_TOKEN', 'IFOOD_WEBHOOK_SECRET', 'app aprovado + merchant homologado'],
      docs: 'docs/INTEGRATIONS.md#ifood',
    },
    {
      provider: 'whatsapp',
      kind: 'order-source',
      status: 'prepared',
      configured: Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_APP_SECRET),
      requires: [
        'WHATSAPP_TOKEN',
        'WHATSAPP_PHONE_ID',
        'WHATSAPP_APP_SECRET',
        'WHATSAPP_VERIFY_TOKEN',
        'ANTHROPIC_API_KEY (opcional, melhora a leitura da mensagem)',
      ],
      docs: 'docs/INTEGRATIONS.md#whatsapp',
    },
    {
      provider: 'maps',
      kind: 'routing',
      status: process.env.OSRM_BASE_URL ? 'implemented' : 'prepared',
      configured: Boolean(process.env.OSRM_BASE_URL),
      requires: ['OSRM_BASE_URL (rota real) — sem isso usa distância em linha reta'],
      docs: 'docs/INTEGRATIONS.md#rotas',
    },
  ];

  for (const c of channelStatuses()) {
    if (c.channel === 'in_app') continue;
    list.push({
      provider: c.channel as IntegrationProvider,
      kind: 'notification',
      status: c.status as IntegrationStatus,
      configured: c.configured,
      requires:
        c.channel === 'whatsapp'
          ? ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_ID']
          : c.channel === 'sms'
            ? ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM']
            : ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'subscription do device'],
      docs: `docs/INTEGRATIONS.md#${c.channel}`,
    });
  }

  return list;
}
