/**
 * Tipos do domínio Levva, adaptados de packages/shared/src/types.ts
 * (o app mobile não está no workspace npm do monorepo, então os tipos
 * são copiados aqui em vez de importados do pacote @levva/shared).
 */

export type UserRole = 'EMPRESA' | 'MOTOBOY' | 'ADMIN';

export type StatusAprovacaoMotoboy = 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'BLOQUEADO';

export type StatusCorrida =
  | 'SOLICITADA'
  | 'PROCURANDO_MOTOBOY'
  | 'ACEITA'
  | 'A_CAMINHO_COLETA'
  | 'COLETADO'
  | 'A_CAMINHO_ENTREGA'
  | 'ENTREGUE'
  | 'CANCELADA';

/** Sequência de transições que o motoboy pode disparar via PATCH /corridas/:id/status */
export const SEQUENCIA_STATUS_MOTOBOY: StatusCorrida[] = [
  'ACEITA',
  'A_CAMINHO_COLETA',
  'COLETADO',
  'A_CAMINHO_ENTREGA',
  'ENTREGUE',
];

export interface User {
  id: string;
  email: string;
  telefone: string;
  role: UserRole;
}

export interface Motoboy {
  id: string;
  nomeCompleto: string;
  cpf: string;
  cnh: string;
  placaVeiculo: string;
  fotoPerfilUrl?: string | null;
  statusAprovacao: StatusAprovacaoMotoboy;
  disponivel: boolean;
  notaMedia: number;
  totalCorridas: number;
}

export interface Corrida {
  id: string;
  empresaId: string;
  motoboyId?: string | null;
  status: StatusCorrida;
  enderecoColeta: string;
  latColeta: number;
  lngColeta: number;
  enderecoEntrega: string;
  latEntrega: number;
  lngEntrega: number;
  nomeDestinatario?: string | null;
  telefoneDestinatario?: string | null;
  observacoes?: string | null;
  distanciaKm?: number | null;
  // Rota real (seguindo rua), calculada via OSRM na criação da corrida —
  // array de pontos [lat, lng] no formato que o Leaflet espera. Null em
  // corridas antigas ou quando o OSRM estava fora do ar na criação
  // (mapa embutido cai no fallback de linha reta entre coleta e entrega).
  rotaGeometria?: Array<[number, number]> | null;
  valorCorrida: string;
  criadoEm: string;
  aceitaEm?: string | null;
  coletadoEm?: string | null;
  entregueEm?: string | null;
  empresa?: {
    nomeFantasia: string;
  } | null;
}

/** Payload resumido do evento socket `corrida:nova` (motoboys disponíveis na região) */
export interface SocketEventCorridaNova {
  corridaId: string;
  enderecoColeta: string;
  enderecoEntrega: string;
  valorCorrida: string;
  distanciaKm: number;
  latColeta: number;
  lngColeta: number;
}

/** Payload do evento socket `corrida:tracking` (posição do motoboy, consumido pela empresa) */
export interface SocketEventTracking {
  corridaId: string;
  lat: number;
  lng: number;
}

/** Payload do evento socket `corrida:status` (mudança de status, consumido pela empresa) */
export interface SocketEventStatus {
  corridaId: string;
  status: StatusCorrida;
}

// ---- Requests/responses de auth e perfis ----

export interface LoginRequest {
  email: string;
  senha: string;
}

export interface RegisterMotoboyRequest {
  email: string;
  senha: string;
  telefone: string;
  nomeCompleto: string;
  cpf: string;
  cnh: string;
  placaVeiculo: string;
}

export interface AuthResponse {
  user: User;
  motoboy?: Motoboy;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
}

export interface MotoboyMeResponse extends Motoboy {}

// Bate com o formato real devolvido por historicoCorridasMotoboy em
// corrida.service.ts (backend) — items/ganhosTotais, não corridas/totalGanho.
export interface HistoricoCorridasResponse {
  items: Corrida[];
  page: number;
  pageSize: number;
  total: number;
  ganhosTotais: string;
}

export interface CorridasDisponiveisResponse {
  corridas: Corrida[];
}
