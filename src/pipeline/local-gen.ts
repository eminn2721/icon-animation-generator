/**
 * Local (offline) Lottie generator for preset animations.
 * No API key needed — generates Lottie JSON programmatically.
 */

import { config } from '../config';
import { PresetAnimation, LottieJSON } from '../types';
import { svgToLottieShapes } from './svg-parser';

// Cubic bezier easing presets — [outX, outY, inX, inY]
// o = out-tangent (leaving current keyframe), i = in-tangent (arriving at next keyframe)
const EASE_IN_OUT = { ox: 0.42, oy: 0, ix: 0.58, iy: 1 };
const EASE_OUT    = { ox: 0,    oy: 0, ix: 0.58, iy: 1 };
const EASE_IN     = { ox: 0.42, oy: 0, ix: 1,    iy: 1 };
const LINEAR      = { ox: 0,    oy: 0, ix: 1,    iy: 1 };

interface AnimationOptions {
  size: number;
  duration: number;
  loop: boolean;
}

interface Easing {
  ox: number;
  oy: number;
  ix: number;
  iy: number;
}

function kf(t: number, s: number[], e?: number[], easing: Easing = EASE_IN_OUT): any {
  const frame: any = { t, s };
  if (e) {
    frame.e = e;
    const dim = s.length;
    // o = out tangent (leaving this keyframe) = first bezier control point
    // i = in tangent (arriving at next keyframe) = second bezier control point
    frame.o = { x: Array(dim).fill(easing.ox), y: Array(dim).fill(easing.oy) };
    frame.i = { x: Array(dim).fill(easing.ix), y: Array(dim).fill(easing.iy) };
  }
  return frame;
}

function buildBase(svg: string, opts: AnimationOptions, name: string): any {
  const fr = config.defaults.framerate;
  const totalFrames = Math.round(opts.duration * fr);
  const scale = (opts.size / 24) * 100; // Lucide icons are 24x24
  const shapes = svgToLottieShapes(svg);

  return {
    v: '5.7.1',
    fr,
    ip: 0,
    op: totalFrames,
    w: opts.size,
    h: opts.size,
    nm: name,
    ddd: 0,
    layers: [
      {
        ddd: 0,
        ty: 4, // shape layer
        nm: 'Icon Layer',
        ind: 0,
        ip: 0,
        op: totalFrames,
        st: 0,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [opts.size / 2, opts.size / 2] },
          a: { a: 0, k: [12, 12] }, // Lucide viewBox center
          s: { a: 0, k: [scale, scale] },
        },
        shapes,
      },
    ],
  };
}

// --- Preset animation generators ---

function bounce(svg: string, opts: AnimationOptions): LottieJSON {
  const lottie = buildBase(svg, opts, 'bounce');
  const total = Math.round(opts.duration * config.defaults.framerate);
  const mid = Math.round(total * 0.4);
  const center = opts.size / 2;
  const offset = opts.size * 0.15;

  lottie.layers[0]!.ks.p = {
    a: 1,
    k: [
      kf(0, [center, center], [center, center - offset], EASE_OUT),
      kf(mid, [center, center - offset], [center, center], EASE_IN),
      kf(total, [center, center]),
    ],
  };
  return lottie;
}

function spin(svg: string, opts: AnimationOptions): LottieJSON {
  const lottie = buildBase(svg, opts, 'spin');
  const total = Math.round(opts.duration * config.defaults.framerate);

  lottie.layers[0]!.ks.r = {
    a: 1,
    k: [
      kf(0, [0], [360], LINEAR),
      kf(total, [360]),
    ],
  };
  return lottie;
}

function pulse(svg: string, opts: AnimationOptions): LottieJSON {
  const lottie = buildBase(svg, opts, 'pulse');
  const total = Math.round(opts.duration * config.defaults.framerate);
  const mid = Math.round(total * 0.5);
  const scale = (opts.size / 24) * 100;
  const big = scale * 1.2;

  lottie.layers[0]!.ks.s = {
    a: 1,
    k: [
      kf(0, [scale, scale], [big, big], EASE_IN_OUT),
      kf(mid, [big, big], [scale, scale], EASE_IN_OUT),
      kf(total, [scale, scale]),
    ],
  };
  return lottie;
}

function shake(svg: string, opts: AnimationOptions): LottieJSON {
  const lottie = buildBase(svg, opts, 'shake');
  const total = Math.round(opts.duration * config.defaults.framerate);
  const center = opts.size / 2;
  const offset = opts.size * 0.06;
  const steps = 6;
  const stepFrames = Math.round(total / steps);

  const keyframes: any[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = Math.min(i * stepFrames, total);
    const dir = i % 2 === 0 ? 0 : (i % 4 === 1 ? offset : -offset);
    const next = i < steps
      ? (((i + 1) % 2 === 0) ? 0 : ((i + 1) % 4 === 1 ? offset : -offset))
      : 0;
    keyframes.push(kf(t, [center + dir, center], i < steps ? [center + next, center] : undefined, LINEAR));
  }

  lottie.layers[0]!.ks.p = { a: 1, k: keyframes };
  return lottie;
}

function fadeIn(svg: string, opts: AnimationOptions): LottieJSON {
  const lottie = buildBase(svg, opts, 'fade-in');
  const total = Math.round(opts.duration * config.defaults.framerate);

  lottie.layers[0]!.ks.o = {
    a: 1,
    k: [
      kf(0, [0], [100], EASE_IN_OUT),
      kf(total, [100]),
    ],
  };
  return lottie;
}

function draw(svg: string, opts: AnimationOptions): LottieJSON {
  const lottie = buildBase(svg, opts, 'draw');
  const total = Math.round(opts.duration * config.defaults.framerate);

  // Add trim paths to simulate drawing
  const layer = lottie.layers[0]!;
  if (layer.shapes) {
    layer.shapes.push({
      ty: 'tm', // trim paths
      nm: 'Trim Paths',
      s: { a: 0, k: 0 },  // start: 0%
      e: {
        a: 1,
        k: [
          kf(0, [0], [100], EASE_IN_OUT),
          kf(total, [100]),
        ],
      },
      o: { a: 0, k: 0 },  // offset
      m: 1, // simultaneously
    });
  }
  return lottie;
}

function slideIn(svg: string, opts: AnimationOptions): LottieJSON {
  const lottie = buildBase(svg, opts, 'slide-in');
  const total = Math.round(opts.duration * config.defaults.framerate);
  const center = opts.size / 2;

  lottie.layers[0]!.ks.p = {
    a: 1,
    k: [
      kf(0, [-opts.size * 0.5, center], [center, center], EASE_OUT),
      kf(total, [center, center]),
    ],
  };
  return lottie;
}

function morph(svg: string, opts: AnimationOptions): LottieJSON {
  // Morph: subtle scale + rotation wiggle
  const lottie = buildBase(svg, opts, 'morph');
  const total = Math.round(opts.duration * config.defaults.framerate);
  const q1 = Math.round(total * 0.25);
  const q2 = Math.round(total * 0.5);
  const q3 = Math.round(total * 0.75);
  const scale = (opts.size / 24) * 100;

  lottie.layers[0]!.ks.s = {
    a: 1,
    k: [
      kf(0, [scale, scale], [scale * 1.08, scale * 0.95], EASE_IN_OUT),
      kf(q1, [scale * 1.08, scale * 0.95], [scale * 0.95, scale * 1.08], EASE_IN_OUT),
      kf(q2, [scale * 0.95, scale * 1.08], [scale * 1.04, scale * 0.97], EASE_IN_OUT),
      kf(q3, [scale * 1.04, scale * 0.97], [scale, scale], EASE_IN_OUT),
      kf(total, [scale, scale]),
    ],
  };
  lottie.layers[0]!.ks.r = {
    a: 1,
    k: [
      kf(0, [0], [3], EASE_IN_OUT),
      kf(q1, [3], [-3], EASE_IN_OUT),
      kf(q2, [-3], [2], EASE_IN_OUT),
      kf(q3, [2], [0], EASE_IN_OUT),
      kf(total, [0]),
    ],
  };
  return lottie;
}

function shine(svg: string, opts: AnimationOptions): LottieJSON {
  const lottie = buildBase(svg, opts, 'shine');
  const total = Math.round(opts.duration * config.defaults.framerate);
  // Delay before shine starts (20% of duration)
  const delayFrame = Math.round(total * 0.2);
  // Shine sweep takes 60% of duration
  const sweepEnd = Math.round(total * 0.8);

  // Create a diagonal white band that sweeps left → right across the icon
  // Icon is 24x24 in Lucide coordinate space
  const shineGroup = {
    ty: 'gr',
    nm: 'Shine Band',
    it: [
      // Tall thin rectangle — taller than icon so diagonal rotation still covers
      {
        ty: 'rc',
        nm: 'Band',
        p: { a: 0, k: [0, 0] },
        s: { a: 0, k: [3, 40] },
        r: { a: 0, k: 0 },
      },
      // White fill
      {
        ty: 'fl',
        nm: 'Shine Fill',
        c: { a: 0, k: [1, 1, 1, 1] },
        o: { a: 0, k: 100 },
        r: 1,
      },
      // Transform: rotated 25deg, animated position sweep, opacity fade in/out
      {
        ty: 'tr',
        nm: 'Transform',
        p: {
          a: 1,
          k: [
            kf(0, [-16, 12], [-16, 12], LINEAR),          // hold off-screen left
            kf(delayFrame, [-16, 12], [28, 12], EASE_OUT), // sweep to right
            kf(sweepEnd, [28, 12], [28, 12], LINEAR),      // arrive off-screen right
            kf(total, [28, 12]),                            // hold
          ],
        },
        a: { a: 0, k: [0, 0] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 25 }, // diagonal tilt
        o: {
          a: 1,
          k: [
            kf(0, [0], [0], LINEAR),                       // invisible during delay
            kf(delayFrame, [0], [70], EASE_IN),             // fade in at sweep start
            kf(Math.round((delayFrame + sweepEnd) / 2), [70], [70], LINEAR), // hold bright
            kf(sweepEnd, [70], [0], EASE_OUT),              // fade out at sweep end
            kf(total, [0]),
          ],
        },
      },
    ],
  };

  // Add a second thinner band for a richer look
  const shineGroup2 = {
    ty: 'gr',
    nm: 'Shine Band 2',
    it: [
      {
        ty: 'rc',
        nm: 'Band',
        p: { a: 0, k: [0, 0] },
        s: { a: 0, k: [1.5, 40] },
        r: { a: 0, k: 0 },
      },
      {
        ty: 'fl',
        nm: 'Shine Fill',
        c: { a: 0, k: [1, 1, 1, 1] },
        o: { a: 0, k: 100 },
        r: 1,
      },
      {
        ty: 'tr',
        nm: 'Transform',
        p: {
          a: 1,
          k: [
            kf(0, [-12, 12], [-12, 12], LINEAR),
            kf(delayFrame, [-12, 12], [32, 12], EASE_OUT),
            kf(sweepEnd, [32, 12], [32, 12], LINEAR),
            kf(total, [32, 12]),
          ],
        },
        a: { a: 0, k: [0, 0] },
        s: { a: 0, k: [100, 100] },
        r: { a: 0, k: 25 },
        o: {
          a: 1,
          k: [
            kf(0, [0], [0], LINEAR),
            kf(delayFrame, [0], [40], EASE_IN),
            kf(Math.round((delayFrame + sweepEnd) / 2), [40], [40], LINEAR),
            kf(sweepEnd, [40], [0], EASE_OUT),
            kf(total, [0]),
          ],
        },
      },
    ],
  };

  // Insert shine bands at the start of shapes array (renders on top)
  lottie.layers[0]!.shapes.unshift(shineGroup2, shineGroup);

  return lottie;
}

const GENERATORS: Record<PresetAnimation, (svg: string, opts: AnimationOptions) => LottieJSON> = {
  bounce,
  spin,
  pulse,
  shake,
  'fade-in': fadeIn,
  draw,
  'slide-in': slideIn,
  morph,
  shine,
};

/**
 * Generate Lottie animation locally for a preset type. No API key needed.
 */
export function generateLocal(
  svg: string,
  preset: PresetAnimation,
  options: AnimationOptions
): LottieJSON {
  const gen = GENERATORS[preset];
  return gen(svg, options);
}
