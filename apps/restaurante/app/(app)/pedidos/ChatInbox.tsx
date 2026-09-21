'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from '../_lib/client';

type Conversation = {
  orderId: string;
  orderNumber: number | null;
  customerName: string;
  status: string;
  lastMessage: { id: string; senderType: 'restaurant' | 'motoboy'; body: string; createdAt: string };
};

let beepCtx: AudioContext | null = null;
function beep(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!beepCtx) beepCtx = new Ctx();
    const ctx = beepCtx;
    if (ctx.state === 'suspended') void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 740;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  } catch {
    /* sem áudio disponível — ignora */
  }
}

/** Notificação do navegador (aparece mesmo com a aba em segundo plano), se o restaurante permitiu. */
function notifyBrowser(c: { orderNumber: number | null; lastMessage: { body: string } } | undefined): void {
  try {
    if (!c || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    new Notification('Mensagem do entregador — pedido #' + c.orderNumber, { body: c.lastMessage.body.slice(0, 120) });
  } catch {
    /* navegador sem suporte */
  }
}

const SEEN_KEY = 'leeva-chats-seen';
function loadSeen(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}');
  } catch {
    return {};
  }
}
function markSeen(orderId: string, messageId: string) {
  const seen = loadSeen();
  seen[orderId] = messageId;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* modo privado */
  }
}

/** Painel "chats abertos" — lista os pedidos com conversa, com aviso sonoro
 *  quando chega mensagem nova do motoboy. Clicar abre o pedido + o chat. */
export function ChatInbox({ onOpenOrder }: { onOpenOrder: (orderId: string) => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ conversations: Conversation[] }>('/api/orders/messages/recent');
      if (!firstLoad.current) {
        const seen = loadSeen();
        const hasNew = d.conversations.some(
          (c) => c.lastMessage.senderType === 'motoboy' && seen[c.orderId] !== c.lastMessage.id,
        );
        if (hasNew) {
          beep();
          notifyBrowser(d.conversations.find((c) => c.lastMessage.senderType === 'motoboy' && seen[c.orderId] !== c.lastMessage.id));
        }
      }
      firstLoad.current = false;
      setConversations(d.conversations);
    } catch {
      /* próximo ciclo */
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [load]);

  const [perm, setPerm] = useState<string>(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const askPerm = perm === 'default' && (
    <button type="button" className="btn sm" style={{ marginBottom: 10 }} onClick={() => void Notification.requestPermission().then(setPerm)}>
      🔔 Ativar avisos do navegador pra novas mensagens
    </button>
  );

  if (!conversations.length) return askPerm || null;

  const seen = loadSeen();

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      {askPerm}
      <div className="card-title">💬 Chats abertos</div>
      <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
        {conversations.map((c) => {
          const isNew = c.lastMessage.senderType === 'motoboy' && seen[c.orderId] !== c.lastMessage.id;
          return (
            <button
              key={c.orderId}
              type="button"
              className="btn"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                textAlign: 'left',
                fontWeight: isNew ? 700 : 400,
              }}
              onClick={() => {
                markSeen(c.orderId, c.lastMessage.id);
                onOpenOrder(c.orderId);
              }}
            >
              <span>
                {isNew && '🔴 '}
                #{c.orderNumber} — {c.customerName}
              </span>
              <span className="muted" style={{ fontSize: 12, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.lastMessage.senderType === 'motoboy' ? '🛵 ' : '🏪 '}
                {c.lastMessage.body}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
