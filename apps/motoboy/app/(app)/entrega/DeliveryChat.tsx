'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';

type Message = { id: string; senderType: 'restaurant' | 'motoboy'; senderId: string; body: string; createdAt: string };

/** Chat do pedido com o restaurante. Atualiza por polling (5s). */
export function DeliveryChat({ orderId }: { orderId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/deliveries/${orderId}/messages`, { cache: 'no-store' });
      if (res.ok) {
        const d = (await res.json()) as { messages: Message[] };
        setMessages(d.messages);
      }
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
      await fetch(`/api/deliveries/${orderId}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="button secondary" onClick={() => setOpen(true)}>
        <MessageCircle size={14} /> Chat com o restaurante
      </button>
    );
  }

  return (
    <div className="panel" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="muted" style={{ fontSize: 12 }}>Chat com o restaurante</span>
        <button type="button" className="btn sm" onClick={() => setOpen(false)}>Fechar</button>
      </div>
      <div
        ref={listRef}
        style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0' }}
      >
        {messages.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Nenhuma mensagem ainda.</p>}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.senderType === 'motoboy' ? 'flex-end' : 'flex-start',
              background: m.senderType === 'motoboy' ? 'var(--brand)' : 'var(--surface-2)',
              color: m.senderType === 'motoboy' ? '#fff' : 'inherit',
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
        <button type="button" className="button" disabled={busy || !text.trim()} onClick={send}>
          Enviar
        </button>
      </div>
    </div>
  );
}
