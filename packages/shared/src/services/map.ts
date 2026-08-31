/**
 * MapProvider — camada desacoplada de mapa (tiles, geocoding, estático).
 *
 * A rota/distância/ETA continuam no RoutingService (services/routing.ts).
 * Aqui fica o que a INTERFACE do mapa precisa: template de tiles, geocoding
 * (endereço → lat/lng) e URL de mapa estático.
 *
 * Estado:
 *  - OsmMapProvider     → IMPLEMENTADO (tiles OSM + geocoding Nominatim, sem chave)
 *  - MapboxMapProvider  → PREPARADO   (MAPBOX_TOKEN)
 *  - GoogleMapProvider  → PREPARADO   (GOOGLE_MAPS_API_KEY)
 *
 * Nominatim tem rate limit (1 req/s, uso justo). Para produção séria,
 * usar geocoding pago ou instância própria — a interface não muda.
 */
import type { LatLng } from './geo';

export type GeocodeResult = { latitude: number; longitude: number; label: string; source: string };

export interface MapProvider {
  readonly name: string;
  /** template de tiles para Leaflet, ex: https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png */
  readonly tileUrl: string;
  readonly tileAttribution: string;
  geocode(address: string, near?: LatLng): Promise<GeocodeResult | null>;
}

class OsmMapProvider implements MapProvider {
  readonly name = 'osm';
  readonly tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  readonly tileAttribution = '© OpenStreetMap';

  async geocode(address: string, near?: LatLng): Promise<GeocodeResult | null> {
    if (!address || address.trim().length < 4) return null;
    try {
      const params = new URLSearchParams({
        q: address,
        format: 'jsonv2',
        limit: '1',
        addressdetails: '0',
      });
      if (near) {
        // viewbox pequeno em torno do ponto de referência melhora a precisão
        const d = 0.3;
        params.set('viewbox', `${near.longitude - d},${near.latitude + d},${near.longitude + d},${near.latitude - d}`);
        params.set('bounded', '0');
      }
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'User-Agent': 'Leeva/1.0 (logistica)', 'Accept-Language': 'pt-BR' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { lat: string; lon: string; display_name: string }[];
      const hit = json[0];
      if (!hit) return null;
      return {
        latitude: parseFloat(hit.lat),
        longitude: parseFloat(hit.lon),
        label: hit.display_name,
        source: 'nominatim',
      };
    } catch {
      return null;
    }
  }
}

class MapboxMapProvider implements MapProvider {
  readonly name = 'mapbox';
  readonly tileUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${process.env.MAPBOX_TOKEN ?? ''}`;
  readonly tileAttribution = '© Mapbox © OpenStreetMap';
  async geocode(address: string, near?: LatLng): Promise<GeocodeResult | null> {
    if (!process.env.MAPBOX_TOKEN) return null;
    try {
      const prox = near ? `&proximity=${near.longitude},${near.latitude}` : '';
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?limit=1&language=pt${prox}&access_token=${process.env.MAPBOX_TOKEN}`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (!res.ok) return null;
      const json = (await res.json()) as { features?: { center: [number, number]; place_name: string }[] };
      const f = json.features?.[0];
      if (!f) return null;
      return { longitude: f.center[0], latitude: f.center[1], label: f.place_name, source: 'mapbox' };
    } catch {
      return null;
    }
  }
}

let cached: MapProvider | null = null;

export function getMapProvider(): MapProvider {
  if (cached) return cached;
  cached = process.env.MAPBOX_TOKEN ? new MapboxMapProvider() : new OsmMapProvider();
  return cached;
}

/** Config do mapa segura para enviar ao cliente (sem segredos). */
export function mapClientConfig() {
  const p = getMapProvider();
  return { provider: p.name, tileUrl: p.tileUrl, attribution: p.tileAttribution };
}

export function __setMapProvider(p: MapProvider | null) {
  cached = p;
}
