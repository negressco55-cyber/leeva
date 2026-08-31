/**
 * Heatmap operacional — concentração geográfica de pedidos + inteligência.
 * Tudo vem do banco. Insights são regras determinísticas sobre os dados reais.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { periodRange, type Period } from './analytics';
import { regionFromAddress } from './geo';
import { STAGE_SLA_MINUTES } from '../constants';

type DB = SupabaseClient<Database>;

export type HeatPoint = { latitude: number; longitude: number; weight: number };
export type RegionStat = {
  region: string;
  count: number;
  share: number; // 0..1
  avgDeliveryMin: number | null;
  lateRate: number | null;
  peakHour: number | null; // hora com mais pedidos
};
export type HeatInsight = { icon: string; text: string; severity: 'info' | 'warning' | 'tip' };

export type HeatmapResult = {
  period: string;
  total: number;
  points: HeatPoint[];
  regions: RegionStat[];
  insights: HeatInsight[];
  truncated: boolean;
};

const MAX_ROWS = 15000;
const minutesBetween = (a: string | null, b: string | null) =>
  a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 60000 : null;

export async function getHeatmap(
  db: DB,
  restaurantId: string,
  period: Period | { from: string; to: string; label: string },
): Promise<HeatmapResult> {
  const range = typeof period === 'string' ? periodRange(period) : period;

  const { data } = await db
    .from('orders')
    .select('id, status, region, customer_address, latitude, longitude, created_at, delivered_at')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', range.from)
    .lt('created_at', range.to)
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS + 1);

  const rows = data ?? [];
  const truncated = rows.length > MAX_ROWS;
  const list = rows.slice(0, MAX_ROWS);
  const total = list.length;

  // pontos (com jitter mínimo para agregação visual — mantém coordenada real)
  const points: HeatPoint[] = list
    .filter((o) => o.latitude != null && o.longitude != null)
    .map((o) => ({ latitude: o.latitude as number, longitude: o.longitude as number, weight: 1 }));

  // regiões
  const map = new Map<
    string,
    { count: number; times: number[]; late: number; delivered: number; hours: number[] }
  >();
  for (const o of list) {
    const region = o.region || regionFromAddress(o.customer_address) || 'Sem região';
    const e = map.get(region) ?? { count: 0, times: [], late: 0, delivered: 0, hours: [] };
    e.count += 1;
    e.hours.push(new Date(o.created_at).getHours());
    if (o.status === 'delivered') {
      e.delivered += 1;
      const m = minutesBetween(o.created_at, o.delivered_at);
      if (m != null) {
        e.times.push(m);
        if (m > STAGE_SLA_MINUTES.total) e.late += 1;
      }
    }
    map.set(region, e);
  }

  const regions: RegionStat[] = [...map.entries()]
    .map(([region, e]) => {
      const hourCounts = new Array(24).fill(0);
      e.hours.forEach((h) => hourCounts[h]++);
      const peakHour = hourCounts.some((c) => c > 0)
        ? hourCounts.indexOf(Math.max(...hourCounts))
        : null;
      return {
        region,
        count: e.count,
        share: total ? e.count / total : 0,
        avgDeliveryMin: e.times.length
          ? Math.round(e.times.reduce((a, b) => a + b, 0) / e.times.length)
          : null,
        lateRate: e.delivered ? Math.round((e.late / e.delivered) * 100) : null,
        peakHour,
      };
    })
    .sort((a, b) => b.count - a.count);

  // --- insights determinísticos ---
  const insights: HeatInsight[] = [];
  const overallAvg =
    regions.filter((r) => r.avgDeliveryMin != null).reduce((s, r) => s + (r.avgDeliveryMin ?? 0), 0) /
    Math.max(1, regions.filter((r) => r.avgDeliveryMin != null).length);

  const top = regions[0];
  if (top && top.share >= 0.2) {
    insights.push({
      icon: '🔥',
      text: `${top.region} concentra ${Math.round(top.share * 100)}% das suas entregas${top.peakHour != null ? `, com pico por volta das ${top.peakHour}h` : ''}.`,
      severity: 'info',
    });
  }
  for (const r of regions.slice(0, 5)) {
    if (r.avgDeliveryMin != null && overallAvg > 0 && r.avgDeliveryMin > overallAvg * 1.2) {
      const pct = Math.round((r.avgDeliveryMin / overallAvg - 1) * 100);
      insights.push({
        icon: '⚠️',
        text: `${r.region} tem tempo médio de entrega ${pct}% acima da sua média (${r.avgDeliveryMin} min).`,
        severity: 'warning',
      });
    }
    if (r.lateRate != null && r.lateRate >= 20 && r.count >= 5) {
      insights.push({
        icon: '⚠️',
        text: `${r.region}: ${r.lateRate}% das entregas passaram do tempo esperado.`,
        severity: 'warning',
      });
    }
  }
  if (top && top.peakHour != null && top.count >= 10) {
    insights.push({
      icon: '💡',
      text: `Considere manter capacidade extra em ${top.region} entre ${Math.max(0, top.peakHour - 1)}h e ${Math.min(23, top.peakHour + 2)}h.`,
      severity: 'tip',
    });
  }
  if (!insights.length && total > 0) {
    insights.push({
      icon: '🟢',
      text: 'Demanda bem distribuída — nenhuma região concentra risco no período.',
      severity: 'info',
    });
  }

  return { period: range.label, total, points, regions, insights, truncated };
}
