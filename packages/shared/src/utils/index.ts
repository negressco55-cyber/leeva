/** Utilitários comuns aos dois apps. */

export function formatCurrencyBRL(value: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value ?? 0);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

/** Diferença em minutos entre dois instantes ISO (ex: tempo de preparo). */
export function minutesBetween(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): number | null {
  if (!startIso || !endIso) return null;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.round(ms / 60000);
}

export function onlyDigits(value: string): string {
  return value.replace(/\D+/g, '');
}

/** "1 motoboy" / "3 motoboys" — plural pt-BR simples. */
export function plural(n: number, singular: string, pluralForm?: string): string {
  const p = pluralForm ?? `${singular}s`;
  return `${n} ${n === 1 ? singular : p}`;
}

/** Frase "N motoboy(s) disponível(is)". */
export function motoboysDisponiveis(n: number): string {
  return `${plural(n, 'motoboy')} ${n === 1 ? 'disponível' : 'disponíveis'}`;
}

export function assertEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variável de ambiente ausente: ${name}. Confira o arquivo .env.local do app.`,
    );
  }
  return value;
}
