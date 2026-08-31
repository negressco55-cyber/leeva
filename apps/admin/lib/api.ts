import { NextResponse } from 'next/server';

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const unauthorized = () => json({ error: 'não autorizado' }, 401);
export const badRequest = (msg: string) => json({ error: msg }, 400);
export const notFound = (msg = 'não encontrado') => json({ error: msg }, 404);
export const UUID = /^[0-9a-f-]{36}$/i;

export const serverError = (detail?: unknown) => {
  if (detail) console.error('[admin-api] 500:', detail instanceof Error ? detail.message : detail);
  return json({ error: 'erro interno — tente novamente' }, 500);
};
export const businessError = (msg: string) => json({ error: msg }, 422);
