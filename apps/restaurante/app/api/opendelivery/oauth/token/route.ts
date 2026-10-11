import { adminDb } from '@/lib/context';
import { json, tooManyRequests } from '@/lib/api';
import { resolveApiKey, checkRateLimit, clientIp } from '@leeva/shared/services';

/**
 * Open Delivery — token OAuth2 (client_credentials).
 * POST /api/opendelivery/oauth/token
 *   grant_type=client_credentials & client_id=<qualquer> & client_secret=<chave do Leeva>
 * Aceita form-urlencoded, JSON ou Basic auth.
 */
export async function POST(req: Request) {
  const db = adminDb();
  const rl = await checkRateLimit(db, 'auth', `od:${clientIp(req)}`);
  if (!rl.allowed) return tooManyRequests(rl.retryAfter);

  let p: Record<string, string> = {};
  const raw = await req.text();
  try {
    p = raw.trim().startsWith('{') ? (JSON.parse(raw) as Record<string, string>) : Object.fromEntries(new URLSearchParams(raw));
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }
  let secret = p.client_secret ?? '';
  const basic = req.headers.get('authorization');
  if (!secret && basic?.startsWith('Basic ')) {
    try {
      secret = atob(basic.slice(6)).split(':').slice(1).join(':');
    } catch {
      /* ignora */
    }
  }
  if ((p.grant_type ?? 'client_credentials') !== 'client_credentials') return json({ error: 'unsupported_grant_type' }, 400);
  if (!secret || !(await resolveApiKey(db, secret))) return json({ error: 'invalid_client' }, 401);

  return json({ access_token: secret, token_type: 'Bearer', expires_in: 86400 });
}
