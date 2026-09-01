import * as Location from 'expo-location';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { aceitarCorrida, atualizarStatusCorrida } from '../api/corridas';
import { updateDisponibilidade, updateLocalizacao } from '../api/motoboy';
import { connectSocket, disconnectSocket, getSocket, joinMotoboyRoom } from '../api/socket';
import type { Corrida, SocketEventCorridaNova, StatusCorrida } from '../types';
import { SEQUENCIA_STATUS_MOTOBOY } from '../types';
import { useAuth } from './AuthContext';

const ENVIO_LOCALIZACAO_INTERVALO_MS = 10000;

interface RideContextValue {
  disponivel: boolean;
  alternandoDisponibilidade: boolean;
  ofertaCorrida: SocketEventCorridaNova | null;
  corridaAtiva: Corrida | null;
  atualizandoStatus: boolean;
  /** Última posição de GPS do motoboy — alimenta o mapa embutido; `null` até a primeira leitura. */
  posicaoAtual: { latitude: number; longitude: number } | null;
  ligarDisponibilidade: () => Promise<void>;
  desligarDisponibilidade: () => Promise<void>;
  aceitarOferta: () => Promise<void>;
  recusarOferta: () => void;
  proximoStatus: (statusAtual: StatusCorrida) => StatusCorrida | null;
  avancarStatusCorrida: (codigoConfirmacao?: string) => Promise<void>;
  finalizarCorridaAtiva: () => void;
}

const RideContext = createContext<RideContextValue | undefined>(undefined);

export function RideProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { accessToken, motoboy, setMotoboy, isAuthenticated } = useAuth();

  const [disponivel, setDisponivel] = useState(false);
  const [alternandoDisponibilidade, setAlternandoDisponibilidade] = useState(false);
  const [ofertaCorrida, setOfertaCorrida] = useState<SocketEventCorridaNova | null>(null);
  const [corridaAtiva, setCorridaAtiva] = useState<Corrida | null>(null);
  const [atualizandoStatus, setAtualizandoStatus] = useState(false);
  const [posicaoAtual, setPosicaoAtual] = useState<{ latitude: number; longitude: number } | null>(null);

  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const lastSentAtRef = useRef<number>(0);
  const motoboyIdRef = useRef<string | null>(null);
  const corridaAtivaRef = useRef<Corrida | null>(null);

  useEffect(() => {
    motoboyIdRef.current = motoboy?.id ?? null;
  }, [motoboy?.id]);

  useEffect(() => {
    corridaAtivaRef.current = corridaAtiva;
  }, [corridaAtiva]);

  useEffect(() => {
    setDisponivel(motoboy?.disponivel ?? false);
  }, [motoboy?.disponivel]);

  const pararRastreamento = useCallback(() => {
    watchSubscriptionRef.current?.remove();
    watchSubscriptionRef.current = null;
  }, []);

  const iniciarRastreamento = useCallback(async () => {
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.LocationAccuracy.Balanced,
        timeInterval: ENVIO_LOCALIZACAO_INTERVALO_MS,
        distanceInterval: 25,
      },
      (position) => {
        const { latitude, longitude } = position.coords;
        // Atualiza o mapa embutido a cada leitura de GPS, independente do
        // throttle de envio ao backend logo abaixo (esse throttle é só pra
        // não sobrecarregar a API/socket, não precisa se aplicar à UI local).
        setPosicaoAtual({ latitude, longitude });

        const now = Date.now();
        if (now - lastSentAtRef.current < ENVIO_LOCALIZACAO_INTERVALO_MS - 500) return;
        lastSentAtRef.current = now;

        updateLocalizacao(latitude, longitude).catch(() => {
          // Falha silenciosa: próxima leitura de posição tenta de novo.
        });

        const id = motoboyIdRef.current;
        if (id) joinMotoboyRoom(id, latitude, longitude);
      }
    );

    watchSubscriptionRef.current = subscription;
  }, []);

  // Listener do evento corrida:nova sempre que o socket estiver conectado.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleCorridaNova = (payload: SocketEventCorridaNova): void => {
      if (corridaAtivaRef.current) return;
      setOfertaCorrida((atual) => atual ?? payload);
    };

    socket.on('corrida:nova', handleCorridaNova);
    return () => {
      socket.off('corrida:nova', handleCorridaNova);
    };
  }, [disponivel]);

  // Conecta socket + geolocalização — separado do PATCH de disponibilidade
  // porque também precisa rodar quando o app ABRE já disponível (backend
  // com disponivel=true de uma sessão anterior que fechou sem desligar):
  // sem isso o motoboy fica "disponível" só na tela, sem socket conectado
  // nem localização atualizada — invisível de verdade pro matching.
  const ativarConexaoEDisponibilidade = useCallback(
    async (latitude: number, longitude: number) => {
      if (accessToken) {
        connectSocket(accessToken);
      }
      const id = motoboyIdRef.current;
      if (id) {
        joinMotoboyRoom(id, latitude, longitude);
      }
      setPosicaoAtual({ latitude, longitude });
      lastSentAtRef.current = Date.now();
      await updateLocalizacao(latitude, longitude);
      await iniciarRastreamento();
    },
    [accessToken, iniciarRastreamento]
  );

  const ligarDisponibilidade = useCallback(async () => {
    if (motoboy?.statusAprovacao !== 'APROVADO') {
      Alert.alert('Cadastro em análise', 'Seu cadastro ainda está em análise. Você poderá ficar disponível assim que for aprovado.');
      return;
    }

    setAlternandoDisponibilidade(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Ative a permissão de localização para ficar disponível e receber corridas.');
        return;
      }

      const updated = await updateDisponibilidade(true);
      setMotoboy(updated);
      setDisponivel(true);

      const initialPosition = await Location.getCurrentPositionAsync({});
      await ativarConexaoEDisponibilidade(initialPosition.coords.latitude, initialPosition.coords.longitude);
    } catch (error) {
      Alert.alert('Não foi possível ficar disponível', 'Tente novamente em instantes.');
    } finally {
      setAlternandoDisponibilidade(false);
    }
  }, [motoboy, setMotoboy, ativarConexaoEDisponibilidade]);

  // Retoma automaticamente a conexão se o app abrir com o motoboy já
  // marcado como disponível no backend (app fechado e reaberto etc.) —
  // só uma vez por sessão do app.
  const retomadaFeitaRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || retomadaFeitaRef.current) return;
    if (motoboy?.disponivel !== true || watchSubscriptionRef.current !== null) return;

    retomadaFeitaRef.current = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const position = await Location.getCurrentPositionAsync({});
        await ativarConexaoEDisponibilidade(position.coords.latitude, position.coords.longitude);
      } catch {
        // Sem permissão/posição disponível nesse retomar automático — o
        // motoboy precisa desligar/ligar manualmente pra tentar de novo.
      }
    })();
  }, [isAuthenticated, motoboy?.disponivel, ativarConexaoEDisponibilidade]);

  const desligarDisponibilidade = useCallback(async () => {
    setAlternandoDisponibilidade(true);
    try {
      const updated = await updateDisponibilidade(false);
      setMotoboy(updated);
      setDisponivel(false);
      pararRastreamento();
      disconnectSocket();
      setOfertaCorrida(null);
      setPosicaoAtual(null);
    } catch (error) {
      Alert.alert('Não foi possível atualizar', 'Tente novamente em instantes.');
    } finally {
      setAlternandoDisponibilidade(false);
    }
  }, [setMotoboy, pararRastreamento]);

  const aceitarOferta = useCallback(async () => {
    if (!ofertaCorrida) return;
    try {
      const corrida = await aceitarCorrida(ofertaCorrida.corridaId);
      setCorridaAtiva(corrida);
      setOfertaCorrida(null);
    } catch (error) {
      Alert.alert('Corrida indisponível', 'Essa corrida já foi aceita por outro motoboy.');
      setOfertaCorrida(null);
    }
  }, [ofertaCorrida]);

  const recusarOferta = useCallback(() => {
    setOfertaCorrida(null);
  }, []);

  const proximoStatus = useCallback((statusAtual: StatusCorrida): StatusCorrida | null => {
    const index = SEQUENCIA_STATUS_MOTOBOY.indexOf(statusAtual);
    if (index === -1 || index === SEQUENCIA_STATUS_MOTOBOY.length - 1) return null;
    return SEQUENCIA_STATUS_MOTOBOY[index + 1];
  }, []);

  const avancarStatusCorrida = useCallback(
    async (codigoConfirmacao?: string) => {
      if (!corridaAtiva) return;
      const proximo = proximoStatus(corridaAtiva.status);
      if (!proximo) return;

      setAtualizandoStatus(true);
      try {
        const atualizada = await atualizarStatusCorrida(corridaAtiva.id, proximo, codigoConfirmacao);
        setCorridaAtiva(atualizada);
      } catch (error) {
        // Erro de código de confirmação (400) tem mensagem específica do backend
        // — a tela de entrega mostra esse texto e mantém o campo aberto pra
        // tentar de novo, por isso relançamos em vez de só engolir com Alert.
        const mensagemBackend = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
        if (proximo === 'ENTREGUE') {
          throw new Error(mensagemBackend ?? 'Não foi possível confirmar a entrega.');
        }
        Alert.alert('Não foi possível atualizar o status', mensagemBackend ?? 'Tente novamente em instantes.');
      } finally {
        setAtualizandoStatus(false);
      }
    },
    [corridaAtiva, proximoStatus]
  );

  const finalizarCorridaAtiva = useCallback(() => {
    setCorridaAtiva(null);
  }, []);

  // Ao deslogar, garante que o rastreamento pare.
  useEffect(() => {
    if (!isAuthenticated) {
      pararRastreamento();
      setDisponivel(false);
      setOfertaCorrida(null);
      setCorridaAtiva(null);
      setPosicaoAtual(null);
    }
  }, [isAuthenticated, pararRastreamento]);

  const value = useMemo<RideContextValue>(
    () => ({
      disponivel,
      alternandoDisponibilidade,
      ofertaCorrida,
      corridaAtiva,
      atualizandoStatus,
      posicaoAtual,
      ligarDisponibilidade,
      desligarDisponibilidade,
      aceitarOferta,
      recusarOferta,
      proximoStatus,
      avancarStatusCorrida,
      finalizarCorridaAtiva,
    }),
    [
      disponivel,
      alternandoDisponibilidade,
      ofertaCorrida,
      corridaAtiva,
      atualizandoStatus,
      posicaoAtual,
      ligarDisponibilidade,
      desligarDisponibilidade,
      aceitarOferta,
      recusarOferta,
      proximoStatus,
      avancarStatusCorrida,
      finalizarCorridaAtiva,
    ]
  );

  return <RideContext.Provider value={value}>{children}</RideContext.Provider>;
}

export function useRide(): RideContextValue {
  const context = useContext(RideContext);
  if (!context) throw new Error('useRide precisa ser usado dentro de um RideProvider');
  return context;
}
