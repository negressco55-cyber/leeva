/**
 * PushService — Web Push (VAPID) para o app do motoboy (PWA).
 *
 * O navegador do motoboy gera uma "subscription" quando ele autoriza
 * notificações. Guardamos em `push_subscriptions`. Para enviar, usamos a
 * lib `web-push` com as chaves VAPID (env). Assinaturas mortas (404/410)
 * são removidas automaticamente.
 *
 * Se VAPID_* não estiver configurado, `sendPushToMotoboy` vira no-op e
 * devolve { ok:false, skipped:true } — nada finge que enviou.
 */
import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

type DB = SupabaseClient<Database>;

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:contato@leeva.app';
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string | null;
};

export async function savePushSubscription(db: DB, motoboyId: string, sub: PushSubscriptionInput) {
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { ok: false as const, error: 'subscription inválida' };
  }
  const { error } = await db
    .from('push_subscriptions')
    .upsert(
      {
        motoboy_id: motoboyId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: sub.userAgent ?? null,
        last_seen_at: new Date().toISOString(),
        failure_count: 0,
      },
      { onConflict: 'endpoint' },
    );
  if (error) return { ok: false as const, error: error.message };
  await db.from('motoboys').update({ push_enabled: true }).eq('id', motoboyId);
  return { ok: true as const };
}

/** Registra (ou atualiza) um token de push do app nativo (Expo). */
export async function saveExpoPushToken(db: DB, motoboyId: string, token: string) {
  if (!token || !/^ExponentPushToken\[|^ExpoPushToken\[/.test(token)) {
    return { ok: false as const, error: 'token Expo inválido' };
  }
  const { error } = await db.from('push_subscriptions').upsert(
    {
      motoboy_id: motoboyId,
      endpoint: token,
      kind: 'expo',
      p256dh: null,
      auth: null,
      last_seen_at: new Date().toISOString(),
      failure_count: 0,
    },
    { onConflict: 'endpoint' },
  );
  if (error) return { ok: false as const, error: error.message };
  await db.from('motoboys').update({ push_enabled: true }).eq('id', motoboyId);
  return { ok: true as const };
}

export async function deletePushSubscription(db: DB, motoboyId: string, endpoint: string) {
  await db.from('push_subscriptions').delete().eq('motoboy_id', motoboyId).eq('endpoint', endpoint);
  const { count } = await db
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('motoboy_id', motoboyId);
  if (!count) await db.from('motoboys').update({ push_enabled: false }).eq('id', motoboyId);
  return { ok: true as const };
}

export type PushPayload = {
  title: string;
  body: string;
  /** rota aberta ao clicar (ex: '/status', '/entrega') */
  url?: string;
  tag?: string;
  /** vibração/urgência maior */
  urgent?: boolean;
  data?: Record<string, unknown>;
};

/**
 * Envia para TODOS os dispositivos do motoboy. Remove assinaturas mortas.
 * Nunca lança — devolve um resumo.
 */
export async function sendPushToMotoboy(
  db: DB,
  motoboyId: string,
  payload: PushPayload,
): Promise<{ ok: boolean; sent: number; removed: number; skipped?: boolean; error?: string }> {
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, failure_count, kind')
    .eq('motoboy_id', motoboyId);
  if (!subs?.length) return { ok: false, sent: 0, removed: 0, error: 'sem dispositivos' };

  const webSubs = subs.filter((s) => s.kind !== 'expo');
  const expoSubs = subs.filter((s) => s.kind === 'expo');
  if (!expoSubs.length && !ensureConfigured()) {
    return { ok: false, sent: 0, removed: 0, skipped: true, error: 'VAPID não configurado' };
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/status',
    tag: payload.tag,
    urgent: !!payload.urgent,
    data: payload.data ?? {},
  });

  let sent = 0;
  let removed = 0;

  // --- Web Push (VAPID) ---
  if (ensureConfigured()) {
    for (const s of webSubs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh ?? '', auth: s.auth ?? '' } },
          body,
          { TTL: payload.urgent ? 60 : 600, urgency: payload.urgent ? 'high' : 'normal' },
        );
        sent++;
        if (s.failure_count > 0) {
          await db.from('push_subscriptions').update({ failure_count: 0, last_seen_at: new Date().toISOString() }).eq('id', s.id);
        }
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.from('push_subscriptions').delete().eq('id', s.id);
          removed++;
        } else {
          await db.from('push_subscriptions').update({ failure_count: s.failure_count + 1 }).eq('id', s.id);
        }
      }
    }
  }

  // --- Expo Push (app nativo) ---
  if (expoSubs.length) {
    try {
      const messages = expoSubs.map((s) => ({
        to: s.endpoint,
        title: payload.title,
        body: payload.body,
        sound: 'default',
        priority: payload.urgent ? 'high' : 'normal',
        channelId: payload.tag === 'offer' ? 'ofertas' : undefined,
        data: { url: payload.url ?? '/status', ...(payload.data ?? {}) },
      }));
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(8000),
      });
      const out = (await res.json().catch(() => null)) as { data?: Array<{ status: string; details?: { error?: string } }> } | null;
      const tickets = out?.data ?? [];
      for (let i = 0; i < expoSubs.length; i++) {
        const t = tickets[i];
        if (t?.status === 'ok') {
          sent++;
        } else if (t?.details?.error === 'DeviceNotRegistered') {
          await db.from('push_subscriptions').delete().eq('id', expoSubs[i]!.id);
          removed++;
        } else {
          await db.from('push_subscriptions').update({ failure_count: expoSubs[i]!.failure_count + 1 }).eq('id', expoSubs[i]!.id);
        }
      }
    } catch {
      for (const s of expoSubs) {
        await db.from('push_subscriptions').update({ failure_count: s.failure_count + 1 }).eq('id', s.id);
      }
    }
  }
  // se removeu tudo, marca push_enabled = false
  if (removed && sent === 0) {
    const { count } = await db
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('motoboy_id', motoboyId);
    if (!count) await db.from('motoboys').update({ push_enabled: false }).eq('id', motoboyId);
  }
  return { ok: sent > 0, sent, removed };
}
