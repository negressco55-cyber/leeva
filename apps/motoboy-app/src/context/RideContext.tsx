import * as Location from 'expo-location';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { advanceDelivery, getActiveDeliveries, getOffers, respondOffer } from '../api/entregas';
import { sendLocation, setOnline } from '../api/motoboy';
import { subscribeMotoboyRealtime, unsubscribeMotoboyRealtime } from '../api/realtime';
import { NEXT_STATUS, type Delivery, type Offer } from '../types';
import { useAuth } from './AuthContext';

const LOCATION_INTERVAL_MS = 10_000;
const OFFERS_POLL_MS = 5_000;

interface RideContextValue {
  online: boolean;
  togglingOnline: boolean;
  offer: Offer | null;
  activeDelivery: Delivery | null;
  advancing: boolean;
  position: { latitude: number; longitude: number } | null;
  goOnline: () => Promise<void>;
  goOffline: () => Promise<void>;
  acceptOffer: () => Promise<void>;
  declineOffer: () => Promise<void>;
  advanceActive: () => Promise<void>;
  reloadDeliveries: () => Promise<void>;
}

const RideContext = createContext<RideContextValue | undefined>(undefined);

export function RideProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { isAuthenticated, me, refreshMe } = useAuth();

  const [online, setOnlineState] = useState(false);
  const [togglingOnline, setToggling] = useState(false);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [activeDelivery, setActive] = useState<Delivery | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);

  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastSentRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      { accuracy: Location.LocationAccuracy.Balanced, timeInterval: LOCATION_INTERVAL_MS, distanceInterval: 25 },
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition({ latitude, longitude });
        const now = Date.now();
        if (now - lastSentRef.current < LOCATION_INTERVAL_MS - 500) return;
        lastSentRef.current = now;
        sendLocation(latitude, longitude).catch(() => {});
      },
    );
  }, []);

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
  }, []);

  const reloadDeliveries = useCallback(async () => {
    try {
      const list = await getActiveDeliveries();
      setActive(list[0] ?? null);
    } catch {
      /* ignora */
    }
  }, []);

  // loop enquanto online ou com entrega ativa
  useEffect(() => {
    const running = isAuthenticated && (online || activeDelivery != null);
    if (!running) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    void loadOffers();
    void reloadDeliveries();
    pollRef.current = setInterval(() => {
      void loadOffers();
      void reloadDeliveries();
    }, OFFERS_POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [isAuthenticated, online, activeDelivery, loadOffers, reloadDeliveries]);

  // realtime + GPS enquanto online
  useEffect(() => {
    if (!isAuthenticated || !me?.motoboyId) return;
    if (online) {
      subscribeMotoboyRealtime(me.motoboyId, () => {
        void loadOffers();
        void reloadDeliveries();
      });
      void startWatch();
    } else {
      unsubscribeMotoboyRealtime();
      stopWatch();
      setOffer(null);
    }
    return () => {
      unsubscribeMotoboyRealtime();
    };
  }, [isAuthenticated, online, me?.motoboyId, loadOffers, reloadDeliveries, startWatch, stopWatch]);

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
  }, [me, refreshMe, startWatch]);

  const goOffline = useCallback(async () => {
    setToggling(true);
    try {
      await setOnline(false);
      setOnlineState(false);
      stopWatch();
      unsubscribeMotoboyRealtime();
      setOffer(null);
      setPosition(null);
      await refreshMe();
    } catch (e) {
      Alert.alert('Não deu para atualizar', (e as Error).message || 'Finalize suas entregas primeiro.');
    } finally {
      setToggling(false);
    }
  }, [refreshMe, stopWatch]);

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
  }, [offer, reloadDeliveries, refreshMe]);

  const declineOffer = useCallback(async () => {
    if (!offer) return;
    const current = offer;
    setOffer(null);
    try {
      await respondOffer(current.offerId, 'decline');
    } catch {
      /* ignora */
    }
  }, [offer]);

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
      unsubscribeMotoboyRealtime();
      setOnlineState(false);
      setOffer(null);
      setActive(null);
      setPosition(null);
    }
  }, [isAuthenticated, stopWatch]);

  const value = useMemo<RideContextValue>(
    () => ({
      online,
      togglingOnline,
      offer,
      activeDelivery,
      advancing,
      position,
      goOnline,
      goOffline,
      acceptOffer,
      declineOffer,
      advanceActive,
      reloadDeliveries,
    }),
    [online, togglingOnline, offer, activeDelivery, advancing, position, goOnline, goOffline, acceptOffer, declineOffer, advanceActive, reloadDeliveries],
  );

  return <RideContext.Provider value={value}>{children}</RideContext.Provider>;
}

export function useRide(): RideContextValue {
  const ctx = useContext(RideContext);
  if (!ctx) throw new Error('useRide precisa estar dentro de RideProvider');
  return ctx;
}
