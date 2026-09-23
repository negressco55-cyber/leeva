'use client';

import { useEffect, useRef } from 'react';
import type { Map as LMap, Marker } from 'leaflet';
import 'leaflet/dist/leaflet.css';

type L = typeof import('leaflet');
async function loadL(): Promise<L> {
  const mod = (await import('leaflet')) as unknown as { default?: L } & L;
  return (mod.default ?? mod) as L;
}

// Esri: sem chave e sem o bloqueio que o tile.openstreetmap.org aplica a apps.
const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';

function pinIcon(l: L, color: string, glyph: string) {
  return l.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:14px">${glyph}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });
}

/**
 * Mapa pequeno com o ponto da entrega ARRASTÁVEL. O geocoder gratuito muitas
 * vezes acha só a rua (não o número) — aqui o restaurante corrige o ponto e a
 * distância/taxa passam a valer do lugar certo.
 */
export default function PinPicker({
  lat,
  lng,
  pickup,
  onMove,
}: {
  lat: number;
  lng: number;
  pickup?: { lat: number; lng: number } | null;
  onMove: (lat: number, lng: number) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const l = await loadL();
      if (cancelled || !elRef.current || mapRef.current) return;
      const map = l.map(elRef.current, { zoomControl: true, attributionControl: true }).setView([lat, lng], 17);
      l.tileLayer(TILE_URL, { maxZoom: 19, attribution: 'Tiles © Esri' }).addTo(map);
      if (pickup) {
        l.marker([pickup.lat, pickup.lng], { icon: pinIcon(l, '#6b7280', '🏪'), interactive: false }).addTo(map);
      }
      const marker = l.marker([lat, lng], { draggable: true, icon: pinIcon(l, '#0c8a5c', '🏠') }).addTo(map);
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        onMoveRef.current(Number(p.lat.toFixed(7)), Number(p.lng.toFixed(7)));
      });
      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        marker.setLatLng(e.latlng);
        onMoveRef.current(Number(e.latlng.lat.toFixed(7)), Number(e.latlng.lng.toFixed(7)));
      });
      mapRef.current = map;
      markerRef.current = marker;
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // o mapa nasce uma vez; mudanças de posição vêm pelo efeito abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // novo endereço localizado → move o pino e recentra
  useEffect(() => {
    const m = markerRef.current;
    if (!m) return;
    const cur = m.getLatLng();
    if (Math.abs(cur.lat - lat) > 1e-7 || Math.abs(cur.lng - lng) > 1e-7) {
      m.setLatLng([lat, lng]);
      mapRef.current?.setView([lat, lng], mapRef.current.getZoom());
    }
  }, [lat, lng]);

  return <div ref={elRef} style={{ height: 240, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }} />;
}
