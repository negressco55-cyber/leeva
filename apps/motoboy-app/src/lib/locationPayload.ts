/**
 * Lógica pura (sem React Native) do envio de localização — separada para
 * poder testar sem device/emulador.
 */

export type Coords = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
};

/** true se ainda NÃO passou o intervalo mínimo desde o último envio. */
export function shouldThrottle(now: number, lastSentAt: number, minIntervalMs: number): boolean {
  return now - lastSentAt < minIntervalMs;
}

/** Corpo do POST /api/location a partir de uma leitura de GPS. */
export function buildLocationBody(c: Coords): {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
} {
  return {
    latitude: c.latitude,
    longitude: c.longitude,
    accuracy: c.accuracy ?? undefined,
    speed: c.speed ?? undefined,
  };
}

/** Extrai a última posição de um lote de leituras (o formato que a task recebe). */
export function lastLocation<T extends { coords: Coords }>(locations: T[] | null | undefined): T | null {
  if (!locations || locations.length === 0) return null;
  return locations[locations.length - 1] ?? null;
}
