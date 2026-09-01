'use client';

import { useEffect, useState } from 'react';
import type { PublicTrackingSnapshot } from '@leeva/shared/services';

/**
 * Página pública de rastreamento. Faz polling leve (15s) do snapshot para
 * atualizar status + posição do motoboy. Não usa realtime porque a página
 * é anônima (sem sessão) — polling é o caminho seguro aqui.
 */
export default function TrackingLive({
  token,
  initial,
}: {
  token: string;
  initial: PublicTrackingSnapshot;
}) {
  const [snap, setSnap] = useState(initial);

  useEffect(() => {
    if (snap.delivered || snap.cancelled) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/track/${token}`, { cache: 'no-store' });
        if (res.ok) setSnap(await res.json());
      } catch {
        /* rede instável — tenta de novo no próximo ciclo */
      }
    }, 15000);
    return () => clearInterval(iv);
  }, [token, snap.delivered, snap.cancelled]);

  if (snap.cancelled) {
    return (
      <div className="track-wrap">
        <div className="track-card">
          <p className="muted">{snap.restaurantName}</p>
          <h1>Pedido cancelado</h1>
          <p className="muted">Pedido #{snap.orderNumber ?? '—'}</p>
          <p className="muted" style={{ marginTop: 12 }}>
            Este pedido foi cancelado. Fale com o restaurante se tiver dúvidas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="track-wrap">
      <div className="track-card">
        <p className="muted">{snap.restaurantName}</p>
        <h1>{snap.delivered ? 'Seu pedido foi entregue 🎉' : 'Seu pedido está a caminho'}</h1>
        <p className="muted">Pedido #{snap.orderNumber ?? '—'}</p>

        {snap.etaText && <div className="track-eta">⏱️ {snap.etaText}</div>}

        <ul className="track-steps">
          {snap.steps.map((s) => (
            <li key={s.key} className={`${s.done ? 'done' : ''} ${s.current ? 'current' : ''}`}>
              <span className="track-dot" />
              {s.label}
            </li>
          ))}
        </ul>

        <MiniMap snap={snap} />

        {snap.driver && !snap.delivered && (
          <p className="muted" style={{ marginTop: 12 }}>
            Entregador: <strong>{snap.driver.name}</strong>
            {snap.driver.position ? ' — posição ao vivo no mapa acima' : ' (localização indisponível no momento)'}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Mini-mapa esquemático a partir de coordenadas REAIS (origem, destino,
 * motoboy). Não é um mapa de ruas — é uma representação proporcional das
 * posições. O link abre o mapa de verdade (OpenStreetMap).
 */
function MiniMap({ snap }: { snap: PublicTrackingSnapshot }) {
  const pts = [
    snap.origin && { ...snap.origin, kind: 'origin' as const },
    snap.destination && { ...snap.destination, kind: 'dest' as const },
    snap.driver?.position && { ...snap.driver.position, kind: 'driver' as const },
  ].filter(Boolean) as { latitude: number; longitude: number; kind: string }[];

  if (pts.length < 2) {
    return (
      <p className="muted" style={{ fontSize: 13 }}>
        Mapa disponível quando houver localização do pedido e do entregador.
      </p>
    );
  }

  const lats = pts.map((p) => p.latitude);
  const lngs = pts.map((p) => p.longitude);
  const minLat = Math.min(...lats),
    maxLat = Math.max(...lats),
    minLng = Math.min(...lngs),
    maxLng = Math.max(...lngs);
  const pad = 0.15;
  const w = 420,
    h = 200;
  const x = (lng: number) =>
    24 + ((lng - minLng) / (maxLng - minLng || 1)) * (w - 48) * (1 - pad) + (w * pad) / 2;
  const y = (lat: number) =>
    h - 24 - ((lat - minLat) / (maxLat - minLat || 1)) * (h - 48) * (1 - pad) - (h * pad) / 2;

  const colors: Record<string, string> = { origin: '#9aa0aa', dest: '#ff5a1f', driver: 'var(--ok)' };
  const labels: Record<string, string> = { origin: 'Restaurante', dest: 'Você', driver: 'Entregador' };
  const dest = snap.destination;

  return (
    <div>
      <svg className="track-map" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
        {snap.driver?.position && snap.destination && (
          <line
            x1={x(snap.driver.position.longitude)}
            y1={y(snap.driver.position.latitude)}
            x2={x(snap.destination.longitude)}
            y2={y(snap.destination.latitude)}
            stroke="#2a2e37"
            strokeDasharray="4 4"
          />
        )}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={x(p.longitude)} cy={y(p.latitude)} r={7} fill={colors[p.kind]} />
            <text x={x(p.longitude) + 11} y={y(p.latitude) + 4} fill="#9aa0aa" fontSize="11">
              {labels[p.kind]}
            </text>
          </g>
        ))}
      </svg>
      {dest && (
        <a
          className="track-link"
          href={`https://www.openstreetmap.org/?mlat=${dest.latitude}&mlon=${dest.longitude}#map=16/${dest.latitude}/${dest.longitude}`}
          target="_blank"
          rel="noreferrer"
        >
          Abrir endereço no mapa
        </a>
      )}
    </div>
  );
}
