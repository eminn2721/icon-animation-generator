import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { LottieJSON } from '../types';

/**
 * Validates and post-processes the Claude-generated Lottie JSON.
 * Ensures required fields exist and values are within expected ranges.
 */
export function validateAndFix(lottie: any, options: { size: number; duration: number; loop: boolean }): LottieJSON {
  const framerate = config.defaults.framerate;
  const totalFrames = Math.round(options.duration * framerate);

  // Ensure top-level required fields
  lottie.v = lottie.v || '5.7.1';
  lottie.fr = lottie.fr || framerate;
  lottie.ip = lottie.ip ?? 0;
  lottie.op = lottie.op || totalFrames;
  lottie.w = lottie.w || options.size;
  lottie.h = lottie.h || options.size;
  lottie.nm = lottie.nm || 'animated-icon';

  if (!Array.isArray(lottie.layers)) {
    lottie.layers = [];
  }

  // Ensure each layer has required timing
  for (const layer of lottie.layers) {
    layer.ip = layer.ip ?? 0;
    layer.op = layer.op ?? totalFrames;
    layer.st = layer.st ?? 0;
    if (!layer.ks) {
      layer.ks = {};
    }
  }

  return lottie as LottieJSON;
}

/**
 * Saves Lottie JSON to output directory and returns the file path.
 */
export function saveLottie(lottie: LottieJSON, keyword: string, animationType: string): string {
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }

  const sanitized = keyword.replace(/[^a-z0-9-]/gi, '_').toLowerCase();
  const animSanitized = animationType.replace(/[^a-z0-9-]/gi, '_').toLowerCase();
  const timestamp = Date.now();
  const filename = `${sanitized}-${animSanitized}-${timestamp}.json`;
  const filepath = path.join(config.outputDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(lottie, null, 2), 'utf-8');

  return filename;
}
