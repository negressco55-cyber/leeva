/**
 * Chamadas às rotas /api do painel do motoboy (Next.js) usando o access
 * token do Supabase como Bearer. O backend valida via getMotoboyContextFromReq.
 */
import { API_URL, supabase } from '../lib/supabase';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { ...(await authHeader()) },
  });
  return handle<T>(res);
}

export async function apiSend<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(await authHeader()),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  return handle<T>(res);
}

async function handle<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* resposta não-JSON */
  }
  if (!res.ok) {
    const msg =
      (json as { error?: string } | null)?.error ??
      (res.status === 401 ? 'Sessão expirada. Entre de novo.' : 'Erro na comunicação com o servidor.');
    throw new ApiError(msg, res.status);
  }
  return json as T;
}
