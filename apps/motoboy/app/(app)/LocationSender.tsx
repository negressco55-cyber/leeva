'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Envia a localização do motoboy enquanto ele estiver online.
 * - usa watchPosition (o navegador entrega updates quando ele se move);
 * - faz throttle para no máximo 1 envio a cada 20s (bateria/dados);
 * - o backend só grava se houver entrega ativa (privacidade).
 */
export default function LocationSender({ active }: { active: boolean }) {
  const lastSent = useRef(0);
  const [state, setState] = useState<'idle' | 'sending' | 'denied' | 'off'>('off');

  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.geolocation) {
      setState('off');
      return;
    }
    setState('idle');

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastSent.current < 20000) return;
        lastSent.current = now;
        setState('sending');
        try {
          await fetch('/api/location', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              speed: pos.coords.speed ?? undefined,
            }),
          });
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
        ? '⚠️ Permissão de localização negada — o cliente não verá você no mapa.'
        : '📍 Compartilhando localização durante as entregas.'}
    </p>
  );
}
