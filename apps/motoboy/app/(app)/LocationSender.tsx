'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, MapPin } from 'lucide-react';
import { createLeevaBrowserClient } from '@leeva/shared/client';

/**
 * Envia a localização do motoboy enquanto ele estiver online.
 * - usa watchPosition (o navegador entrega updates quando ele se move);
 * - faz throttle para no máximo 1 envio a cada 10s (bateria/dados);
 * - grava DIRETO no Supabase (função record_my_location), sem passar pela
 *   Vercel; o painel do restaurante recebe pelo Realtime;
 * - o banco só grava se houver entrega ativa (privacidade);
 * - perto do cliente (< 400 m), chama /api/location uma vez por entrega
 *   para disparar o aviso "seu pedido está chegando".
 */
export default function LocationSender({ active }: { active: boolean }) {
  const lastSent = useRef(0);
  const nearbySent = useRef(new Set<string>());
  const [state, setState] = useState<'idle' | 'sending' | 'denied' | 'off'>('off');

  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.geolocation) {
      setState('off');
      return;
    }
    setState('idle');
    const supabase = createLeevaBrowserClient();

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastSent.current < 10000) return;
        lastSent.current = now;
        setState('sending');
        const body = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed ?? undefined,
        };
        try {
          const { data } = await supabase.rpc('record_my_location', {
            p_latitude: body.latitude,
            p_longitude: body.longitude,
            p_accuracy: body.accuracy ?? undefined,
            p_speed: body.speed ?? undefined,
          });
          const r = data as { nearby?: boolean; order_id?: string } | null;
          if (r?.nearby && r.order_id && !nearbySent.current.has(r.order_id)) {
            nearbySent.current.add(r.order_id);
            await fetch('/api/location', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(body),
            });
          }
        } catch {
          /* rede — tenta no próximo movimento */
        }
        setState('idle');
      },
      () => setState('denied'),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [active]);

  if (!active) return null;

  return (
    <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 8 }}>
      {state === 'denied'
        ? <><AlertTriangle size={13} /> Permissão de localização negada — o cliente não verá você no mapa.</>
        : <><MapPin size={13} /> Compartilhando localização durante as entregas.</>}
    </p>
  );
}
