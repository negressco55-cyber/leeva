/**
 * Utilitários geográficos determinísticos (sem API externa).
 * Distâncias aqui são "em linha reta" (Haversine). O RoutingService pode
 * sobrepor com distância/tempo de rota real quando um provedor de mapas
 * estiver configurado.
 */

export type LatLng = { latitude: number; longitude: number };

/** Coordenada plausível: números finitos dentro do globo e não (0,0). */
export function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: LatLng | null | undefined, b: LatLng | null | undefined): number | null {
  if (!a || !b) return null;
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return null;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Velocidade média urbana de moto assumida (km/h) quando não há dado melhor. */
export const ASSUMED_MOTO_SPEED_KMH = 22;

/** Minutos de deslocamento para uma distância em km, na velocidade assumida. */
export function minutesForKm(km: number, speedKmh = ASSUMED_MOTO_SPEED_KMH): number {
  return (km / speedKmh) * 60;
}

/**
 * Extrai uma "região" aproximada de um endereço em texto livre.
 * Heurística simples: usa o trecho após a primeira vírgula (bairro) ou a
 * primeira palavra significativa. Serve para agrupar indicadores por região
 * enquanto não houver geocoding real.
 */
export function regionFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address
    .split(/[,–-]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0]!;

  // ignora o primeiro trecho (logradouro) e trechos só de número.
  // pega o primeiro trecho "textual" restante (geralmente o bairro).
  const candidates = parts.slice(1).filter((p) => !/^\d[\d\s/ºª.-]*$/.test(p));
  const CITY_HINTS = /jo[ãa]o pessoa|pb|para[íi]ba|brasil/i;
  const nonCity = candidates.filter((p) => !CITY_HINTS.test(p));
  return nonCity[0] ?? candidates[0] ?? parts[parts.length - 1] ?? null;
}

/** Centro geográfico de um conjunto de pontos. */
export function centroid(points: LatLng[]): LatLng | null {
  const valid = points.filter((p) => p.latitude != null && p.longitude != null);
  if (!valid.length) return null;
  const sum = valid.reduce(
    (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
    { latitude: 0, longitude: 0 },
  );
  return { latitude: sum.latitude / valid.length, longitude: sum.longitude / valid.length };
}
