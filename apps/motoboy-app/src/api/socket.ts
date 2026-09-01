import { io, type Socket } from 'socket.io-client';

import { API_URL } from './client';
import type { SocketEventCorridaNova, SocketEventStatus, SocketEventTracking } from '../types';

/**
 * Eventos recebidos do servidor no namespace /rt (ver docs/api-contract.md).
 * `corrida:aceita` e `corrida:tracking` são consumidos pela empresa, mas o tipo
 * fica declarado aqui também para o client não quebrar caso o backend emita
 * updates gerais de status para o motoboy também.
 */
interface ServerToClientEvents {
  'corrida:nova': (payload: SocketEventCorridaNova) => void;
  'corrida:status': (payload: SocketEventStatus) => void;
  'corrida:tracking': (payload: SocketEventTracking) => void;
  'corrida:aceita': (payload: unknown) => void;
}

interface ClientToServerEvents {
  'join:motoboy': (payload: { motoboyId: string; lat: number; lng: number }) => void;
  'join:empresa': (payload: { empresaId: string }) => void;
}

export type LevvaSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: LevvaSocket | null = null;

/** Conecta (ou reaproveita) o socket autenticado no namespace /rt. */
export function connectSocket(accessToken: string): LevvaSocket {
  if (socket?.connected) return socket;

  if (!socket) {
    socket = io(`${API_URL}/rt`, {
      transports: ['websocket'],
      autoConnect: false,
      auth: { token: accessToken },
    });
  } else {
    socket.auth = { token: accessToken };
  }

  socket.connect();
  return socket;
}

export function getSocket(): LevvaSocket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function joinMotoboyRoom(motoboyId: string, lat: number, lng: number): void {
  socket?.emit('join:motoboy', { motoboyId, lat, lng });
}
