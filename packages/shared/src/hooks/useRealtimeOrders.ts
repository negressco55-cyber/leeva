'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createLeevaBrowserClient } from '../supabase/client';
import type { Order } from '../types/index';

type Options = {
  /** Filtra por restaurante (painel) — ex: restaurantId */
  restaurantId?: string;
  /** Filtra por motoboy (app do entregador) — ex: motoboyId */
  motoboyId?: string;
};

/**
 * Assina em tempo real a tabela `orders`.
 * Retorna a lista atual + um log dos últimos eventos (útil para o teste manual).
 *
 * O RLS continua valendo: o cliente só recebe eventos das linhas que
 * ele poderia ler normalmente.
 */
export function useRealtimeOrders(options: Options = {}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const filter = options.restaurantId
    ? `restaurant_id=eq.${options.restaurantId}`
    : options.motoboyId
      ? `motoboy_id=eq.${options.motoboyId}`
      : undefined;

  useEffect(() => {
    const supabase = createLeevaBrowserClient();

    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (options.restaurantId) query = query.eq('restaurant_id', options.restaurantId);
    if (options.motoboyId) query = query.eq('motoboy_id', options.motoboyId);
    query.then(({ data }) => {
      if (data) setOrders(data as Order[]);
    });

    const channel = supabase
      .channel(`orders-${filter ?? 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter },
        (payload) => {
          setEvents((prev) =>
            [
              `${new Date().toLocaleTimeString('pt-BR')} — ${payload.eventType} pedido`,
              ...prev,
            ].slice(0, 20),
          );

          setOrders((prev) => {
            if (payload.eventType === 'INSERT') return [payload.new as Order, ...prev];
            if (payload.eventType === 'UPDATE')
              return prev.map((o) => (o.id === (payload.new as Order).id ? (payload.new as Order) : o));
            if (payload.eventType === 'DELETE')
              return prev.filter((o) => o.id !== (payload.old as Order).id);
            return prev;
          });
        },
      )
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'));

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return { orders, events, connected };
}
