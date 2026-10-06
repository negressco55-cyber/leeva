/**
 * Rastreamento de localização em SEGUNDO PLANO durante uma entrega.
 *
 * Enquanto há entrega ativa, o app continua enviando a posição do motoboy
 * para o servidor mesmo com a tela travada ou o app minimizado — exigência
 * de um app de entrega (o restaurante e o cliente acompanham em tempo real).
 * No Android isso roda como *foreground service*, com uma notificação fixa
 * obrigatória explicando o motivo (regra do sistema).
 *
 * Quando não há entrega ativa, o rastreamento em segundo plano é desligado
 * automaticamente — nada de ficar drenando bateria à toa.
 *
 * A task roda num contexto de JS separado (headless), então ela NÃO usa os
 * contextos React — usa o cliente Supabase direto (sessão no AsyncStorage).
 *
 * A posição vai DIRETO pro Supabase (função record_my_location), sem passar
 * pela Vercel. Só perto do cliente (< 400 m) o app chama /api/location uma
 * vez por entrega, para disparar o aviso "seu pedido está chegando".
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { API_URL, supabase } from './supabase';
import { buildLocationBody, lastLocation, shouldThrottle } from './locationPayload';

export const BG_LOCATION_TASK = 'leeva-bg-location';

let lastSentAt = 0;
const nearbySent = new Set<string>();
const MIN_SEND_INTERVAL_MS = 8_000;

TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const last = lastLocation((data as { locations?: Location.LocationObject[] } | null)?.locations);
  if (!last) return;

  const now = Date.now();
  if (shouldThrottle(now, lastSentAt, MIN_SEND_INTERVAL_MS)) return;
  lastSentAt = now;

  try {
    const body = buildLocationBody(last.coords);
    const { data } = await supabase.rpc('record_my_location', {
      p_latitude: body.latitude,
      p_longitude: body.longitude,
      p_accuracy: body.accuracy,
      p_speed: body.speed,
    });
    const r = data as { nearby?: boolean; order_id?: string } | null;
    if (r?.nearby && r.order_id && !nearbySent.has(r.order_id)) {
      nearbySent.add(r.order_id);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;
      await fetch(`${API_URL}/api/location`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
    }
  } catch {
    /* sem rede — a próxima leitura tenta de novo */
  }
});

export async function startBackgroundLocation(): Promise<void> {
  try {
    // precisa da permissão "sempre" (background) — pede se ainda não tem
    const fg = await Location.getForegroundPermissionsAsync();
    if (!fg.granted) {
      const req = await Location.requestForegroundPermissionsAsync();
      if (!req.granted) return;
    }
    const bg = await Location.getBackgroundPermissionsAsync();
    if (!bg.granted) {
      const req = await Location.requestBackgroundPermissionsAsync();
      if (!req.granted) return; // segue só com foreground; não quebra
    }

    const already = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => false);
    if (already) return;

    await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 12_000,
      distanceInterval: 40,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService:
        Platform.OS === 'android'
          ? {
              notificationTitle: 'Leeva — entrega em andamento',
              notificationBody: 'Enviando sua localização para o cliente acompanhar a entrega.',
              notificationColor: '#1f6f5c',
              killServiceOnDestroy: false,
            }
          : undefined,
    });
  } catch {
    /* se não der pra iniciar (permissão, device), o foreground watch cobre o essencial */
  }
}

export async function stopBackgroundLocation(): Promise<void> {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => false);
    if (started) await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK);
  } catch {
    /* ignora */
  }
}

export async function isBackgroundLocationRunning(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => false);
}
