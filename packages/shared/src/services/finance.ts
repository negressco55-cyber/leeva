/**
 * Financeiro da LOGÍSTICA (separado da receita SaaS).
 *
 * Para cada entrega concluída:
 *   receita logística (leeva_fee) − remuneração do entregador (driver_payout)
 *   = margem logística (logistics_margin)
 *
 * Este serviço agrega o período e gera alertas financeiros com dados reais.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { periodRange, type Period } from './analytics';
import { regionFromAddress } from './geo';

type DB = SupabaseClient<Database>;
const MAX_ROWS = 20000;
const round = (n: number, dp = 2) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

export type LogisticsFinance = {
  period: string;
  deliveries: number;
  revenue: number; // Σ leeva_fee
  driverCost: number; // Σ driver_payout
  margin: number; // revenue − driverCost
  avgRevenue: number | null;
  avgCost: number | null;
  avgMargin: number | null;
  marginRate: number | null; // margin / revenue
  grouped: { deliveries: number; avgCost: number | null };
  ungrouped: { deliveries: number; avgCost: number | null };
  byRegion: { region: string; deliveries: number; avgCost: number | null; avgMargin: number | null }[];
  alerts: { icon: string; text: string; severity: 'warning' | 'tip' | 'info' }[];
  truncated: boolean;
};

export async function getLogisticsFinance(db: DB, restaurantId: string, period: Period): Promise<LogisticsFinance> {
  const { from, to, label } = periodRange(period);
  const { data } = await db
    .from('orders')
    .select('id, status, region, customer_address, delivered_at, created_at, leeva_fee, driver_payout, logistics_margin, group_id')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'delivered')
    .gte('delivered_at', from)
    .lt('delivered_at', to)
    .order('delivered_at', { ascending: false })
    .limit(MAX_ROWS + 1);

  const rows = data ?? [];
  const truncated = rows.length > MAX_ROWS;
  const list = rows.slice(0, MAX_ROWS).filter((o) => o.driver_payout != null);

  const n = list.length;
  const revenue = round(list.reduce((s, o) => s + Number(o.leeva_fee ?? 0), 0));
  const driverCost = round(list.reduce((s, o) => s + Number(o.driver_payout ?? 0), 0));
  const margin = round(revenue - driverCost);

  const grouped = list.filter((o) => o.group_id);
  const ungrouped = list.filter((o) => !o.group_id);
  const avgOf = (arr: typeof list, f: (o: (typeof list)[number]) => number) =>
    arr.length ? round(arr.reduce((s, o) => s + f(o), 0) / arr.length) : null;

  const regionMap = new Map<string, { n: number; cost: number; margin: number }>();
  for (const o of list) {
    const r = o.region || regionFromAddress(o.customer_address) || 'Sem região';
    const e = regionMap.get(r) ?? { n: 0, cost: 0, margin: 0 };
    e.n += 1;
    e.cost += Number(o.driver_payout ?? 0);
    e.margin += Number(o.logistics_margin ?? Number(o.leeva_fee ?? 0) - Number(o.driver_payout ?? 0));
    regionMap.set(r, e);
  }
  const byRegion = [...regionMap.entries()]
    .map(([region, e]) => ({
      region,
      deliveries: e.n,
      avgCost: e.n ? round(e.cost / e.n) : null,
      avgMargin: e.n ? round(e.margin / e.n) : null,
    }))
    .sort((a, b) => b.deliveries - a.deliveries);

  // --- alertas financeiros (dados reais) ---
  const alerts: LogisticsFinance['alerts'] = [];
  const avgMargin = n ? round(margin / n) : null;
  const avgCost = n ? round(driverCost / n) : null;

  if (avgMargin != null && avgMargin < 0) {
    alerts.push({
      icon: '⚠️',
      text: `Sua margem logística média está negativa (${avgMargin.toFixed(2)} por entrega). A taxa cobrada não cobre o custo do entregador.`,
      severity: 'warning',
    });
  } else if (avgMargin != null && avgCost != null && avgMargin < avgCost * 0.1) {
    alerts.push({
      icon: '⚠️',
      text: `Margem apertada: R$ ${avgMargin.toFixed(2)} por entrega. Revise a taxa de entrega ou a política de remuneração.`,
      severity: 'warning',
    });
  }

  const g = avgOf(grouped, (o) => Number(o.driver_payout ?? 0));
  const u = avgOf(ungrouped, (o) => Number(o.driver_payout ?? 0));
  if (g != null && u != null && grouped.length >= 3 && g < u) {
    alerts.push({
      icon: '💡',
      text: `Entregas agrupadas custaram ${Math.round((1 - g / u) * 100)}% menos por pedido (R$ ${g.toFixed(2)} vs R$ ${u.toFixed(2)}).`,
      severity: 'tip',
    });
  }

  const worst = byRegion.filter((r) => r.avgCost != null).sort((a, b) => (b.avgCost ?? 0) - (a.avgCost ?? 0))[0];
  if (worst && avgCost != null && (worst.avgCost ?? 0) > avgCost * 1.22 && worst.deliveries >= 5) {
    alerts.push({
      icon: '⚠️',
      text: `${worst.region} tem custo médio ${Math.round(((worst.avgCost ?? 0) / avgCost - 1) * 100)}% acima da média.`,
      severity: 'warning',
    });
  }

  return {
    period: label,
    deliveries: n,
    revenue,
    driverCost,
    margin,
    avgRevenue: n ? round(revenue / n) : null,
    avgCost,
    avgMargin,
    marginRate: revenue > 0 ? round(margin / revenue, 3) : null,
    grouped: { deliveries: grouped.length, avgCost: g },
    ungrouped: { deliveries: ungrouped.length, avgCost: u },
    byRegion,
    alerts,
    truncated,
  };
}
