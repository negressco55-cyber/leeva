import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreCandidatesForOrder, type ScoredCandidate } from '../services/autodispatch';
import { __setRoutingService, StraightLineRoutingService } from '../services/routing';

// Sem OSRM_BASE_URL/MAPBOX_TOKEN no ambiente de teste, getRoutingService() já
// cairia em StraightLineRoutingService — fixamos explicitamente por clareza.
__setRoutingService(new StraightLineRoutingService());

// ---------------------------------------------------------------------------
// Mock mínimo do client do Supabase: cada método de filtro devolve a própria
// cadeia; o resultado final é fixado por tabela (e, pra 'orders', pela ordem
// da chamada — a 1ª busca o pedido, a 2ª busca as entregas ativas da frota).
// ---------------------------------------------------------------------------
function chainable(result: unknown) {
  const rows = Array.isArray(result) ? result : result == null ? [] : [result];
  const chain: Record<string, unknown> = {};
  const passthrough = ['select', 'eq', 'gte', 'lte', 'lt', 'gt', 'limit', 'order', 'in', 'or', 'is', 'neq', 'not'];
  for (const m of passthrough) chain[m] = () => chain;
  chain.maybeSingle = async () => ({ data: result ?? null, error: null });
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(resolve, reject);
  return chain;
}

type FakeSpec = {
  orderRow: Record<string, unknown>;
  restaurantRow: Record<string, unknown>;
  motoboys: Record<string, unknown>[];
  activeOrders?: Record<string, unknown>[];
};

function makeFakeDb(spec: FakeSpec) {
  let ordersCalls = 0;
  return {
    from(table: string) {
      if (table === 'orders') {
        ordersCalls += 1;
        return chainable(ordersCalls === 1 ? spec.orderRow : (spec.activeOrders ?? []));
      }
      if (table === 'restaurants') return chainable(spec.restaurantRow);
      if (table === 'terms_versions') return chainable(null);
      if (table === 'motoboys') return chainable(spec.motoboys);
      throw new Error(`tabela não mockada no teste: ${table}`);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const PICKUP = { latitude: -7.1195, longitude: -34.845 };
// ~1 grau de latitude ≈ 111 km — desloca só em latitude pra controlar a
// distância até a coleta de cada motoboy.
const nearMotoboy = { latitude: PICKUP.latitude + 2 / 111, longitude: PICKUP.longitude }; // ~2 km
const farMotoboy = { latitude: PICKUP.latitude + 8 / 111, longitude: PICKUP.longitude }; // ~8 km

function motoboy(id: string, name: string, pos: { latitude: number; longitude: number }) {
  return {
    id,
    full_name: name,
    fleet: 'leeva',
    restaurant_id: null,
    status: 'available',
    active: true,
    blocked: false,
    current_latitude: pos.latitude,
    current_longitude: pos.longitude,
    location_updated_at: new Date().toISOString(),
    max_concurrent_deliveries: 3,
    rating: 4.8,
    deliveries_total: 20,
    deliveries_completed: 20,
    deliveries_late: 0,
    avg_delay_min: 0,
  };
}

function baseOrder(overrides: Record<string, unknown>) {
  return {
    id: 'order-1',
    order_number: 1001,
    restaurant_id: 'rest-1',
    latitude: PICKUP.latitude,
    longitude: PICKUP.longitude + 5 / 111,
    status: 'preparing',
    motoboy_id: null,
    group_id: null,
    ready_at: null,
    preparing_at: null,
    prep_estimate_minutes: null,
    ...overrides,
  };
}

const RESTAURANT = {
  latitude: PICKUP.latitude,
  longitude: PICKUP.longitude,
  fleet_mode: 'leeva',
  logistics_config: {},
};

// ---------------------------------------------------------------------------

test('Bloco 3: pedido ainda em preparo — motoboy mais longe é chamado antes do mais próximo', async () => {
  const preparingAt = new Date(Date.now() - 5 * 60_000).toISOString();
  const db = makeFakeDb({
    orderRow: baseOrder({ preparing_at: preparingAt, prep_estimate_minutes: 20 }), // pronto em ~15 min
    restaurantRow: RESTAURANT,
    motoboys: [motoboy('near', 'Perto', nearMotoboy), motoboy('far', 'Longe', farMotoboy)],
  });

  const { candidates, waitingForTiming } = await scoreCandidatesForOrder(db, 'order-1');
  const near = candidates.find((c) => c.motoboyId === 'near')!;
  const far = candidates.find((c) => c.motoboyId === 'far')!;

  // longe: tempo até a coleta é maior que a folga até o pedido ficar pronto
  // → já está na janela de chamada agora.
  assert.equal(far.blockers.length, 0, `far não devia ter blocker: ${far.blockers.join(', ')}`);
  assert.equal(far.minutesUntilDispatch, null);

  // perto: chegaria bem antes do pedido ficar pronto → ainda não é a hora.
  assert.ok(near.blockers.some((b) => b.includes('em preparo')), `near devia estar bloqueado por tempo: ${near.blockers.join(', ')}`);
  assert.ok(near.minutesUntilDispatch != null && near.minutesUntilDispatch > 0);

  assert.equal(waitingForTiming, false); // não é "sem ninguém" — o far já está elegível
});

test('Bloco 3: todos os candidatos ainda cedo → waitingForTiming, sem contar como falha', async () => {
  const preparingAt = new Date(Date.now() - 1 * 60_000).toISOString();
  const db = makeFakeDb({
    // prep_estimate bem longo: nem o motoboy "longe" alcança a janela ainda
    orderRow: baseOrder({ preparing_at: preparingAt, prep_estimate_minutes: 120 }),
    restaurantRow: RESTAURANT,
    motoboys: [motoboy('near', 'Perto', nearMotoboy), motoboy('far', 'Longe', farMotoboy)],
  });

  const { candidates, waitingForTiming, note } = await scoreCandidatesForOrder(db, 'order-1');
  assert.ok(candidates.every((c) => c.blockers.length === 1 && c.minutesUntilDispatch! > 0));
  assert.equal(waitingForTiming, true);
  assert.ok(note?.includes('em preparo'));
});

test('Bloco 3: pedido já pronto (ready_at) despacha na hora, sem esperar ninguém', async () => {
  const db = makeFakeDb({
    orderRow: baseOrder({
      ready_at: new Date().toISOString(),
      preparing_at: new Date(Date.now() - 20 * 60_000).toISOString(),
      prep_estimate_minutes: 15, // já venceu, mas ready_at manda
    }),
    restaurantRow: RESTAURANT,
    motoboys: [motoboy('near', 'Perto', nearMotoboy), motoboy('far', 'Longe', farMotoboy)],
  });

  const { candidates } = await scoreCandidatesForOrder(db, 'order-1');
  for (const c of candidates) {
    assert.equal(c.minutesUntilDispatch, null);
    assert.ok(!c.blockers.some((b) => b.includes('em preparo')));
  }
});

test('Bloco 3: pedido sem estimativa de preparo despacha na hora (fallback já usado no Bloco 1)', async () => {
  const db = makeFakeDb({
    orderRow: baseOrder({ status: 'waiting_dispatch', preparing_at: null, prep_estimate_minutes: null }),
    restaurantRow: RESTAURANT,
    motoboys: [motoboy('near', 'Perto', nearMotoboy)],
  });

  const { candidates } = await scoreCandidatesForOrder(db, 'order-1');
  const near = candidates[0] as ScoredCandidate;
  assert.equal(near.minutesUntilDispatch, null);
  assert.equal(near.blockers.length, 0);
});
