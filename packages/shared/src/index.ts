// Ponto de entrada do pacote compartilhado @leeva/shared.
//
// Aqui só exportamos o que é seguro em qualquer ambiente (tipos, constantes,
// utilitários puros). Os clientes Supabase têm subpaths próprios porque
// dependem do ambiente:
//
//   import { createLeevaBrowserClient } from '@leeva/shared/client';   // navegador
//   import { createLeevaServerClient }  from '@leeva/shared/server';   // servidor Next
//   import { updateLeevaSession }       from '@leeva/shared/middleware';
//   import { useRealtimeOrders }        from '@leeva/shared/hooks';

export * from './types/index';
export * from './constants';
export * from './utils/index';
export { isSupabaseConfigured, isSupabaseAdminConfigured, authCookieName } from './supabase/config';

// Serviços e integrações também têm subpaths dedicados
// (@leeva/shared/services, @leeva/shared/integrations) mas re-exportamos
// os tipos/os helpers puros daqui por conveniência.
export type {
  NormalizedOrder,
  NormalizedItem,
  OrderProvider,
  ProviderResult,
} from './integrations/types';
