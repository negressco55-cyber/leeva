'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, apiPost } from '../_lib/client';

type Message = { id: string; senderType: 'restaurant' | 'motoboy'; senderId: string; body: string; createdAt: string };

/** Chat do pedido com o entregador atribuído. Atualiza por polling (5s). */
export function OrderChat({ orderId, startOpen }: { orderId: string; startOpen?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(!!startOpen);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (startOpen) setOpen(true);
  }, [startOpen]);

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ messages: Message[] }>(`/api/orders/${orderId}/messages`);
      setMessages(d.messages);
    } catch {
      /* próximo ciclo */
    }
  }, [orderId]);

  useEffect(() => {
    if (!open) return;
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [open, load]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setText('');
    try {
      await apiPost(`/api/orders/${orderId}/messages`, { body });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="button secondary" onClick={() => setOpen(true)} style={{ marginTop: 10 }}>
        💬 Chat com o entregador
      </button>
    );
  }

  return (
    <div className="section" style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="muted" style={{ fontSize: 12 }}>Chat com o entregador</span>
        <button className="btn sm" onClick={() => setOpen(false)}>Fechar</button>
      </div>
      <div
        ref={listRef}
        style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0' }}
      >
        {messages.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Nenhuma mensagem ainda.</p>}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.senderType === 'restaurant' ? 'flex-end' : 'flex-start',
              background: m.senderType === 'restaurant' ? 'var(--brand)' : 'var(--surface-2)',
              color: m.senderType === 'restaurant' ? '#fff' : 'inherit',
              borderRadius: 10,
              padding: '6px 10px',
              fontSize: 13,
              maxWidth: '80%',
            }}
          >
            {m.body}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="input"
          placeholder="Escreva uma mensagem…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          style={{ flex: 1 }}
        />
        <button className="btn primary" disabled={busy || !text.trim()} onClick={send}>
          Enviar
        </button>
      </div>
    </div>
  );
}
