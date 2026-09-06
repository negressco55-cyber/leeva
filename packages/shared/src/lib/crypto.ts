/**
 * Helpers de cripto usando Web Crypto (funciona no Node 20+ e no Edge).
 * Sem dependências. Usado para validar assinaturas de webhook e gerar tokens.
 */

const enc = new TextEncoder();

export async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparação em tempo (quase) constante de dois hex. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  const x = a.toLowerCase().replace(/^sha256=/, '');
  const y = b.toLowerCase().replace(/^sha256=/, '');
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

/** Token aleatório url-safe (hex). */
export function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ===========================================================================
// Criptografia simétrica de segredos (refresh token, etc.) guardados em
// colunas que o dono do restaurante pode SELECT via RLS (ex: integrations.config).
// A chave nunca sai do servidor — sem ela, o valor cifrado é inútil mesmo se
// a linha vazar. AES-GCM via Web Crypto, sem dependência.
// ===========================================================================

async function secretAesKey(): Promise<CryptoKey> {
  const secret = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!secret) throw new Error('INTEGRATIONS_ENCRYPTION_KEY não configurada');
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

// btoa/atob (não Buffer) — disponíveis tanto no Node quanto no Edge runtime.
function toB64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Cifra um texto (ex: refresh token). Formato: "<iv base64>.<ciphertext base64>". */
export async function encryptSecret(plain: string): Promise<string> {
  const key = await secretAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain));
  return `${toB64(iv)}.${toB64(new Uint8Array(ct))}`;
}

/** Decifra um valor gerado por `encryptSecret`. */
export async function decryptSecret(payload: string): Promise<string> {
  const [ivB64, ctB64] = payload.split('.');
  if (!ivB64 || !ctB64) throw new Error('formato de segredo cifrado inválido');
  const key = await secretAesKey();
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(ivB64) }, key, fromB64(ctB64));
  return new TextDecoder().decode(pt);
}
