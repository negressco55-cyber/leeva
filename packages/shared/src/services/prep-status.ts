/**
 * Status de preparo — cálculo único, usado pelo painel do restaurante e
 * pelas telas do motoboy (oferta + entrega ativa), pros dois nunca mostrarem
 * coisas diferentes pro mesmo pedido.
 */
export type PrepStatusInput = {
  readyAt: string | null;
  preparingAt: string | null;
  prepEstimateMinutes: number | null;
};

export type PrepStatus =
  | { state: 'none' } // nunca foi marcado "em preparo" (ainda aguardando despacho, sem estimativa)
  | { state: 'ready'; label: string }
  | { state: 'preparing'; label: string; minutesLeft: number | null };

/** `now` é injetável só pra teste — em produção sempre o instante atual. */
export function computePrepStatus(input: PrepStatusInput, now: Date = new Date()): PrepStatus {
  if (input.readyAt) return { state: 'ready', label: '🔔 Pronto pra retirada' };
  if (!input.preparingAt) return { state: 'none' };
  if (!input.prepEstimateMinutes) return { state: 'preparing', label: 'Em preparo', minutesLeft: null };

  const readyBy = new Date(input.preparingAt).getTime() + input.prepEstimateMinutes * 60_000;
  const minutesLeft = Math.round((readyBy - now.getTime()) / 60_000);
  const label = minutesLeft > 0 ? `Em preparo · pronto em ~${minutesLeft} min` : 'Em preparo · já deveria estar pronto';
  return { state: 'preparing', label, minutesLeft };
}
