// Gera assets/sounds/offer.wav — bipe de duas notas (880Hz, 1180Hz), o mesmo
// desenho de som usado na versão web (OffersPanel.tsx), sem depender de
// nenhum arquivo de áudio de terceiros/licenciado.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SAMPLE_RATE = 44100;
const notes = [
  { freq: 880, start: 0, dur: 0.16 },
  { freq: 1180, start: 0.16, dur: 0.16 },
];
const totalDur = 0.34;
const numSamples = Math.ceil(totalDur * SAMPLE_RATE);
const samples = new Int16Array(numSamples);

for (const { freq, start, dur } of notes) {
  const startSample = Math.floor(start * SAMPLE_RATE);
  const durSamples = Math.floor(dur * SAMPLE_RATE);
  for (let i = 0; i < durSamples; i++) {
    const t = i / SAMPLE_RATE;
    // envelope: ataque rápido, decaimento exponencial (mesmo formato do bipe web)
    const attack = Math.min(1, t / 0.02);
    const decay = Math.exp(-t * 18);
    const amp = 0.5 * attack * decay;
    const v = Math.sin(2 * Math.PI * freq * t) * amp;
    const idx = startSample + i;
    if (idx < numSamples) {
      samples[idx] = Math.max(-32767, Math.min(32767, Math.round(v * 32767)));
    }
  }
}

function buildWav(samples, sampleRate) {
  const blockAlign = 2; // 16-bit mono
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(samples[i], 44 + i * 2);
  }
  return buf;
}

const wav = buildWav(samples, SAMPLE_RATE);
const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds', 'offer.wav');
writeFileSync(outPath, wav);
console.log('gerado:', outPath, `(${wav.length} bytes)`);
