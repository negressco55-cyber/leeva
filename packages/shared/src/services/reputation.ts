/**
 * REPUTAÇÃO E INTELIGÊNCIA DO MOTOBOY — Fase 3.5
 *
 * Dois eixos independentes:
 *   1. QUALIDADE DA OFERTA  — "esta corrida é boa para o entregador?"
 *      Classificada ANTES de enviar: excellent / good / acceptable / poor.
 *      Recusar oferta `poor` NUNCA penaliza. Só ofertas adequadas
 *      (excellent/good) contam para a taxa de aceitação.
 *   2. ÍNDICE DE CONFIABILIDADE — "este entregador é confiável?"
 *      Combinação ponderada de aceitação, finalização, pontualidade,
 *      avaliação e incidentes. Pesos configuráveis (reputation_config).
 *      Nenhum indicador domina sozinho.
 *
 * Determinístico, sem IA. Origem do incidente (driver/restaurant/customer/
 * system) decide se pesa: problema do restaurante/cliente/sistema não pune
 * o motoboy.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { OfferQuality, IncidentType, IncidentOrigin, ReputationConfig } from '../types';

type DB = SupabaseClient<Database>;
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const round = (n: number, dp = 2) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};
/** interpolação linear por pontos de controle [x, y] ordenados por x */
function lerp(points: [number, number][], x: number): number {
  if (x <= points[0]![0]) return points[0]![1];
  const last = points[points.length - 1]!;
  if (x >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]!;
    const [x1, y1] = points[i]!;
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return last[1];
}

// ===========================================================================
// 1. QUALIDADE DA OFERTA
// ===========================================================================

export const DEFAULT_OFFER_QUALITY_CONFIG = {
  weights: { earningsRate: 34, absolutePayout: 24, deadhead: 22, timeEfficiency: 12, routeFit: 8 },
  thresholds: { excellent: 75, good: 55, acceptable: 38 },
  /** R$ por km de esforço (coleta + entrega) */
  earningsRateCurve: [
    [0.5, 0],
    [0.8, 0.25],
    [1.1, 0.5],
    [1.6, 0.8],
    [2.2, 1],
  ] as [number, number][],
  absolutePayoutCurve: [
    [5.5, 0.05],
    [7.5, 0.4],
    [9.5, 0.7],
    [12, 0.9],
    [16, 1],
  ] as [number, number][],
  deadheadCurve: [
    [1, 1],
    [2.5, 0.75],
    [4.5, 0.45],
    [7, 0.2],
    [10, 0],
  ] as [number, number][],
  etaCurve: [
    [20, 1],
    [35, 0.7],
    [50, 0.4],
    [70, 0.15],
    [95, 0],
  ] as [number, number][],
};
export type OfferQualityConfig = typeof DEFAULT_OFFER_QUALITY_CONFIG;

export type OfferQualityInput = {
  payout: number;
  distancePickupKm: number | null;
  distanceDropoffKm: number | null;
  etaTotalMin: number | null;
  /** true quando o destino cai perto de uma entrega que o motoboy já leva */
  routeFits?: boolean;
};

export type OfferQualityResult = {
  quality: OfferQuality;
  score: number; // 0..100
  countsForAcceptance: boolean; // recusa penaliza aceitação?
  factors: Record<string, number>;
  explain: string;
};

/**
 * Classifica a qualidade de UMA oferta (entregador + entrega + momento).
 * Não revela a fórmula ao motoboy — só o rótulo e o essencial.
 */
export function classifyOfferQuality(
  input: OfferQualityInput,
  cfg: OfferQualityConfig = DEFAULT_OFFER_QUALITY_CONFIG,
): OfferQualityResult {
  const pickup = input.distancePickupKm ?? 2;
  const drop = input.distanceDropoffKm ?? 3;
  const effortKm = Math.max(0.8, pickup + drop);
  const perKm = input.payout / effortKm;

  const f = {
    earningsRate: clamp(lerp(cfg.earningsRateCurve, perKm)),
    absolutePayout: clamp(lerp(cfg.absolutePayoutCurve, input.payout)),
    deadhead: clamp(lerp(cfg.deadheadCurve, pickup)),
    timeEfficiency: input.etaTotalMin == null ? 0.6 : clamp(lerp(cfg.etaCurve, input.etaTotalMin)),
    routeFit: input.routeFits ? 1 : 0.5,
  };

  const w = cfg.weights;
  const wsum = w.earningsRate + w.absolutePayout + w.deadhead + w.timeEfficiency + w.routeFit;
  const score = round(
    ((f.earningsRate * w.earningsRate +
      f.absolutePayout * w.absolutePayout +
      f.deadhead * w.deadhead +
      f.timeEfficiency * w.timeEfficiency +
      f.routeFit * w.routeFit) /
      wsum) *
      100,
  );

  const quality: OfferQuality =
    score >= cfg.thresholds.excellent
      ? 'excellent'
      : score >= cfg.thresholds.good
        ? 'good'
        : score >= cfg.thresholds.acceptable
          ? 'acceptable'
          : 'poor';

  const countsForAcceptance = quality === 'excellent' || quality === 'good';

  let explain: string;
  if (quality === 'excellent') explain = 'Ótima oferta: boa remuneração e trajeto curto.';
  else if (quality === 'good') explain = 'Boa oferta.';
  else if (quality === 'acceptable') explain = 'Oferta razoável. Recusar tem impacto reduzido.';
  else explain = 'Oferta pouco vantajosa. Recusar não afeta sua reputação.';

  return {
    quality,
    score,
    countsForAcceptance,
    factors: {
      earningsRate: round(f.earningsRate, 3),
      absolutePayout: round(f.absolutePayout, 3),
      deadhead: round(f.deadhead, 3),
      timeEfficiency: round(f.timeEfficiency, 3),
      routeFit: round(f.routeFit, 3),
      payoutPerKm: round(perKm, 2),
      effortKm: round(effortKm, 2),
    },
    explain,
  };
}

// ===========================================================================
// 2. ÍNDICE DE CONFIABILIDADE
// ===========================================================================

export const DEFAULT_REPUTATION_CONFIG: ReputationConfig = {
  weights: { acceptance: 20, completion: 30, punctuality: 20, rating: 15, incidents: 15 },
  acceptance_soft_impact: 0.5,
  incident_penalty: {
    decline_adequate_offer: 3,
    cancel_after_accept: 15,
    abandon: 25,
    no_show: 20,
    late_delivery: 5,
    complaint: 8,
  },
  incident_window_days: 30,
  sla_minutes: 55,
  block_threshold: 45,
  min_sample: 5,
};

export async function getReputationConfig(db: DB): Promise<ReputationConfig> {
  const { data } = await db.from('reputation_config').select('config').eq('id', 1).maybeSingle();
  return { ...DEFAULT_REPUTATION_CONFIG, ...((data?.config as Partial<ReputationConfig>) ?? {}) };
}

export type DriverPerformance = {
  motoboyId: string;
  name: string;
  fleet: 'own' | 'leeva';
  rating: number;
  acceptanceRate: number; // % ofertas adequadas aceitas
  completionRate: number; // % aceitas concluídas
  punctualityRate: number; // % concluídas no prazo
  reliabilityIndex: number; // 0..100
  blocked: boolean;
  blockedReason: string | null;
  sample: { offersAdequate: number; deliveriesTotal: number; deliveriesCompleted: number };
  recentIncidents: { type: IncidentType; origin: IncidentOrigin; count: number }[];
  components: Record<string, number>;
  explanation: string;
  tips: string[];
};

/**
 * Recalcula as taxas e o índice de confiabilidade de um motoboy.
 * Persiste em `motoboys` quando `persist` (default true).
 */
export async function computeReliabilityIndex(
  db: DB,
  motoboyId: string,
  opts: { persist?: boolean; config?: ReputationConfig } = {},
): Promise<DriverPerformance | null> {
  const cfg = opts.config ?? (await getReputationConfig(db));
  const persist = opts.persist ?? true;

  const { data: m } = await db
    .from('motoboys')
    .select(
      'id, full_name, fleet, rating, blocked, blocked_reason, offers_adequate, offers_adequate_accepted, deliveries_total, deliveries_completed, deliveries_late',
    )
    .eq('id', motoboyId)
    .maybeSingle();
  if (!m) return null;

  const since = new Date(Date.now() - cfg.incident_window_days * 86400_000).toISOString();
  const { data: incidents } = await db
    .from('driver_incidents')
    .select('type, origin, severity, created_at')
    .eq('motoboy_id', motoboyId)
    .gte('created_at', since)
    .limit(500);

  // --- taxas brutas ---
  const adequate = m.offers_adequate ?? 0;
  const acceptedAdequate = m.offers_adequate_accepted ?? 0;
  const total = m.deliveries_total ?? 0;
  const completed = m.deliveries_completed ?? 0;
  const late = m.deliveries_late ?? 0;

  const rawAcceptance = clamp(adequate > 0 ? (acceptedAdequate / adequate) * 100 : 100, 0, 100);
  const rawCompletion = clamp(total > 0 ? (completed / total) * 100 : 100, 0, 100);
  const rawPunctuality = clamp(completed > 0 ? ((completed - Math.min(late, completed)) / completed) * 100 : 100, 0, 100);

  // amostra pequena → puxa para 100 (não penaliza quem tem histórico curto)
  const blend = (raw: number, n: number) => {
    if (n >= cfg.min_sample) return raw;
    const k = n / cfg.min_sample;
    return round(raw * k + 100 * (1 - k));
  };
  const acceptanceRate = round(blend(rawAcceptance, adequate));
  const completionRate = round(blend(rawCompletion, total));
  const punctualityRate = round(blend(rawPunctuality, completed));

  // --- componente de incidentes (só origem 'driver' pesa) ---
  let penalty = 0;
  for (const inc of incidents ?? []) {
    if (inc.origin !== 'driver') continue;
    const base = cfg.incident_penalty[inc.type as IncidentType] ?? 0;
    penalty += base * Number(inc.severity ?? 1);
  }
  const incidentsScore = clamp(100 - penalty, 0, 100);

  // aceitação com impacto suave: recusa de oferta adequada só reduz parcialmente
  const acceptanceComponent = round(100 - (100 - acceptanceRate) * cfg.acceptance_soft_impact);

  // avaliação 2..5 -> 0..100
  const ratingComponent = round(clamp((Number(m.rating) - 2) / 3, 0, 1) * 100);

  const w = cfg.weights;
  const wsum = w.acceptance + w.completion + w.punctuality + w.rating + w.incidents || 1;
  const reliabilityIndex = round(
    clamp(
      (acceptanceComponent * w.acceptance +
        completionRate * w.completion +
        punctualityRate * w.punctuality +
        ratingComponent * w.rating +
        incidentsScore * w.incidents) /
        wsum,
      0,
      100,
    ),
  );

  // --- incidentes recentes agregados ---
  const incMap = new Map<string, { type: IncidentType; origin: IncidentOrigin; count: number }>();
  for (const inc of incidents ?? []) {
    const key = `${inc.type}:${inc.origin}`;
    const e = incMap.get(key) ?? { type: inc.type as IncidentType, origin: inc.origin as IncidentOrigin, count: 0 };
    e.count += 1;
    incMap.set(key, e);
  }

  // --- explicação amigável + dicas (linguagem não ameaçadora) ---
  const tips: string[] = [];
  if (punctualityRate < 85) tips.push('Melhore a pontualidade para aumentar sua confiabilidade.');
  if (completionRate < 90) tips.push('Conclua as entregas que aceitar — cancelamentos pesam bastante.');
  if (acceptanceRate < 70 && adequate >= cfg.min_sample)
    tips.push('Você tem recusado ofertas boas. Só ofertas vantajosas contam aqui.');
  if (Number(m.rating) < 4.3) tips.push('Capriche no atendimento ao cliente para melhorar sua avaliação.');
  let explanation: string;
  if (reliabilityIndex >= 85) explanation = 'Seu índice está ótimo. Continue assim!';
  else if (reliabilityIndex >= 70) explanation = 'Seu índice está bom.';
  else if (reliabilityIndex >= cfg.block_threshold) explanation = 'Seu índice pode melhorar. Veja as dicas abaixo.';
  else explanation = 'Seu índice está baixo. Priorize concluir as entregas que aceitar.';

  if (persist) {
    await db
      .from('motoboys')
      .update({
        acceptance_rate: acceptanceRate,
        completion_rate_pct: completionRate,
        punctuality_rate: punctualityRate,
        reliability_index: reliabilityIndex,
        reputation_updated_at: new Date().toISOString(),
      })
      .eq('id', motoboyId);
  }

  return {
    motoboyId,
    name: m.full_name,
    fleet: m.fleet as 'own' | 'leeva',
    rating: Number(m.rating),
    acceptanceRate,
    completionRate,
    punctualityRate,
    reliabilityIndex,
    blocked: !!m.blocked,
    blockedReason: m.blocked_reason ?? null,
    sample: { offersAdequate: adequate, deliveriesTotal: total, deliveriesCompleted: completed },
    recentIncidents: [...incMap.values()].sort((a, b) => b.count - a.count),
    components: {
      acceptance: acceptanceComponent,
      completion: completionRate,
      punctuality: punctualityRate,
      rating: ratingComponent,
      incidents: incidentsScore,
    },
    explanation,
    tips,
  };
}

/**
 * Registra um incidente operacional. A ORIGEM decide o impacto:
 * problema do restaurante / cliente / sistema é registrado para auditoria
 * mas NÃO penaliza o entregador (só origem 'driver' pesa no índice).
 */
export async function recordIncident(
  db: DB,
  input: {
    motoboyId: string;
    orderId?: string | null;
    restaurantId?: string | null;
    type: IncidentType;
    origin: IncidentOrigin;
    severity?: number;
    note?: string;
  },
): Promise<void> {
  await db.from('driver_incidents').insert({
    motoboy_id: input.motoboyId,
    order_id: input.orderId ?? null,
    restaurant_id: input.restaurantId ?? null,
    type: input.type,
    origin: input.origin,
    severity: input.severity ?? (input.origin === 'driver' ? 1 : 0),
    note: input.note ?? null,
  });
  try {
    await computeReliabilityIndex(db, input.motoboyId);
  } catch {
    /* não bloqueia o fluxo principal */
  }
}

/** Painel de desempenho para o app do motoboy (transparência). */
export async function getDriverPerformance(db: DB, motoboyId: string): Promise<DriverPerformance | null> {
  return computeReliabilityIndex(db, motoboyId, { persist: true });
}

/** Recalcula todos (uso no cron / admin). */
export async function recomputeAllReliability(db: DB): Promise<{ updated: number }> {
  const { data } = await db.from('motoboys').select('id').eq('active', true).limit(2000);
  const cfg = await getReputationConfig(db);
  let updated = 0;
  for (const m of data ?? []) {
    try {
      await computeReliabilityIndex(db, m.id, { persist: true, config: cfg });
      updated++;
    } catch {
      /* segue */
    }
  }
  return { updated };
}
