'use client';

import { useCallback, useEffect, useState } from 'react';

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = 'unsupported' | 'default' | 'denied' | 'granted' | 'working';

/**
 * Ativa as notificações do celular (Web Push). Mostra um cartão claro
 * pedindo permissão; some assim que estiver tudo certo. Também re-sincroniza
 * a assinatura em silêncio quando a permissão já foi dada.
 */
export default function NotificationSetup({ askNow = false }: { askNow?: boolean }) {
  const [state, setState] = useState<State>('default');
  const [msg, setMsg] = useState<string | null>(null);

  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !!PUBLIC_KEY;

  const subscribe = useCallback(async () => {
    if (!supported) return;
    setState('working');
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      let perm = Notification.permission;
      if (perm === 'default') perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setState(perm === 'denied' ? 'denied' : 'default');
        return;
      }

      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY!),
        }));

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error('falha ao registrar no servidor');
      setState('granted');
      setMsg('Notificações ativadas. Você vai receber as ofertas mesmo com o app fechado.');
    } catch (e) {
      setState('default');
      setMsg((e as Error).message || 'não deu para ativar agora');
    }
  }, [supported]);

  // re-sincroniza em silêncio quando já autorizado
  useEffect(() => {
    if (!supported) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'granted') {
      setState('granted');
      void subscribe();
    } else if (Notification.permission === 'denied') {
      setState('denied');
    } else if (askNow) {
      void subscribe();
    }
  }, [supported, subscribe, askNow]);

  async function sendTest() {
    setMsg('enviando teste…');
    const r = await fetch('/api/push/test', { method: 'POST' });
    const d = await r.json().catch(() => ({}));
    setMsg(d.sent ? 'Teste enviado — confira a notificação.' : 'Não chegou. Reative abaixo.');
  }

  if (state === 'unsupported' || state === 'granted') {
    // quando ativo, deixa só um respiro discreto com o teste
    if (state === 'granted') {
      return (
        <p className="muted" style={{ fontSize: 13 }}>
          🔔 Notificações ativas.{' '}
          <button
            onClick={sendTest}
            style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
          >
            enviar teste
          </button>
          {msg && <> — {msg}</>}
        </p>
      );
    }
    return null;
  }

  return (
    <div className="panel" style={{ borderColor: 'var(--accent, #6c8cff)' }}>
      <strong>Ative as notificações</strong>
      <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
        {state === 'denied'
          ? 'As notificações estão bloqueadas no navegador. Abra os ajustes do site e permita "Notificações" para receber as ofertas.'
          : 'Para receber as ofertas de entrega no celular — mesmo com o app fechado — o Leeva precisa da sua permissão.'}
      </p>
      {state !== 'denied' && (
        <button className="button" style={{ marginTop: 10 }} disabled={state === 'working'} onClick={subscribe}>
          {state === 'working' ? 'Ativando…' : 'Permitir notificações'}
        </button>
      )}
      {msg && <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{msg}</p>}
    </div>
  );
}
