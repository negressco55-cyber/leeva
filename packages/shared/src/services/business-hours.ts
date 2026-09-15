/**
 * Horário de funcionamento do restaurante — um horário simples por dia da
 * semana (sem múltiplos turnos nesta versão). Usado pra bloquear despacho
 * automático e criação manual de pedido fora do expediente.
 */
export type Weekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export type DayHours = { open: string; close: string; closed: boolean };

export type BusinessHours = Partial<Record<Weekday, DayHours>>;

export const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  sun: 'Domingo',
  mon: 'Segunda',
  tue: 'Terça',
  wed: 'Quarta',
  thu: 'Quinta',
  fri: 'Sexta',
  sat: 'Sábado',
};

/** Padrão sugerido no cadastro — todo dia, 08:00–22:00. Restaurante ajusta. */
export function defaultBusinessHours(): BusinessHours {
  const hours: BusinessHours = {};
  for (const day of WEEKDAYS) hours[day] = { open: '08:00', close: '22:00', closed: false };
  return hours;
}

// Brasil não tem mais horário de verão desde 2019 — UTC-3 fixo é suficiente
// pra essa checagem (evita depender de timezone do servidor/ICU).
const BR_OFFSET_MS = -3 * 60 * 60 * 1000;

function toMinutes(hhmm: string | undefined): number | null {
  const m = hhmm ? /^(\d{1,2}):(\d{2})$/.exec(hhmm) : null;
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * O restaurante está dentro do horário de funcionamento agora (ou em `at`)?
 * Sem horário configurado (`hours` null/undefined) = sempre aberto — é um
 * recurso opcional, não trava quem ainda não configurou.
 */
export function isRestaurantOpen(hours: BusinessHours | null | undefined, at: Date = new Date()): boolean {
  if (!hours) return true;
  const local = new Date(at.getTime() + BR_OFFSET_MS);
  const day = WEEKDAYS[local.getUTCDay()]!;
  const d = hours[day];
  if (!d || d.closed) return false;

  const nowMin = local.getUTCHours() * 60 + local.getUTCMinutes();
  const openMin = toMinutes(d.open);
  const closeMin = toMinutes(d.close);
  if (openMin == null || closeMin == null) return true; // configurado errado — não trava por engano
  if (openMin === closeMin) return true; // aberto 24h nesse dia

  if (openMin < closeMin) return nowMin >= openMin && nowMin < closeMin;
  // vira a noite (ex.: 18:00–02:00)
  return nowMin >= openMin || nowMin < closeMin;
}

/** Valida/normaliza um payload de horário vindo do cliente — nunca confia
 *  cegamente no que chega numa requisição. Ignora dias mal formados. */
export function sanitizeBusinessHours(input: unknown): BusinessHours | null {
  if (!input || typeof input !== 'object') return null;
  const out: BusinessHours = {};
  for (const day of WEEKDAYS) {
    const d = (input as Record<string, unknown>)[day] as Partial<DayHours> | undefined;
    if (!d || typeof d !== 'object') continue;
    const open = typeof d.open === 'string' && toMinutes(d.open) != null ? d.open : '08:00';
    const close = typeof d.close === 'string' && toMinutes(d.close) != null ? d.close : '22:00';
    out[day] = { open, close, closed: !!d.closed };
  }
  return Object.keys(out).length ? out : null;
}

/** Mensagem pronta pra mostrar quando bloquear por estar fechado. */
export function closedMessage(hours: BusinessHours | null | undefined, at: Date = new Date()): string {
  if (!hours) return 'Fora do horário de funcionamento.';
  const local = new Date(at.getTime() + BR_OFFSET_MS);
  const day = WEEKDAYS[local.getUTCDay()]!;
  const d = hours[day];
  if (!d || d.closed) return `Fechado hoje (${WEEKDAY_LABELS[day]}).`;
  return `Fora do horário de funcionamento — hoje (${WEEKDAY_LABELS[day]}) funciona das ${d.open} às ${d.close}.`;
}
