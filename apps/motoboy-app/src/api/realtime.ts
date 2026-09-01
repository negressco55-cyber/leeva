/**
 * Tempo real via Supabase Realtime. Substitui o Socket.io da versão do
 * clone. Escuta mudanças em dispatch_attempts do próprio motoboy (nova
 * oferta, oferta cancelada) e em orders atribuídos a ele.
 */
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

let channel: RealtimeChannel | null = null;

export function subscribeMotoboyRealtime(motoboyId: string, onChange: () => void): void {
  unsubscribeMotoboyRealtime();
  channel = supabase
    .channel(`motoboy-${motoboyId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'dispatch_attempts', filter: `motoboy_id=eq.${motoboyId}` },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `motoboy_id=eq.${motoboyId}` },
      () => onChange(),
    )
    .subscribe();
}

export function unsubscribeMotoboyRealtime(): void {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}
