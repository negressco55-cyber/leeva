/**
 * RoutingService — camada isolada para cálculo de distância/tempo/rota.
 *
 * Fica separada de OrderService e DeliveryService justamente para poder
 * trocar o provedor (Google Maps, Mapbox, OpenStreetMap/OSRM) sem tocar
 * na lógica de negócio.
 *
 * Estado atual:
 *  - StraightLineRoutingService  -> IMPLEMENTADO (Haversine, sem API)
 *  - GoogleRoutingService        -> PREPARADO   (requer GOOGLE_MAPS_API_KEY)
 *  - MapboxRoutingService        -> PREPARADO   (requer MAPBOX_TOKEN)
 *  - OsrmRoutingService          -> PREPARADO   (requer OSRM_BASE_URL)
 */
import { haversineKm, minutesForKm, type LatLng } from './geo';

export type RouteLeg = {
  distanceKm: number;
  durationMin: number;
  /** true quando vem de rota real; false quando é estimativa em linha reta. */
  isEstimate: boolean;
  provider: string;
  /** polilinha opcional (quando o provedor devolve) */
  geometry?: string;
};

export type RoutePlan = {
  legs: RouteLeg[];
  totalDistanceKm: number;
  totalDurationMin: number;
  isEstimate: boolean;
  provider: string;
};

export interface RoutingService {
  readonly provider: string;
  readonly isEstimate: boolean;
  /** Distância + tempo entre dois pontos. */
  leg(from: LatLng, to: LatLng): Promise<RouteLeg | null>;
  /** Rota passando por vários pontos na ordem dada. */
  route(points: LatLng[]): Promise<RoutePlan | null>;
}

/** Fator de correção: ruas não são linha reta. ~1.3 é um valor urbano comum. */
const STREET_FACTOR = 1.3;

export class StraightLineRoutingService implements RoutingService {
  readonly provider = 'straight-line';
  readonly isEstimate = true;

  async leg(from: LatLng, to: LatLng): Promise<RouteLeg | null> {
    const straight = haversineKm(from, to);
    if (straight == null) return null;
    const distanceKm = straight * STREET_FACTOR;
    return {
      distanceKm,
      durationMin: minutesForKm(distanceKm),
      isEstimate: true,
      provider: this.provider,
    };
  }

  async route(points: LatLng[]): Promise<RoutePlan | null> {
    if (points.length < 2) return null;
    const legs: RouteLeg[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const leg = await this.leg(points[i]!, points[i + 1]!);
      if (!leg) return null;
      legs.push(leg);
    }
    return {
      legs,
      totalDistanceKm: legs.reduce((s, l) => s + l.distanceKm, 0),
      totalDurationMin: legs.reduce((s, l) => s + l.durationMin, 0),
      isEstimate: true,
      provider: this.provider,
    };
  }
}

/**
 * PREPARADO — implementação real via OSRM (Open Source Routing Machine).
 * Basta definir OSRM_BASE_URL (ex: https://router.project-osrm.org) para
 * ativar. Não requer chave de API, mas o servidor público tem rate limit;
 * em produção rode a sua própria instância.
 */
export class OsrmRoutingService implements RoutingService {
  readonly provider = 'osrm';
  readonly isEstimate = false;
  constructor(private baseUrl: string) {}

  async leg(from: LatLng, to: LatLng): Promise<RouteLeg | null> {
    const plan = await this.route([from, to]);
    return plan?.legs[0] ?? null;
  }

  async route(points: LatLng[]): Promise<RoutePlan | null> {
    if (points.length < 2) return null;
    const coords = points.map((p) => `${p.longitude},${p.latitude}`).join(';');
    const url = `${this.baseUrl}/route/v1/driving/${coords}?overview=false`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        routes?: { distance: number; duration: number; legs: { distance: number; duration: number }[] }[];
      };
      const route = json.routes?.[0];
      if (!route) return null;
      return {
        legs: route.legs.map((l) => ({
          distanceKm: l.distance / 1000,
          durationMin: l.duration / 60,
          isEstimate: false,
          provider: this.provider,
        })),
        totalDistanceKm: route.distance / 1000,
        totalDurationMin: route.duration / 60,
        isEstimate: false,
        provider: this.provider,
      };
    } catch {
      return null;
    }
  }
}

/**
 * Combina um provedor de rota real com o fallback em linha reta.
 * Se o provedor real falha (rede, rate limit, ponto sem via), NÃO perde a
 * estimativa — cai para Haversine × fator de rua. Cache curto em memória
 * para não martelar o servidor OSRM público (que tem rate limit).
 */
export class HybridRoutingService implements RoutingService {
  readonly provider: string;
  readonly isEstimate = false; // pode variar por perna; ver leg.isEstimate
  private fallback = new StraightLineRoutingService();
  private cache = new Map<string, { at: number; leg: RouteLeg }>();
  private ttlMs = 5 * 60_000;
  private maxEntries = 500;

  constructor(private real: RoutingService) {
    this.provider = `${real.provider}+fallback`;
  }

  private key(from: LatLng, to: LatLng): string {
    const r = (n: number) => n.toFixed(4);
    return `${r(from.latitude)},${r(from.longitude)}>${r(to.latitude)},${r(to.longitude)}`;
  }

  async leg(from: LatLng, to: LatLng): Promise<RouteLeg | null> {
    const k = this.key(from, to);
    const hit = this.cache.get(k);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.leg;

    let leg: RouteLeg | null = null;
    try {
      leg = await this.real.leg(from, to);
    } catch {
      leg = null;
    }
    if (!leg) leg = await this.fallback.leg(from, to);
    if (!leg) return null;

    if (this.cache.size >= this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(k, { at: Date.now(), leg });
    return leg;
  }

  async route(points: LatLng[]): Promise<RoutePlan | null> {
    if (points.length < 2) return null;
    try {
      const plan = await this.real.route(points);
      if (plan) return plan;
    } catch {
      /* cai para o fallback abaixo */
    }
    return this.fallback.route(points);
  }
}

let cached: RoutingService | null = null;

/**
 * Escolhe o RoutingService conforme o ambiente. Cai para linha reta quando
 * nenhum provedor estiver configurado — sempre devolve algo utilizável.
 *
 * OSRM_BASE_URL define o servidor de rota real (ex.: uma instância própria,
 * ou https://router.project-osrm.org para testes — esse tem rate limit e
 * não deve ser usado em produção de verdade).
 */
export function getRoutingService(): RoutingService {
  if (cached) return cached;
  const osrm = process.env.OSRM_BASE_URL;
  if (osrm) {
    cached = new HybridRoutingService(new OsrmRoutingService(osrm));
  } else {
    cached = new StraightLineRoutingService();
  }
  return cached;
}

/** Só para testes: injeta um serviço específico. */
export function __setRoutingService(svc: RoutingService | null): void {
  cached = svc;
}
