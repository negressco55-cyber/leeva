'use client';

import { useEffect, useState } from 'react';
import { createLeevaBrowserClient } from '../supabase/client';
import type { Motoboy } from '../types/index';

/**
 * Assina em tempo real a tabela `motoboys` de um restaurante.
 * Ex: o painel vê o motoboy ficar "available" no instante em que ele
 * aperta "ficar online" no app.
 */
export function useRealtimeMotoboys(restaurantId: string | undefined) {
  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    const supabase = createLeevaBrowserClient();

    supabase
      .from('motoboys')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('full_name')
      .then(({ data }) => {
        if (data) setMotoboys(data as Motoboy[]);
      });

    const channel = supabase
      .channel(`motoboys-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'motoboys',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          setEvents((prev) =>
            [
              `${new Date().toLocaleTimeString('pt-BR')} — ${payload.eventType} motoboy`,
              ...prev,
            ].slice(0, 20),
          );
          setMotoboys((prev) => {
            if (payload.eventType === 'INSERT') return [...prev, payload.new as Motoboy];
            if (payload.eventType === 'UPDATE')
              return prev.map((m) =>
                m.id === (payload.new as Motoboy).id ? (payload.new as Motoboy) : m,
              );
            if (payload.eventType === 'DELETE')
              return prev.filter((m) => m.id !== (payload.old as Motoboy).id);
            return prev;
          });
        },
      )
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  return { motoboys, events, connected };
}
