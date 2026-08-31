export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const unauthorized = () => json({ error: 'não autenticado' }, 401);
export const forbidden = (msg = 'sem permissão') => json({ error: msg }, 403);
export const badRequest = (msg: string) => json({ error: msg }, 400);
export const businessError = (msg: string) => json({ error: msg }, 422);

export const serverError = (detail?: unknown) => {
  if (detail) console.error('[api/motoboy] 500:', detail instanceof Error ? detail.message : detail);
  return json({ error: 'erro interno — tente novamente' }, 500);
};

export const UUID = /^[0-9a-f-]{36}$/i;
