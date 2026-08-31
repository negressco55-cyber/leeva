/**
 * Billing SaaS — planos, assinatura, uso e fatura estimada.
 *
 * Modelo: mensalidade + valor por entrega concluída.
 * As regras de plano ficam em `plans.features` (jsonb), nunca espalhadas
 * pelo código.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { PlanFeatures } from '../types';

type DB = SupabaseClient<Database>;

/** Garante que o restaurante tem uma assinatura; cria em trial no plano dado (ou 'start'). */
export async function ensureSubscription(db: DB, restaurantId: string, planCode = 'start') {
  const { data: existing } = await db
    .from('subscriptions')
    .select('*, plans(*)')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (existing) return existing;

  const { data: plan } = await db.from('plans').select('*').eq('code', planCode).maybeSingle();
  if (!plan) throw new Error(`plano '${planCode}' não existe`);

  const now = new Date();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const { data: created, error } = await db
    .from('subscriptions')
    .upsert(
      {
        restaurant_id: restaurantId,
        plan_id: plan.id,
        status: plan.trial_days > 0 ? 'trialing' : 'active',
        current_period_start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        current_period_end: periodEnd.toISOString(),
        trial_ends_at:
          plan.trial_days > 0 ? new Date(now.getTime() + plan.trial_days * 864e5).toISOString() : null,
      },
      { onConflict: 'restaurant_id', ignoreDuplicates: true },
    )
    .select('*, plans(*)')
    .maybeSingle();

  if (created) return created;
  // corrida: outra requisição criou ao mesmo tempo
  const { data: raced } = await db
    .from('subscriptions')
    .select('*, plans(*)')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (raced) return raced;
  throw new Error(`falha ao criar assinatura: ${error?.message ?? 'desconhecido'}`);
}

export type SubscriptionRow = NonNullable<Awaited<ReturnType<typeof ensureSubscription>>>;

/** Troca o plano da assinatura. */
export async function changePlan(db: DB, restaurantId: string, planCode: string) {
  const { data: plan } = await db.from('plans').select('id').eq('code', planCode).eq('active', true).maybeSingle();
  if (!plan) return { ok: false as const, error: 'plano inválido' };
  const { error } = await db
    .from('subscriptions')
    .update({ plan_id: plan.id, status: 'active' })
    .eq('restaurant_id', restaurantId);
  if (error) return { ok: false as const, error: 'falha ao trocar de plano' };
  return { ok: true as const };
}

/**
 * Registra a cobrança de uma entrega concluída (idempotente por order_id via
 * unique index). Chamado quando o pedido é entregue.
 */
export async function recordDeliveryUsage(db: DB, restaurantId: string, orderId: string) {
  const sub = await ensureSubscription(db, restaurantId);
  const plan = (sub as { plans: Database['public']['Tables']['plans']['Row'] }).plans;
  const now = new Date();
  const { error } = await db.from('billing_events').insert({
    restaurant_id: restaurantId,
    subscription_id: sub.id,
    type: 'delivery_fee',
    amount: Number(plan.per_delivery_price),
    description: `Entrega — ${plan.name}`,
    order_id: orderId,
    period_start: sub.current_period_start,
    period_end: sub.current_period_end,
  });
  // 23505 = já cobrado (idempotência) → ok
  if (error && error.code !== '23505') {
    console.error('[billing] recordDeliveryUsage:', error.message);
  }
  return { ok: true as const };
}

export type UsageSummary = {
  plan: { code: string; name: string; monthlyPrice: number; perDeliveryPrice: number; features: PlanFeatures };
  status: string;
  trialEndsAt: string | null;
  periodStart: string;
  periodEnd: string;
  deliveries: number;
  orders: number;
  monthlyFee: number;
  variableFee: number;
  estimatedTotal: number;
  billedTotal: number;
};

/** Resumo de uso e fatura estimada do período corrente. */
export async function getUsageSummary(db: DB, restaurantId: string): Promise<UsageSummary> {
  const sub = await ensureSubscription(db, restaurantId);
  const plan = (sub as { plans: Database['public']['Tables']['plans']['Row'] }).plans;

  const { count: deliveries } = await db
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('status', 'delivered')
    .gte('delivered_at', sub.current_period_start)
    .lt('delivered_at', sub.current_period_end);

  const { count: orders } = await db
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .gte('created_at', sub.current_period_start)
    .lt('created_at', sub.current_period_end);

  const { data: billed } = await db
    .from('billing_events')
    .select('amount')
    .eq('restaurant_id', restaurantId)
    .gte('period_start', sub.current_period_start);

  const d = deliveries ?? 0;
  const monthlyFee = Number(plan.monthly_price);
  const variableFee = round(d * Number(plan.per_delivery_price));
  const billedTotal = round((billed ?? []).reduce((s, b) => s + Number(b.amount), 0) + monthlyFee);

  return {
    plan: {
      code: plan.code,
      name: plan.name,
      monthlyPrice: monthlyFee,
      perDeliveryPrice: Number(plan.per_delivery_price),
      features: (plan.features ?? {}) as PlanFeatures,
    },
    status: sub.status,
    trialEndsAt: sub.trial_ends_at,
    periodStart: sub.current_period_start,
    periodEnd: sub.current_period_end,
    deliveries: d,
    orders: orders ?? 0,
    monthlyFee,
    variableFee,
    estimatedTotal: round(monthlyFee + variableFee),
    billedTotal,
  };
}

/** Features do plano do restaurante — para gating de UI/rotas. */
export async function getPlanFeatures(db: DB, restaurantId: string): Promise<PlanFeatures> {
  const { data } = await db
    .from('subscriptions')
    .select('plans(features)')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  const features = (data as { plans?: { features?: PlanFeatures } } | null)?.plans?.features;
  return (features ?? { auto_dispatch: true, map: true, tracking: true, grouping: true, own_fleet: true }) as PlanFeatures;
}

const round = (n: number) => Math.round(n * 100) / 100;
