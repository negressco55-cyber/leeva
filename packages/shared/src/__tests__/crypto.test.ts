import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptSecret, decryptSecret, hmacSha256Hex, timingSafeEqualHex, sha256Hex } from '../lib/crypto';

process.env.INTEGRATIONS_ENCRYPTION_KEY ??= 'teste-chave-nao-usar-em-producao';

test('encryptSecret/decryptSecret: round-trip', async () => {
  const plain = 'refresh-token-super-secreto-do-ifood';
  const enc = await encryptSecret(plain);
  assert.notEqual(enc, plain);
  assert.match(enc, /^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);
  const dec = await decryptSecret(enc);
  assert.equal(dec, plain);
});

test('encryptSecret: duas chamadas com o mesmo texto dão ciphertexts diferentes (IV aleatório)', async () => {
  const a = await encryptSecret('mesmo texto');
  const b = await encryptSecret('mesmo texto');
  assert.notEqual(a, b);
});

test('decryptSecret: formato inválido lança erro', async () => {
  await assert.rejects(() => decryptSecret('sem-ponto-no-meio'));
});

test('sha256Hex/hmacSha256Hex: determinístico', async () => {
  const h1 = await sha256Hex('abc');
  const h2 = await sha256Hex('abc');
  assert.equal(h1, h2);
  const sig = await hmacSha256Hex('segredo', 'corpo');
  assert.ok(timingSafeEqualHex(sig, sig));
  assert.ok(!timingSafeEqualHex(sig, 'a'.repeat(sig.length)));
});
