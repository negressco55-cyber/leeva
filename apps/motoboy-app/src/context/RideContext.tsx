import * as Location from 'expo-location';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';

import { advanceDelivery, getActiveDeliveries, getOffers, respondOffer } from '../api/entregas';
import { sendLocation, setOnline } from '../api/motoboy';
import { subscribeMotoboyRealtime, unsubscribeMotoboyRealtime } from '../api/realtime';
import { startBackgroundLocation, stopBackgroundLocation } from '../lib/backgroundLocation';
import { NEXT_STATUS, type Delivery, type Offer } from '../types';
import { useAuth } from './AuthContext';
import { usePosition } from './PositionContext';

const LOCATION_INTERVAL_MS = 10_000;
const POLL_ACTIVE_MS = 5_000;
const POLL_BACKGROUND_MS = 20_000;

interface RideContextValue {
  online: boolean;
  togglingOnline: boolean;
  offer: Offer | null;
  activeDelivery: Delivery | null;
  advancing: boolean;
  goOnline: () => Promise<void>;
  goOffline: () => Promise<void>;
  acceptOffer: () => Promise<void>;
  declineOffer: () => Promise<void>;
  advanceActive: () => Promise<void>;
}

const RideContext = createContext<RideContextValue | undefined>(undefined);

/** Duas ofertas são "a mesma" se têm o mesmo id e validade — evita re-render. */
function sameOffer(a: Offer | null, b: Offer | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.offerId === b.offerId && a.expiresAt === b.expiresAt;
}
function sameDelivery(a: Delivery | null, b: Delivery | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.id === b.id && a.status === b.status && a.groupSequence === b.groupSequence;
}

export function RideProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { isAuthenticated, me, refreshMe } = useAuth();
  const { setPosition } = usePosition();

  const [online, setOnlineState] = useState(false);
  const [togglingOnline, setToggling] = useState(false);
  const [offer, setOfferState] = useState<Offer | null>(null);
  const [activeDelivery, setActiveState] = useState<Delivery | null>(null);
  const [advancing, setAdvancing] = useState(false);

  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastSentRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onlineRef = useRef(false);
  const hasActiveRef = useRef(false);

  const setOffer = useCallback((next: Offer | null) => {
    setOfferState((prev) => (sameOffer(prev, next) ? prev : next));
  }, []);
  const setActive = useCallback((next: Delivery | null) => {
    hasActiveRef.current = next != null;
    setActiveState((prev) => (sameDelivery(prev, next) ? prev : next));
  }, []);

  useEffect(() => {
    onlineRef.current = online;
  }, [online]);

  useEffect(() => {
    setOnlineState((me?.status ?? 'offline') !== 'offline');
  }, [me?.status]);

  const stopWatch = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
  }, []);

  const startWatch = useCallback(async () => {
    if (watchRef.current) return;
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.LocationAccuracy.Balanced, timeInterval: LOCATION_INTERVAL_MS, distanceInterval: 30 },
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition({ latitude, longitude });
        // com entrega ativa quem manda a posição pro servidor é a task de
        // segundo plano (roda mesmo com o app fechado). Sem entrega, o
        // watch de primeiro plano cobre.
        if (hasActiveRef.current) return;
        const now = Date.now();
        if (now - lastSentRef.current < LOCATION_INTERVAL_MS - 500) return;
        lastSentRef.current = now;
        sendLocation(latitude, longitude).catch(() => {});
      },
    );
  }, [setPosition]);

  const loadOffers = useCallback(async () => {
    try {
      const offers = await getOffers();
      const active = offers
        .filter((o) => new Date(o.expiresAt).getTime() > Date.now())
        .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
      setOffer(active[0] ?? null);
    } catch {
      /* rede — próximo ciclo */
    }
  }, [setOffer]);

  const reloadDeliveries = useCallback(async () => {
    try {
      const list = await getActiveDeliveries();
      setActive(list[0] ?? null);
    } catch {
      /* ignora */
    }
  }, [setActive]);

  const tick = useCallback(() => {
    if (!onlineRef.current && !hasActiveRef.current) return;
    void loadOffers();
    void reloadDeliveries();
  }, [loadOffers, reloadDeliveries]);

  // UM único loop, criado uma vez enquanto autenticado. Sem depender de
  // `activeDelivery`/`online` (que mudam ref) — usa refs pra decidir dentro.
  // Ajusta a frequência conforme o app está em primeiro plano ou não.
  useEffect(() => {
    if (!isAuthenticated) return;

    const schedule = (ms: number) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(tick, ms);
    };
    tick();
    schedule(AppState.currentState === 'active' ? POLL_ACTIVE_MS : POLL_BACKGROUND_MS);

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        tick();
        schedule(POLL_ACTIVE_MS);
      } else {
        schedule(POLL_BACKGROUND_MS);
      }
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      appSub.remove();
    };
  }, [isAuthenticated, tick]);

  // realtime + GPS enquanto online
  useEffect(() => {
    if (!isAuthenticated || !me?.motoboyId) return;
    if (online) {
      subscribeMotoboyRealtime(me.motoboyId, tick);
      void startWatch();
    } else {
      unsubscribeMotoboyRealtime();
      stopWatch();
      setOffer(null);
    }
    return () => unsubscribeMotoboyRealtime();
  }, [isAuthenticated, online, me?.motoboyId, tick, startWatch, stopWatch, setOffer]);

  // localização em segundo plano: liga enquanto há entrega ativa, desliga quando não há
  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeDelivery) void startBackgroundLocation();
    else void stopBackgroundLocation();
  }, [isAuthenticated, activeDelivery]);

  const goOnline = useCallback(async () => {
    if (me?.approvalStatus !== 'approved') {
      Alert.alert('Cadastro em análise', 'Você poderá ficar disponível quando o cadastro for aprovado.');
      return;
    }
    if (me?.terms) {
      Alert.alert('Termos de uso', 'Aceite os termos de uso na tela de Perfil antes de ficar disponível.');
      return;
    }
    setToggling(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Ative a localização para ficar disponível e receber entregas.');
        return;
      }
      await setOnline(true);
      setOnlineState(true);
      await refreshMe();
      const pos = await Location.getCurrentPositionAsync({});
      setPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      await sendLocation(pos.coords.latitude, pos.coords.longitude).catch(() => {});
      await startWatch();
    } catch (e) {
      Alert.alert('Não deu para ficar disponível', (e as Error).message || 'Tente de novo.');
    } finally {
      setToggling(false);
    }
  }, [me, refreshMe, startWatch, setPosition]);

  const goOffline = useCallback(async () => {
    setToggling(true);
    try {
      await setOnline(false);
      setOnlineState(false);
      stopWatch();
      void stopBackgroundLocation();
      unsubscribeMotoboyRealtime();
      setOffer(null);
      setPosition(null);
      await refreshMe();
    } catch (e) {
      Alert.alert('Não deu para atualizar', (e as Error).message || 'Finalize suas entregas primeiro.');
    } finally {
      setToggling(false);
    }
  }, [refreshMe, stopWatch, setOffer, setPosition]);

  const acceptOffer = useCallback(async () => {
    if (!offer) return;
    const current = offer;
    setOffer(null);
    try {
      await respondOffer(current.offerId, 'accept');
      await reloadDeliveries();
      await refreshMe();
    } catch (e) {
      Alert.alert('Oferta indisponível', (e as Error).message || 'Essa entrega já foi para outro motoboy.');
    }
  }, [offer, reloadDeliveries, refreshMe, setOffer]);

  const declineOffer = useCallback(async () => {
    if (!offer) return;
    const current = offer;
    setOffer(null);
    try {
      await respondOffer(current.offerId, 'decline');
    } catch {
      /* ignora */
    }
  }, [offer, setOffer]);

  const advanceActive = useCallback(async () => {
    if (!activeDelivery) return;
    const next = NEXT_STATUS[activeDelivery.status];
    if (!next) return;
    setAdvancing(true);
    try {
      await advanceDelivery(activeDelivery.id, next);
      await reloadDeliveries();
      if (next === 'delivered') await refreshMe();
    } catch (e) {
      Alert.alert('Não deu para atualizar', (e as Error).message || 'Tente de novo.');
    } finally {
      setAdvancing(false);
    }
  }, [activeDelivery, reloadDeliveries, refreshMe]);

  useEffect(() => {
    if (!isAuthenticated) {
      stopWatch();
      void stopBackgroundLocation();
      unsubscribeMotoboyRealtime();
      setOnlineState(false);
      setOffer(null);
      setActive(null);
    }
  }, [isAuthenticated, stopWatch, setOffer, setActive]);

  const value = useMemo<RideContextValue>(
    () => ({
      online,
      togglingOnline,
      offer,
      activeDelivery,
      advancing,
      goOnline,
      goOffline,
      acceptOffer,
      declineOffer,
      advanceActive,
    }),
    [online, togglingOnline, offer, activeDelivery, advancing, goOnline, goOffline, acceptOffer, declineOffer, advanceActive],
  );

  return <RideContext.Provider value={value}>{children}</RideContext.Provider>;
}

export function useRide(): RideContextValue {
  const ctx = useContext(RideContext);
  if (!ctx) throw new Error('useRide precisa estar dentro de RideProvider');
  return ctx;
}
