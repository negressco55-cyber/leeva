/**
 * NotificationService — serviço central de notificações.
 *
 * Canais:
 *  - in_app  -> IMPLEMENTADO (grava em `notifications`, aparece no painel)
 *  - whatsapp -> PREPARADO   (WhatsAppChannel: envia de verdade se
 *                WHATSAPP_TOKEN + WHATSAPP_PHONE_ID estiverem setados;
 *                senão marca a notificação como 'skipped' com o motivo)
 *  - sms     -> PREPARADO    (idem, TWILIO_*)
 *  - push    -> PREPARADO    (idem, WEB_PUSH_* / VAPID)
 *
 * Nada aqui finge que enviou. Se o canal não está configurado, a
 * notificação fica com status 'skipped' e o motivo no campo `error`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

type DB = SupabaseClient<Database>;
type Channel = Database['public']['Enums']['notification_channel'];

export interface NotificationChannelAdapter {
  readonly channel: Channel;
  readonly configured: boolean;
  readonly statusLabel: 'implemented' | 'prepared' | 'mock';
  send(msg: OutboundMessage): Promise<{ ok: boolean; error?: string }>;
}

export type OutboundMessage = {
  to: string;
  title?: string;
  body: string;
  data?: Record<string, unknown>;
};

/** in-app: a própria linha em `notifications` já é a entrega. */
class InAppChannel implements NotificationChannelAdapter {
  channel: Channel = 'in_app';
  configured = true;
  statusLabel = 'implemented' as const;
  async send() {
    return { ok: true };
  }
}

class WhatsAppChannel implements NotificationChannelAdapter {
  channel: Channel = 'whatsapp';
  statusLabel = 'prepared' as const;
  get configured() {
    return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
  }
  async send(msg: OutboundMessage) {
    if (!this.configured)
      return { ok: false, error: 'WhatsApp não configurado (WHATSAPP_TOKEN / WHATSAPP_PHONE_ID ausentes) — PREPARADO' };
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: msg.to,
            type: 'text',
            text: { body: msg.title ? `*${msg.title}*\n${msg.body}` : msg.body },
          }),
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!res.ok) return { ok: false, error: `WhatsApp API ${res.status}: ${await res.text()}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: `WhatsApp: ${(e as Error).message}` };
    }
  }
}

class SmsChannel implements NotificationChannelAdapter {
  channel: Channel = 'sms';
  statusLabel = 'prepared' as const;
  get configured() {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM,
    );
  }
  async send(msg: OutboundMessage) {
    if (!this.configured)
      return { ok: false, error: 'SMS não configurado (TWILIO_* ausentes) — PREPARADO' };
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID!;
      const body = new URLSearchParams({
        To: msg.to,
        From: process.env.TWILIO_FROM!,
        Body: msg.body,
      });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization:
            'Basic ' + btoa(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return { ok: false, error: `Twilio ${res.status}: ${await res.text()}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: `SMS: ${(e as Error).message}` };
    }
  }
}

class PushChannel implements NotificationChannelAdapter {
  channel: Channel = 'push';
  statusLabel = 'prepared' as const;
  get configured() {
    return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  }
  async send() {
    if (!this.configured)
      return { ok: false, error: 'Web Push não configurado (VAPID_* ausentes) — PREPARADO' };
    // Envio real de Web Push exige a lib `web-push` + subscription do device.
    return { ok: false, error: 'Push: assinatura do dispositivo ainda não implementada — PREPARADO' };
  }
}

const ADAPTERS: Record<Channel, NotificationChannelAdapter> = {
  in_app: new InAppChannel(),
  whatsapp: new WhatsAppChannel(),
  sms: new SmsChannel(),
  push: new PushChannel(),
};

export function getChannelAdapter(channel: Channel): NotificationChannelAdapter {
  return ADAPTERS[channel];
}

export function channelStatuses() {
  return (Object.keys(ADAPTERS) as Channel[]).map((c) => ({
    channel: c,
    configured: ADAPTERS[c].configured,
    status: ADAPTERS[c].statusLabel,
  }));
}

export type QueueInput = {
  restaurantId: string;
  orderId?: string | null;
  channel?: Channel;
  recipientType: Database['public']['Enums']['notification_recipient'];
  recipient?: string | null;
  template: string;
  title?: string;
  body: string;
  data?: Record<string, unknown>;
};

/** Enfileira e tenta enviar imediatamente. */
export async function queueNotification(db: DB, input: QueueInput) {
  const channel = input.channel ?? 'in_app';
  const { data: row, error } = await db
    .from('notifications')
    .insert({
      restaurant_id: input.restaurantId,
      order_id: input.orderId ?? null,
      channel,
      recipient_type: input.recipientType,
      recipient: input.recipient ?? null,
      template: input.template,
      title: input.title ?? null,
      body: input.body,
      data: (input.data ?? {}) as Database['public']['Tables']['notifications']['Insert']['data'],
    })
    .select('id')
    .single();
  if (error || !row) return { ok: false, error: error?.message };

  const adapter = getChannelAdapter(channel);
  if (channel === 'in_app') {
    await db.from('notifications').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', row.id);
    return { ok: true, id: row.id };
  }

  if (!input.recipient) {
    await db.from('notifications').update({ status: 'skipped', error: 'sem destinatário' }).eq('id', row.id);
    return { ok: false, id: row.id, error: 'sem destinatário' };
  }

  const result = await adapter.send({
    to: input.recipient,
    title: input.title,
    body: input.body,
    data: input.data,
  });
  await db
    .from('notifications')
    .update({
      status: result.ok ? 'sent' : 'skipped',
      error: result.error ?? null,
      sent_at: result.ok ? new Date().toISOString() : null,
      attempts: 1,
    })
    .eq('id', row.id);
  return { ...result, id: row.id };
}

/**
 * Notifica o cliente sobre um evento do pedido. Sempre grava a versão
 * in-app (visível no rastreamento) e, se houver telefone + canal externo
 * configurado, tenta também por lá.
 */
export async function queueCustomerNotification(
  db: DB,
  args: { restaurantId: string; orderId: string; template: string; body: string; title?: string },
) {
  // dedup: um mesmo (pedido, template) só notifica o cliente uma vez
  const { data: dup } = await db
    .from('notifications')
    .select('id')
    .eq('order_id', args.orderId)
    .eq('template', args.template)
    .eq('recipient_type', 'customer')
    .limit(1);
  if (dup?.length) return;

  const { data: order } = await db
    .from('orders')
    .select('customer_phone')
    .eq('id', args.orderId)
    .maybeSingle();

  // link de rastreamento — sempre existe, e vai junto da notificação
  let trackUrl: string | null = null;
  try {
    const { ensureTrackingToken, trackingUrl } = await import('./tracking');
    const token = await ensureTrackingToken(db, args.orderId);
    if (token) trackUrl = trackingUrl(token);
  } catch {
    /* rastreamento indisponível não bloqueia a notificação */
  }

  const bodyWithLink = trackUrl ? `${args.body}\nAcompanhe: ${trackUrl}` : args.body;

  await queueNotification(db, {
    restaurantId: args.restaurantId,
    orderId: args.orderId,
    channel: 'in_app',
    recipientType: 'customer',
    template: args.template,
    title: args.title,
    body: args.body,
    data: trackUrl ? { tracking_url: trackUrl } : undefined,
  });

  // canal externo preferencial: WhatsApp se configurado, senão SMS
  const wa = getChannelAdapter('whatsapp');
  const sms = getChannelAdapter('sms');
  const phone = order?.customer_phone ?? null;
  if (phone && wa.configured) {
    await queueNotification(db, {
      restaurantId: args.restaurantId,
      orderId: args.orderId,
      channel: 'whatsapp',
      recipientType: 'customer',
      recipient: phone,
      template: args.template,
      title: args.title,
      body: bodyWithLink,
    });
  } else if (phone && sms.configured) {
    await queueNotification(db, {
      restaurantId: args.restaurantId,
      orderId: args.orderId,
      channel: 'sms',
      recipientType: 'customer',
      recipient: phone,
      template: args.template,
      body: bodyWithLink,
    });
  }
}
