'use client';

import { useEffect, useRef, useState } from 'react';
import { createLeevaBrowserClient } from '../supabase/client';

export type LivePosition = { motoboyId: string; orderId: string | null; latitude: number; longitude: number };

/**
 * "Ao vivo" do painel do restaurante, direto do Supabase Realtime — sem
 * polling na Vercel.
 *
 * - `onDriverPosition`: cada ponto novo de GPS de um motoboy numa entrega
 *   deste restaurante (driver_locations). Move o marcador na hora.
 * - `onOrdersChange`: algum pedido do restaurante mudou (novo, status,
 *   despacho). Vem agrupado (debounce) pra não recarregar a cada evento.
 *
 * O RLS continua valendo: só chegam linhas que a equipe já podia ler.
 */
export function useLiveOps(
  restaurantId: string,
  handlers: { onDriverPosition?: (p: LivePosition) => void; onOrdersChange?: () => void },
  debounceMs = 1500,
) {
  const [connected, setConnected] = useState(false);
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const supabase = createLeevaBrowserClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ordersChanged = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => ref.current.onOrdersChange?.(), debounceMs);
    };

    const channel = supabase
      .channel(`live-ops-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'driver_locations', filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          const row = payload.new as {
            motoboy_id: string;
            order_id: string | null;
            latitude: number;
            longitude: number;
          };
          ref.current.onDriverPosition?.({
            motoboyId: row.motoboy_id,
            orderId: row.order_id,
            latitude: row.latitude,
            longitude: row.longitude,
          });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        ordersChanged,
      )
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'));

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [restaurantId, debounceMs]);

  return { connected };
}
