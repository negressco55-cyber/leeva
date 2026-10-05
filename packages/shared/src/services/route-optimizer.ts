/**
 * Ordem das paradas de uma rota de entrega.
 *
 * Não é só "a mais perto primeiro": cada parada tem um prazo (o tempo
 * prometido ao cliente) e a ordem escolhida é a que menos estoura prazo e,
 * empatando, a que roda menos. Até MAX_EXACT paradas testa todas as ordens
 * possíveis (6 paradas = 720 combinações, instantâneo); acima disso usa
 * vizinho-mais-próximo ponderado pelo prazo.
 *
 * Função pura — sem banco, sem rede — pra rodar igual no despacho, na API do
 * motoboy e nos testes.
 */
import { haversineKm, minutesForKm, type LatLng } from './geo';

export type RouteStopInput = {
  id: string;
  point: LatLng;
  /** prazo prometido ao cliente (epoch ms); null = sem prazo */
  deadline: number | null;
};

export type RouteOptimizerOptions = {
  /** instante de saída do ponto de origem (epoch ms); default = agora */
  startAt?: number;
  /** minutos parado em cada entrega (estacionar, subir, entregar) */
  serviceMinutes?: number;
  /** peso de cada minuto de atraso contra cada minuto de rota */
  latePenalty?: number;
};

export type RouteEvaluation = {
  order: string[];
  totalKm: number;
  totalMinutes: number;
  lateMinutes: number;
  /** horário estimado de chegada em cada parada (epoch ms), na ordem */
  arrivals: number[];
};

const MAX_EXACT = 6;
const STREET_FACTOR = 1.3; // linha reta → rua (mesmo fator do resto do Leeva)

const legKm = (a: LatLng, b: LatLng) => (haversineKm(a, b) ?? 0) * STREET_FACTOR;

/** Avalia uma ordem específica (usada também pra mostrar o efeito da ordem que o motoboy escolheu). */
export function evaluateRoute(
  origin: LatLng,
  stops: RouteStopInput[],
  opts: RouteOptimizerOptions = {},
): RouteEvaluation {
  const start = opts.startAt ?? Date.now();
  const service = opts.serviceMinutes ?? 3;
  let t = start;
  let km = 0;
  let late = 0;
  let prev = origin;
  const arrivals: number[] = [];
  for (const s of stops) {
    const k = legKm(prev, s.point);
    km += k;
    t += minutesForKm(k) * 60_000;
    arrivals.push(t);
    if (s.deadline != null && t > s.deadline) late += (t - s.deadline) / 60_000;
    t += service * 60_000;
    prev = s.point;
  }
  return {
    order: stops.map((s) => s.id),
    totalKm: Math.round(km * 100) / 100,
    totalMinutes: Math.round((t - start) / 60_000),
    lateMinutes: Math.round(late),
    arrivals,
  };
}

function cost(e: RouteEvaluation, latePenalty: number) {
  return e.totalMinutes + latePenalty * e.lateMinutes;
}

function* permutations<T>(items: T[]): Generator<T[]> {
  if (items.length <= 1) {
    yield items.slice();
    return;
  }
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const p of permutations(rest)) yield [items[i]!, ...p];
  }
}

/** Melhor ordem para as paradas, saindo de `origin`. */
export function optimizeStopOrder(
  origin: LatLng,
  stops: RouteStopInput[],
  opts: RouteOptimizerOptions = {},
): RouteEvaluation {
  const latePenalty = opts.latePenalty ?? 4;
  if (stops.length <= 1) return evaluateRoute(origin, stops, opts);

  if (stops.length <= MAX_EXACT) {
    let best: RouteEvaluation | null = null;
    for (const p of permutations(stops)) {
      const e = evaluateRoute(origin, p, opts);
      if (!best || cost(e, latePenalty) < cost(best, latePenalty)) best = e;
    }
    return best!;
  }

  // muitas paradas: guloso — a próxima é a de menor (tempo até lá + folga de prazo apertada)
  const start = opts.startAt ?? Date.now();
  const service = opts.serviceMinutes ?? 3;
  const rest = [...stops];
  const ordered: RouteStopInput[] = [];
  let prev = origin;
  let t = start;
  while (rest.length) {
    let bi = 0;
    let bs = Infinity;
    for (let i = 0; i < rest.length; i++) {
      const s = rest[i]!;
      const travel = minutesForKm(legKm(prev, s.point));
      const slack = s.deadline != null ? (s.deadline - (t + travel * 60_000)) / 60_000 : 60;
      const score = travel + Math.max(0, 30 - slack) * 0.5; // prazo apertando pesa mais
      if (score < bs) {
        bs = score;
        bi = i;
      }
    }
    const s = rest.splice(bi, 1)[0]!;
    t += (minutesForKm(legKm(prev, s.point)) + service) * 60_000;
    ordered.push(s);
    prev = s.point;
  }
  return evaluateRoute(origin, ordered, opts);
}

/** Link do Google Maps com todas as paradas na ordem (navegação grátis, sem chave). */
export function googleMapsRouteUrl(points: LatLng[], origin?: LatLng | null): string | null {
  if (!points.length) return null;
  const fmt = (p: LatLng) => `${p.latitude},${p.longitude}`;
  const dest = points[points.length - 1]!;
  // o Google aceita até 9 paradas intermediárias no link
  const waypoints = points.slice(0, -1).slice(0, 9);
  const params = new URLSearchParams({ api: '1', destination: fmt(dest), travelmode: 'driving' });
  if (origin) params.set('origin', fmt(origin));
  if (waypoints.length) params.set('waypoints', waypoints.map(fmt).join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
