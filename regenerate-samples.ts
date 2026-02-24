/**
 * Script to regenerate all sample Lottie animations.
 * Run with: npx tsx regenerate-samples.ts
 */
import fs from 'fs';
import path from 'path';
import { generateLocal } from './src/pipeline/local-gen';
import { matchIcon } from './src/pipeline/icon-matcher';

const SAMPLES_DIR = path.resolve(__dirname, 'output/samples');

const SAMPLES: Array<{ icon: string; animation: string }> = [
  { icon: 'heart', animation: 'pulse' },
  { icon: 'heart', animation: 'bounce' },
  { icon: 'heart', animation: 'spin' },
  { icon: 'heart', animation: 'shake' },
  { icon: 'heart', animation: 'fade-in' },
  { icon: 'heart', animation: 'draw' },
  { icon: 'heart', animation: 'slide-in' },
  { icon: 'heart', animation: 'morph' },
  { icon: 'settings', animation: 'spin' },
  { icon: 'bell', animation: 'shake' },
  { icon: 'star', animation: 'bounce' },
  { icon: 'trash', animation: 'bounce' },
  { icon: 'home', animation: 'slide-in' },
  { icon: 'mail', animation: 'fade-in' },
  { icon: 'camera', animation: 'bounce' },
  { icon: 'cloud', animation: 'bounce' },
  { icon: 'clock', animation: 'bounce' },
  { icon: 'edit', animation: 'draw' },
  { icon: 'lock', animation: 'bounce' },
  { icon: 'music', animation: 'bounce' },
  { icon: 'search', animation: 'bounce' },
  { icon: 'user', animation: 'morph' },
  { icon: 'wifi', animation: 'bounce' },
  { icon: 'rocket', animation: 'slide-in' },
];

const OPTIONS = { size: 128, duration: 1, loop: true };

// Clear old sample files (except test-circle-bounce.json)
const existing = fs.readdirSync(SAMPLES_DIR);
for (const file of existing) {
  if (file.endsWith('.json') && file !== 'test-circle-bounce.json') {
    fs.unlinkSync(path.join(SAMPLES_DIR, file));
  }
}

let success = 0;
let failed = 0;

for (const sample of SAMPLES) {
  const icon = matchIcon(sample.icon);
  if (!icon) {
    console.error(`Icon not found: ${sample.icon}`);
    failed++;
    continue;
  }

  try {
    const lottie = generateLocal(icon.svg, sample.animation as any, OPTIONS);
    const filename = `${sample.icon}-${sample.animation}.json`;
    const filepath = path.join(SAMPLES_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(lottie, null, 2), 'utf-8');
    console.log(`OK: ${filename}`);
    success++;
  } catch (err: any) {
    console.error(`FAIL: ${sample.icon}-${sample.animation}: ${err.message}`);
    failed++;
  }
}

console.log(`\nDone: ${success} success, ${failed} failed`);
